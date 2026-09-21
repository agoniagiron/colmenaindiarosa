import type { EstadoPedido } from '@prisma/client';
import { calcularPrecioDualConTasa, obtenerTasaUsdVigente } from '../../lib/moneda.js';
import { prisma } from '../../lib/prisma.js';

// "pagado o posterior" en el ciclo de vida normal del pedido (no incluye
// cancelado ni reembolsado: esas unidades volvieron a estar disponibles,
// no siguen contando como vendidas de este lote).
const ESTADOS_VENDIDO: EstadoPedido[] = ['pagado', 'enPreparacion', 'despachado', 'entregado'];

async function contarUnidadesVendidas(varianteIds: string[], desde: Date): Promise<number> {
  if (varianteIds.length === 0) return 0;

  const [directas, enCombos] = await Promise.all([
    prisma.pedidoItem.aggregate({
      where: {
        varianteId: { in: varianteIds },
        pedido: { estado: { in: ESTADOS_VENDIDO }, creadoEn: { gte: desde } },
      },
      _sum: { cantidad: true },
    }),
    prisma.pedidoItemComboDetalle.aggregate({
      where: {
        varianteId: { in: varianteIds },
        pedidoItem: { pedido: { estado: { in: ESTADOS_VENDIDO }, creadoEn: { gte: desde } } },
      },
      _sum: { cantidad: true },
    }),
  ]);

  return (directas._sum.cantidad ?? 0) + (enCombos._sum.cantidad ?? 0);
}

export async function listarEdicionesLimitadasVigentes() {
  const ahora = new Date();
  const ediciones = await prisma.edicionLimitada.findMany({
    where: {
      activa: true,
      desde: { lte: ahora },
      OR: [{ hasta: null }, { hasta: { gt: ahora } }],
    },
    orderBy: { orden: 'asc' },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      unidadesLote: true,
      mostrarRestantes: true,
      desde: true,
      hasta: true,
      producto: {
        select: {
          id: true,
          nombre: true,
          slug: true,
          imagenes: {
            where: { varianteId: null },
            orderBy: { orden: 'asc' },
            take: 1,
            select: { url: true, altTexto: true },
          },
          variantes: {
            where: { activa: true },
            select: { id: true, precioActual: true, precioUsd: true },
          },
        },
      },
    },
  });

  if (ediciones.length === 0) return [];

  const tasaUsd = await obtenerTasaUsdVigente();

  return Promise.all(
    ediciones.map(async (edicion) => {
      const varianteIds = edicion.producto.variantes.map((v) => v.id);
      const precios = edicion.producto.variantes.map((v) => v.precioActual);
      const precioMinimo = precios.length > 0 ? Math.min(...precios) : 0;
      const varianteBase = edicion.producto.variantes.find((v) => v.precioActual === precioMinimo);

      const vendidas = await contarUnidadesVendidas(varianteIds, edicion.desde);
      const unidadesRestantes =
        edicion.unidadesLote === null ? null : Math.max(0, edicion.unidadesLote - vendidas);

      return {
        id: edicion.id,
        nombre: edicion.nombre,
        descripcion: edicion.descripcion,
        unidadesLote: edicion.unidadesLote,
        unidadesRestantes: edicion.mostrarRestantes ? unidadesRestantes : null,
        desde: edicion.desde,
        hasta: edicion.hasta,
        producto: {
          id: edicion.producto.id,
          nombre: edicion.producto.nombre,
          slug: edicion.producto.slug,
          imagen: edicion.producto.imagenes[0] ?? null,
        },
        precio: calcularPrecioDualConTasa(precioMinimo, varianteBase?.precioUsd, tasaUsd),
      };
    }),
  );
}
