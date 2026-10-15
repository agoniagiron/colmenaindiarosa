// Cliente HTTP para api/src/modulos/admin/productos. Mismo patrón que
// apiPedidosAdmin.ts: token del panel admin, GET simples y mutaciones
// POST/PATCH con cuerpo JSON.

import { BASE_URL_API } from '../datos/urlApi.ts';

const BASE_PRODUCTOS = `${BASE_URL_API}/api/admin/productos`;
const BASE_VARIANTES = `${BASE_URL_API}/api/admin/variantes`;
const BASE_ATRIBUTOS = `${BASE_URL_API}/api/admin/atributos`;

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

// Un 400 de validación trae detalles.campos: [{ campo, problema }], con la
// ruta del campo tal como viaja en el cuerpo ("precio",
// "combinaciones.3.stock"). Esto lo traduce a las etiquetas del formulario
// para que se vea qué corregir. Las posiciones numéricas se ignoran al
// buscar la etiqueta: "combinaciones.3.stock" usa la de "combinaciones.stock".
export function describirError(
  error: unknown,
  etiquetas: Record<string, string>,
  respaldo: string,
): string {
  if (!(error instanceof ErrorProductosAdmin)) return respaldo;
  const campos = (error.detalles as { campos?: { campo: string; problema: string }[] } | undefined)
    ?.campos;
  if (!Array.isArray(campos) || campos.length === 0) return error.message;

  const partes = campos.map(({ campo, problema }) => {
    const segmentos = campo.split('.').filter((s) => !/^\d+$/.test(s));
    const etiqueta =
      etiquetas[segmentos.join('.')] ?? etiquetas[segmentos[0] ?? ''] ?? (campo || 'Datos');
    return `${etiqueta}: ${problema}`;
  });
  return `Revisá ${partes.length === 1 ? 'este campo' : 'estos campos'}. ${partes.join('. ')}.`;
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
  // Sin variante principal utilizable (nunca definida, borrada o
  // inactiva): la tienda muestra la más barata con stock hasta elegir una.
  sinPrincipal: boolean;
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

// La portada de un producto es la primera foto por orden, nunca se elige
// por tipo: 'principal' ya no es un valor que este código escriba.
export type TipoImagenProducto = 'galeria' | 'detalle' | 'modelo' | 'medida' | 'video';

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
  // Solo la parte del modelo (VAL). El código completo (IR-PEL-VAL) lo arma
  // el backend en codigoProducto, con la misma función que los SKU; null
  // mientras falte el código de modelo.
  codigoModelo: string | null;
  codigoProducto: string | null;
  // La variante que muestra la tienda (tarjeta, ficha, orden y filtro).
  variantePrincipalId: string | null;
  principal: ResumenPrincipal;
  creadoEn: string;
  actualizadoEn: string;
  categoria: { id: string; nombre: string; slug: string; codigo: string | null };
  variantes: VarianteDetalle[];
  imagenes: ImagenProductoDetalle[];
  // Carrusel del héroe en la tienda (seccion:'portada'). Solo aplica a la
  // categoría Pelucas — ver PestanaGeneral en AdminProductoDetalle.tsx.
  destacadoPortada: boolean;
  ordenPortada: number | null;
}

export interface ResumenPrincipal {
  estado: 'definida' | 'sin_definir' | 'inactiva';
  sku: string | null;
  // Definida pero sin stock: la tienda muestra la más barata con stock.
  sinStock: boolean;
  // Aviso, no bloqueo: la principal es más cara que la más barata (precios
  // de lista, sin promociones).
  noEsLaMasBarata: { precioPrincipal: number; precioMinimo: number } | null;
}

export function cambiarVariantePrincipal(
  accessToken: string,
  productoId: string,
  varianteId: string,
): Promise<ProductoDetalle> {
  return solicitar(
    BASE_PRODUCTOS,
    `/${encodeURIComponent(productoId)}/variante-principal`,
    accessToken,
    { method: 'PATCH', body: JSON.stringify({ varianteId }) },
  );
}

export function obtenerDetalleProducto(accessToken: string, id: string): Promise<ProductoDetalle> {
  return solicitar(BASE_PRODUCTOS, `/${encodeURIComponent(id)}`, accessToken);
}

// --- Alta / edición de producto ------------------------------------------------

export interface DatosCrearProducto {
  nombre: string;
  categoriaId: string;
  codigoModelo: string;
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
  codigoModelo?: string;
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

// El backend ya rechaza destacado:true fuera de Pelucas (400); acá no se
// repite esa validación, solo se muestra el campo condicionalmente (ver
// PestanaGeneral en AdminProductoDetalle.tsx).
export function cambiarPortadaProducto(
  accessToken: string,
  id: string,
  destacado: boolean,
  orden?: number,
): Promise<ProductoDetalle> {
  return solicitar(BASE_PRODUCTOS, `/${encodeURIComponent(id)}/portada`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ destacado, ...(orden !== undefined ? { orden } : {}) }),
  });
}

