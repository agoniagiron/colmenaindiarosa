import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { EstadoPago } from '@prisma/client';
import { construirMensajeWhatsapp } from '../../dominio/construirMensajeWhatsapp.js';
import { describirItemPedido, SELECT_DESCRIPCION_ITEM } from '../../lib/lineaPedido.js';
import { prisma } from '../../lib/prisma.js';
import { servicioNotificacionTienda } from '../../lib/notificacionTienda.js';
import { obtenerUnidadesPorVariante } from '../../lib/unidadesPedido.js';
import { validarFirmaWebhook } from '../../lib/wompi/validarFirmaWebhook.js';
import type { EventoWebhookWompi } from '../../lib/wompi/validarFirmaWebhook.js';
import { esquemaEventoWompi } from './esquemas.js';

const ESTADOS_APROBADOS = 'APPROVED';
const ESTADOS_RECHAZADOS = new Set(['DECLINED', 'VOIDED', 'ERROR']);

const MAPA_ESTADO_PAGO: Record<string, EstadoPago> = {
  DECLINED: 'rechazado',
  VOIDED: 'expirado',
  ERROR: 'rechazado',
};

function leerRuta(objeto: unknown, ruta: string[]): unknown {
  return ruta.reduce<unknown>((actual, clave) => {
    if (actual && typeof actual === 'object' && clave in actual) {
      return (actual as Record<string, unknown>)[clave];
    }
    return undefined;
  }, objeto);
}

function leerTexto(objeto: unknown, ruta: string[]): string | undefined {
  const valor = leerRuta(objeto, ruta);
  return typeof valor === 'string' ? valor : undefined;
}

function leerNumero(objeto: unknown, ruta: string[]): number | undefined {
  const valor = leerRuta(objeto, ruta);
  return typeof valor === 'number' ? valor : undefined;
}

// Otro envío del mismo evento lo está procesando ahora (o quedó colgado hace
// menos de TIEMPO_ABANDONO_MS). El controlador responde 503: si el otro
// termina bien, el próximo reintento de Wompi lo ve procesado; si murió a
// mitad de camino, el reintento lo retoma.
export class ErrorEventoEnProceso extends Error {
  constructor() {
    super('El evento ya se está procesando');
  }
}

// Un evento registrado y sin procesado_en durante más que esto se da por
// abandonado (el proceso murió sin llegar a guardar el error) y se puede
// retomar. Muy por encima de lo que tarda un procesamiento normal.
const TIEMPO_ABANDONO_MS = 2 * 60 * 1000;

// Un evento que ya estaba registrado: si se procesó, no hay nada que hacer
// (null). Si falló (error_proceso) o quedó abandonado, lo retoma ESTE envío
// y solo este: el UPDATE condicional lo gana uno solo aunque lleguen dos a
// la vez. recibido_en pasa a ser el momento del último intento.
async function retomarEventoPendiente(idEventoExterno: string): Promise<{ id: string } | null> {
  const existente = await prisma.eventoPasarela.findUnique({
    where: { idEventoExterno },
    select: { id: true, procesadoEn: true },
  });
  if (!existente || existente.procesadoEn) return null;

  const { count } = await prisma.eventoPasarela.updateMany({
    where: {
      id: existente.id,
      procesadoEn: null,
      OR: [
        { errorProceso: { not: null } },
        { recibidoEn: { lt: new Date(Date.now() - TIEMPO_ABANDONO_MS) } },
      ],
    },
    data: { errorProceso: null, recibidoEn: new Date() },
  });
  if (count === 0) throw new ErrorEventoEnProceso();
  return { id: existente.id };
}

