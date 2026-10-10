// Cliente HTTP para api/src/modulos/admin/limitadas. Mismo patrón que
// apiCombosAdmin.ts: token del panel admin, GET simples y mutaciones
// POST/PATCH con cuerpo JSON. Sin DELETE: en este proyecto no se borra,
// se desactiva (ver AJUSTE 1 — editarEdicion con { activa: false }).

import { BASE_URL_API } from '../datos/urlApi.ts';

const BASE_LIMITADAS = `${BASE_URL_API}/api/admin/limitadas`;

export class ErrorLimitadasAdmin extends Error {
  readonly estadoHttp: number;
  readonly detalles?: unknown;

  constructor(estadoHttp: number, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.name = 'ErrorLimitadasAdmin';
    this.estadoHttp = estadoHttp;
    this.detalles = detalles;
  }
}

async function solicitar<T>(
  ruta: string,
  accessToken: string,
  opciones: RequestInit = {},
): Promise<T> {
  const respuesta = await fetch(`${BASE_LIMITADAS}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...opciones.headers,
    },
  });

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: { mensaje?: string; detalles?: unknown };
    } | null;
    throw new ErrorLimitadasAdmin(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
      cuerpo?.error?.detalles,
    );
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export type EstadoEdicionLimitada = 'inactiva' | 'programada' | 'vencida' | 'agotada' | 'vigente';

export interface ImagenMini {
  url: string;
  altTexto: string;
}

export interface EdicionLimitadaAdmin {
  id: string;
  nombre: string;
  descripcion: string | null;
  producto: {
    id: string;
    nombre: string;
    slug: string;
    imagen: ImagenMini | null;
    // Hasta 5 (tope de rotación de MiniaturaGaleria), ya resueltas por el
    // listado: la fila no pide el detalle completo del producto solo
    // para esto.
    imagenes: ImagenMini[];
    // Total real de fotos (puede ser más de 5), para el indicador "1/N"
    // de MiniaturaGaleria en táctil.
    cantidadImagenes: number;
  };
  // null = sin tope (ver AJUSTE 2): el lote se define por fecha, no por
  // cantidad, y nunca llega a "agotada" por ventas.
  unidadesLote: number | null;
  unidadesVendidas: number;
  unidadesRestantes: number | null;
  mostrarRestantes: boolean;
  desde: string;
  hasta: string | null;
  activa: boolean;
  estado: EstadoEdicionLimitada;
}

export interface ListadoEdicionesLimitadas {
  datos: EdicionLimitadaAdmin[];
  paginacion: { pagina: number; porPagina: number; total: number; totalPaginas: number };
}

export function listarEdiciones(
  accessToken: string,
  filtros: { incluirInactivas?: boolean; pagina?: number } = {},
): Promise<ListadoEdicionesLimitadas> {
  const params = new URLSearchParams();
  if (filtros.incluirInactivas) params.set('incluirInactivas', 'true');
  params.set('pagina', String(filtros.pagina ?? 1));
  return solicitar(`?${params.toString()}`, accessToken);
}

export function obtenerDetalleEdicion(
  accessToken: string,
  id: string,
): Promise<EdicionLimitadaAdmin> {
  return solicitar(`/${encodeURIComponent(id)}`, accessToken);
}

export interface DatosCrearEdicion {
  productoId: string;
  nombre: string;
  descripcion?: string | null;
  unidadesLote?: number | null;
  mostrarRestantes?: boolean;
  desde: string;
  hasta?: string | null;
}

export interface DatosEditarEdicion {
  nombre?: string;
  descripcion?: string | null;
  unidadesLote?: number | null;
  mostrarRestantes?: boolean;
  desde?: string;
  hasta?: string | null;
  activa?: boolean;
}

export function crearEdicion(
  accessToken: string,
  datos: DatosCrearEdicion,
): Promise<EdicionLimitadaAdmin> {
  return solicitar('', accessToken, { method: 'POST', body: JSON.stringify(datos) });
}

export function editarEdicion(
  accessToken: string,
  id: string,
  datos: DatosEditarEdicion,
): Promise<EdicionLimitadaAdmin> {
  return solicitar(`/${encodeURIComponent(id)}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}
