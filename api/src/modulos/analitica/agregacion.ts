import type { EstadoPedido } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { claveDia, limitesDia } from '../../lib/fechasReporte.js';
import type { FechaBogota } from '../../lib/fechasReporte.js';

// ---------------------------------------------------------------------------
// Definiciones (punto 2 del prompt): se escriben una sola vez acá, todo lo
// demás las importa. Nunca se repiten inline en una consulta.
// ---------------------------------------------------------------------------

// pedidos pagados = pedido con estado en estos 4, y pagado_en en el rango.
// Mismo criterio que ya usa modulos/limitadas/servicio.ts (ESTADOS_VENDIDO):
// "pagado o posterior" en el ciclo de vida normal, sin cancelado/reembolsado.
export const ESTADOS_PAGADOS: EstadoPedido[] = [
  'pagado',
  'enPreparacion',
  'despachado',
  'entregado',
];

// sesiones = filas de sesion_visita con inicio_en en el rango.
// visitantes únicos = visitante_id distintos en ese rango.
// registros = usuarios con creado_en en el rango.
// ingresos = suma de total de esos pedidos pagados.
// conversión = pedidos pagados / sesiones.
// ticket promedio = ingresos / pedidos pagados.
// (conversión y ticket promedio son derivadas: se calculan donde se
// consultan, no se guardan como columna propia.)

// ---------------------------------------------------------------------------
// Ventas por producto: una sola consulta a pedido_item + su detalle de
// combo, reutilizada por la agregación diaria Y por las consultas en vivo
// (servicioReportes.ts) que necesitan lo mismo para un rango cualquiera.
//
// Una línea de pedido_item es variante directa XOR combo (ver el check
// constraint de la tabla). Los ingresos de un combo NO se reparten entre
// sus piezas — repartir el precio de bulto es arbitrario y nadie puede
// reconstruir después cómo se repartió. Por eso:
//   - unidadesDirectas: unidades vendidas en líneas de variante directa.
//   - unidadesEnCombo: unidades de esa variante que salieron dentro de un
//     combo (vía pedido_item_combo_detalle, cantidad de la "receta" ×
//     cuántos combos se compraron — igual que pagos/servicio.ts).
//   - ingresos: SOLO de líneas directas. Una compra por combo no le suma
//     ingresos a sus piezas acá — si sumaras ingresos de líneas directas
//     con unidades que incluyen combos, ingresos y unidades dejan de
//     cuadrar entre sí sin explicación; mejor mostrar unidadesEnCombo por
//     separado que inventar un reparto.
//   - margen: ingresos - costo de esas mismas unidades directas
//     (pedido_item_combo_detalle no guarda costo propio, así que el
//     margen de unidades vendidas dentro de un combo no es calculable con
//     los datos que hay).
// ---------------------------------------------------------------------------

export interface VentasProducto {
  productoId: string;
  unidadesDirectas: number;
  unidadesEnCombo: number;
  unidadesVendidas: number;
  ingresos: number;
  margen: number;
  // Pedidos pagados distintos que incluyeron este producto, directo o
  // dentro de un combo.
  pedidos: number;
}

function filaVacia(productoId: string): VentasProducto {
  return {
    productoId,
    unidadesDirectas: 0,
    unidadesEnCombo: 0,
    unidadesVendidas: 0,
    ingresos: 0,
    margen: 0,
    pedidos: 0,
  };
}

export async function calcularVentasPorProducto(
  inicio: Date,
  fin: Date,
): Promise<Map<string, VentasProducto>> {
  const items = await prisma.pedidoItem.findMany({
    where: { pedido: { estado: { in: ESTADOS_PAGADOS }, pagadoEn: { gte: inicio, lt: fin } } },
    select: {
      pedidoId: true,
      varianteId: true,
      cantidad: true,
      subtotal: true,
      costoUnitario: true,
      varianteProducto: { select: { productoId: true } },
      detallesCombo: {
        select: {
          varianteId: true,
          cantidad: true,
          varianteProducto: { select: { productoId: true } },
        },
      },
    },
  });

  const mapa = new Map<string, VentasProducto>();
  const pedidosPorProducto = new Map<string, Set<string>>();
  function fila(productoId: string): VentasProducto {
    const existente = mapa.get(productoId);
    if (existente) return existente;
    const nueva = filaVacia(productoId);
    mapa.set(productoId, nueva);
    return nueva;
  }
  function registrarPedido(productoId: string, pedidoId: string): void {
    const set = pedidosPorProducto.get(productoId) ?? new Set<string>();
    set.add(pedidoId);
    pedidosPorProducto.set(productoId, set);
  }

  const costoDirectoPorProducto = new Map<string, number>();

  for (const item of items) {
    if (item.varianteId && item.varianteProducto) {
      const productoId = item.varianteProducto.productoId;
      const f = fila(productoId);
      f.unidadesDirectas += item.cantidad;
      f.ingresos += item.subtotal;
      registrarPedido(productoId, item.pedidoId);
      const costoAcumulado = costoDirectoPorProducto.get(productoId) ?? 0;
      costoDirectoPorProducto.set(
        productoId,
        costoAcumulado + (item.costoUnitario ?? 0) * item.cantidad,
      );
    } else {
      for (const detalle of item.detallesCombo) {
        if (!detalle.varianteId || !detalle.varianteProducto) continue; // variante borrada del catálogo
        const productoId = detalle.varianteProducto.productoId;
        const f = fila(productoId);
        f.unidadesEnCombo += detalle.cantidad * item.cantidad;
        registrarPedido(productoId, item.pedidoId);
      }
    }
  }

  for (const f of mapa.values()) {
    f.unidadesVendidas = f.unidadesDirectas + f.unidadesEnCombo;
    f.margen = f.ingresos - (costoDirectoPorProducto.get(f.productoId) ?? 0);
    f.pedidos = pedidosPorProducto.get(f.productoId)?.size ?? 0;
  }

  return mapa;
}

