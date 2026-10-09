import type { AlcancePromocion, TipoPromocion } from '@prisma/client';
import { prisma } from './prisma.js';

export interface PromocionVigente {
  id: string;
  nombre: string;
  tipo: TipoPromocion;
  valor: number;
  alcance: AlcancePromocion;
  prioridad: number;
  bannerTitulo: string | null;
  bannerTexto: string | null;
  bannerImagenUrl: string | null;
  bannerColorFondo: string | null;
  objetivos: { categoriaId: string | null; productoId: string | null; varianteId: string | null }[];
}

// Tipos que afectan el precio mostrado de una variante. "anuncio" y
// "envio_gratis" no tocan precio: el primero es un banner puro, el
// segundo ya se resuelve como cupón/config de envío, no como descuento
// de línea.
const TIPOS_DE_PRECIO: ReadonlySet<TipoPromocion> = new Set([
  'descuentoPorcentaje',
  'descuentoMonto',
  'precioFijo',
]);

// Una sola consulta para todo el listado que la llame: evita pegarle a la
// base una vez por variante (mismo criterio que la optimización de
// catálogo — menos viajes vale más que resolverlo "elegante" por fila).
export async function listarPromocionesVigentes(): Promise<PromocionVigente[]> {
  const ahora = new Date();
  const filas = await prisma.promocion.findMany({
    where: {
      activa: true,
      vigenteDesde: { lte: ahora },
      OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: ahora } }],
    },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      valor: true,
      alcance: true,
      prioridad: true,
      bannerTitulo: true,
      bannerTexto: true,
      bannerImagenUrl: true,
      bannerColorFondo: true,
      objetivos: { select: { categoriaId: true, productoId: true, varianteId: true } },
    },
    orderBy: { prioridad: 'desc' },
  });
  return filas;
}

function promocionAplica(
  promo: PromocionVigente,
  contexto: { varianteId: string; productoId: string; categoriaId: string },
): boolean {
  if (promo.alcance === 'global') return true;
  return promo.objetivos.some((objetivo) => {
    if (promo.alcance === 'variante') return objetivo.varianteId === contexto.varianteId;
    if (promo.alcance === 'producto') return objetivo.productoId === contexto.productoId;
    if (promo.alcance === 'categoria') return objetivo.categoriaId === contexto.categoriaId;
    return false;
  });
}

// `promociones` ya debe venir ordenada por prioridad desc (como la
// devuelve listarPromocionesVigentes). Devuelve la de mayor prioridad
// cuyo alcance incluya esta variante — por producto, por categoría o
// global — o null si ninguna aplica.
export function obtenerMejorPromocionDePrecio(
  promociones: PromocionVigente[],
  contexto: { varianteId: string; productoId: string; categoriaId: string },
): PromocionVigente | null {
  const candidata = promociones.find(
    (promo) => TIPOS_DE_PRECIO.has(promo.tipo) && promocionAplica(promo, contexto),
  );
  return candidata ?? null;
}

// Pick<...> y no PromocionVigente completo: admin/promociones/servicio.ts
// la reusa para la vista previa de una promoción que todavía no se
// guardó (ver punto 10 del pedido de Promociones/Kits) y ahí no hay
// objetivos/prioridad/banner que armar, solo tipo y valor.
export function aplicarPromocionAPrecio(
  precioOriginal: number,
  promo: Pick<PromocionVigente, 'tipo' | 'valor'>,
): number {
  switch (promo.tipo) {
    case 'descuentoPorcentaje':
      return Math.max(0, Math.round(precioOriginal * (1 - promo.valor / 100)));
    case 'descuentoMonto':
      return Math.max(0, precioOriginal - promo.valor);
    case 'precioFijo':
      return Math.max(0, promo.valor);
    default:
      return precioOriginal;
  }
}

// Para las bandas de portada (GET /api/promociones): solo anuncios y
// descuentos de alcance global, nunca envio_gratis/precio_fijo ni nada
// con alcance acotado (eso se ve en el producto, no en una banda de
// portada genérica).
export function esPromocionDeBanda(promo: PromocionVigente): boolean {
  const tiposBanda: ReadonlySet<TipoPromocion> = new Set([
    'anuncio',
    'descuentoPorcentaje',
    'descuentoMonto',
  ]);
  return promo.alcance === 'global' && tiposBanda.has(promo.tipo);
}
