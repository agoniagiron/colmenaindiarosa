import { prisma } from '../../lib/prisma.js';

// Carrusel del héroe de la tienda. Lee producto_destacado con
// seccion:'portada' (ver admin/productos/servicio.ts, donde el panel la
// escribe) — un concepto aparte de seccion:'inicio', que es el "Destacado"
// del catálogo (ver catalogo/servicio.ts). No se tocan desde/hasta: a
// diferencia de 'inicio', portada no tiene programación por fechas, una
// fila presente ya cuenta como vigente.

interface ColorDisponible {
  nombre: string;
  hex?: string;
}

function estaAgotada(variantes: { stockActual: number; stockReservado: number }[]): boolean {
  // Mismo criterio que el catálogo público (ver TarjetaProducto.tsx en
  // web/): lo reservado también cuenta como no disponible, no solo lo
  // vendido.
  return variantes.every((v) => v.stockActual - v.stockReservado <= 0);
}

export async function obtenerHeroePortada() {
  const filas = await prisma.productoDestacado.findMany({
    where: { seccion: 'portada', producto: { estado: 'publicado' } },
    orderBy: { orden: 'asc' },
    select: {
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
            select: {
              stockActual: true,
              stockReservado: true,
              valoresAtributo: {
                where: { valorAtributo: { atributo: { slug: 'color' } } },
                select: {
                  valorAtributo: { select: { valor: true, hex: true, orden: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const coloresUnion = new Map<string, ColorDisponible & { orden: number }>();
  const destacadas: {
    id: string;
    slug: string;
    nombre: string;
    imagenPrincipal: { url: string; altTexto: string } | null;
    colores: ColorDisponible[];
  }[] = [];

  for (const fila of filas) {
    const { producto } = fila;

    // No mandar a la clienta a una ficha agotada desde el héroe: en el
    // catálogo la peluca sigue apareciendo marcada como agotada, como hoy
    // (esto no toca catalogo/servicio.ts).
    if (estaAgotada(producto.variantes)) continue;

    const coloresProducto = new Map<string, ColorDisponible & { orden: number }>();
    for (const variante of producto.variantes) {
      for (const relacion of variante.valoresAtributo) {
        const { valor, hex, orden } = relacion.valorAtributo;
        if (!coloresProducto.has(valor)) {
          coloresProducto.set(valor, hex ? { nombre: valor, hex, orden } : { nombre: valor, orden });
        }
      }
    }

    for (const [valor, color] of coloresProducto) {
      if (!coloresUnion.has(valor)) coloresUnion.set(valor, color);
    }

    destacadas.push({
      id: producto.id,
      slug: producto.slug,
      nombre: producto.nombre,
      imagenPrincipal: producto.imagenes[0] ?? null,
      colores: [...coloresProducto.values()]
        .sort((a, b) => a.orden - b.orden)
        .map(({ nombre, hex }) => (hex ? { nombre, hex } : { nombre })),
    });
  }

  const colores = [...coloresUnion.values()]
    .sort((a, b) => a.orden - b.orden)
    .map(({ nombre, hex }) => (hex ? { nombre, hex } : { nombre }));

  return { destacadas, colores };
}
