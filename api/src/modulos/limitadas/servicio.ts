import type { EstadoPedido } from '@prisma/client';
import { calcularPrecioDualConTasa, obtenerTasaUsdVigente } from '../../lib/moneda.js';
import { prisma } from '../../lib/prisma.js';

// "pagado o posterior" en el ciclo de vida normal del pedido (no incluye
// cancelado ni reembolsado: esas unidades volvieron a estar disponibles,
// no siguen contando como vendidas de este lote).
const ESTADOS_VENDIDO: EstadoPedido[] = ['pagado', 'enPreparacion', 'despachado', 'entregado'];

// Exportada: admin/limitadas/servicio.ts la reusa tal cual para el
// panel (columna "Vendidas" y la advertencia al reducir el lote) — nunca
// se duplica esta consulta.
export async function contarUnidadesVendidas(varianteIds: string[], desde: Date): Promise<number> {
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
          // Para el indicador "1/N" en celular (MiniaturaGaleria) sin
          // traer la galería completa solo para contar.
          _count: { select: { imagenes: { where: { varianteId: null } } } },
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

  const mapeadas = await Promise.all(
    ediciones.map(async (edicion) => {
      const varianteIds = edicion.producto.variantes.map((v) => v.id);
      const precios = edicion.producto.variantes.map((v) => v.precioActual);
      const precioMinimo = precios.length > 0 ? Math.min(...precios) : 0;
      const varianteBase = edicion.producto.variantes.find((v) => v.precioActual === precioMinimo);

      // Restantes se cuenta por VENTAS desde que arrancó el lote, no por
      // stock actual: el lote anunciado es una promesa ("van 6 piezas de
      // esto"), no un espejo del inventario. Si se repone stock del
      // producto, el lote no se infla ni se reinicia — sigue siendo el
      // mismo lote, y por eso puede agotarse aunque el producto tenga
      // unidades disponibles en el catálogo general.
      //
      // unidadesLote null = sin tope (una edición limitada por fecha, no
      // por cantidad): nunca se agota por ventas, así que acá
      // unidadesRestantes queda null a propósito, no 0 ni Infinity.
      const vendidas = await contarUnidadesVendidas(varianteIds, edicion.desde);
      const unidadesRestantes =
        edicion.unidadesLote === null ? null : Math.max(0, edicion.unidadesLote - vendidas);

      return {
        id: edicion.id,
        nombre: edicion.nombre,
        descripcion: edicion.descripcion,
        unidadesLote: edicion.unidadesLote,
        // mostrarRestantes solo oculta el NÚMERO en la tienda; la
        // decisión de si la edición sigue apareciendo cuando se agota
        // (más abajo) siempre mira el valor real, nunca esta versión
        // enmascarada.
        unidadesRestantes: edicion.mostrarRestantes ? unidadesRestantes : null,
        agotada: unidadesRestantes !== null && unidadesRestantes <= 0,
        producto: {
          id: edicion.producto.id,
          nombre: edicion.producto.nombre,
          slug: edicion.producto.slug,
          imagen: edicion.producto.imagenes[0] ?? null,
          cantidadImagenes: edicion.producto._count.imagenes,
        },
        precio: calcularPrecioDualConTasa(precioMinimo, varianteBase?.precioUsd, tasaUsd),
        desde: edicion.desde,
        hasta: edicion.hasta,
      };
    }),
  );

  // Agotada (restantes <= 0, nunca por un unidadesLote null) deja de
  // mostrarse en la tienda: el lote se cerró, aunque el producto siga
  // teniendo stock por otras variantes o por reposición. activa:false ya
  // quedó afuera en el where de arriba.
  return mapeadas
    .filter((edicion) => !edicion.agotada)
    .map((edicion) => ({
      id: edicion.id,
      nombre: edicion.nombre,
      descripcion: edicion.descripcion,
      unidadesLote: edicion.unidadesLote,
      unidadesRestantes: edicion.unidadesRestantes,
      producto: edicion.producto,
      precio: edicion.precio,
      desde: edicion.desde,
      hasta: edicion.hasta,
    }));
}
