// Cliente HTTP para api/src/modulos/admin/productos. Mismo patrón que
// apiPedidosAdmin.ts: token del panel admin, GET simples y mutaciones
// POST/PATCH con cuerpo JSON.

const BASE_PRODUCTOS = '/api/admin/productos';
const BASE_VARIANTES = '/api/admin/variantes';
const BASE_ATRIBUTOS = '/api/admin/atributos';

export class ErrorProductosAdmin extends Error {
  readonly estadoHttp: number;
  readonly detalles?: unknown;

  constructor(estadoHttp: number, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.name = 'ErrorProductosAdmin';
    this.estadoHttp = estadoHttp;
    this.detalles = detalles;
  }
}

async function solicitar<T>(
  baseUrl: string,
  ruta: string,
  accessToken: string,
  opciones: RequestInit = {},
): Promise<T> {
  const respuesta = await fetch(`${baseUrl}${ruta}`, {
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
    throw new ErrorProductosAdmin(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
      cuerpo?.error?.detalles,
    );
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export type EstadoPublicacion = 'borrador' | 'publicado' | 'archivado';

// --- Listado -----------------------------------------------------------------

export interface FilaProductoAdmin {
  id: string;
  nombre: string;
  slug: string;
  estado: EstadoPublicacion;
  categoria: { id: string; nombre: string };
  creadoEn: string;
  cantidadVariantes: number;
  rangoPrecios: { min: number; max: number } | null;
  stockTotal: number;
  calificacionPromedio: number | null;
  agotado: boolean;
}

export interface Paginacion {
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
}

export interface ListadoProductos {
  datos: FilaProductoAdmin[];
  paginacion: Paginacion;
}

export interface FiltrosListadoProductos {
  categoriaId?: string;
  estado?: EstadoPublicacion;
  buscar?: string;
  pagina?: number;
  porPagina?: number;
}

export function listarProductos(
  accessToken: string,
  filtros: FiltrosListadoProductos,
): Promise<ListadoProductos> {
  const params = new URLSearchParams();
  if (filtros.categoriaId) params.set('categoriaId', filtros.categoriaId);
  if (filtros.estado) params.set('estado', filtros.estado);
  if (filtros.buscar) params.set('buscar', filtros.buscar);
  params.set('pagina', String(filtros.pagina ?? 1));
  params.set('porPagina', String(filtros.porPagina ?? 20));
  return solicitar(BASE_PRODUCTOS, `?${params.toString()}`, accessToken);
}

// --- Detalle -----------------------------------------------------------------

export interface ValorAtributoVariante {
  id: string;
  valor: string;
  hex: string | null;
  atributo: { id: string; nombre: string; slug: string };
}

export interface HistorialPrecioVariante {
  id: string;
  precio: number;
  precioAntes: number | null;
  costo: number | null;
  precioUsd: number | null;
  motivo: string | null;
  creadoEn: string;
  usuario: { nombre: string } | null;
}

export interface VarianteDetalle {
  id: string;
  productoId: string;
  sku: string;
  peso: number | null;
  stockActual: number;
  stockReservado: number;
  puntoReorden: number;
  precioActual: number;
  precioAntes: number | null;
  costoActual: number | null;
  precioUsd: number | null;
  activa: boolean;
  creadoEn: string;
  valoresAtributo: { valorAtributo: ValorAtributoVariante }[];
  historialPrecios: HistorialPrecioVariante[];
}

export type TipoImagenProducto =
  'principal' | 'galeria' | 'detalle' | 'modelo' | 'medida' | 'video';

export interface ImagenProductoDetalle {
  id: string;
  productoId: string;
  varianteId: string | null;
  url: string;
  altTexto: string;
  tipo: TipoImagenProducto;
  orden: number;
  ancho: number | null;
  alto: number | null;
  creadoEn: string;
}

export interface ProductoDetalle {
  id: string;
  nombre: string;
  slug: string;
  descripcionCorta: string | null;
  descripcion: string;
  cuidados: string | null;
  envioNotas: string | null;
  categoriaId: string;
  estado: EstadoPublicacion;
  publicadoEn: string | null;
  seoTitulo: string | null;
  seoDescripcion: string | null;
  creadoEn: string;
  actualizadoEn: string;
  categoria: { id: string; nombre: string; slug: string };
  variantes: VarianteDetalle[];
  imagenes: ImagenProductoDetalle[];
}

export function obtenerDetalleProducto(accessToken: string, id: string): Promise<ProductoDetalle> {
  return solicitar(BASE_PRODUCTOS, `/${encodeURIComponent(id)}`, accessToken);
}

// --- Alta / edición de producto ------------------------------------------------

export interface DatosCrearProducto {
  nombre: string;
  categoriaId: string;
  slug?: string;
}

export function crearProducto(
  accessToken: string,
  datos: DatosCrearProducto,
): Promise<ProductoDetalle> {
  return solicitar(BASE_PRODUCTOS, '', accessToken, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export interface DatosEditarProducto {
  nombre?: string;
  slug?: string;
  categoriaId?: string;
  descripcionCorta?: string | null;
  descripcion?: string;
  cuidados?: string | null;
  envioNotas?: string | null;
  seoTitulo?: string | null;
  seoDescripcion?: string | null;
}

export function editarProducto(
  accessToken: string,
  id: string,
  datos: DatosEditarProducto,
): Promise<ProductoDetalle> {
  return solicitar(BASE_PRODUCTOS, `/${encodeURIComponent(id)}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export interface KitAfectado {
  id: string;
  nombre: string;
}

export function cambiarEstadoProducto(
  accessToken: string,
  id: string,
  estado: EstadoPublicacion,
  confirmarKitsAfectados = false,
): Promise<ProductoDetalle> {
  return solicitar(BASE_PRODUCTOS, `/${encodeURIComponent(id)}/estado`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ estado, confirmarKitsAfectados }),
  });
}

// --- Variantes -----------------------------------------------------------------

export interface DatosCrearVariante {
  sku: string;
  precio: number;
  precioUsd?: number;
  costo?: number;
  stockInicial: number;
  puntoReorden: number;
  peso?: number;
  valoresAtributo: string[];
}

export function crearVariante(
  accessToken: string,
  productoId: string,
  datos: DatosCrearVariante,
): Promise<VarianteDetalle> {
  return solicitar(BASE_PRODUCTOS, `/${encodeURIComponent(productoId)}/variantes`, accessToken, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export interface DatosEditarVariante {
  sku?: string;
  puntoReorden?: number;
  peso?: number | null;
  activa?: boolean;
  valoresAtributo?: string[];
}

export function editarVariante(
  accessToken: string,
  id: string,
  datos: DatosEditarVariante,
): Promise<VarianteDetalle> {
  return solicitar(BASE_VARIANTES, `/${encodeURIComponent(id)}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export interface DatosPrecioVariante {
  precio: number;
  precioUsd?: number;
  costo?: number;
  motivo: string;
}

export function cambiarPrecioVariante(
  accessToken: string,
  id: string,
  datos: DatosPrecioVariante,
): Promise<VarianteDetalle> {
  return solicitar(BASE_VARIANTES, `/${encodeURIComponent(id)}/precio`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export type DatosPreciosProducto =
  | { modo: 'porcentaje'; porcentaje: number; motivo: string }
  | { modo: 'precioUnico'; precio: number; precioUsd?: number; motivo: string };

export function cambiarPreciosProducto(
  accessToken: string,
  productoId: string,
  datos: DatosPreciosProducto,
): Promise<ProductoDetalle> {
  return solicitar(BASE_PRODUCTOS, `/${encodeURIComponent(productoId)}/precios`, accessToken, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

// --- Atributos -----------------------------------------------------------------

export interface ValorAtributoOpcion {
  id: string;
  valor: string;
  hex: string | null;
}

export interface AtributoConValores {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  valoresAtributo: ValorAtributoOpcion[];
}

export function listarAtributos(accessToken: string): Promise<AtributoConValores[]> {
  return solicitar(BASE_ATRIBUTOS, '', accessToken);
}

export function crearValorAtributo(
  accessToken: string,
  atributoId: string,
  valor: string,
  hex?: string | null,
): Promise<ValorAtributoOpcion> {
  return solicitar(BASE_ATRIBUTOS, '', accessToken, {
    method: 'POST',
    body: JSON.stringify({ atributoId, valor, hex: hex ?? undefined }),
  });
}

// --- Imágenes ------------------------------------------------------------------

const BASE_IMAGENES = '/api/admin/imagenes';

export interface SubidaFirmadaImagen {
  urlFirmada: string;
  ruta: string;
  token: string;
  urlPublica: string;
}

export function firmarSubidaImagen(
  accessToken: string,
  productoId: string,
  tipo: string,
  tamano: number,
): Promise<SubidaFirmadaImagen> {
  return solicitar(
    BASE_PRODUCTOS,
    `/${encodeURIComponent(productoId)}/imagenes/firmar`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ tipo, tamano }),
    },
  );
}

export interface DatosCrearImagen {
  url: string;
  altTexto: string;
  tipo: TipoImagenProducto;
  orden: number;
  ancho: number;
  alto: number;
  varianteId?: string;
}

export function crearImagen(
  accessToken: string,
  productoId: string,
  datos: DatosCrearImagen,
): Promise<ImagenProductoDetalle> {
  return solicitar(BASE_PRODUCTOS, `/${encodeURIComponent(productoId)}/imagenes`, accessToken, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export interface DatosEditarImagen {
  altTexto?: string;
  tipo?: TipoImagenProducto;
  varianteId?: string | null;
}

export function editarImagen(
  accessToken: string,
  id: string,
  datos: DatosEditarImagen,
): Promise<ImagenProductoDetalle> {
  return solicitar(BASE_IMAGENES, `/${encodeURIComponent(id)}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function eliminarImagen(accessToken: string, id: string): Promise<void> {
  return solicitar(BASE_IMAGENES, `/${encodeURIComponent(id)}`, accessToken, { method: 'DELETE' });
}

export function reordenarImagenes(
  accessToken: string,
  productoId: string,
  ids: string[],
): Promise<ImagenProductoDetalle[]> {
  return solicitar(
    BASE_PRODUCTOS,
    `/${encodeURIComponent(productoId)}/imagenes/orden`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    },
  );
}
