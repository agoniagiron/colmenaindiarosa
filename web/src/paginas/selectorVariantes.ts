// Selector de variantes de la ficha, jerárquico en el orden en que se muestran
// los grupos. Ese orden lo configura cada categoría en el panel
// (categoria_atributo): en pelucas, tipo de base → longitud → color → talla →
// densidad; en extensiones, color → longitud. El orden define también la
// jerarquía de qué se deshabilita.
//
// Por qué jerárquico: las variantes no forman una grilla completa (el
// asistente deja desmarcar combinaciones, y hay atributos que van atados,
// como color y densidad). Si cada opción se deshabilitara contra TODO el
// resto de la selección, el selector se traba: estando en Media + Negro,
// "Larga" no existe con Negro y "Castaño" no existe con Media, y no habría
// forma de salir. En cambio, cada opción se evalúa contra lo elegido en los
// grupos de ARRIBA, y al elegir algo arriba, los de abajo se acomodan — y si
// alguno cambia, se avisa, nunca en silencio.

import type { VarianteProducto } from '../tipos/index.ts';

export type ClaveAtributo = 'tipoBase' | 'longitud' | 'color' | 'talla' | 'densidad';

// Orden por defecto: el de pelucas. Se usa si la API no manda el orden de la
// categoría, y para ubicar al final los atributos que una variante vieja usa
// aunque su categoría ya no los tenga.
export const GRUPOS_ATRIBUTO: { clave: ClaveAtributo; etiqueta: string }[] = [
  { clave: 'tipoBase', etiqueta: 'Tipo de base' },
  { clave: 'longitud', etiqueta: 'Longitud' },
  { clave: 'color', etiqueta: 'Color' },
  { clave: 'talla', etiqueta: 'Talla' },
  { clave: 'densidad', etiqueta: 'Densidad' },
];

const CLAVE_POR_SLUG: Record<string, ClaveAtributo> = {
  tipo_base: 'tipoBase',
  longitud: 'longitud',
  color: 'color',
  talla: 'talla',
  densidad: 'densidad',
};

// Orden de los grupos para un producto: los slugs de su categoría en el
// orden configurado, y al final cualquier otro atributo (en el orden por
// defecto), para que una variante vieja con un atributo que la categoría ya
// no usa siga siendo elegible.
export function ordenDeGrupos(slugsCategoria: string[] | undefined): ClaveAtributo[] {
  const deCategoria = (slugsCategoria ?? [])
    .map((slug) => CLAVE_POR_SLUG[slug])
    .filter((clave): clave is ClaveAtributo => Boolean(clave));
  const resto = GRUPOS_ATRIBUTO.map((g) => g.clave).filter((c) => !deCategoria.includes(c));
  return [...deCategoria, ...resto];
}

export function valorAtributo(
  variante: VarianteProducto,
  clave: ClaveAtributo,
): string | undefined {
  switch (clave) {
    case 'color':
      return variante.color?.nombre;
    case 'tipoBase':
      return variante.tipoBase;
    case 'longitud':
      return variante.longitud;
    case 'talla':
      return variante.talla;
    case 'densidad':
      return variante.densidad;
  }
}

export function disponibleDe(variante: VarianteProducto): number {
  return variante.stockActual - variante.stockReservado;
}

export type EstadoOpcion = 'disponible' | 'agotada' | 'no_existe';

// Variantes que coinciden con la selección actual en todos los grupos de
// arriba de `clave` (según `orden`), y que tienen `valor` en `clave`.
function candidatas(
  variantes: VarianteProducto[],
  clave: ClaveAtributo,
  valor: string,
  actual: VarianteProducto,
  orden: ClaveAtributo[],
): VarianteProducto[] {
  const anteriores = orden.slice(0, orden.indexOf(clave));
  return variantes.filter(
    (v) =>
      valorAtributo(v, clave) === valor &&
      anteriores.every((c) => valorAtributo(v, c) === valorAtributo(actual, c)),
  );
}

export function estadoOpcion(
  variantes: VarianteProducto[],
  clave: ClaveAtributo,
  valor: string,
  actual: VarianteProducto,
  orden: ClaveAtributo[],
): EstadoOpcion {
  const posibles = candidatas(variantes, clave, valor, actual, orden);
  if (posibles.length === 0) return 'no_existe';
  return posibles.some((v) => disponibleDe(v) > 0) ? 'disponible' : 'agotada';
}

export interface AjusteAutomatico {
  clave: ClaveAtributo;
  antes: string;
  despues: string;
}

// Al elegir `valor` en `clave`: la variante que coincide con los grupos de
// arriba y el valor elegido, que conserve lo más posible los grupos de abajo
// (en orden) y que tenga stock si alguna lo tiene. Devuelve también qué
// grupos de abajo cambiaron, para avisarlo.
export function elegirAlCambiar(
  variantes: VarianteProducto[],
  clave: ClaveAtributo,
  valor: string,
  actual: VarianteProducto,
  orden: ClaveAtributo[],
): { variante: VarianteProducto; ajustes: AjusteAutomatico[] } {
  const posibles = candidatas(variantes, clave, valor, actual, orden);
  if (posibles.length === 0) return { variante: actual, ajustes: [] };

  const conStock = posibles.filter((v) => disponibleDe(v) > 0);
  const pool = conStock.length > 0 ? conStock : posibles;
  const siguientes = orden.slice(orden.indexOf(clave) + 1);

  // Comparación lexicográfica: primero conservar el grupo de abajo más
  // cercano, después el siguiente, etc.
  const puntaje = (v: VarianteProducto) =>
    siguientes.map((c) => (valorAtributo(v, c) === valorAtributo(actual, c) ? 1 : 0));
  const mejor = pool.reduce((a, b) => {
    const pa = puntaje(a);
    const pb = puntaje(b);
    for (let i = 0; i < pa.length; i++) {
      if (pb[i]! !== pa[i]!) return pb[i]! > pa[i]! ? b : a;
    }
    return a;
  });

  const ajustes: AjusteAutomatico[] = [];
  for (const c of siguientes) {
    const antes = valorAtributo(actual, c);
    const despues = valorAtributo(mejor, c);
    if (antes && despues && antes !== despues) {
      ajustes.push({ clave: c, antes, despues });
    }
  }
  return { variante: mejor, ajustes };
}
