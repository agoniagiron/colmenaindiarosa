import { Prisma } from '@prisma/client';
import { atributosDeCategoria } from '../../lib/atributosCategoria.js';
import { extraerAtributosVariante } from '../../lib/atributosVariante.js';
import { calcularPrecioDualConTasa, obtenerTasaUsdVigente } from '../../lib/moneda.js';
import { prisma } from '../../lib/prisma.js';
import {
  aplicarPromocionAPrecio,
  listarPromocionesVigentes,
  obtenerMejorPromocionDePrecio,
} from '../../lib/promociones.js';
import type { PromocionVigente } from '../../lib/promociones.js';
import type { FiltrosProducto, QueryProductos } from './esquemas.js';
import { resolverVarianteMostrada } from './variantePrincipal.js';
import type { VarianteMostrada } from './variantePrincipal.js';

const SLUGS_ATRIBUTO = {
  tipo: 'tipo_base',
  longitud: 'longitud',
  color: 'color',
  talla: 'talla',
  densidad: 'densidad',
} as const;

type ClaveAtributo = keyof typeof SLUGS_ATRIBUTO;

const CLAVES_ATRIBUTO = Object.keys(SLUGS_ATRIBUTO) as ClaveAtributo[];

// ---------------------------------------------------------------------------
// Construcción de filtros: dos condiciones de atributos distintos deben
// cumplirse en la MISMA variante, nunca repartidas entre variantes distintas
// del producto. Por eso todas viajan como AND dentro del mismo
// `variantes.some`. El precio NO va acá: se filtra en memoria por el precio
// que muestra la tarjeta (ver precioMostradoEnRango), que sale de la variante
// principal con su promoción — no de cualquier variante.
// ---------------------------------------------------------------------------

function condicionAtributo(
  clave: ClaveAtributo,
  valores: string[] | undefined,
): Prisma.VarianteProductoWhereInput | null {
  if (!valores || valores.length === 0) return null;
  return {
    valoresAtributo: {
      some: {
        valorAtributo: {
          valor: { in: valores },
          atributo: { slug: SLUGS_ATRIBUTO[clave] },
        },
      },
    },
  };
}

function condicionesVariante(
  filtros: FiltrosProducto,
  excluirAtributo?: ClaveAtributo,
): Prisma.VarianteProductoWhereInput[] {
  const condiciones: Prisma.VarianteProductoWhereInput[] = [];

  for (const clave of CLAVES_ATRIBUTO) {
    if (clave === excluirAtributo) continue;
    const condicion = condicionAtributo(clave, filtros[clave]);
    if (condicion) condiciones.push(condicion);
  }

  return condiciones;
}

