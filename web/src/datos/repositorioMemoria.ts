// Implementación de Repositorio usada solo en pruebas (ver
// src/test/setup.ts): lee de datos/muestra.ts y resuelve filtros, orden y
// paginación en memoria. El retardo artificial simula una petición real
// para que los estados de carga se puedan probar.

import {
  CATEGORIAS,
  COMBOS,
  CONFIGURACION_PUBLICA,
  CUPONES,
  LIMITADAS,
  PRODUCTOS,
} from './muestra.ts';
import type {
  Facetas,
  FiltrosProducto,
  HeroePortada,
  OrdenProducto,
  Pagina,
  ProductoHeroe,
  Repositorio,
  ResultadoPaginado,
  TonoConConteo,
} from './repositorio.ts';
import type {
  Categoria,
  Combo,
  Cupon,
  EdicionLimitada,
  EntradaConfiguracion,
  Producto,
  ValorAtributo,
  VarianteProducto,
} from '../tipos/index.ts';

const RETARDO_MS = 300;
const MAXIMO_RELACIONADOS = 4;
const PAGINA_POR_DEFECTO: Pagina = { pagina: 1, porPagina: 12 };

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function precioDesde(producto: Producto): number {
  return producto.precioBase.cop;
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

async function listarFacetas(filtros: FiltrosProducto = {}): Promise<Facetas> {
  await esperar(RETARDO_MS);

  const categoriaPorSlug = new Map(CATEGORIAS.map((categoria) => [categoria.slug, categoria]));
  const candidatos = PRODUCTOS.filter((producto) =>
    cumpleFiltros(producto, categoriaPorSlug, filtros),
  );

  const tiposBase = new Set<string>();
  const longitudes = new Set<string>();
  const tallas = new Set<string>();
  const densidades = new Set<string>();
  const coloresPorNombre = new Map<string, TonoConConteo>();

  for (const producto of candidatos) {
    const coloresDelProducto = new Set<string>();
    for (const variante of producto.variantes) {
      if (variante.tipoBase) tiposBase.add(variante.tipoBase);
      if (variante.longitud) longitudes.add(variante.longitud);
      if (variante.talla) tallas.add(variante.talla);
      if (variante.densidad) densidades.add(variante.densidad);
      if (variante.color) coloresDelProducto.add(variante.color.nombre);
    }
    for (const nombreColor of coloresDelProducto) {
      const variante = producto.variantes.find((v) => v.color?.nombre === nombreColor);
      const existente = coloresPorNombre.get(nombreColor);
      coloresPorNombre.set(nombreColor, {
        nombre: nombreColor,
        hex: variante?.color?.hex,
        conteo: (existente?.conteo ?? 0) + 1,
      });
    }
  }

  return {
    tiposBase: Array.from(tiposBase).sort(),
    longitudes: Array.from(longitudes).sort(),
    tallas: Array.from(tallas).sort(),
    densidades: Array.from(densidades).sort(),
    colores: Array.from(coloresPorNombre.values()),
  };
}

const SLUG_CATEGORIA_PORTADA = 'cat-pelucas';

function estaAgotado(producto: Producto): boolean {
  return producto.variantes.every((v) => v.stockActual - v.stockReservado <= 0);
}

// No hay un concepto de "marcado para portada" en los datos de muestra:
// se reutiliza el flag `destacado` ya existente, acotado a Pelucas, como
// equivalente de prueba de producto_destacado con seccion:'portada' (ver
// api/src/modulos/portada/servicio.ts). Mismo criterio de disponibilidad
// que el real: una peluca agotada no entra al héroe.
async function obtenerHeroePortada(): Promise<HeroePortada> {
  await esperar(RETARDO_MS);

  const destacadas = PRODUCTOS.filter(
    (p) => p.categoriaId === SLUG_CATEGORIA_PORTADA && p.destacado && !estaAgotado(p),
  );

  const coloresUnion = new Map<string, ValorAtributo>();
  const productosHeroe: ProductoHeroe[] = destacadas.map((producto) => {
    const coloresProducto = new Map<string, ValorAtributo>();
    for (const variante of producto.variantes) {
      if (variante.color && !coloresProducto.has(variante.color.nombre)) {
        coloresProducto.set(variante.color.nombre, variante.color);
        if (!coloresUnion.has(variante.color.nombre)) {
          coloresUnion.set(variante.color.nombre, variante.color);
        }
      }
    }
    const imagenPrincipal = producto.imagenes[0];
    return {
      id: producto.id,
      slug: producto.slug,
      nombre: producto.nombre,
      colores: Array.from(coloresProducto.values()),
      ...(imagenPrincipal
        ? { imagenPrincipal: { url: imagenPrincipal.url, altTexto: imagenPrincipal.altTexto } }
        : {}),
    };
  });

  return { destacadas: productosHeroe, colores: Array.from(coloresUnion.values()) };
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

async function obtenerConfiguracionPublica(): Promise<EntradaConfiguracion[]> {
  await esperar(RETARDO_MS);
  return CONFIGURACION_PUBLICA;
}

async function listarLimitadas(): Promise<EdicionLimitada[]> {
  await esperar(RETARDO_MS);
  return LIMITADAS;
}

async function listarCombos(): Promise<Combo[]> {
  await esperar(RETARDO_MS);
  return COMBOS;
}

export const repositorioMemoria: Repositorio = {
  listarCategorias,
  listarProductos,
  listarFacetas,
  obtenerHeroePortada,
  obtenerProducto,
  listarRelacionados,
  buscarCupon,
  obtenerConfiguracionPublica,
  listarLimitadas,
  listarCombos,
};
