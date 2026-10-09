import type { AlcancePromocion, Prisma, TipoPromocion } from '@prisma/client';
import { aplicarPromocionAPrecio } from '../../../lib/promociones.js';
import { ErrorApi } from '../../../lib/errorApi.js';
import { prisma } from '../../../lib/prisma.js';
import type {
  BodyCrearPromocion,
  BodyEditarPromocion,
  BodyPrevisualizar,
  QueryListadoPromociones,
} from './esquemas.js';

interface Objetivo {
  categoriaId?: string | null;
  productoId?: string | null;
  varianteId?: string | null;
}

// Mismo criterio de "qué variantes toca" en los tres lugares que lo
// necesitan: el conteo del listado (columna "Afecta"), la vista previa
// antes de guardar y, el día que haga falta, el motor de precios real
// (lib/promociones.ts) — hoy ese motor recibe los objetivos ya resueltos
// desde la base, así que no duplica esta consulta, solo el criterio de
// qué significa cada alcance.
async function variantesAfectadas(alcance: AlcancePromocion, objetivos: Objetivo[]) {
  const whereBase: Prisma.VarianteProductoWhereInput = { activa: true };

  if (alcance === 'global') {
    return prisma.varianteProducto.findMany({
      where: whereBase,
      select: {
        id: true,
        precioActual: true,
        productoId: true,
        producto: { select: { nombre: true } },
      },
    });
  }
  if (alcance === 'categoria') {
    const categoriaIds = objetivos.map((o) => o.categoriaId).filter((v): v is string => Boolean(v));
    if (categoriaIds.length === 0) return [];
    return prisma.varianteProducto.findMany({
      where: { ...whereBase, producto: { categoriaId: { in: categoriaIds } } },
      select: {
        id: true,
        precioActual: true,
        productoId: true,
        producto: { select: { nombre: true } },
      },
    });
  }
  if (alcance === 'producto') {
    const productoIds = objetivos.map((o) => o.productoId).filter((v): v is string => Boolean(v));
    if (productoIds.length === 0) return [];
    return prisma.varianteProducto.findMany({
      where: { ...whereBase, productoId: { in: productoIds } },
      select: {
        id: true,
        precioActual: true,
        productoId: true,
        producto: { select: { nombre: true } },
      },
    });
  }
  // variante
  const varianteIds = objetivos.map((o) => o.varianteId).filter((v): v is string => Boolean(v));
  if (varianteIds.length === 0) return [];
  return prisma.varianteProducto.findMany({
    where: { ...whereBase, id: { in: varianteIds } },
    select: {
      id: true,
      precioActual: true,
      productoId: true,
      producto: { select: { nombre: true } },
    },
  });
}

async function contarProductosAfectados(
  tipo: TipoPromocion,
  alcance: AlcancePromocion,
  objetivos: Objetivo[],
): Promise<number | null> {
  // "anuncio" es un banner puro, no toca precios: "Afecta" se muestra
  // como "—" en vez de un número (igual que en el mockup).
  if (tipo === 'anuncio') return null;
  const variantes = await variantesAfectadas(alcance, objetivos);
  return new Set(variantes.map((v) => v.productoId)).size;
}

const SELECT_LISTADO = {
  id: true,
  nombre: true,
  tipo: true,
  valor: true,
  alcance: true,
  vigenteDesde: true,
  vigenteHasta: true,
  activa: true,
  objetivos: { select: { categoriaId: true, productoId: true, varianteId: true } },
} satisfies Prisma.PromocionSelect;

function calcularEstado(
  activa: boolean,
  vigenteDesde: Date,
  vigenteHasta: Date | null,
): 'programada' | 'vigente' | 'vencida' | 'inactiva' {
  if (!activa) return 'inactiva';
  const ahora = new Date();
  if (ahora < vigenteDesde) return 'programada';
  if (vigenteHasta !== null && ahora >= vigenteHasta) return 'vencida';
  return 'vigente';
}

export async function listarPromociones(query: QueryListadoPromociones) {
  const [total, promociones] = await Promise.all([
    prisma.promocion.count(),
    prisma.promocion.findMany({
      orderBy: { creadoEn: 'desc' },
      skip: (query.pagina - 1) * query.porPagina,
      take: query.porPagina,
      select: SELECT_LISTADO,
    }),
  ]);

  const datos = await Promise.all(
    promociones.map(async (promo) => ({
      id: promo.id,
      nombre: promo.nombre,
      tipo: promo.tipo,
      valor: promo.valor,
      alcance: promo.alcance,
      vigenteDesde: promo.vigenteDesde,
      vigenteHasta: promo.vigenteHasta,
      estado: calcularEstado(promo.activa, promo.vigenteDesde, promo.vigenteHasta),
      productosAfectados: await contarProductosAfectados(
        promo.tipo,
        promo.alcance,
        promo.objetivos,
      ),
    })),
  );

  return {
    datos,
    paginacion: {
      pagina: query.pagina,
      porPagina: query.porPagina,
      total,
      totalPaginas: Math.ceil(total / query.porPagina),
    },
  };
}

