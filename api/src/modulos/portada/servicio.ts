import { galeriaDeVarianteId, SELECT_IMAGEN_PUBLICA } from '../../lib/imagenesVariante.js';
import { prisma } from '../../lib/prisma.js';
import { listarPromocionesVigentes } from '../../lib/promociones.js';
import type { PromocionVigente } from '../../lib/promociones.js';
import { varianteMostradaDe } from '../catalogo/servicio.js';

// Carrusel del héroe de la tienda. Lee producto_destacado con
// seccion:'portada' (ver admin/productos/servicio.ts, donde el panel la
// escribe) — un concepto aparte de seccion:'inicio', que es el "Destacado"
// del catálogo (ver catalogo/servicio.ts). No se tocan desde/hasta: a
// diferencia de 'inicio', portada no tiene programación por fechas, una
// fila presente ya cuenta como vigente.

interface ColorDisponible {
  nombre: string;
  hex?: string;
  // Segundo tono de un color combinado (esfera partida).
  hexSecundario?: string;
}

// Sin claves vacías: un color sin tono es solo el nombre.
function aColorDisponible(
  nombre: string,
  hex: string | null | undefined,
  hexSecundario: string | null | undefined,
): ColorDisponible {
  return {
    nombre,
    ...(hex ? { hex } : {}),
    ...(hex && hexSecundario ? { hexSecundario } : {}),
  };
}

function estaAgotada(variantes: { stockActual: number; stockReservado: number }[]): boolean {
  // Mismo criterio que el catálogo público (ver TarjetaProducto.tsx en
  // web/): lo reservado también cuenta como no disponible, no solo lo
  // vendido.
  return variantes.every((v) => v.stockActual - v.stockReservado <= 0);
}

type ProductoParaPortada = Parameters<typeof varianteMostradaDe>[0] & {
  imagenes: { url: string; altTexto: string; valorAtributoId: string | null; orden: number }[];
  variantes: { id: string; valoresAtributo: { valorId: string }[] }[];
};

function portadaDe(producto: ProductoParaPortada, promociones: PromocionVigente[]) {
  const { varianteId } = varianteMostradaDe(producto, promociones);
  const portada = galeriaDeVarianteId(producto.imagenes, producto.variantes, varianteId)[0];
  return portada ? { url: portada.url, altTexto: portada.altTexto } : null;
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
          categoriaId: true,
          variantePrincipalId: true,
          imagenes: { select: SELECT_IMAGEN_PUBLICA },
          variantes: {
            where: { activa: true },
            select: {
              id: true,
              precioActual: true,
              stockActual: true,
              stockReservado: true,
              // Todos los valores: la foto se resuelve con cualquiera de
              // ellos; los tonos del héroe filtran solo los de color.
              valoresAtributo: {
                select: {
                  valorId: true,
                  valorAtributo: {
                    select: {
                      valor: true,
                      hex: true,
                      hexSecundario: true,
                      orden: true,
                      atributo: { select: { slug: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // La foto sale de la variante mostrada, igual que el precio de la
  // tarjeta: hace falta la promoción para saber cuál es.
  const promociones = filas.length > 0 ? await listarPromocionesVigentes() : [];

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
        if (relacion.valorAtributo.atributo.slug !== 'color') continue;
        const { valor, hex, hexSecundario, orden } = relacion.valorAtributo;
        if (!coloresProducto.has(valor)) {
          coloresProducto.set(valor, { ...aColorDisponible(valor, hex, hexSecundario), orden });
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
      imagenPrincipal: portadaDe(producto, promociones),
      colores: [...coloresProducto.values()]
        .sort((a, b) => a.orden - b.orden)
        .map(({ nombre, hex, hexSecundario }) => aColorDisponible(nombre, hex, hexSecundario)),
    });
  }

  const colores = [...coloresUnion.values()]
    .sort((a, b) => a.orden - b.orden)
    .map(({ nombre, hex, hexSecundario }) => aColorDisponible(nombre, hex, hexSecundario));

  return { destacadas, colores };
}