function construirWhereProducto(
  filtros: FiltrosProducto,
  excluirAtributo?: ClaveAtributo,
): Prisma.ProductoWhereInput {
  const where: Prisma.ProductoWhereInput = {
    estado: 'publicado',
    variantes: {
      some: {
        activa: true,
        AND: condicionesVariante(filtros, excluirAtributo),
      },
    },
  };

  if (filtros.categoria) {
    where.categoria = { slug: filtros.categoria };
  }

  if (filtros.busqueda) {
    where.OR = [
      { nombre: { contains: filtros.busqueda, mode: 'insensitive' } },
      { descripcion: { contains: filtros.busqueda, mode: 'insensitive' } },
    ];
  }

  if (filtros.destacado !== undefined) {
    const ahora = new Date();
    // seccion: 'inicio' a propósito. producto_destacado también guarda la
    // sección 'portada' (carrusel del héroe, ver modulos/portada/), que es
    // un concepto aparte: un producto marcado para portada no debe
    // aparecer como "Destacado" en el catálogo ni entrar en este filtro.
    const condicionVigente: Prisma.ProductoDestacadoWhereInput = {
      seccion: 'inicio',
      desde: { lte: ahora },
      OR: [{ hasta: null }, { hasta: { gt: ahora } }],
    };
    where.destacados = filtros.destacado ? { some: condicionVigente } : { none: condicionVigente };
  }

  return where;
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

export async function listarCategorias() {
  const categorias = await prisma.categoria.findMany({
    where: { activa: true },
    orderBy: { orden: 'asc' },
    select: {
      id: true,
      nombre: true,
      slug: true,
      descripcion: true,
      imagenUrl: true,
      _count: { select: { productos: { where: { estado: 'publicado' } } } },
    },
  });

  return categorias.map((categoria) => ({
    id: categoria.id,
    nombre: categoria.nombre,
    slug: categoria.slug,
    descripcion: categoria.descripcion,
    imagenUrl: categoria.imagenUrl,
    conteoProductos: categoria._count.productos,
  }));
}

// ---------------------------------------------------------------------------
// Productos: selects compartidos (sin N+1: todo resuelto con include/select)
// ---------------------------------------------------------------------------

const SELECT_VARIANTE = {
  id: true,
  sku: true,
  precioActual: true,
  precioAntes: true,
  precioUsd: true,
  stockActual: true,
  stockReservado: true,
  imagenes: {
    orderBy: { orden: 'asc' },
    select: { id: true, url: true, altTexto: true },
  },
  valoresAtributo: {
    select: {
      valorAtributo: {
        select: {
          valor: true,
          hex: true,
          atributo: { select: { slug: true } },
        },
      },
    },
  },
} satisfies Prisma.VarianteProductoSelect;

const SELECT_PRODUCTO = {
  id: true,
  nombre: true,
  slug: true,
  descripcion: true,
  categoriaId: true,
  creadoEn: true,
  imagenes: {
    where: { varianteId: null },
    orderBy: { orden: 'asc' },
    select: { id: true, url: true, altTexto: true },
  },
  variantePrincipalId: true,
  variantes: { where: { activa: true }, select: SELECT_VARIANTE },
  resumen: { select: { calificacionPromedio: true, cantidadResenas: true } },
  // seccion: 'inicio' a propósito — ver el comentario en construirWhereProducto.
  destacados: { where: { seccion: 'inicio' }, select: { desde: true, hasta: true } },
} satisfies Prisma.ProductoSelect;

type VarianteConAtributos = Prisma.VarianteProductoGetPayload<{ select: typeof SELECT_VARIANTE }>;
type ProductoConDetalle = Prisma.ProductoGetPayload<{ select: typeof SELECT_PRODUCTO }>;

function esDestacadoVigente(destacados: { desde: Date; hasta: Date | null }[]): boolean {
  const ahora = new Date();
  return destacados.some((d) => d.desde <= ahora && (d.hasta === null || d.hasta > ahora));
}

// Contexto que hace falta para encontrar la promoción que aplica (por
// variante, por producto o por categoría) y para convertir a USD.
interface ContextoPrecio {
  productoId: string;
  categoriaId: string;
  promociones: PromocionVigente[];
  tasaUsd: number;
}

// El precio que ve la clienta (con la mejor promoción que aplique). Única
// cuenta: la usan la tarjeta, la ficha, el orden y el filtro por precio.
function precioConPromocion(
  variante: { id: string; precioActual: number },
  contexto: Pick<ContextoPrecio, 'productoId' | 'categoriaId' | 'promociones'>,
) {
  const promo = obtenerMejorPromocionDePrecio(contexto.promociones, {
    varianteId: variante.id,
    productoId: contexto.productoId,
    categoriaId: contexto.categoriaId,
  });
  return { promo, cop: promo ? aplicarPromocionAPrecio(variante.precioActual, promo) : variante.precioActual };
}

interface ProductoParaMostrar {
  id: string;
  categoriaId: string;
  variantePrincipalId: string | null;
  // Solo variantes activas (los selects del catálogo ya filtran activa: true).
  variantes: { id: string; precioActual: number; stockActual: number; stockReservado: number }[];
}

// Qué variante y qué precio muestra la tienda para este producto. Ver
// variantePrincipal.ts para las reglas.
function varianteMostradaDe(
  producto: ProductoParaMostrar,
  promociones: PromocionVigente[],
): VarianteMostrada {
  const contexto = { productoId: producto.id, categoriaId: producto.categoriaId, promociones };
  return resolverVarianteMostrada(
    producto.variantes.map((v) => ({
      id: v.id,
      precio: precioConPromocion(v, contexto).cop,
      disponible: v.stockActual - v.stockReservado,
    })),
    producto.variantePrincipalId,
  );
}

// Precio de tarjeta completo (COP y USD) para quien muestra un producto
// fuera del catálogo, como las ediciones limitadas: la misma variante y el
// mismo número que la tarjeta del catálogo y la ficha. Mismo armado del USD
// que mapearVariante: con promoción, el USD sale de la tasa vigente.
export function precioDeTarjeta(
  producto: Omit<ProductoParaMostrar, 'variantes'> & {
    variantes: (ProductoParaMostrar['variantes'][number] & { precioUsd: number | null })[];
  },
  promociones: PromocionVigente[],
  tasaUsd: number,
) {
  const mostrada = varianteMostradaDe(producto, promociones);
  const variante = producto.variantes.find((v) => v.id === mostrada.varianteId);
  const { promo } = variante
    ? precioConPromocion(variante, { ...producto, productoId: producto.id, promociones })
    : { promo: null };
  return {
    precio: calcularPrecioDualConTasa(
      mostrada.precio,
      promo ? null : (variante?.precioUsd ?? null),
      tasaUsd,
    ),
    desde: mostrada.desde,
    varianteId: mostrada.varianteId,
  };
}

function precioMostradoEnRango(precio: number, filtros: FiltrosProducto): boolean {
  if (filtros.precioMin !== undefined && precio < filtros.precioMin) return false;
  if (filtros.precioMax !== undefined && precio > filtros.precioMax) return false;
  return true;
}

function mapearVariante(variante: VarianteConAtributos, contexto: ContextoPrecio) {
  const { promo, cop: precioConDescuentoCop } = precioConPromocion(variante, contexto);

  return {
    id: variante.id,
    sku: variante.sku,
    // precioUsd guardado es del precio de lista: si hay promoción, el USD
    // también sale de la tasa vigente en vez del valor guardado (ese
    // quedó fijado para el precio SIN descuento).
    precioOriginal: calcularPrecioDualConTasa(
      variante.precioActual,
      variante.precioUsd,
      contexto.tasaUsd,
    ),
    precioConDescuento: calcularPrecioDualConTasa(
      precioConDescuentoCop,
      promo ? null : variante.precioUsd,
      contexto.tasaUsd,
    ),
    ...(variante.precioAntes
      ? { precioAntes: calcularPrecioDualConTasa(variante.precioAntes, null, contexto.tasaUsd) }
      : {}),
    stockActual: variante.stockActual,
    stockReservado: variante.stockReservado,
    imagenes: variante.imagenes,
    ...extraerAtributosVariante(variante.valoresAtributo),
  };
}

function mapearProducto(
  producto: ProductoConDetalle,
  promociones: PromocionVigente[],
  tasaUsd: number,
) {
  const contexto: ContextoPrecio = {
    productoId: producto.id,
    categoriaId: producto.categoriaId,
    promociones,
    tasaUsd,
  };
  const variantes = producto.variantes.map((v) => mapearVariante(v, contexto));

  // Precio de la tarjeta = precio de la variante mostrada (la principal, o
  // su reemplazo si está agotada), con la promoción ya aplicada. La ficha
  // abre en esa misma variante (varianteMostradaId).
  const mostrada = varianteMostradaDe(producto, promociones);
  const varianteMostrada = variantes.find((v) => v.id === mostrada.varianteId);

  return {
    id: producto.id,
    nombre: producto.nombre,
    slug: producto.slug,
    descripcion: producto.descripcion,
    categoriaId: producto.categoriaId,
    precioBase:
      varianteMostrada?.precioConDescuento ?? calcularPrecioDualConTasa(0, null, tasaUsd),
    // true solo si hay más de un precio y el mostrado es el mínimo: la
    // tarjeta antepone "desde". Si la principal es más cara, número solo.
    desde: mostrada.desde,
    varianteMostradaId: mostrada.varianteId,
    calificacion: producto.resumen ? Number(producto.resumen.calificacionPromedio) : 0,
    cantidadResenas: producto.resumen?.cantidadResenas ?? 0,
    destacado: esDestacadoVigente(producto.destacados),
    imagenes: producto.imagenes,
    variantes,
  };
}

// ---------------------------------------------------------------------------
// Listado con filtros, orden y paginación
// ---------------------------------------------------------------------------

interface ClaveOrden {
  id: string;
  // El mismo precio que muestra la tarjeta (varianteMostradaDe).
  precio: number;
  calificacion: number;
  creadoEn: Date;
  coincideNombre: boolean;
}

function ordenarPorClave(
  lista: ClaveOrden[],
  orden: QueryProductos['orden'],
  hayBusqueda: boolean,
): void {
  switch (orden) {
    case 'precio_asc':
      lista.sort((a, b) => a.precio - b.precio);
      break;
    case 'precio_desc':
      lista.sort((a, b) => b.precio - a.precio);
      break;
    case 'calificacion':
      lista.sort((a, b) => b.calificacion - a.calificacion);
      break;
    case 'recientes':
      lista.sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());
      break;
    case 'relevancia':
    default:
      if (hayBusqueda) {
        lista.sort((a, b) => {
          if (a.coincideNombre !== b.coincideNombre) return a.coincideNombre ? -1 : 1;
          return b.creadoEn.getTime() - a.creadoEn.getTime();
        });
      } else {
        lista.sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());
      }
  }
}

