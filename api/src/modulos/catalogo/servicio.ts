import { Prisma } from '@prisma/client';
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
// Construcción de filtros: dos condiciones de atributos distintos (o precio)
// deben cumplirse en la MISMA variante, nunca repartidas entre variantes
// distintas del producto. Por eso todas viajan como AND dentro del mismo
// `variantes.some`.
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

  if (filtros.precioMin !== undefined) {
    condiciones.push({ precioActual: { gte: filtros.precioMin } });
  }
  if (filtros.precioMax !== undefined) {
    condiciones.push({ precioActual: { lte: filtros.precioMax } });
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
    const condicionVigente: Prisma.ProductoDestacadoWhereInput = {
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
  variantes: { where: { activa: true }, select: SELECT_VARIANTE },
  resumen: { select: { calificacionPromedio: true, cantidadResenas: true } },
  destacados: { select: { desde: true, hasta: true } },
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

function mapearVariante(variante: VarianteConAtributos, contexto: ContextoPrecio) {
  const promo = obtenerMejorPromocionDePrecio(contexto.promociones, {
    varianteId: variante.id,
    productoId: contexto.productoId,
    categoriaId: contexto.categoriaId,
  });

  const precioConDescuentoCop = promo
    ? aplicarPromocionAPrecio(variante.precioActual, promo)
    : variante.precioActual;

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

  // "Desde $X" del listado: el menor precio YA con descuento, para que la
  // promoción se vea también en la tarjeta del producto, no solo al
  // entrar al detalle.
  const preciosConDescuento = variantes.map((v) => v.precioConDescuento.cop);
  const precioBaseCop = preciosConDescuento.length > 0 ? Math.min(...preciosConDescuento) : 0;

  return {
    id: producto.id,
    nombre: producto.nombre,
    slug: producto.slug,
    descripcion: producto.descripcion,
    categoriaId: producto.categoriaId,
    precioBase: calcularPrecioDualConTasa(precioBaseCop, null, tasaUsd),
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
  precioMinimo: number;
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
      lista.sort((a, b) => a.precioMinimo - b.precioMinimo);
      break;
    case 'precio_desc':
      lista.sort((a, b) => b.precioMinimo - a.precioMinimo);
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

  const claves: ClaveOrden[] = productos.map((producto) => {
    const precios = producto.variantes.map((v) => v.precioActual);
    return {
      id: producto.id,
      precioMinimo: precios.length > 0 ? Math.min(...precios) : 0,
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

  // Una sola consulta de promociones para toda la página (no una por
  // producto): mismo criterio que ya se usó para el resto del catálogo.
  const [promociones, tasaUsd] = await Promise.all([
    listarPromocionesVigentes(),
    obtenerTasaUsdVigente(),
  ]);
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

export async function listarFacetas(filtros: FiltrosProducto) {
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

  const [promociones, tasaUsd] = await Promise.all([
    listarPromocionesVigentes(),
    obtenerTasaUsdVigente(),
  ]);
  return mapearProducto(producto, promociones, tasaUsd);
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
