import type { EstadoPedido, Prisma } from '@prisma/client';
import { ErrorApi } from '../../../lib/errorApi.js';
import { limitesDia, limitesRango } from '../../../lib/fechasReporte.js';
import { prisma } from '../../../lib/prisma.js';
import { obtenerUnidadesPorVariante } from '../../../lib/unidadesPedido.js';
import type { BodyEnvio, BodyEstado, BodyReembolso, QueryListadoPedidos } from './esquemas.js';
import {
  consecuenciaInventario,
  transicionesDisponibles,
  validarTransicion,
} from './maquinaEstados.js';

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------

const SELECT_LISTADO = {
  numero: true,
  creadoEn: true,
  nombreContacto: true,
  telefonoContacto: true,
  total: true,
  estado: true,
  items: { select: { cantidad: true } },
  pagos: { select: { metodo: true }, orderBy: { creadoEn: 'desc' }, take: 1 },
  // Para el distintivo de la fila (TANDA 1, ajuste 2): no reemplaza el
  // `pagos` de arriba (que trae el método del pago más reciente, de
  // cualquier estado) porque filtrar ESE por estado perdería el método a
  // mostrar en la columna cuando el pago más reciente no sea el que
  // requiere revisión.
  _count: { select: { pagos: { where: { estado: 'requiereRevision' } } } },
} satisfies Prisma.PedidoSelect;

export async function listarPedidos(query: QueryListadoPedidos) {
  const where: Prisma.PedidoWhereInput = {};

  // Mutuamente excluyente con `estado`: un pedido que requiere revisión
  // puede estar en cualquier estado_pedido (típicamente cancelado o
  // pago_rechazado, nunca se lo movimos — ver procesarAprobado), así que
  // filtrar por los dos a la vez no tendría sentido para este tab.
  if (query.requiereRevision) {
    where.pagos = { some: { estado: 'requiereRevision' } };
  } else if (query.estado) {
    where.estado = query.estado;
  }

  if (query.desde && query.hasta) {
    const { inicio, fin } = limitesRango(query.desde, query.hasta);
    where.creadoEn = { gte: inicio, lt: fin };
  } else if (query.desde) {
    where.creadoEn = { gte: limitesDia(query.desde).inicio };
  } else if (query.hasta) {
    where.creadoEn = { lt: limitesDia(query.hasta).fin };
  }

  if (query.buscar) {
    where.OR = [
      { numero: { contains: query.buscar, mode: 'insensitive' } },
      { nombreContacto: { contains: query.buscar, mode: 'insensitive' } },
      { telefonoContacto: { contains: query.buscar, mode: 'insensitive' } },
    ];
  }

  const [total, pedidos] = await Promise.all([
    prisma.pedido.count({ where }),
    prisma.pedido.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      skip: (query.pagina - 1) * query.porPagina,
      take: query.porPagina,
      select: SELECT_LISTADO,
    }),
  ]);

  const datos = pedidos.map((pedido) => ({
    numero: pedido.numero,
    creadoEn: pedido.creadoEn,
    nombreContacto: pedido.nombreContacto,
    telefonoContacto: pedido.telefonoContacto,
    articulos: pedido.items.reduce((suma, item) => suma + item.cantidad, 0),
    total: pedido.total,
    estado: pedido.estado,
    metodoPago: pedido.pagos[0]?.metodo ?? null,
    requiereRevision: pedido._count.pagos > 0,
  }));

  return {
    datos,
    paginacion: {
      pagina: query.pagina,
      porPagina: query.porPagina,
      total,
      totalPaginas: Math.ceil(total / query.porPagina),
    },
  };
}

// Estados que tienen pestaña propia en el panel (ver plan aprobado): quedan
// afuera pago_rechazado y reembolsado, que siguen contando dentro de
// "todos" pero no tienen tab dedicada.
const ESTADOS_TAB: EstadoPedido[] = [
  'esperandoPago',
  'pagado',
  'enPreparacion',
  'despachado',
  'entregado',
  'cancelado',
];

