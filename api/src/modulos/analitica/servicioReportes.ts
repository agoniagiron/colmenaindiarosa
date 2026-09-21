import type { TipoEvento } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  claveDia,
  hoyBogota,
  limitesDelMes,
  limitesRango,
  listaDeDias,
  mesDe,
  rangoAnteriorEquivalente,
  restarMeses,
} from '../../lib/fechasReporte.js';
import type { FechaBogota } from '../../lib/fechasReporte.js';
import {
  calcularVentasPorProducto,
  calcularVistasYAgregadosPorProducto,
  ESTADOS_PAGADOS,
} from './agregacion.js';

// ---------------------------------------------------------------------------
// Punto 11: cuando el rango pedido está completamente cubierto por
// metrica_diaria (una fila por cada día del rango), se lee de ahí. El día
// en curso nunca tiene fila (se agrega recién al día siguiente), así que
// cualquier rango que llegue hasta hoy cae siempre a crudo. Lo mismo pasa
// si algún día histórico todavía no se agregó (por ejemplo, antes del
// primer backfill).
// ---------------------------------------------------------------------------

async function estaCubiertoPorAgregados(desde: FechaBogota, hasta: FechaBogota): Promise<boolean> {
  const diasEsperados = listaDeDias(desde, hasta).length;
  const filas = await prisma.metricaDiaria.count({
    where: { fecha: { gte: claveDia(desde), lte: claveDia(hasta) } },
  });
  return filas === diasEsperados;
}

// ---------------------------------------------------------------------------
// GET /resumen
// ---------------------------------------------------------------------------

interface IndicadoresBrutos {
  sesiones: number;
  visitantesUnicos: number;
  registros: number;
  pedidosPagados: number;
  ingresos: number;
}

