// Implementación actual de Repositorio: lee de datos/muestra.ts y resuelve
// filtros, orden y paginación en memoria. El retardo artificial simula una
// petición real para que los estados de carga se puedan probar ahora mismo.

import { CATEGORIAS, CUPONES, PRODUCTOS } from './muestra.ts';
import type {
  FiltrosProducto,
  OrdenProducto,
  Pagina,
  Repositorio,
  ResultadoPaginado,
} from './repositorio.ts';
import type { Categoria, Cupon, Producto, VarianteProducto } from '../tipos/index.ts';

const RETARDO_MS = 300;
const MAXIMO_RELACIONADOS = 4;
const PAGINA_POR_DEFECTO: Pagina = { pagina: 1, porPagina: 12 };

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function precioDesde(producto: Producto): number {
  const precios = producto.variantes.map((variante) => variante.precio);
  return precios.length > 0 ? Math.min(...precios) : producto.precioBase;
}

function varianteCumpleAtributos(variante: VarianteProducto, filtros: FiltrosProducto): boolean {
  if (
    filtros.tipoBase?.length &&
    !(variante.tipoBase && filtros.tipoBase.includes(variante.tipoBase))
  ) {
    return false;
  }
  if (
    filtros.longitud?.length &&
    !(variante.longitud && filtros.longitud.includes(variante.longitud))
  ) {
    return false;
  }
  if (filtros.talla?.length && !(variante.talla && filtros.talla.includes(variante.talla))) {
    return false;
  }
  if (
    filtros.densidad?.length &&
    !(variante.densidad && filtros.densidad.includes(variante.densidad))
  ) {
    return false;
  }
  if (filtros.color?.length && !(variante.color && filtros.color.includes(variante.color.nombre))) {
    return false;
  }
  return true;
}

function cumpleFiltros(
  producto: Producto,
  categoriaPorSlug: Map<string, Categoria>,
  filtros: FiltrosProducto,
): boolean {
  if (filtros.categoriaSlug?.length) {
    const idsCategoria = filtros.categoriaSlug
      .map((slug) => categoriaPorSlug.get(slug)?.id)
      .filter((id): id is string => Boolean(id));
    if (!idsCategoria.includes(producto.categoriaId)) return false;
  }

  if (filtros.destacado !== undefined && producto.destacado !== filtros.destacado) return false;

  if (filtros.texto) {
    const texto = filtros.texto.trim().toLowerCase();
    const coincide =
      producto.nombre.toLowerCase().includes(texto) ||
      producto.descripcion.toLowerCase().includes(texto);
    if (!coincide) return false;
  }

  if (filtros.precioMin !== undefined && precioDesde(producto) < filtros.precioMin) return false;
  if (filtros.precioMax !== undefined && precioDesde(producto) > filtros.precioMax) return false;

  const hayFiltroDeAtributo =
    Boolean(filtros.tipoBase?.length) ||
    Boolean(filtros.longitud?.length) ||
    Boolean(filtros.talla?.length) ||
    Boolean(filtros.densidad?.length) ||
    Boolean(filtros.color?.length);
  if (hayFiltroDeAtributo) {
    const algunaVarianteCoincide = producto.variantes.some((variante) =>
      varianteCumpleAtributos(variante, filtros),
    );
    if (!algunaVarianteCoincide) return false;
  }

  return true;
}

function ordenarProductos(productos: Producto[], orden: OrdenProducto): Producto[] {
  switch (orden) {
    case 'precio_asc':
      return [...productos].sort((a, b) => precioDesde(a) - precioDesde(b));
    case 'precio_desc':
      return [...productos].sort((a, b) => precioDesde(b) - precioDesde(a));
    case 'calificacion_desc':
      return [...productos].sort((a, b) => b.calificacion - a.calificacion);
    case 'novedad':
      // Los productos más nuevos van al final de PRODUCTOS: se invierte.
      return [...productos].reverse();
    case 'relevancia':
    default:
      return [...productos];
  }
}

async function listarCategorias(): Promise<Categoria[]> {
  await esperar(RETARDO_MS);
  return CATEGORIAS;
}

// Nota para cuando exista la API real: Catalogo.tsx pide aquí el catálogo
// completo (porPagina muy alto) solo para derivar en el cliente las
// opciones de filtro (facetas: categorías, tipos de base, colores, etc.).
// Contra estos datos de muestra en memoria es aceptable, pero contra el
// backend real esto debe reemplazarse por un endpoint de facetas dedicado
// (p. ej. GET /productos/facetas) en vez de traer todos los productos.
async function listarProductos(
  filtros: FiltrosProducto = {},
  orden: OrdenProducto = 'relevancia',
  pagina: Pagina = PAGINA_POR_DEFECTO,
): Promise<ResultadoPaginado<Producto>> {
  await esperar(RETARDO_MS);

  const categoriaPorSlug = new Map(CATEGORIAS.map((categoria) => [categoria.slug, categoria]));
  const filtrados = PRODUCTOS.filter((producto) =>
    cumpleFiltros(producto, categoriaPorSlug, filtros),
  );
  const ordenados = ordenarProductos(filtrados, orden);

  const total = ordenados.length;
  const porPagina = pagina.porPagina;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaActual = Math.min(Math.max(1, pagina.pagina), totalPaginas);
  const inicio = (paginaActual - 1) * porPagina;
  const datos = ordenados.slice(inicio, inicio + porPagina);

  return {
    datos,
    paginacion: { pagina: paginaActual, porPagina, total, totalPaginas },
  };
}

async function obtenerProducto(slug: string): Promise<Producto | null> {
  await esperar(RETARDO_MS);
  return PRODUCTOS.find((producto) => producto.slug === slug) ?? null;
}

async function listarRelacionados(slug: string): Promise<Producto[]> {
  await esperar(RETARDO_MS);
  const producto = PRODUCTOS.find((item) => item.slug === slug);
  if (!producto) return [];

  return PRODUCTOS.filter(
    (item) => item.categoriaId === producto.categoriaId && item.slug !== producto.slug,
  ).slice(0, MAXIMO_RELACIONADOS);
}

async function buscarCupon(codigo: string): Promise<Cupon | null> {
  await esperar(RETARDO_MS);
  const codigoNormalizado = codigo.trim().toUpperCase();
  return CUPONES.find((cupon) => cupon.codigo === codigoNormalizado) ?? null;
}

export const repositorioMemoria: Repositorio = {
  listarCategorias,
  listarProductos,
  obtenerProducto,
  listarRelacionados,
  buscarCupon,
};