export async function obtenerResumenEstados(): Promise<Record<string, number>> {
  const [todos, grupos, requiereRevision] = await Promise.all([
    prisma.pedido.count(),
    prisma.pedido.groupBy({ by: ['estado'], _count: { _all: true } }),
    // Mismo criterio que el filtro de arriba: pedidos con al menos un
    // pago en requiereRevision, sin importar en qué estado_pedido estén.
    prisma.pedido.count({ where: { pagos: { some: { estado: 'requiereRevision' } } } }),
  ]);

  const conteos: Record<string, number> = { todos, requiereRevision };
  for (const estado of ESTADOS_TAB) conteos[estado] = 0;
  for (const grupo of grupos) {
    if (grupo.estado in conteos) conteos[grupo.estado] = grupo._count._all;
  }
  return conteos;
}

// ---------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------

const SELECT_DETALLE = {
  id: true,
  numero: true,
  estado: true,
  creadoEn: true,
  actualizadoEn: true,
  nombreContacto: true,
  telefonoContacto: true,
  correoContacto: true,
  envioNombre: true,
  envioTelefono: true,
  envioDepartamento: true,
  envioCiudad: true,
  envioDireccion: true,
  envioComplemento: true,
  envioNotas: true,
  transportadora: true,
  numeroGuia: true,
  urlSeguimiento: true,
  subtotal: true,
  descuento: true,
  envio: true,
  total: true,
  cuponCodigo: true,
  pagadoEn: true,
  despachadoEn: true,
  entregadoEn: true,
  canceladoEn: true,
  motivoCancelacion: true,
  items: {
    select: {
      id: true,
      nombreProducto: true,
      sku: true,
      tipoBase: true,
      longitud: true,
      colorNombre: true,
      colorHex: true,
      talla: true,
      densidad: true,
      precioUnitario: true,
      cantidad: true,
      subtotal: true,
      comboId: true,
      nombreCombo: true,
      detallesCombo: {
        select: {
          id: true,
          nombreProducto: true,
          sku: true,
          descripcionVariante: true,
          cantidad: true,
        },
      },
    },
  },
  historial: {
    orderBy: { creadoEn: 'asc' },
    select: {
      id: true,
      estadoAnterior: true,
      estadoNuevo: true,
      nota: true,
      creadoEn: true,
      usuario: { select: { nombre: true } },
    },
  },
  pagos: {
    orderBy: { creadoEn: 'asc' },
    select: {
      id: true,
      pasarela: true,
      referenciaExterna: true,
      referenciaInterna: true,
      metodo: true,
      estado: true,
      monto: true,
      comision: true,
      montoNeto: true,
      moneda: true,
      ultimosCuatro: true,
      franquicia: true,
      bancoPse: true,
      cuotas: true,
      mensajeError: true,
      aprobadoEn: true,
      rechazadoEn: true,
      creadoEn: true,
      reembolsos: {
        select: {
          id: true,
          monto: true,
          motivo: true,
          tipo: true,
          estado: true,
          referenciaExterna: true,
          creadoEn: true,
          procesadoEn: true,
        },
      },
    },
  },
  reservasStock: {
    select: { id: true, varianteId: true, cantidad: true, expiraEn: true, liberadaEn: true },
  },
} satisfies Prisma.PedidoSelect;

// Agrega las transiciones válidas desde el estado actual a cualquier
// resultado con forma SELECT_DETALLE, para que el <select> de "Cambiar
// estado" del admin nunca tenga que adivinarlas ni traer su propia copia.
function conTransicionesDisponibles<T extends { estado: EstadoPedido }>(
  pedido: T,
): T & { transicionesDisponibles: EstadoPedido[] } {
  return { ...pedido, transicionesDisponibles: transicionesDisponibles(pedido.estado) };
}

export async function obtenerDetallePedido(numero: string) {
  const pedido = await prisma.pedido.findUnique({ where: { numero }, select: SELECT_DETALLE });
  if (!pedido) {
    throw ErrorApi.noEncontrado('El pedido no existe');
  }
  return conTransicionesDisponibles(pedido);
}

// ---------------------------------------------------------------------------
// Cambio de estado
// ---------------------------------------------------------------------------