// --- Variantes -----------------------------------------------------------------

// Sin sku: lo genera el backend (sku.ts) a partir del código de producto y
// de los códigos de largo y color.
export interface DatosCrearVariante {
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

// --- Variantes en lote (asistente) -----------------------------------------------
// El backend recalcula todo al crear: SKU, existencia, validaciones. Acá
// solo viaja lo que la persona eligió y escribió.

export interface LongitudLote {
  valorId: string;
  precio: number;
  costo?: number;
}

export interface DatosPrevisualizarLote {
  longitudes: LongitudLote[];
  colores: string[];
  fijos: string[];
}

export interface CombinacionLote {
  longitud: { id: string; valor: string };
  color: { id: string; valor: string; hex: string | null } | null;
  sku: string;
  precio: number;
  costo: number | null;
  yaExiste: boolean;
  skuOcupado: boolean;
}

export interface VistaPreviaLote {
  codigoProducto: string;
  combinaciones: CombinacionLote[];
}

export interface CombinacionElegida {
  longitudId: string;
  colorId: string | null;
  precio?: number;
  stock: number;
}

export interface ResultadoLote {
  creadas: string[];
  saltadas: string[];
}

export function previsualizarLoteVariantes(
  accessToken: string,
  productoId: string,
  datos: DatosPrevisualizarLote,
): Promise<VistaPreviaLote> {
  return solicitar(
    BASE_PRODUCTOS,
    `/${encodeURIComponent(productoId)}/variantes/lote/previsualizar`,
    accessToken,
    { method: 'POST', body: JSON.stringify(datos) },
  );
}

export function crearLoteVariantes(
  accessToken: string,
  productoId: string,
  datos: DatosPrevisualizarLote & { combinaciones: CombinacionElegida[] },
): Promise<ResultadoLote> {
  return solicitar(
    BASE_PRODUCTOS,
    `/${encodeURIComponent(productoId)}/variantes/lote`,
    accessToken,
    { method: 'POST', body: JSON.stringify(datos) },
  );
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
  // Parte del SKU (24, NEG). null en atributos que no van en el SKU.
  codigo: string | null;
}

export interface AtributoConValores {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  // Solo viene al pedir los de una categoría: si cada variante nueva tiene
  // que tener un valor de este atributo.
  obligatorio?: boolean;
  valoresAtributo: ValorAtributoOpcion[];
}

// Sin categoría: todos los atributos con todos sus valores (para editar una
// variante existente, que puede usar un valor que su categoría ya no
// permite). Con categoría: solo los que esa categoría usa, en su orden, con
// sus valores permitidos (para crear variantes nuevas).
export function listarAtributos(
  accessToken: string,
  categoriaId?: string,
): Promise<AtributoConValores[]> {
  return solicitar(
    BASE_ATRIBUTOS,
    categoriaId ? `?categoriaId=${encodeURIComponent(categoriaId)}` : '',
    accessToken,
  );
}

// --- Pantalla de atributos -----------------------------------------------------

export interface ValorDeAtributo {
  id: string;
  valor: string;
  hex: string | null;
  codigo: string | null;
  orden: number;
}

export interface AtributoConfigurable {
  id: string;
  slug: string;
  nombre: string;
  valores: ValorDeAtributo[];
}

// Un atributo dentro de una categoría. El orden es la posición en la lista.
export interface AtributoEnCategoria {
  atributoId: string;
  obligatorio: boolean;
  valorIds: string[];
}

export interface CategoriaConfigurada {
  id: string;
  slug: string;
  nombre: string;
  atributos: AtributoEnCategoria[];
}

export interface ConfiguracionAtributos {
  atributos: AtributoConfigurable[];
  categorias: CategoriaConfigurada[];
}

export function obtenerConfiguracionAtributos(
  accessToken: string,
): Promise<ConfiguracionAtributos> {
  return solicitar(BASE_ATRIBUTOS, '/configuracion', accessToken);
}

// Reemplaza la configuración completa de la categoría.
export function guardarConfiguracionCategoria(
  accessToken: string,
  categoriaId: string,
  atributos: AtributoEnCategoria[],
): Promise<ConfiguracionAtributos> {
  return solicitar(
    BASE_ATRIBUTOS,
    `/categorias/${encodeURIComponent(categoriaId)}`,
    accessToken,
    { method: 'PUT', body: JSON.stringify({ atributos }) },
  );
}

export interface DatosNuevoValor {
  atributoId: string;
  valor: string;
  hex?: string;
  codigo?: string;
  // En qué categorías se habilita, en el mismo paso.
  categoriaIds: string[];
}

export function crearValorAtributo(
  accessToken: string,
  datos: DatosNuevoValor,
): Promise<ValorDeAtributo> {
  return solicitar(BASE_ATRIBUTOS, '', accessToken, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

// --- Imágenes ------------------------------------------------------------------

const BASE_IMAGENES = `${BASE_URL_API}/api/admin/imagenes`;

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