const SELECT_DETALLE = {
  id: true,
  nombre: true,
  descripcion: true,
  tipo: true,
  valor: true,
  alcance: true,
  prioridad: true,
  acumulable: true,
  bannerTitulo: true,
  bannerTexto: true,
  bannerImagenUrl: true,
  bannerColorFondo: true,
  vigenteDesde: true,
  vigenteHasta: true,
  activa: true,
  objetivos: {
    select: {
      id: true,
      categoriaId: true,
      productoId: true,
      varianteId: true,
      categoria: { select: { nombre: true } },
      producto: { select: { nombre: true } },
      varianteProducto: { select: { sku: true, producto: { select: { nombre: true } } } },
    },
  },
} satisfies Prisma.PromocionSelect;

function mapearObjetivo(objetivo: {
  categoriaId: string | null;
  productoId: string | null;
  varianteId: string | null;
  categoria: { nombre: string } | null;
  producto: { nombre: string } | null;
  varianteProducto: { sku: string; producto: { nombre: string } } | null;
}) {
  if (objetivo.categoriaId) {
    return { categoriaId: objetivo.categoriaId, etiqueta: objetivo.categoria?.nombre ?? '' };
  }
  if (objetivo.productoId) {
    return { productoId: objetivo.productoId, etiqueta: objetivo.producto?.nombre ?? '' };
  }
  return {
    varianteId: objetivo.varianteId!,
    etiqueta: objetivo.varianteProducto
      ? `${objetivo.varianteProducto.producto.nombre} · ${objetivo.varianteProducto.sku}`
      : '',
  };
}

export async function obtenerDetallePromocion(id: string) {
  const promo = await prisma.promocion.findUnique({ where: { id }, select: SELECT_DETALLE });
  if (!promo) throw ErrorApi.noEncontrado('La promoción no existe');
  return {
    ...promo,
    estado: calcularEstado(promo.activa, promo.vigenteDesde, promo.vigenteHasta),
    objetivos: promo.objetivos.map(mapearObjetivo),
  };
}

export async function crearPromocion(datos: BodyCrearPromocion, usuarioAdminId: string) {
  return prisma.promocion.create({
    data: {
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      tipo: datos.tipo,
      valor: datos.valor,
      alcance: datos.alcance,
      prioridad: datos.prioridad,
      acumulable: datos.acumulable ?? false,
      bannerTitulo: datos.bannerTitulo ?? null,
      bannerTexto: datos.bannerTexto ?? null,
      bannerImagenUrl: datos.bannerImagenUrl ?? null,
      bannerColorFondo: datos.bannerColorFondo ?? null,
      vigenteDesde: datos.vigenteDesde,
      vigenteHasta: datos.vigenteHasta ?? null,
      creadoPorId: usuarioAdminId,
      objetivos: {
        create: datos.objetivos.map((o) => ({
          categoriaId: o.categoriaId ?? null,
          productoId: o.productoId ?? null,
          varianteId: o.varianteId ?? null,
        })),
      },
    },
    select: SELECT_DETALLE,
  });
}

export async function editarPromocion(id: string, datos: BodyEditarPromocion) {
  return prisma.$transaction(async (tx) => {
    const actual = await tx.promocion.findUnique({ where: { id }, select: { id: true } });
    if (!actual) throw ErrorApi.noEncontrado('La promoción no existe');

    if (datos.objetivos) {
      await tx.promocionObjetivo.deleteMany({ where: { promocionId: id } });
    }

    return tx.promocion.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        tipo: datos.tipo,
        valor: datos.valor,
        alcance: datos.alcance,
        prioridad: datos.prioridad,
        acumulable: datos.acumulable,
        bannerTitulo: datos.bannerTitulo,
        bannerTexto: datos.bannerTexto,
        bannerImagenUrl: datos.bannerImagenUrl,
        bannerColorFondo: datos.bannerColorFondo,
        vigenteDesde: datos.vigenteDesde,
        vigenteHasta: datos.vigenteHasta,
        activa: datos.activa,
        actualizadoEn: new Date(),
        ...(datos.objetivos
          ? {
              objetivos: {
                create: datos.objetivos.map((o) => ({
                  categoriaId: o.categoriaId ?? null,
                  productoId: o.productoId ?? null,
                  varianteId: o.varianteId ?? null,
                })),
              },
            }
          : {}),
      },
      select: SELECT_DETALLE,
    });
  });
}

export async function previsualizar(datos: BodyPrevisualizar) {
  const variantes = await variantesAfectadas(datos.alcance, datos.objetivos);

  const porProducto = new Map<string, { nombre: string; precioOriginalCop: number }>();
  for (const variante of variantes) {
    const existente = porProducto.get(variante.productoId);
    if (!existente || variante.precioActual < existente.precioOriginalCop) {
      porProducto.set(variante.productoId, {
        nombre: variante.producto.nombre,
        precioOriginalCop: variante.precioActual,
      });
    }
  }

  const productos = [...porProducto.entries()].map(([productoId, info]) => ({
    productoId,
    nombre: info.nombre,
    precioOriginalCop: info.precioOriginalCop,
    precioResultanteCop: aplicarPromocionAPrecio(info.precioOriginalCop, datos),
  }));

  // Punto 11: un monto fijo que ya supera el precio del más barato
  // afectado se avisa (no bloquea) — ahí el "descuento" dejaría ese
  // producto en $0 o negativo.
  const precioMasBaratoCop =
    productos.length > 0 ? Math.min(...productos.map((p) => p.precioOriginalCop)) : null;
  const avisoMontoSuperaPrecio =
    datos.tipo === 'descuentoMonto' &&
    precioMasBaratoCop !== null &&
    datos.valor > precioMasBaratoCop;

  return { productos, avisoMontoSuperaPrecio };
}
