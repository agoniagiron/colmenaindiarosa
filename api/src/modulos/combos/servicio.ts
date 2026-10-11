import type { EstadoPublicacion, Prisma } from '@prisma/client';
import { ErrorApi } from '../../lib/errorApi.js';
import { calcularPrecioDualConTasa, obtenerTasaUsdVigente } from '../../lib/moneda.js';
import { prisma } from '../../lib/prisma.js';

// Mismo filtro en listado y detalle a propósito: un kit inactivo o fuera de
// vigencia tiene que desaparecer de los dos por igual, nunca solo del
// listado (si no, el link directo a /kit/:slug seguiría vendiendo algo que
// ya se sacó de la tienda).
function condicionVigencia(ahora: Date): Prisma.ComboWhereInput {
  return {
    activo: true,
    vigenteDesde: { lte: ahora },
    OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: ahora } }],
  };
}

interface PiezaParaCalculo {
  cantidad: number;
  varianteProducto: {
    precioActual: number;
    stockActual: number;
    stockReservado: number;
  };
}

// Única fuente para las dos cuentas que dependen de las piezas del combo:
// listado y detalle llaman a esto, nunca reimplementan la cuenta (mismo
// criterio que contarUnidadesVendidas en modulos/limitadas/servicio.ts).
function piezaTieneStock(item: PiezaParaCalculo): boolean {
  return item.varianteProducto.stockActual - item.varianteProducto.stockReservado >= item.cantidad;
}

function calcularDisponibilidadCombo(items: PiezaParaCalculo[]): boolean {
  return items.every(piezaTieneStock);
}

interface PiezaParaDiagnostico extends PiezaParaCalculo {
  varianteProducto: PiezaParaCalculo['varianteProducto'] & {
    activa: boolean;
    producto: { estado: EstadoPublicacion };
  };
}

// Única fuente de "qué le pasa a esta pieza": la usa el detalle público
// solo para decidir si el kit es comprable (sin devolver el motivo, que
// habla en términos del panel y expone stock) y el panel
// (admin/combos/servicio.ts) para mostrarlo tal cual y saber qué reponer.
// solo_kits a propósito no bloquea: es una pieza que SOLO se vende adentro
// de un kit, nunca sola — no es lo mismo que archivada. Si una pieza está
// bloqueada y además sin stock, el motivo es el bloqueo.
export function diagnosticarPieza(item: PiezaParaDiagnostico): {
  bloqueaCompra: boolean;
  motivo: string | null;
} {
  const variante = item.varianteProducto;
  const estado = variante.producto.estado;

  let motivo: string | null = null;
  if (estado === 'archivado') motivo = 'Producto archivado';
  else if (estado === 'borrador') motivo = 'Producto en borrador, sin publicar';
  else if (!variante.activa) motivo = 'Variante desactivada';
  const bloqueaCompra = motivo !== null;

  if (!bloqueaCompra && !piezaTieneStock(item)) {
    const libres = Math.max(0, variante.stockActual - variante.stockReservado);
    motivo = `Sin stock suficiente: el kit lleva ${item.cantidad} y hay ${libres}`;
  }

  return { bloqueaCompra, motivo };
}

function calcularPrecioPiezasPorSeparadoCop(items: PiezaParaCalculo[]): number {
  return items.reduce(
    (acumulado, item) => acumulado + item.varianteProducto.precioActual * item.cantidad,
    0,
  );
}

