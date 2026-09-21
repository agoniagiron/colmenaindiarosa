// Cliente HTTP para api/src/modulos/analitica (rutas admin). Mismo patrón
// que apiAuthAdmin.ts: token del panel admin, nunca el de cliente.

const BASE_URL = '/api/admin/analitica';

export class ErrorAnaliticaAdmin extends Error {
  readonly estadoHttp: number;

  constructor(estadoHttp: number, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorAnaliticaAdmin';
    this.estadoHttp = estadoHttp;
  }
}

async function solicitar<T>(ruta: string, accessToken: string): Promise<T> {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: { mensaje?: string };
    } | null;
    throw new ErrorAnaliticaAdmin(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
    );
  }

  return (await respuesta.json()) as T;
}

export interface Comparacion {
  actual: number;
  anterior: number;
  variacion: number | null;
}

export interface Resumen {
  rangoAnterior: { desde: string; hasta: string };
  sesiones: Comparacion;
  visitantesUnicos: Comparacion;
  registros: Comparacion;
  pedidosPagados: Comparacion;
  ingresos: Comparacion;
  conversion: Comparacion;
  ticketPromedio: Comparacion;
}

export function obtenerResumen(
  accessToken: string,
  desde: string,
  hasta: string,
): Promise<Resumen> {
  return solicitar(`/resumen?desde=${desde}&hasta=${hasta}`, accessToken);
}

export interface PasoEmbudo {
  paso: string;
  sesiones: number;
}
export interface FugaEmbudo {
  de: string;
  a: string;
  perdieron: number;
  porcentajeFuga: number;
}
export interface Embudo {
  pasos: PasoEmbudo[];
  fuga: FugaEmbudo[];
}

export function obtenerEmbudo(accessToken: string, desde: string, hasta: string): Promise<Embudo> {
  return solicitar(`/embudo?desde=${desde}&hasta=${hasta}`, accessToken);
}

export interface PuntoSerie {
  mes: string;
  sesiones: number;
  pedidosPagados: number;
}

// `hasta` es el fin del período que ya se está mostrando en el resto del
// panel (calculado en el navegador de quien mira, no en el servidor):
// mismo marco temporal que los otros 7 endpoints, para que el gráfico no
// sea el único que puede mostrar un mes distinto si el servidor está en
// otro huso horario que quien lo mira.
export function obtenerSerie(
  accessToken: string,
  meses: number,
  hasta: string,
): Promise<PuntoSerie[]> {
  return solicitar(`/serie?meses=${meses}&hasta=${hasta}`, accessToken);
}

export type OrdenProductosAdmin = 'vistos' | 'agregados' | 'vendidos' | 'menos_vendidos';

export interface FilaProductoAdmin {
  productoId: string;
  nombre: string;
  slug: string;
  vistas: number;
  agregadosCarrito: number;
  unidadesDirectas: number;
  unidadesEnCombo: number;
  unidadesVendidas: number;
  // Solo de venta directa: no incluye lo vendido dentro de un kit.
  ingresos: number;
  margen: number;
  stockDisponible: number;
}

export function obtenerProductos(
  accessToken: string,
  desde: string,
  hasta: string,
  orden: OrdenProductosAdmin,
  limite: number,
): Promise<FilaProductoAdmin[]> {
  return solicitar(
    `/productos?desde=${desde}&hasta=${hasta}&orden=${orden}&limite=${limite}`,
    accessToken,
  );
}

export interface FilaCalificacion {
  productoId: string;
  nombre: string;
  slug: string;
  calificacionPromedio: number;
  cantidadResenas: number;
}

export function obtenerCalificaciones(
  accessToken: string,
  orden: 'mejor' | 'peor',
  minimo: number,
): Promise<FilaCalificacion[]> {
  return solicitar(`/calificaciones?orden=${orden}&minimo=${minimo}`, accessToken);
}

export interface FilaOrigen {
  origen: string;
  sesiones: number;
  porcentaje: number;
}

export function obtenerOrigen(
  accessToken: string,
  desde: string,
  hasta: string,
): Promise<FilaOrigen[]> {
  return solicitar(`/origen?desde=${desde}&hasta=${hasta}`, accessToken);
}

export interface FilaBusqueda {
  termino: string;
  veces: number;
}

export function obtenerBusquedas(
  accessToken: string,
  desde: string,
  hasta: string,
): Promise<FilaBusqueda[]> {
  return solicitar(`/busquedas?desde=${desde}&hasta=${hasta}&sinResultados=true`, accessToken);
}

export interface Clientas {
  compraronPorPrimeraVez: number;
  compraronDeNuevo: number;
  registradosSinComprar: number;
  ticketPromedio: number;
  carritosAbandonados: number;
}

export function obtenerClientas(
  accessToken: string,
  desde: string,
  hasta: string,
): Promise<Clientas> {
  return solicitar(`/clientas?desde=${desde}&hasta=${hasta}`, accessToken);
}