function accionesDeAuditoria(
  entidadId: string,
  accion: string,
  antes: Prisma.InputJsonValue | undefined,
  despues: Prisma.InputJsonValue,
) {
  return {
    entidad: 'pedido',
    entidadId,
    accion,
    ...(antes !== undefined ? { datosAntes: antes } : {}),
    datosDespues: despues,
  };
}

export async function cambiarEstadoPedido(
  id: string,
  datos: BodyEstado,
  usuarioAdminId: string,
  ipHash: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id },
      select: { id: true, numero: true, estado: true },
    });
    if (!pedido) {
      throw ErrorApi.noEncontrado('El pedido no existe');
    }

    validarTransicion(pedido.estado, datos.estado);
    const consecuencia = consecuenciaInventario(pedido.estado, datos.estado);

    if (consecuencia === 'liberarReserva') {
      const reservas = await tx.reservaStock.findMany({
        where: { pedidoId: id, liberadaEn: null },
        select: { id: true, varianteId: true, cantidad: true },
      });
      for (const reserva of reservas) {
        await tx.varianteProducto.update({
          where: { id: reserva.varianteId },
          data: { stockReservado: { decrement: reserva.cantidad } },
        });
        await tx.reservaStock.update({
          where: { id: reserva.id },
          data: { liberadaEn: new Date() },
        });
      }
    } else if (consecuencia === 'devolverStock') {
      const unidades = await obtenerUnidadesPorVariante(tx, id);
      for (const unidad of unidades) {
        const varianteActualizada = await tx.varianteProducto.update({
          where: { id: unidad.varianteId },
          data: { stockActual: { increment: unidad.cantidad } },
          select: { stockActual: true },
        });
        await tx.movimientoInventario.create({
          data: {
            varianteId: unidad.varianteId,
            tipo: 'entrada',
            cantidad: unidad.cantidad,
            stockResultante: varianteActualizada.stockActual,
            referenciaTipo: 'pedido',
            referenciaId: id,
            usuarioId: usuarioAdminId,
            motivo: `Cancelación del pedido ${pedido.numero}`,
          },
        });
      }
    }

    const dataActualizacion: Prisma.PedidoUpdateInput = {
      estado: datos.estado,
      actualizadoEn: new Date(),
    };
    if (datos.estado === 'pagado') dataActualizacion.pagadoEn = new Date();
    if (datos.estado === 'despachado') dataActualizacion.despachadoEn = new Date();
    if (datos.estado === 'entregado') dataActualizacion.entregadoEn = new Date();
    if (datos.estado === 'cancelado') {
      dataActualizacion.canceladoEn = new Date();
      dataActualizacion.motivoCancelacion = datos.nota ?? null;
    }

    await tx.pedido.update({ where: { id }, data: dataActualizacion });

    await tx.pedidoHistorial.create({
      data: {
        pedidoId: id,
        estadoAnterior: pedido.estado,
        estadoNuevo: datos.estado,
        usuarioId: usuarioAdminId,
        nota: datos.nota,
      },
    });

    await tx.auditoriaAdmin.create({
      data: {
        usuarioAdminId,
        ipHash,
        ...accionesDeAuditoria(
          id,
          'admin.pedido.cambiar_estado',
          { estado: pedido.estado },
          { estado: datos.estado },
        ),
      },
    });

    // Select final, después de escribir historial y auditoría, para que el
    // pedido devuelto ya incluya el registro de historial recién creado.
    const pedidoActualizado = await tx.pedido.findUniqueOrThrow({
      where: { id },
      select: SELECT_DETALLE,
    });
    return conTransicionesDisponibles(pedidoActualizado);
  });
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------

