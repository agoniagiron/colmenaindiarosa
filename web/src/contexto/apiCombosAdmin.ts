// Cliente HTTP para api/src/modulos/admin/combos. Mismo patrón que
// apiProductosAdmin.ts: token del panel admin, GET simples y mutaciones
// POST/PATCH con cuerpo JSON.

import { BASE_URL_API } from '../datos/urlApi.ts';

const BASE_KITS = `${BASE_URL_API}/api/admin/combos`;

export class ErrorKitsAdmin extends Error {
  readonly estadoHttp: number;
  readonly detalles?: unknown;

  constructor(estadoHttp: number, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.name = 'ErrorKitsAdmin';
    this.estadoHttp = estadoHttp;
    this.detalles = detalles;
  }
}

async function solicitar<T>(
  ruta: string,
  accessToken: string,
  opciones: RequestInit = {},
): Promise<T> {
  const respuesta = await fetch(`${BASE_KITS}${ruta}`, {
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
    throw new ErrorKitsAdmin(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
      cuerpo?.error?.detalles,
    );
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export interface ColorPieza {
  nombre: string;
  hex: string | null;
}

export interface PiezaKit {
  varianteId: string;
  sku: string;
  nombreProducto: string;
  color: ColorPieza | null;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number | null;
}

// El resumen (piezas, precioSueltoCop, ahorro, margen, disponible) lo
// calcula el backend y es el mismo en el listado y en el detalle — ver
// calcularResumenKit en servicio.ts. Nunca se recalcula acá.
export interface ResumenKit {
  piezas: number;
  precioSueltoCop: number;
  costoCop: number | null;
  ahorroCop: number;
  ahorroPorcentaje: number;
  margenCop: number | null;
  margenPorcentaje: number | null;
  margenBajo: boolean | null;
  disponible: boolean;
  piezaSinStock: string | null;
}

export interface FilaKitAdmin extends ResumenKit {
  id: string;
  nombre: string;
  slug: string;
  precioCop: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activo: boolean;
}

export interface KitDetalle extends ResumenKit {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagenUrl: string | null;
  // Fotos propias del kit (punto 2): nunca las de los productos que lo
  // componen. Ordenadas por orden ascendente, la principal puede no ser
  // la primera del arreglo — ver tipo en ImagenComboDetalle.
  imagenes: ImagenComboDetalle[];
  precioCop: number;
  precioUsd: number | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activo: boolean;
  destacado: boolean;
  items: PiezaKit[];
}

export interface ListadoKits {
  datos: FilaKitAdmin[];
  paginacion: { pagina: number; porPagina: number; total: number; totalPaginas: number };
}

export interface VarianteBuscada {
  id: string;
  sku: string;
  nombreProducto: string;
  precioActual: number;
  costoActual: number | null;
  color: ColorPieza | null;
}

export function listarKits(
  accessToken: string,
  filtros: { buscar?: string; pagina?: number },
): Promise<ListadoKits> {
  const params = new URLSearchParams();
  if (filtros.buscar) params.set('buscar', filtros.buscar);
  params.set('pagina', String(filtros.pagina ?? 1));
  return solicitar(`?${params.toString()}`, accessToken);
}

export function obtenerDetalleKit(accessToken: string, id: string): Promise<KitDetalle> {
  return solicitar(`/${encodeURIComponent(id)}`, accessToken);
}

export function buscarVariantes(accessToken: string, buscar: string): Promise<VarianteBuscada[]> {
  return solicitar(`/variantes?buscar=${encodeURIComponent(buscar)}`, accessToken);
}

export interface DatosItemKit {
  varianteId: string;
  cantidad: number;
}

export interface DatosKit {
  nombre: string;
  slug?: string;
  descripcion?: string | null;
  imagenUrl?: string | null;
  precioCop: number;
  precioUsd?: number | null;
  items: DatosItemKit[];
  vigenteDesde: string;
  vigenteHasta?: string | null;
  destacado?: boolean;
  activo?: boolean;
}

export function crearKit(accessToken: string, datos: DatosKit): Promise<KitDetalle> {
  return solicitar('', accessToken, { method: 'POST', body: JSON.stringify(datos) });
}

export function editarKit(
  accessToken: string,
  id: string,
  datos: Partial<DatosKit>,
): Promise<KitDetalle> {
  return solicitar(`/${encodeURIComponent(id)}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Resumen vivo del formulario (punto 12): el backend lo calcula con la
// misma fórmula que usa para guardar — ver calcularResumenKit en
// servicio.ts — nunca se repite esa cuenta acá.
export function previsualizarKit(
  accessToken: string,
  datos: { precioCop: number; items: DatosItemKit[] },
): Promise<ResumenKit> {
  return solicitar('/previsualizar', accessToken, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

// --- Imágenes propias del kit (punto 2) ----------------------------------------
// Misma mecánica de subida que ya existe para productos (ver
// apiProductosAdmin.ts, sección "Imágenes"): firmar → subir al storage →
// crear la fila. No se duplica ese helper, solo se adapta la forma de los
// datos a un kit (sin varianteId, con menos tipos posibles).

const BASE_IMAGENES_COMBO = `${BASE_URL_API}/api/admin/imagenes-combo`;

async function solicitarImagen<T>(
  ruta: string,
  accessToken: string,
  opciones: RequestInit = {},
): Promise<T> {
  const respuesta = await fetch(`${BASE_IMAGENES_COMBO}${ruta}`, {
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
    throw new ErrorKitsAdmin(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
      cuerpo?.error?.detalles,
    );
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export type TipoImagenCombo = 'principal' | 'galeria';

export interface ImagenComboDetalle {
  id: string;
  comboId: string;
  url: string;
  altTexto: string;
  tipo: TipoImagenCombo;
  orden: number;
  ancho: number | null;
  alto: number | null;
  creadoEn: string;
}

export interface SubidaFirmadaImagenCombo {
  urlFirmada: string;
  ruta: string;
  token: string;
  urlPublica: string;
}

export function firmarSubidaImagenCombo(
  accessToken: string,
  comboId: string,
  tipo: string,
  tamano: number,
): Promise<SubidaFirmadaImagenCombo> {
  return solicitar(`/${encodeURIComponent(comboId)}/imagenes/firmar`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ tipo, tamano }),
  });
}

export interface DatosCrearImagenCombo {
  url: string;
  altTexto: string;
  tipo: TipoImagenCombo;
  orden: number;
  ancho: number;
  alto: number;
}

export function crearImagenCombo(
  accessToken: string,
  comboId: string,
  datos: DatosCrearImagenCombo,
): Promise<ImagenComboDetalle> {
  return solicitar(`/${encodeURIComponent(comboId)}/imagenes`, accessToken, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export interface DatosEditarImagenCombo {
  altTexto?: string;
  tipo?: TipoImagenCombo;
}

export function editarImagenCombo(
  accessToken: string,
  id: string,
  datos: DatosEditarImagenCombo,
): Promise<ImagenComboDetalle> {
  return solicitarImagen(`/${encodeURIComponent(id)}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function eliminarImagenCombo(accessToken: string, id: string): Promise<void> {
  return solicitarImagen(`/${encodeURIComponent(id)}`, accessToken, { method: 'DELETE' });
}

export function reordenarImagenesCombo(
  accessToken: string,
  comboId: string,
  ids: string[],
): Promise<ImagenComboDetalle[]> {
  return solicitar(`/${encodeURIComponent(comboId)}/imagenes/orden`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ ids }),
  });
}
