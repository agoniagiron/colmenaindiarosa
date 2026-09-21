import type { Prisma } from '@prisma/client';

// Un pedido_item es variante XOR combo. Para decrementar/liberar/devolver
// stock hay que aplanar: una línea de variante aporta una unidad directa,
// una línea de combo aporta una por cada pieza en pedido_item_combo_detalle,
// multiplicada por cuántos combos se compraron (el detalle guarda la
// receta "por un combo", no el total).
//
// Usado tanto por el webhook de Wompi (modulos/pagos/servicio.ts, al
// aprobar o rechazar un pago) como por el panel admin (modulos/admin/pedidos,
// al cancelar un pedido pagado). Vive acá, no duplicado en cada módulo:
// dos copias que se desincronicen producen un descuadre de inventario que
// solo se descubre en un conteo físico.
export async function obtenerUnidadesPorVariante(
  tx: Prisma.TransactionClient,
  pedidoId: string,
): Promise<{ varianteId: string; cantidad: number }[]> {
  const items = await tx.pedidoItem.findMany({
    where: { pedidoId },
    select: {
      varianteId: true,
      cantidad: true,
      detallesCombo: { select: { varianteId: true, cantidad: true } },
    },
  });

  const unidades: { varianteId: string; cantidad: number }[] = [];
  for (const item of items) {
    if (item.varianteId) {
      unidades.push({ varianteId: item.varianteId, cantidad: item.cantidad });
      continue;
    }
    for (const detalle of item.detallesCombo) {
      if (!detalle.varianteId) continue; // variante borrada del catálogo (FK en SET NULL)
      unidades.push({ varianteId: detalle.varianteId, cantidad: detalle.cantidad * item.cantidad });
    }
  }
  return unidades;
}