export async function listarProductos(query: QueryProductos, sesionVisitaId: string | undefined) {
  const where = construirWhereProducto(query);

  // Antes había dos findMany de nivel superior (cada uno su propia
  // transacción contra el pooler): uno liviano solo para poder ordenar y
  // paginar, y otro con el detalle completo de la página — pero
  // precioActual y calificacionPromedio se pedían en los dos. Con un
  // catálogo de este tamaño, sale más barato traer el detalle completo de
  // TODO lo que matchea el filtro en una sola consulta (una sola
  // transacción, aunque Prisma siga resolviendo cada relación como su
  // propio SELECT por dentro) y ordenar/paginar en memoria, que dos viajes
  // encadenados a Supabase. relationLoadStrategy: 'join' habría colapsado
  // esas sub-selects en un solo SQL con JOIN, pero esta versión de Prisma
  // no lo expone sin activar previewFeatures en el schema — fuera de
  // alcance de este cambio. Se paga con traer de más para las filas que no
  // entran en la página, aceptable mientras el catálogo sea chico.
  const productos = await prisma.producto.findMany({
    where,
    select: SELECT_PRODUCTO,
  });
  const porId = new Map(productos.map((p) => [p.id, p]));

  // Las promociones hacen falta antes de ordenar y filtrar: el precio que
  // ordena y filtra es el de la tarjeta, con la promoción aplicada.
  const [promociones, tasaUsd] = await Promise.all([
    listarPromocionesVigentes(),
    obtenerTasaUsdVigente(),
  ]);

  const claves: ClaveOrden[] = productos.flatMap((producto) => {
    const { precio } = varianteMostradaDe(producto, promociones);
    if (!precioMostradoEnRango(precio, query)) return [];
    return {
      id: producto.id,
      precio,
      calificacion: producto.resumen ? Number(producto.resumen.calificacionPromedio) : 0,
      creadoEn: producto.creadoEn,
      coincideNombre: query.busqueda
        ? producto.nombre.toLowerCase().includes(query.busqueda.toLowerCase())
        : false,
    };
  });

  ordenarPorClave(claves, query.orden, Boolean(query.busqueda));

  const total = claves.length;
  const totalPaginas = Math.ceil(total / query.porPagina);
  const inicio = (query.pagina - 1) * query.porPagina;
  const paginaDeProductos = claves
    .slice(inicio, inicio + query.porPagina)
    .map((clave) => porId.get(clave.id))
    .filter((p): p is ProductoConDetalle => Boolean(p));

  const datos = paginaDeProductos.map((producto) => mapearProducto(producto, promociones, tasaUsd));

  if (query.busqueda) {
    await registrarBusqueda(query.busqueda, total, sesionVisitaId);
  }

  return {
    datos,
    paginacion: { pagina: query.pagina, porPagina: query.porPagina, total, totalPaginas },
  };
}