// Procesa un webhook de Wompi. Si termina sin lanzar, el controlador
// responde 200, también cuando no hay nada que hacer (cuerpo irreconocible,
// firma inválida, referencia desconocida): reintentar no ayuda en esos
// casos. Si el procesamiento FALLA, el error queda en
// evento_pasarela.error_proceso y esta función lanza: el controlador
// responde 500, Wompi reintenta y el reintento retoma el evento
// (retomarEventoPendiente). Un pago aprobado nunca queda registrado y sin
// procesar para siempre.
export async function procesarWebhook(cuerpoCrudo: unknown): Promise<void> {
  const parseo = esquemaEventoWompi.safeParse(cuerpoCrudo);
  if (!parseo.success) return;

  const evento = parseo.data;
  const transaccion = evento.data.transaction;
  const idTransaccion = leerTexto(transaccion, ['id']);
  const estadoTransaccion = leerTexto(transaccion, ['status']);

  const firmaValida = validarFirmaWebhook(evento as EventoWebhookWompi);

  if (!firmaValida) {
    // Se registra para auditoría (con un id propio: no debe competir por el
    // mismo id_evento_externo que usaría un evento legítimo) pero no se
    // procesa nada más.
    await prisma.eventoPasarela.create({
      data: {
        pasarela: 'wompi',
        idEventoExterno: `firma-invalida:${idTransaccion ?? 'sin-id'}:${randomUUID()}`,
        tipo: evento.event,
        cuerpo: evento as Prisma.InputJsonValue,
        firmaValida: false,
      },
    });
    return;
  }

  if (!idTransaccion || !estadoTransaccion) return;

  // Idempotencia: id_evento_externo es único. Wompi puede reenviar el mismo
  // evento (mismo id + mismo estado); una transición real (p. ej. PENDING
  // luego APPROVED) tiene un id_evento_externo distinto porque cambia el
  // estado, así que sí se procesa.
  const idEventoExterno = `${idTransaccion}:${estadoTransaccion}`;

  let registro: { id: string };
  try {
    registro = await prisma.eventoPasarela.create({
      data: {
        pasarela: 'wompi',
        idEventoExterno,
        tipo: evento.event,
        cuerpo: evento as Prisma.InputJsonValue,
        firmaValida: true,
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Ya se había insertado (reenvío de Wompi, o llegada casi simultánea).
      // Si quedó sin procesar porque falló o se colgó, se retoma acá.
      const retomado = await retomarEventoPendiente(idEventoExterno);
      if (!retomado) return;
      registro = retomado;
    } else {
      throw error;
    }
  }

  try {
    await procesarEventoRegistrado(transaccion, estadoTransaccion);
  } catch (error) {
    // Queda el motivo y el evento sin procesado_en: el reintento de Wompi
    // (que llega porque el controlador responde 500) lo retoma.
    await prisma.eventoPasarela
      .update({
        where: { id: registro.id },
        data: { errorProceso: error instanceof Error ? error.message : String(error) },
      })
      .catch(() => {
        // Si ni esto se puede guardar (base caída), el evento queda sin
        // error y sin procesar: se retoma por abandono.
      });
    throw error;
  }

  // procesado_en también cuando no había nada que hacer (referencia o pago
  // desconocidos): el evento ya se decidió y no se vuelve a retomar.
  await prisma.eventoPasarela.update({
    where: { id: registro.id },
    data: { procesadoEn: new Date() },
  });
}

async function procesarEventoRegistrado(
  transaccion: unknown,
  estadoTransaccion: string,
): Promise<void> {
  const referencia = leerTexto(transaccion, ['reference']);
  if (!referencia) return;

  const pago = await prisma.pago.findUnique({
    where: { referenciaInterna: referencia },
    select: { id: true, pedidoId: true, estado: true },
  });
  if (!pago) return;

  if (estadoTransaccion === ESTADOS_APROBADOS) {
    await procesarAprobado(pago, transaccion);
  } else if (ESTADOS_RECHAZADOS.has(estadoTransaccion)) {
    await procesarRechazado(pago, transaccion, estadoTransaccion);
  }
}

type ResultadoProcesarAprobado =
  | { tipo: 'ninguna' }
  | { tipo: 'pagado' }
  | { tipo: 'conflicto'; numeroPedido: string; estadoPago: string; estadoPedido: string };

async function procesarAprobado(
  pago: { id: string; pedidoId: string; estado: string },
  transaccion: unknown,
): Promise<void> {
  // Idempotencia a nivel de negocio, además de la del evento: si por algún
  // motivo se llega hasta acá dos veces para el mismo pago, no se descuenta
  // stock ni se notifica a la tienda una segunda vez. Esta es la ÚNICA
  // salida temprana antes de la lista blanca de abajo: un reenvío normal
  // de Wompi sobre un pago ya aprobado no tiene que generar una alerta
  // falsa.
  if (pago.estado === 'aprobado') return;

  const idPedidoParaNotificar = pago.pedidoId;

  const resultado: ResultadoProcesarAprobado = await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pago.pedidoId },
      select: { id: true, numero: true, estado: true, usuarioId: true, cuponId: true },
    });
    if (!pedido) return { tipo: 'ninguna' };

    // Lista blanca, no lista negra: el camino feliz corre SOLO si los dos
    // están exactamente donde deberían estar para un pago que se está
    // confirmando por primera vez. Cualquier otra combinación — pago
    // 'expirado' o 'rechazado', pedido 'cancelado' o 'pagoRechazado', lo
    // que sea — es una carrera entre Wompi y lo que ya pasó acá adentro
    // (tareaReservas venciendo la reserva, un admin cancelando a mano,
    // etc.) y nunca se resuelve sola: para entonces el inventario ya pudo
    // liberarse o venderse a otra persona. Esto también cubre, sin
    // enumerarlo a mano, cualquier estado nuevo que se agregue al enum
    // más adelante.
    const esCaminoFeliz = pago.estado === 'iniciado' && pedido.estado === 'esperandoPago';

    if (!esCaminoFeliz) {
      await tx.pago.update({
        where: { id: pago.id },
        data: {
          estado: 'requiereRevision',
          referenciaExterna: leerTexto(transaccion, ['id']),
          mensajeError: `Wompi aprobó el pago, pero al llegar la confirmación el pago estaba en "${pago.estado}" y el pedido en "${pedido.estado}" (se esperaba "iniciado" y "esperandoPago"). Revisar manualmente.`,
          aprobadoEn: new Date(),
        },
      });

      // No es una transición real de pedido.estado (a propósito no se
      // toca: queda como estaba), pero necesita quedar en el historial
      // igual que cualquier otro evento relevante del pedido.
      await tx.pedidoHistorial.create({
        data: {
          pedidoId: pedido.id,
          estadoAnterior: pedido.estado,
          estadoNuevo: pedido.estado,
          nota: `Wompi aprobó el pago con el pago en "${pago.estado}" y el pedido en "${pedido.estado}". Requiere revisión manual: decidir si se reactiva el pedido o se devuelve el dinero.`,
        },
      });

      return {
        tipo: 'conflicto',
        numeroPedido: pedido.numero,
        estadoPago: pago.estado,
        estadoPedido: pedido.estado,
      };
    }

    // Condicional: si otro procesamiento del mismo pago ya lo aprobó (un
    // evento retomado mientras corría el original), este no encuentra el
    // pago en 'iniciado' y no descuenta stock otra vez. El UPDATE toma el
    // lock de la fila, así que de dos a la vez gana uno solo.
    const { count: aprobados } = await tx.pago.updateMany({
      where: { id: pago.id, estado: 'iniciado' },
      data: {
        estado: 'aprobado',
        referenciaExterna: leerTexto(transaccion, ['id']),
        ultimosCuatro: leerTexto(transaccion, ['payment_method', 'extra', 'last_four']),
        franquicia: leerTexto(transaccion, ['payment_method', 'extra', 'brand']),
        bancoPse:
          leerTexto(transaccion, ['payment_method', 'extra', 'financial_institution_name']) ??
          leerTexto(transaccion, ['payment_method', 'extra', 'financial_institution_code']),
        cuotas: leerNumero(transaccion, ['payment_method', 'extra', 'installments']),
        aprobadoEn: new Date(),
      },
    });
    if (aprobados === 0) return { tipo: 'ninguna' };

    await tx.pedido.update({
      where: { id: pedido.id },
      data: { estado: 'pagado', pagadoEn: new Date() },
    });

    const unidades = await obtenerUnidadesPorVariante(tx, pedido.id);

    for (const unidad of unidades) {
      const varianteActualizada = await tx.varianteProducto.update({
        where: { id: unidad.varianteId },
        data: {
          stockActual: { decrement: unidad.cantidad },
          stockReservado: { decrement: unidad.cantidad },
        },
        select: { stockActual: true },
      });

      await tx.movimientoInventario.create({
        data: {
          varianteId: unidad.varianteId,
          tipo: 'salida',
          cantidad: unidad.cantidad,
          stockResultante: varianteActualizada.stockActual,
          referenciaTipo: 'pedido',
          referenciaId: pedido.id,
          motivo: `Pedido ${pedido.numero} pagado`,
        },
      });

      await tx.reservaStock.updateMany({
        where: { pedidoId: pedido.id, varianteId: unidad.varianteId, liberadaEn: null },
        data: { liberadaEn: new Date() },
      });
    }

    if (pedido.cuponId) {
      await tx.cupon.update({
        where: { id: pedido.cuponId },
        data: { usosActuales: { increment: 1 } },
      });
    }

    if (pedido.usuarioId) {
      await tx.carrito.updateMany({
        where: { usuarioId: pedido.usuarioId, convertidoEn: null },
        data: { convertidoEn: new Date(), pedidoId: pedido.id },
      });
    }

    await tx.pedidoHistorial.create({
      data: {
        pedidoId: pedido.id,
        estadoAnterior: 'esperandoPago',
        estadoNuevo: 'pagado',
        nota: 'Pago aprobado por Wompi',
      },
    });

    return { tipo: 'pagado' };
  });

  if (resultado.tipo === 'pagado') {
    await notificarTiendaSiCorresponde(idPedidoParaNotificar);
  } else if (resultado.tipo === 'conflicto') {
    await alertarConflictoPagoAprobado(resultado.numeroPedido, resultado.estadoPago, resultado.estadoPedido);
  }
}