export async function listarCombosVigentes() {
  const ahora = new Date();
  const combos = await prisma.combo.findMany({
    where: condicionVigencia(ahora),
    orderBy: [{ destacado: 'desc' }, { creadoEn: 'desc' }],
    select: {
      id: true,
      nombre: true,
      slug: true,
      descripcion: true,
      precioCop: true,
      precioUsd: true,
      imagenUrl: true,
      // Fotos propias del kit (punto 2 del pedido) — nunca las de los
      // productos que lo componen. imagenUrl de arriba es el campo viejo
      // de una sola foto, que se deja de usar en el front una vez que hay
      // filas acá; si no hay ninguna, el front cae al SVG de respaldo.
      imagenes: {
        orderBy: { orden: 'asc' },
        take: 1,
        select: { url: true, altTexto: true },
      },
      _count: { select: { imagenes: true } },
      items: {
        select: {
          cantidad: true,
          varianteProducto: {
            select: {
              id: true,
              sku: true,
              precioActual: true,
              precioUsd: true,
              stockActual: true,
              stockReservado: true,
              producto: { select: { nombre: true } },
            },
          },
        },
      },
    },
  });

  if (combos.length === 0) return [];

  const tasaUsd = await obtenerTasaUsdVigente();

  return combos.map((combo) => ({
    id: combo.id,
    nombre: combo.nombre,
    slug: combo.slug,
    descripcion: combo.descripcion,
    imagenUrl: combo.imagenUrl,
    imagenPrincipal: combo.imagenes[0] ?? null,
    cantidadImagenes: combo._count.imagenes,
    precio: calcularPrecioDualConTasa(combo.precioCop, combo.precioUsd, tasaUsd),
    precioPiezasPorSeparado: calcularPrecioDualConTasa(
      calcularPrecioPiezasPorSeparadoCop(combo.items),
      null,
      tasaUsd,
    ),
    disponible: calcularDisponibilidadCombo(combo.items),
    items: combo.items.map((item) => ({
      varianteId: item.varianteProducto.id,
      sku: item.varianteProducto.sku,
      nombreProducto: item.varianteProducto.producto.nombre,
      cantidad: item.cantidad,
      precioUnitario: calcularPrecioDualConTasa(
        item.varianteProducto.precioActual,
        item.varianteProducto.precioUsd,
        tasaUsd,
      ),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Detalle (pantalla pública /kit/:slug)
// ---------------------------------------------------------------------------

const SELECT_COMBO_DETALLE = {
  id: true,
  nombre: true,
  slug: true,
  descripcion: true,
  precioCop: true,
  precioUsd: true,
  imagenes: {
    orderBy: { orden: 'asc' },
    select: { url: true, altTexto: true },
  },
  items: {
    select: {
      cantidad: true,
      varianteProducto: {
        select: {
          id: true,
          sku: true,
          precioActual: true,
          precioUsd: true,
          stockActual: true,
          stockReservado: true,
          activa: true,
          producto: {
            select: {
              nombre: true,
              slug: true,
              estado: true,
              // Portada de la ficha del producto (primera por orden, igual
              // que en todo el resto del sitio) — no la de la variante: es
              // la miniatura de "qué es esta pieza", no una foto puntual.
              imagenes: {
                where: { varianteId: null },
                orderBy: { orden: 'asc' },
                take: 1,
                select: { url: true, altTexto: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ComboSelect;

export async function obtenerComboPorSlug(slug: string) {
  const ahora = new Date();
  const combo = await prisma.combo.findFirst({
    where: { slug, ...condicionVigencia(ahora) },
    select: SELECT_COMBO_DETALLE,
  });
  if (!combo) {
    throw ErrorApi.noEncontrado('El kit no existe o no está disponible');
  }

  const tasaUsd = await obtenerTasaUsdVigente();
  const disponible = calcularDisponibilidadCombo(combo.items);

  // El motivo por pieza NO viaja en esta respuesta: es pública, y si lo
  // mandara estaría a la vista aunque la pantalla no lo pinte. Acá solo
  // importa si alguna pieza bloquea; el desglose vive en el panel.
  const comprable = disponible && combo.items.every((item) => !diagnosticarPieza(item).bloqueaCompra);

  const piezas = combo.items.map((item) => {
    const variante = item.varianteProducto;
    const estadoProducto = variante.producto.estado;
    return {
      varianteId: variante.id,
      sku: variante.sku,
      nombreProducto: variante.producto.nombre,
      cantidad: item.cantidad,
      precioUnitario: calcularPrecioDualConTasa(variante.precioActual, variante.precioUsd, tasaUsd),
      imagen: variante.producto.imagenes[0] ?? null,
      // Solo enlaza si la ficha pública del producto existe de verdad: la
      // misma regla que ya usa modulos/catalogo/servicio.ts
      // (estado: 'publicado') — cubre solo_kits, archivado y borrador por
      // igual, sin tener que repetir la lista de estados acá.
      productoSlug: estadoProducto === 'publicado' ? variante.producto.slug : null,
    };
  });

  return {
    id: combo.id,
    nombre: combo.nombre,
    slug: combo.slug,
    descripcion: combo.descripcion,
    imagenes: combo.imagenes,
    precio: calcularPrecioDualConTasa(combo.precioCop, combo.precioUsd, tasaUsd),
    precioPiezasPorSeparado: calcularPrecioDualConTasa(
      calcularPrecioPiezasPorSeparadoCop(combo.items),
      null,
      tasaUsd,
    ),
    disponible,
    comprable,
    piezas,
  };
}
