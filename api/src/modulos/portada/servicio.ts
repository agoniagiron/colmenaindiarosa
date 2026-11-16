import { imagenesPropiasDeValor, SELECT_IMAGEN_PUBLICA } from '../../lib/imagenesVariante.js';
import { prisma } from '../../lib/prisma.js';
import { listarPromocionesVigentes } from '../../lib/promociones.js';
import type { PromocionVigente } from '../../lib/promociones.js';
import { varianteMostradaDe } from '../catalogo/servicio.js';

// Carrusel del héroe de la tienda ("Encuentra tu tono"). Lee
// producto_destacado con seccion:'portada' (ver admin/productos/servicio.ts,
// donde el panel la escribe) — un concepto aparte de seccion:'inicio', que
// es el "Destacado" del catálogo (ver catalogo/servicio.ts). No se tocan
// desde/hasta: a diferencia de 'inicio', portada no tiene programación por
// fechas, una fila presente ya cuenta como vigente.
//
// Se arma por tono, sin tablas propias. Lo deciden dos cosas del panel:
//  - la casilla de portada decide qué productos entran;
//  - a qué color se le asignan fotos decide bajo qué tonos se ven.
//
// Un producto aparece bajo un tono solo si:
//  - tiene al menos una variante activa y disponible en ese color (una
//    foto que lleva a un color agotado no va en la portada), y
//  - tiene al menos una foto asignada a ese color. Nunca se muestra una
//    foto genérica ni la de otro color: sin foto propia, no aparece.
// Un tono sin productos no sale. Sin tonos, la tienda oculta la sección.

interface ProductoDeTono {
  id: string;
  slug: string;
  nombre: string;
  // SKU de la variante de ese color a la que lleva la foto: la ficha la
  // abre ya elegida (?variante=SKU).
  sku: string;
  imagen: { url: string; altTexto: string };
}

export interface TonoPortada {
  nombre: string;
  hex?: string;
  // Segundo tono de un color combinado (esfera partida).
  hexSecundario?: string;
  productos: ProductoDeTono[];
}

interface ColorDeVariante {
  valorId: string;
  valor: string;
  hex: string | null;
  hexSecundario: string | null;
  orden: number;
}

const disponible = (v: { stockActual: number; stockReservado: number }) =>
  v.stockActual - v.stockReservado > 0;

export async function obtenerHeroePortada(): Promise<{ tonos: TonoPortada[] }> {
  const filas = await prisma.productoDestacado.findMany({
    where: { seccion: 'portada', producto: { estado: 'publicado' } },
    orderBy: { orden: 'asc' },
    select: {
      producto: {
        select: {
          id: true,
          nombre: true,
          slug: true,
          categoriaId: true,
          variantePrincipalId: true,
          imagenes: { select: SELECT_IMAGEN_PUBLICA },
          variantes: {
            where: { activa: true },
            select: {
              id: true,
              sku: true,
              precioActual: true,
              stockActual: true,
              stockReservado: true,
              valoresAtributo: {
                where: { valorAtributo: { atributo: { slug: 'color' } } },
                select: {
                  valorId: true,
                  valorAtributo: {
                    select: { valor: true, hex: true, hexSecundario: true, orden: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // La variante a la que lleva la foto se elige como la de la tarjeta del
  // catálogo (principal, o la más barata con stock), con la promoción
  // vigente: hace falta para saber cuál es.
  const promociones: PromocionVigente[] = filas.length > 0 ? await listarPromocionesVigentes() : [];

  // Por valor de color: sus datos y los productos que van bajo él, en el
  // orden de producto_destacado.
  const tonos = new Map<string, { color: ColorDeVariante; productos: ProductoDeTono[] }>();

  for (const { producto } of filas) {
    const variantesPorColor = new Map<string, typeof producto.variantes>();
    const colores = new Map<string, ColorDeVariante>();
    for (const variante of producto.variantes) {
      if (!disponible(variante)) continue;
      for (const relacion of variante.valoresAtributo) {
        colores.set(relacion.valorId, { valorId: relacion.valorId, ...relacion.valorAtributo });
        const lista = variantesPorColor.get(relacion.valorId) ?? [];
        lista.push(variante);
        variantesPorColor.set(relacion.valorId, lista);
      }
    }

    for (const [valorId, variantes] of variantesPorColor) {
      const foto = imagenesPropiasDeValor(producto.imagenes, valorId)[0];
      if (!foto) continue;

      const { varianteId } = varianteMostradaDe({ ...producto, variantes }, promociones);
      const variante = variantes.find((v) => v.id === varianteId) ?? variantes[0]!;

      const tono = tonos.get(valorId) ?? { color: colores.get(valorId)!, productos: [] };
      tono.productos.push({
        id: producto.id,
        slug: producto.slug,
        nombre: producto.nombre,
        sku: variante.sku,
        imagen: { url: foto.url, altTexto: foto.altTexto },
      });
      tonos.set(valorId, tono);
    }
  }

  return {
    tonos: [...tonos.values()]
      .sort((a, b) => a.color.orden - b.color.orden)
      .map(({ color, productos }) => ({
        nombre: color.valor,
        // Sin claves vacías: un color sin tono es solo el nombre.
        ...(color.hex ? { hex: color.hex } : {}),
        ...(color.hex && color.hexSecundario ? { hexSecundario: color.hexSecundario } : {}),
        productos,
      })),
  };
}
