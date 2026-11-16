import type { Prisma } from '@prisma/client';

// Única fuente de "qué fotos muestra la tienda para una variante". La usan
// la ficha (galería por variante), la tarjeta del catálogo, el héroe, las
// ediciones limitadas, las piezas de un kit, el carrito y la copia que
// guarda el pedido. Ninguna pantalla decide por su cuenta de dónde sale la
// foto: mismo criterio que variantePrincipal.ts con el precio.
//
// Una foto se asocia a un valor de atributo (imagen_producto.valor_atributo_id),
// no a una variante: las fotos del rosa sirven para todas sus longitudes.
// En NULL es genérica.
//
// Reglas:
//  - Primero las fotos de los valores de la variante, después las genéricas.
//  - Si ningún valor de la variante tiene fotos, solo las genéricas: nunca
//    las de otro color.
//  - Si tampoco hay genéricas, todas, antes que una galería vacía.
//  - Dentro de cada grupo, por `orden`. La portada es la primera.

export interface ImagenAsociable {
  valorAtributoId: string | null;
  orden: number;
}

// Lo que hay que leer de imagen_producto para resolver la galería.
export const SELECT_IMAGEN_PUBLICA = {
  id: true,
  url: true,
  altTexto: true,
  valorAtributoId: true,
  orden: true,
} satisfies Prisma.ImagenProductoSelect;

export type ImagenCruda = Prisma.ImagenProductoGetPayload<{ select: typeof SELECT_IMAGEN_PUBLICA }>;

// Lo que viaja a la tienda: la asociación ya se resolvió en el servidor.
export function aImagenPublica({ id, url, altTexto }: ImagenCruda) {
  return { id, url, altTexto };
}

function porOrden<T extends ImagenAsociable>(imagenes: readonly T[]): T[] {
  return [...imagenes].sort((a, b) => a.orden - b.orden);
}

export function resolverImagenesVariante<T extends ImagenAsociable>(
  imagenes: readonly T[],
  valoresVariante: Iterable<string>,
): T[] {
  const valores = new Set(valoresVariante);
  const ordenadas = porOrden(imagenes);
  const propias = ordenadas.filter(
    (imagen) => imagen.valorAtributoId !== null && valores.has(imagen.valorAtributoId),
  );
  const genericas = ordenadas.filter((imagen) => imagen.valorAtributoId === null);

  if (propias.length > 0) return [...propias, ...genericas];
  if (genericas.length > 0) return genericas;
  return ordenadas;
}

export function imagenDeVariante<T extends ImagenAsociable>(
  imagenes: readonly T[],
  valoresVariante: Iterable<string>,
): T | null {
  return resolverImagenesVariante(imagenes, valoresVariante)[0] ?? null;
}

// Los ids de valor de una variante, a partir de las filas de
// variante_valor_atributo (con `valorId` seleccionado).
export function valoresDeVariante(variante: { valoresAtributo: { valorId: string }[] }): string[] {
  return variante.valoresAtributo.map((relacion) => relacion.valorId);
}

// Solo las fotos asignadas a un valor, sin genéricas ni las de otro valor:
// vacío si ese valor no tiene fotos propias. Para lo que se muestra BAJO un
// color (el carrusel de portada por tono), donde una foto genérica o de otro
// color sería mostrar algo que no es lo que se eligió. La galería de una
// variante sigue siendo resolverImagenesVariante, que sí completa.
export function imagenesPropiasDeValor<T extends ImagenAsociable>(
  imagenes: readonly T[],
  valorId: string,
): T[] {
  return porOrden(imagenes).filter((imagen) => imagen.valorAtributoId === valorId);
}

// La galería de una variante de un producto, por id. Para la portada, el
// id es el de la variante mostrada (variantePrincipal.ts): la foto sale de
// la misma variante que el precio. Con id null (producto sin variantes
// activas), las genéricas.
export function galeriaDeVarianteId<T extends ImagenAsociable>(
  imagenes: readonly T[],
  variantes: { id: string; valoresAtributo: { valorId: string }[] }[],
  varianteId: string | null,
): T[] {
  const variante = variantes.find((v) => v.id === varianteId);
  return resolverImagenesVariante(imagenes, variante ? valoresDeVariante(variante) : []);
}