async function calcularIndicadoresBrutos(
  desde: FechaBogota,
  hasta: FechaBogota,
): Promise<IndicadoresBrutos> {
  const { inicio, fin } = limitesRango(desde, hasta);
  const cubierto = await estaCubiertoPorAgregados(desde, hasta);

  let sesiones: number;
  let registros: number;
  let pedidosPagados: number;
  let ingresos: number;

  if (cubierto) {
    const filas = await prisma.metricaDiaria.findMany({
      where: { fecha: { gte: claveDia(desde), lte: claveDia(hasta) } },
      select: { sesiones: true, usuariosNuevos: true, pedidosPagados: true, ingresos: true },
    });
    sesiones = filas.reduce((acumulado, f) => acumulado + f.sesiones, 0);
    registros = filas.reduce((acumulado, f) => acumulado + f.usuariosNuevos, 0);
    pedidosPagados = filas.reduce((acumulado, f) => acumulado + f.pedidosPagados, 0);
    ingresos = filas.reduce((acumulado, f) => acumulado + Number(f.ingresos), 0);
  } else {
    const [sesionesCount, registrosCount, pedidosAgg] = await Promise.all([
      prisma.sesionVisita.count({ where: { inicioEn: { gte: inicio, lt: fin } } }),
      prisma.usuario.count({ where: { creadoEn: { gte: inicio, lt: fin } } }),
      prisma.pedido.aggregate({
        where: { estado: { in: ESTADOS_PAGADOS }, pagadoEn: { gte: inicio, lt: fin } },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);
    sesiones = sesionesCount;
    registros = registrosCount;
    pedidosPagados = pedidosAgg._count._all;
    ingresos = pedidosAgg._sum.total ?? 0;
  }

  // visitantesUnicos SIEMPRE se calcula en crudo, incluso cuando el resto
  // del rango está cubierto por agregados: metrica_diaria guarda el
  // conteo de únicos DE ESE DÍA, y sumar únicos diarios sobrecuenta a
  // cualquier visitante activo en más de un día del rango (el mismo
  // problema que tiene el embudo con "sesiones distintas"). sesion_visita
  // es chica (una fila por sesión, no por evento), así que esto no pega
  // contra el problema de rendimiento que sí tiene evento_analitica.
  const visitantesFilas = await prisma.sesionVisita.findMany({
    where: { inicioEn: { gte: inicio, lt: fin } },
    select: { visitanteId: true },
    distinct: ['visitanteId'],
  });

  return {
    sesiones,
    visitantesUnicos: visitantesFilas.length,
    registros,
    pedidosPagados,
    ingresos,
  };
}

interface Comparacion {
  actual: number;
  anterior: number;
  // null cuando el período anterior fue 0: no hay base para calcular un
  // cambio porcentual (evita Infinity o un número que no significa nada).
  variacion: number | null;
}

function comparar(actual: number, anterior: number): Comparacion {
  return {
    actual,
    anterior,
    variacion: anterior === 0 ? null : (actual - anterior) / anterior,
  };
}

export async function obtenerResumen(desde: FechaBogota, hasta: FechaBogota) {
  const anterior = rangoAnteriorEquivalente(desde, hasta);
  const [actual, previo] = await Promise.all([
    calcularIndicadoresBrutos(desde, hasta),
    calcularIndicadoresBrutos(anterior.desde, anterior.hasta),
  ]);

  const conversionActual = actual.sesiones > 0 ? actual.pedidosPagados / actual.sesiones : 0;
  const conversionAnterior = previo.sesiones > 0 ? previo.pedidosPagados / previo.sesiones : 0;
  const ticketActual = actual.pedidosPagados > 0 ? actual.ingresos / actual.pedidosPagados : 0;
  const ticketAnterior = previo.pedidosPagados > 0 ? previo.ingresos / previo.pedidosPagados : 0;

  return {
    rangoAnterior: anterior,
    sesiones: comparar(actual.sesiones, previo.sesiones),
    visitantesUnicos: comparar(actual.visitantesUnicos, previo.visitantesUnicos),
    registros: comparar(actual.registros, previo.registros),
    pedidosPagados: comparar(actual.pedidosPagados, previo.pedidosPagados),
    ingresos: comparar(actual.ingresos, previo.ingresos),
    // Conversión: fracción (0.0234 = 2.34%), NUNCA se compara como
    // "porcentaje de porcentaje" — variación = resta directa de las dos
    // fracciones (puntos porcentuales), no (actual-anterior)/anterior.
    conversion: {
      actual: conversionActual,
      anterior: conversionAnterior,
      variacion: conversionActual - conversionAnterior,
    },
    ticketPromedio: comparar(ticketActual, ticketAnterior),
  };
}

// ---------------------------------------------------------------------------
// GET /embudo — siempre en crudo (ver nota en agregacion.ts / plan): sumar
// "sesiones distintas por día" de metrica_diaria sobrecontaría una sesión
// que cruza dos días. sesion_visita + el índice de evento_analitica por
// sesión mantienen esto acotado y rápido igual.
// ---------------------------------------------------------------------------

async function contarSesionesConEvento(tipo: TipoEvento, inicio: Date, fin: Date): Promise<number> {
  const filas = await prisma.eventoAnalitica.groupBy({
    by: ['sesionId'],
    where: { tipo, sesionVisita: { inicioEn: { gte: inicio, lt: fin } } },
  });
  return filas.length;
}

export async function obtenerEmbudo(desde: FechaBogota, hasta: FechaBogota) {
  const { inicio, fin } = limitesRango(desde, hasta);

  const [visitaron, vieronProducto, agregaron, iniciaronPago, pagaron] = await Promise.all([
    prisma.sesionVisita.count({ where: { inicioEn: { gte: inicio, lt: fin } } }),
    contarSesionesConEvento('vistaProducto', inicio, fin),
    contarSesionesConEvento('agregarCarrito', inicio, fin),
    contarSesionesConEvento('iniciarCheckout', inicio, fin),
    contarSesionesConEvento('pagoAprobado', inicio, fin),
  ]);

  const pasos = [
    { paso: 'visitaron', sesiones: visitaron },
    { paso: 'vieron_producto', sesiones: vieronProducto },
    { paso: 'agregaron', sesiones: agregaron },
    { paso: 'iniciaron_pago', sesiones: iniciaronPago },
    { paso: 'pagaron', sesiones: pagaron },
  ];

  const fuga = pasos.slice(1).map((paso, indice) => {
    const anterior = pasos[indice]!;
    const perdieron = anterior.sesiones - paso.sesiones;
    return {
      de: anterior.paso,
      a: paso.paso,
      perdieron,
      porcentajeFuga: anterior.sesiones > 0 ? perdieron / anterior.sesiones : 0,
    };
  });

  return { pasos, fuga };
}

// ---------------------------------------------------------------------------
// GET /serie
// ---------------------------------------------------------------------------

async function calcularSesionesYPedidos(
  desde: FechaBogota,
  hasta: FechaBogota,
): Promise<{ sesiones: number; pedidosPagados: number }> {
  const cubierto = await estaCubiertoPorAgregados(desde, hasta);
  if (cubierto) {
    const filas = await prisma.metricaDiaria.findMany({
      where: { fecha: { gte: claveDia(desde), lte: claveDia(hasta) } },
      select: { sesiones: true, pedidosPagados: true },
    });
    return {
      sesiones: filas.reduce((a, f) => a + f.sesiones, 0),
      pedidosPagados: filas.reduce((a, f) => a + f.pedidosPagados, 0),
    };
  }

  const { inicio, fin } = limitesRango(desde, hasta);
  const [sesiones, pedidosPagados] = await Promise.all([
    prisma.sesionVisita.count({ where: { inicioEn: { gte: inicio, lt: fin } } }),
    prisma.pedido.count({
      where: { estado: { in: ESTADOS_PAGADOS }, pagadoEn: { gte: inicio, lt: fin } },
    }),
  ]);
  return { sesiones, pedidosPagados };
}

// `hastaParametro` es el mismo "hoy" que ya usan los otros 7 endpoints
// (lo calcula el navegador de quien mira el panel, no el reloj del
// servidor): sin esto, /serie era el único que decidía "hoy" por su
// cuenta, y un servidor en otro huso que el navegador lo desfasaba del
// resto del panel. Si no llega (por ejemplo, llamado desde un script),
// se cae a hoyBogota() del servidor como antes.
export async function obtenerSerie(meses: number, hastaParametro?: FechaBogota) {
  const referencia = hastaParametro ?? hoyBogota();
  const salida: { mes: string; sesiones: number; pedidosPagados: number }[] = [];

  for (let i = meses - 1; i >= 0; i -= 1) {
    const primerDiaDelMes = restarMeses(referencia, i);
    const limites = limitesDelMes(primerDiaDelMes);
    // El mes en curso se corta en la fecha de referencia: no hay datos
    // futuros que mostrar.
    const hasta = limites.hasta > referencia ? referencia : limites.hasta;
    const datos = await calcularSesionesYPedidos(limites.desde, hasta);
    salida.push({ mes: mesDe(primerDiaDelMes), ...datos });
  }

  return salida;
}

// ---------------------------------------------------------------------------
// GET /productos — parte de `producto` (LEFT JOIN implícito: se listan
// TODOS los publicados y se les pega encima lo que tengan de ventas, en
// vez de partir de pedido_item y perder los que tienen cero). vistas y
// agregados usan el atajo de agregados cuando el rango está cubierto;
// unidades/ingresos/margen y el stock siempre se calculan en vivo (ver
// agregacion.ts: no hay dónde guardar el margen agregado, y el stock no
// es una métrica de rango).
// ---------------------------------------------------------------------------

const ORDENADORES: Record<string, (a: FilaProducto, b: FilaProducto) => number> = {
  vistos: (a, b) => b.vistas - a.vistas,
  agregados: (a, b) => b.agregadosCarrito - a.agregadosCarrito,
  vendidos: (a, b) => b.unidadesVendidas - a.unidadesVendidas,
  menos_vendidos: (a, b) => a.unidadesVendidas - b.unidadesVendidas,
};

export interface FilaProducto {
  productoId: string;
  nombre: string;
  slug: string;
  vistas: number;
  agregadosCarrito: number;
  unidadesDirectas: number;
  unidadesEnCombo: number;
  unidadesVendidas: number;
  // Solo de venta directa: ver la nota en agregacion.ts sobre por qué no
  // se reparte el precio de un combo entre sus piezas.
  ingresos: number;
  margen: number;
  stockDisponible: number;
}

export async function obtenerProductos(
  desde: FechaBogota,
  hasta: FechaBogota,
  orden: keyof typeof ORDENADORES,
  limite: number,
): Promise<FilaProducto[]> {
  const { inicio, fin } = limitesRango(desde, hasta);
  const cubierto = await estaCubiertoPorAgregados(desde, hasta);

  const [productos, ventas, vistasPorProducto] = await Promise.all([
    prisma.producto.findMany({
      where: { estado: 'publicado' },
      select: {
        id: true,
        nombre: true,
        slug: true,
        variantes: { select: { stockActual: true, stockReservado: true } },
      },
    }),
    calcularVentasPorProducto(inicio, fin),
    cubierto
      ? prisma.productoMetricaDiaria
          .groupBy({
            by: ['productoId'],
            where: { fecha: { gte: claveDia(desde), lte: claveDia(hasta) } },
            _sum: { vistas: true, agregadosCarrito: true },
          })
          .then(
            (filas) =>
              new Map(
                filas.map((f) => [
                  f.productoId,
                  { vistas: f._sum.vistas ?? 0, agregadosCarrito: f._sum.agregadosCarrito ?? 0 },
                ]),
              ),
          )
      : calcularVistasYAgregadosPorProducto(inicio, fin),
  ]);

  const filas: FilaProducto[] = productos.map((p) => {
    const v = ventas.get(p.id);
    const vis = vistasPorProducto.get(p.id);
    const stockDisponible = p.variantes.reduce(
      (acumulado, variante) =>
        acumulado + Math.max(0, variante.stockActual - variante.stockReservado),
      0,
    );
    return {
      productoId: p.id,
      nombre: p.nombre,
      slug: p.slug,
      vistas: vis?.vistas ?? 0,
      agregadosCarrito: vis?.agregadosCarrito ?? 0,
      unidadesDirectas: v?.unidadesDirectas ?? 0,
      unidadesEnCombo: v?.unidadesEnCombo ?? 0,
      unidadesVendidas: v?.unidadesVendidas ?? 0,
      ingresos: v?.ingresos ?? 0,
      margen: v?.margen ?? 0,
      stockDisponible,
    };
  });

  filas.sort(ORDENADORES[orden]);
  return filas.slice(0, limite);
}

// ---------------------------------------------------------------------------
// GET /calificaciones — producto_resumen es en sí un agregado siempre al
// día (lo mantiene el módulo de reseñas), no hay rango de fechas ni falta
// hace: es barato sin importar cuántas reseñas haya.
// ---------------------------------------------------------------------------

export async function obtenerCalificaciones(orden: 'mejor' | 'peor', minimo: number) {
  const filas = await prisma.productoResumen.findMany({
    where: { cantidadResenas: { gte: minimo } },
    orderBy: { calificacionPromedio: orden === 'mejor' ? 'desc' : 'asc' },
    select: {
      calificacionPromedio: true,
      cantidadResenas: true,
      producto: { select: { id: true, nombre: true, slug: true } },
    },
  });

  return filas.map((f) => ({
    productoId: f.producto.id,
    nombre: f.producto.nombre,
    slug: f.producto.slug,
    calificacionPromedio: Number(f.calificacionPromedio),
    cantidadResenas: f.cantidadResenas,
  }));
}

// ---------------------------------------------------------------------------
// GET /origen — sesion_visita es una tabla chica (una fila por sesión),
// nunca hace falta el atajo de agregados acá.
// ---------------------------------------------------------------------------

export async function obtenerOrigen(desde: FechaBogota, hasta: FechaBogota) {
  const { inicio, fin } = limitesRango(desde, hasta);
  const filas = await prisma.sesionVisita.groupBy({
    by: ['origen'],
    where: { inicioEn: { gte: inicio, lt: fin } },
    _count: { _all: true },
  });

  const total = filas.reduce((acumulado, f) => acumulado + f._count._all, 0);

  return filas
    .map((f) => ({
      origen: f.origen ?? 'Directo',
      sesiones: f._count._all,
      porcentaje: total > 0 ? f._count._all / total : 0,
    }))
    .sort((a, b) => b.sesiones - a.sesiones);
}

// ---------------------------------------------------------------------------
// GET /busquedas — busqueda_registro es chica, siempre en vivo.
// ---------------------------------------------------------------------------

export async function obtenerBusquedas(
  desde: FechaBogota,
  hasta: FechaBogota,
  sinResultados?: boolean,
) {
  const { inicio, fin } = limitesRango(desde, hasta);
  const filas = await prisma.busquedaRegistro.groupBy({
    by: ['termino'],
    where: {
      creadoEn: { gte: inicio, lt: fin },
      ...(sinResultados ? { resultados: 0 } : {}),
    },
    _count: { _all: true },
  });

  return filas
    .map((f) => ({ termino: f.termino, veces: f._count._all }))
    .sort((a, b) => b.veces - a.veces);
}

// ---------------------------------------------------------------------------
// GET /clientas — "primera vez" se decide con el primer pedido pagado
// GLOBAL de cada clienta (toda su historia), no solo dentro del rango: si
// ya había comprado antes del rango, un pedido pagado dentro del rango es
// una compra "de nuevo" aunque sea la única que cae en este período.
// ---------------------------------------------------------------------------

export async function obtenerClientas(desde: FechaBogota, hasta: FechaBogota) {
  const { inicio, fin } = limitesRango(desde, hasta);

  const pedidosEnRango = await prisma.pedido.findMany({
    where: {
      estado: { in: ESTADOS_PAGADOS },
      pagadoEn: { gte: inicio, lt: fin },
      usuarioId: { not: null },
    },
    select: { usuarioId: true, total: true },
  });

  const usuariosIds = Array.from(new Set(pedidosEnRango.map((p) => p.usuarioId!)));

  const primerPedidoPorUsuario =
    usuariosIds.length > 0
      ? await prisma.pedido.groupBy({
          by: ['usuarioId'],
          where: { estado: { in: ESTADOS_PAGADOS }, usuarioId: { in: usuariosIds } },
          _min: { pagadoEn: true },
        })
      : [];
  const primerPedidoMap = new Map(
    primerPedidoPorUsuario.map((p) => [p.usuarioId, p._min.pagadoEn]),
  );

  let compraronPorPrimeraVez = 0;
  let compraronDeNuevo = 0;
  for (const usuarioId of usuariosIds) {
    const primerPagado = primerPedidoMap.get(usuarioId);
    const esPrimeraVez = Boolean(primerPagado && primerPagado >= inicio && primerPagado < fin);
    if (esPrimeraVez) compraronPorPrimeraVez += 1;
    else compraronDeNuevo += 1;
  }

  const registradosEnRango = await prisma.usuario.findMany({
    where: { creadoEn: { gte: inicio, lt: fin } },
    select: { id: true },
  });
  const idsRegistrados = registradosEnRango.map((u) => u.id);
  const conAlgunPedidoPagado =
    idsRegistrados.length > 0
      ? await prisma.pedido.findMany({
          where: { estado: { in: ESTADOS_PAGADOS }, usuarioId: { in: idsRegistrados } },
          select: { usuarioId: true },
          distinct: ['usuarioId'],
        })
      : [];
  const registradosSinComprar = idsRegistrados.length - conAlgunPedidoPagado.length;

  const pedidosPagados = pedidosEnRango.length;
  const ingresos = pedidosEnRango.reduce((acumulado, p) => acumulado + p.total, 0);
  const ticketPromedio = pedidosPagados > 0 ? ingresos / pedidosPagados : 0;

  const carritosAbandonados = await prisma.carrito.count({
    where: { convertidoEn: null, actualizadoEn: { gte: inicio, lt: fin }, items: { some: {} } },
  });

  return {
    compraronPorPrimeraVez,
    compraronDeNuevo,
    registradosSinComprar,
    ticketPromedio,
    carritosAbandonados,
  };
}