async function alertarConflictoPagoAprobado(
  numeroPedido: string,
  estadoPago: string,
  estadoPedido: string,
): Promise<void> {
  try {
    await servicioNotificacionTienda.alertarConflictoPago(
      `ALERTA: Wompi aprobó un pago para el pedido ${numeroPedido}, pero el pago estaba en "${estadoPago}" y el pedido en "${estadoPedido}" cuando llegó la confirmación. Hay que revisar manualmente si se reactiva el pedido o se devuelve el dinero.`,
    );
  } catch {
    // No crítico para el procesamiento del webhook: el conflicto ya quedó
    // registrado en pago.estado y en el historial del pedido aunque la
    // notificación falle.
  }
}

async function procesarRechazado(
  pago: { id: string; pedidoId: string; estado: string },
  transaccion: unknown,
  estadoTransaccion: string,
): Promise<void> {
  if (pago.estado === 'rechazado' || pago.estado === 'expirado') return;

  await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pago.pedidoId },
      select: { id: true, estado: true },
    });
    if (!pedido || pedido.estado !== 'esperandoPago') return;

    // Condicional, primero: de dos procesamientos del mismo rechazo (un
    // evento retomado mientras corría el original), solo uno encuentra el
    // pedido en 'esperandoPago' y libera la reserva. El otro sale sin tocar
    // stock.
    const { count: rechazados } = await tx.pedido.updateMany({
      where: { id: pedido.id, estado: 'esperandoPago' },
      data: { estado: 'pagoRechazado' },
    });
    if (rechazados === 0) return;

    await tx.pago.update({
      where: { id: pago.id },
      data: {
        estado: MAPA_ESTADO_PAGO[estadoTransaccion],
        referenciaExterna: leerTexto(transaccion, ['id']),
        mensajeError: leerTexto(transaccion, ['status_message']),
        rechazadoEn: new Date(),
      },
    });

    const unidades = await obtenerUnidadesPorVariante(tx, pedido.id);

    for (const unidad of unidades) {
      await tx.varianteProducto.update({
        where: { id: unidad.varianteId },
        data: { stockReservado: { decrement: unidad.cantidad } },
      });
      await tx.reservaStock.updateMany({
        where: { pedidoId: pedido.id, varianteId: unidad.varianteId, liberadaEn: null },
        data: { liberadaEn: new Date() },
      });
    }

    await tx.pedidoHistorial.create({
      data: {
        pedidoId: pedido.id,
        estadoAnterior: 'esperandoPago',
        estadoNuevo: 'pagoRechazado',
        nota: `Pago ${estadoTransaccion.toLowerCase()}`,
      },
    });
  });
}

