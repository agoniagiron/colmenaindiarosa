import { calcularPrecioDualConTasa, obtenerTasaUsdVigente } from '../../lib/moneda.js';
import { prisma } from '../../lib/prisma.js';

export async function listarCombosVigentes() {
  const ahora = new Date();
  const combos = await prisma.combo.findMany({
    where: {
      activo: true,
      vigenteDesde: { lte: ahora },
      OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: ahora } }],
    },
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

  return combos.map((combo) => {
    const precioPiezasCop = combo.items.reduce(
      (acumulado, item) => acumulado + item.varianteProducto.precioActual * item.cantidad,
      0,
    );
    const disponible = combo.items.every(
      (item) =>
        item.varianteProducto.stockActual - item.varianteProducto.stockReservado >= item.cantidad,
    );

    return {
      id: combo.id,
      nombre: combo.nombre,
      slug: combo.slug,
      descripcion: combo.descripcion,
      imagenUrl: combo.imagenUrl,
      imagenPrincipal: combo.imagenes[0] ?? null,
      cantidadImagenes: combo._count.imagenes,
      precio: calcularPrecioDualConTasa(combo.precioCop, combo.precioUsd, tasaUsd),
      precioPiezasPorSeparado: calcularPrecioDualConTasa(precioPiezasCop, null, tasaUsd),
      disponible,
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
    };
  });
}