export async function calcularVistasYAgregadosPorProducto(
  inicio: Date,
  fin: Date,
): Promise<Map<string, { vistas: number; agregadosCarrito: number }>> {
  const [vistas, agregados] = await Promise.all([
    prisma.eventoAnalitica.groupBy({
      by: ['productoId'],
      where: {
        tipo: 'vistaProducto',
        productoId: { not: null },
        creadoEn: { gte: inicio, lt: fin },
      },
      _count: { _all: true },
    }),
    prisma.eventoAnalitica.groupBy({
      by: ['productoId'],
      where: {
        tipo: 'agregarCarrito',
        productoId: { not: null },
        creadoEn: { gte: inicio, lt: fin },
      },
      _count: { _all: true },
    }),
  ]);

  const mapa = new Map<string, { vistas: number; agregadosCarrito: number }>();
  function fila(productoId: string) {
    const existente = mapa.get(productoId);
    if (existente) return existente;
    const nueva = { vistas: 0, agregadosCarrito: 0 };
    mapa.set(productoId, nueva);
    return nueva;
  }
  for (const v of vistas) {
    if (v.productoId) fila(v.productoId).vistas = v._count._all;
  }
  for (const a of agregados) {
    if (a.productoId) fila(a.productoId).agregadosCarrito = a._count._all;
  }
  return mapa;
}

// ---------------------------------------------------------------------------
// recalcularDia: reconstruye desde cero metrica_diaria y
// producto_metrica_diaria para un día calendario en Bogotá. Idempotente:
// se puede correr cualquier cantidad de veces sobre el mismo día y el
// resultado final es el mismo (siempre upsert, nunca create a ciegas; y
// las filas de producto_metrica_diaria que ya no correspondan se borran
// antes de reescribir, para que sea una reconstrucción real).
// ---------------------------------------------------------------------------