export async function actualizarEnvioPedido(
  id: string,
  datos: BodyEnvio,
  usuarioAdminId: string,
  ipHash: string | null,
) {
  const pedidoAntes = await prisma.pedido.findUnique({
    where: { id },
    select: { transportadora: true, numeroGuia: true, urlSeguimiento: true },
  });
  if (!pedidoAntes) {
    throw ErrorApi.noEncontrado('El pedido no existe');
  }

  const pedidoActualizado = await prisma.pedido.update({
    where: { id },
    data: { ...datos, actualizadoEn: new Date() },
    select: SELECT_DETALLE,
  });

  await prisma.auditoriaAdmin.create({
    data: {
      usuarioAdminId,
      ipHash,
      ...accionesDeAuditoria(id, 'admin.pedido.actualizar_envio', pedidoAntes, datos),
    },
  });

  return conTransicionesDisponibles(pedidoActualizado);
}

// ---------------------------------------------------------------------------
// Reembolso
// ---------------------------------------------------------------------------

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const PLAZO_RETRACTO_DIAS_HABILES = 5;

// Días hábiles (lunes a viernes) transcurridos entre dos instantes, sin
// contar `desde`. No descuenta festivos colombianos (no hay calendario de
// festivos en el proyecto todavía) — subestima ligeramente el plazo
// vencido en semanas con festivo, nunca lo sobreestima, así que el filtro
// queda del lado conservador mientras no se agregue ese calendario.
function diasHabilesTranscurridos(desde: Date, hasta: Date): number {
  let dias = 0;
  const cursor = new Date(desde.getTime());
  cursor.setUTCHours(0, 0, 0, 0);
  const limite = new Date(hasta.getTime());
  limite.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() < limite.getTime()) {
    cursor.setTime(cursor.getTime() + MS_POR_DIA);
    const diaSemana = cursor.getUTCDay();
    if (diaSemana !== 0 && diaSemana !== 6) dias++;
  }
  return dias;
}

export async function crearReembolso(
  id: string,
  datos: BodyReembolso,
  usuarioAdminId: string,
  ipHash: string | null,
) {
  const pago = await prisma.pago.findUnique({
    where: { id: datos.pagoId },
    select: {
      id: true,
      pedidoId: true,
      monto: true,
      pedido: { select: { numero: true, entregadoEn: true } },
      reembolsos: { select: { monto: true } },
    },
  });
  if (!pago || pago.pedidoId !== id) {
    throw ErrorApi.noEncontrado('El pago no existe en este pedido');
  }

  const yaReembolsado = pago.reembolsos.reduce((suma, r) => suma + r.monto, 0);
  const disponible = pago.monto - yaReembolsado;
  if (datos.monto > disponible) {
    throw ErrorApi.conflicto('El monto supera lo pagado menos lo ya reembolsado', {
      disponible,
      montoSolicitado: datos.monto,
    });
  }

  if (datos.tipo === 'retracto') {
    if (!pago.pedido.entregadoEn) {
      throw ErrorApi.peticionInvalida(
        'El derecho de retracto aplica desde la fecha de entrega; este pedido todavía no figura como entregado',
      );
    }
    const diasTranscurridos = diasHabilesTranscurridos(pago.pedido.entregadoEn, new Date());
    if (diasTranscurridos > PLAZO_RETRACTO_DIAS_HABILES) {
      throw ErrorApi.conflicto(
        `El plazo legal de retracto (${PLAZO_RETRACTO_DIAS_HABILES} días hábiles desde la entrega) ya venció`,
        { entregadoEn: pago.pedido.entregadoEn, diasTranscurridos },
      );
    }
  }

  // TODO: llamar a la API de reembolsos de Wompi cuando esté disponible
  // (ver pub_test_PENDIENTE / prv_test_PENDIENTE en .env). Por ahora solo
  // se registra la solicitud; referenciaExterna queda null y estado en su
  // default ("solicitado").
  const reembolso = await prisma.reembolso.create({
    data: {
      pagoId: pago.id,
      monto: datos.monto,
      motivo: datos.motivo,
      tipo: datos.tipo,
      solicitadoPorId: usuarioAdminId,
    },
  });

  await prisma.auditoriaAdmin.create({
    data: {
      usuarioAdminId,
      ipHash,
      ...accionesDeAuditoria(id, 'admin.pedido.reembolsar', undefined, {
        pagoId: pago.id,
        monto: datos.monto,
        tipo: datos.tipo,
      }),
    },
  });

  return reembolso;
}