async function notificarTiendaSiCorresponde(pedidoId: string): Promise<void> {
  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        numero: true,
        nombreContacto: true,
        subtotal: true,
        descuento: true,
        envio: true,
        total: true,
        cuponCodigo: true,
        items: {
          select: {
            ...SELECT_DESCRIPCION_ITEM,
            precioUnitario: true,
            cantidad: true,
          },
        },
      },
    });
    if (!pedido) return;

    // Los totales del pedido quedaron fijados en el checkout: se usan tal
    // cual, no se recalculan acá.
    const totalesPedido = {
      subtotal: pedido.subtotal,
      descuento: pedido.descuento,
      envio: pedido.envio,
      total: pedido.total,
    };

    const mensaje = construirMensajeWhatsapp({
      numeroPedido: pedido.numero,
      nombreCliente: pedido.nombreContacto,
      // Mismo texto que ven la clienta y el panel, de la copia congelada.
      lineas: pedido.items.map((item) => ({
        descripcion: describirItemPedido(item),
        precioUnitario: item.precioUnitario,
        cantidad: item.cantidad,
      })),
      cuponCodigo: pedido.cuponCodigo,
      totales: totalesPedido,
    });

    await servicioNotificacionTienda.notificarPedidoPagado(mensaje);
  } catch {
    // No crítico: el pedido ya quedó pagado aunque falle la notificación.
  }
}