export async function recalcularDia(fecha: FechaBogota): Promise<void> {
  const { inicio, fin } = limitesDia(fecha);
  const fechaClave = claveDia(fecha);

  const [
    sesiones,
    visitantesUnicosFilas,
    registros,
    pedidosPagadosAgg,
    pedidosCreados,
    pedidosCancelados,
    carritosCreados,
    carritosAbandonados,
    vistasPagina,
    productosVistos,
    checkoutsIniciados,
    pagosAprobadosAgg,
    pagosRechazadosDirectos,
    pagosExpiradosDelDia,
    ventasPorProducto,
    vistasPorProducto,
  ] = await Promise.all([
    prisma.sesionVisita.count({ where: { inicioEn: { gte: inicio, lt: fin } } }),
    prisma.sesionVisita.findMany({
      where: { inicioEn: { gte: inicio, lt: fin } },
      select: { visitanteId: true },
      distinct: ['visitanteId'],
    }),
    prisma.usuario.count({ where: { creadoEn: { gte: inicio, lt: fin } } }),
    prisma.pedido.aggregate({
      where: { estado: { in: ESTADOS_PAGADOS }, pagadoEn: { gte: inicio, lt: fin } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.pedido.count({ where: { creadoEn: { gte: inicio, lt: fin } } }),
    prisma.pedido.count({ where: { estado: 'cancelado', canceladoEn: { gte: inicio, lt: fin } } }),
    prisma.carrito.count({ where: { creadoEn: { gte: inicio, lt: fin } } }),
    prisma.carrito.count({
      where: { convertidoEn: null, actualizadoEn: { gte: inicio, lt: fin }, items: { some: {} } },
    }),
    prisma.eventoAnalitica.count({
      where: { tipo: 'vistaPagina', creadoEn: { gte: inicio, lt: fin } },
    }),
    prisma.eventoAnalitica.count({
      where: { tipo: 'vistaProducto', creadoEn: { gte: inicio, lt: fin } },
    }),
    prisma.eventoAnalitica.count({
      where: { tipo: 'iniciarCheckout', creadoEn: { gte: inicio, lt: fin } },
    }),
    prisma.pago.aggregate({
      where: { estado: 'aprobado', aprobadoEn: { gte: inicio, lt: fin } },
      _count: { _all: true },
      _sum: { comision: true },
    }),
    prisma.pago.count({ where: { estado: 'rechazado', rechazadoEn: { gte: inicio, lt: fin } } }),
    // "expirado" no guarda cuándo expiró (ver tareaReservas.ts): se
    // aproxima con el día en que se creó el pago, que para tarjeta es el
    // mismo día casi siempre y para PSE/efectivo puede quedarse corto por
    // hasta 24h. Columna secundaria, no la usa ningún endpoint del punto
    // 3-10; se documenta la aproximación en vez de inventar una fecha.
    prisma.pago.count({ where: { estado: 'expirado', creadoEn: { gte: inicio, lt: fin } } }),
    calcularVentasPorProducto(inicio, fin),
    calcularVistasYAgregadosPorProducto(inicio, fin),
  ]);

  const pedidosPagados = pedidosPagadosAgg._count._all;
  const ingresos = BigInt(pedidosPagadosAgg._sum.total ?? 0);
  const pagosAprobados = pagosAprobadosAgg._count._all;
  const comisiones = BigInt(pagosAprobadosAgg._sum.comision ?? 0);
  const ingresosNetos = ingresos - comisiones;

  // pedido_item.costo_unitario * cantidad, para TODAS las líneas de
  // pedidos pagados de ese día (a diferencia de calcularVentasPorProducto,
  // que solo cuenta costo de líneas directas: acá es un total de tienda,
  // no una atribución por producto).
  const lineasParaCosto = await prisma.pedidoItem.findMany({
    where: { pedido: { estado: { in: ESTADOS_PAGADOS }, pagadoEn: { gte: inicio, lt: fin } } },
    select: { costoUnitario: true, cantidad: true },
  });
  const costos = lineasParaCosto.reduce(
    (acumulado, item) => acumulado + BigInt(item.costoUnitario ?? 0) * BigInt(item.cantidad),
    0n,
  );

  let unidadesVendidas = 0;
  for (const fila of ventasPorProducto.values()) unidadesVendidas += fila.unidadesVendidas;

  await prisma.metricaDiaria.upsert({
    where: { fecha: fechaClave },
    update: {
      sesiones,
      visitantesUnicos: visitantesUnicosFilas.length,
      vistasPagina,
      usuariosNuevos: registros,
      productosVistos,
      carritosCreados,
      carritosAbandonados,
      checkoutsIniciados,
      pagosIntentados: pagosAprobados + pagosRechazadosDirectos + pagosExpiradosDelDia,
      pagosAprobados,
      pagosRechazados: pagosRechazadosDirectos + pagosExpiradosDelDia,
      pedidosCreados,
      pedidosPagados,
      pedidosCancelados,
      ingresos,
      comisiones,
      ingresosNetos,
      costos,
      unidadesVendidas,
      actualizadoEn: new Date(),
    },
    create: {
      fecha: fechaClave,
      sesiones,
      visitantesUnicos: visitantesUnicosFilas.length,
      vistasPagina,
      usuariosNuevos: registros,
      productosVistos,
      carritosCreados,
      carritosAbandonados,
      checkoutsIniciados,
      pagosIntentados: pagosAprobados + pagosRechazadosDirectos + pagosExpiradosDelDia,
      pagosAprobados,
      pagosRechazados: pagosRechazadosDirectos + pagosExpiradosDelDia,
      pedidosCreados,
      pedidosPagados,
      pedidosCancelados,
      ingresos,
      comisiones,
      ingresosNetos,
      costos,
      unidadesVendidas,
    },
  });

  // Reconstrucción real de producto_metrica_diaria: primero se borra lo
  // que ya no corresponde a este recálculo (ej. un pedido que se canceló
  // después del primer recalculo de ese día), después se upsertea lo que
  // sí. Nunca create a ciegas.
  const idsConDatos = new Set<string>([...ventasPorProducto.keys(), ...vistasPorProducto.keys()]);

  await prisma.productoMetricaDiaria.deleteMany({
    where: { fecha: fechaClave, productoId: { notIn: Array.from(idsConDatos) } },
  });

  for (const productoId of idsConDatos) {
    const ventas = ventasPorProducto.get(productoId);
    const vistas = vistasPorProducto.get(productoId);
    const datos = {
      vistas: vistas?.vistas ?? 0,
      agregadosCarrito: vistas?.agregadosCarrito ?? 0,
      pedidos: ventas?.pedidos ?? 0,
      unidadesVendidas: ventas?.unidadesVendidas ?? 0,
      ingresos: BigInt(ventas?.ingresos ?? 0),
    };

    await prisma.productoMetricaDiaria.upsert({
      where: { productoId_fecha: { productoId, fecha: fechaClave } },
      update: datos,
      create: { productoId, fecha: fechaClave, ...datos },
    });
  }
}