// ---------------------------------------------------------------------------
// Facetas: cuenta valores respetando los filtros activos, excluyendo del
// cálculo el propio atributo que se está contando (patrón estándar de
// faceted search: "si agrego este filtro, cuántos resultados quedan").
// ---------------------------------------------------------------------------

// Con filtro de precio, las facetas cuentan solo los productos cuyo precio
// mostrado cae en el rango: el mismo criterio que el listado. null si no
// hay filtro de precio.
async function idsConPrecioMostradoEnRango(filtros: FiltrosProducto): Promise<string[] | null> {
  if (filtros.precioMin === undefined && filtros.precioMax === undefined) return null;
  const [productos, promociones] = await Promise.all([
    prisma.producto.findMany({
      where: { estado: 'publicado' },
      select: {
        id: true,
        categoriaId: true,
        variantePrincipalId: true,
        variantes: {
          where: { activa: true },
          select: { id: true, precioActual: true, stockActual: true, stockReservado: true },
        },
      },
    }),
    listarPromocionesVigentes(),
  ]);
  return productos
    .filter((p) => precioMostradoEnRango(varianteMostradaDe(p, promociones).precio, filtros))
    .map((p) => p.id);
}

export async function listarFacetas(filtros: FiltrosProducto) {
  const idsEnRango = await idsConPrecioMostradoEnRango(filtros);
  const atributos = await prisma.atributo.findMany({
    where: { slug: { in: Object.values(SLUGS_ATRIBUTO) } },
    select: {
      id: true,
      slug: true,
      valoresAtributo: { orderBy: { orden: 'asc' }, select: { id: true, valor: true, hex: true } },
    },
  });
  const atributoPorSlug = new Map(atributos.map((a) => [a.slug, a]));

  const resultado: Record<ClaveAtributo, Array<{ valor: string; hex?: string; conteo: number }>> = {
    tipo: [],
    longitud: [],
    color: [],
    talla: [],
    densidad: [],
  };

  for (const clave of CLAVES_ATRIBUTO) {
    const atributo = atributoPorSlug.get(SLUGS_ATRIBUTO[clave]);
    if (!atributo) continue;

    const whereProducto = construirWhereProducto(filtros, clave);
    if (idsEnRango) whereProducto.id = { in: idsEnRango };
    const condiciones = condicionesVariante(filtros, clave);

    const candidatos = await prisma.producto.findMany({
      where: whereProducto,
      select: {
        variantes: {
          where: { activa: true, AND: condiciones },
          select: {
            valoresAtributo: {
              where: { valorAtributo: { atributoId: atributo.id } },
              select: { valorId: true },
            },
          },
        },
      },
    });

    const conteoPorValor = new Map<string, number>();
    for (const producto of candidatos) {
      const valoresDelProducto = new Set<string>();
      for (const variante of producto.variantes) {
        for (const relacion of variante.valoresAtributo) {
          valoresDelProducto.add(relacion.valorId);
        }
      }
      for (const valorId of valoresDelProducto) {
        conteoPorValor.set(valorId, (conteoPorValor.get(valorId) ?? 0) + 1);
      }
    }

    resultado[clave] = atributo.valoresAtributo.map((valor) => ({
      valor: valor.valor,
      ...(valor.hex ? { hex: valor.hex } : {}),
      conteo: conteoPorValor.get(valor.id) ?? 0,
    }));
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// Detalle y relacionados
// ---------------------------------------------------------------------------

export async function obtenerProductoPorSlug(slug: string) {
  const producto = await prisma.producto.findFirst({
    where: { slug, estado: 'publicado' },
    select: SELECT_PRODUCTO,
  });
  if (!producto) return null;

  const [promociones, tasaUsd, atributos] = await Promise.all([
    listarPromocionesVigentes(),
    obtenerTasaUsdVigente(),
    atributosDeCategoria(prisma, producto.categoriaId),
  ]);
  return {
    ...mapearProducto(producto, promociones, tasaUsd),
    // Slugs de los atributos de la categoría, en el orden configurado en el
    // panel: es el orden (y la jerarquía) del selector de la ficha.
    ordenAtributos: atributos.map((a) => a.slug),
  };
}

export async function listarRelacionados(slug: string) {
  const actual = await prisma.producto.findFirst({
    where: { slug, estado: 'publicado' },
    select: { id: true, categoriaId: true },
  });
  if (!actual) return [];

  const relacionados = await prisma.producto.findMany({
    where: { categoriaId: actual.categoriaId, estado: 'publicado', id: { not: actual.id } },
    orderBy: { creadoEn: 'desc' },
    take: 4,
    select: SELECT_PRODUCTO,
  });

  const [promociones, tasaUsd] = await Promise.all([
    listarPromocionesVigentes(),
    obtenerTasaUsdVigente(),
  ]);
  return relacionados.map((producto) => mapearProducto(producto, promociones, tasaUsd));
}

// ---------------------------------------------------------------------------
// Analítica: falla en silencio (no debe tumbar una lectura pública) pero
// deja rastro en el logger de la petición.
// ---------------------------------------------------------------------------

export async function registrarVistaProducto(
  productoId: string,
  categoriaId: string,
  sesionVisitaId: string | undefined,
): Promise<void> {
  if (!sesionVisitaId) return;
  try {
    await prisma.eventoAnalitica.create({
      data: { sesionId: sesionVisitaId, tipo: 'vistaProducto', productoId, categoriaId },
    });
  } catch {
    // La sesión de visita pudo no resolverse (ver middleware/sesionVisita.ts).
  }
}

export async function registrarBusqueda(
  termino: string,
  resultados: number,
  sesionVisitaId: string | undefined,
): Promise<void> {
  try {
    await prisma.busquedaRegistro.create({
      data: { termino, resultados, sesionId: sesionVisitaId ?? null },
    });
  } catch {
    // No bloquea la respuesta del catálogo si el registro de búsqueda falla.
  }
}
