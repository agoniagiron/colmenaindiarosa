import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { EstadoPago } from '@prisma/client';
import { construirMensajeWhatsapp } from '../../dominio/construirMensajeWhatsapp.js';
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

// Procesa un webhook de Wompi. Responde SIEMPRE 200 desde el controlador,
// incluso si esta función no hace nada (cuerpo irreconocible, firma
// inválida, referencia desconocida): reintentar no ayuda en esos casos y
// Wompi solo necesita el 200 para no seguir reenviando.
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

  let registro;
  try {
    registro = await prisma.eventoPasarela.create({
      data: {
        pasarela: 'wompi',
        idEventoExterno,
        tipo: evento.event,
        cuerpo: evento as Prisma.InputJsonValue,
        firmaValida: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Ya se había insertado (reenvío de Wompi, o llegada casi simultánea).
      return;
    }
    throw error;
  }

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

  await prisma.eventoPasarela.update({
    where: { id: registro.id },
    data: { procesadoEn: new Date() },
  });
}

async function procesarAprobado(
  pago: { id: string; pedidoId: string; estado: string },
  transaccion: unknown,
): Promise<void> {
  // Idempotencia a nivel de negocio, además de la del evento: si por algún
  // motivo se llega hasta acá dos veces para el mismo pago, no se descuenta
  // stock ni se notifica a la tienda una segunda vez.
  if (pago.estado === 'aprobado') return;

  const idPedidoParaNotificar = pago.pedidoId;

  await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pago.pedidoId },
      select: { id: true, numero: true, estado: true, usuarioId: true, cuponId: true },
    });
    if (!pedido || pedido.estado === 'pagado') return;

    await tx.pago.update({
      where: { id: pago.id },
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
  });

  await notificarTiendaSiCorresponde(idPedidoParaNotificar);
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

    await tx.pedido.update({ where: { id: pedido.id }, data: { estado: 'pagoRechazado' } });

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
            nombreProducto: true,
            tipoBase: true,
            longitud: true,
            colorNombre: true,
            talla: true,
            densidad: true,
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
      lineas: pedido.items,
      cuponCodigo: pedido.cuponCodigo,
      totales: totalesPedido,
    });

    await servicioNotificacionTienda.notificarPedidoPagado(mensaje);
  } catch {
    // No crítico: el pedido ya quedó pagado aunque falle la notificación.
  }
}
