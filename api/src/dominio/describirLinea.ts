// Única función que arma el texto de una línea de compra: "HANNAH — Rosa /
// 14 / Lace frontal 13x4 / Mediana / 210". La usan el carrito, el checkout,
// el mensaje de WhatsApp a la tienda y las pantallas de pedido (de la
// clienta y del panel). El frontend muestra lo que llega, no arma este
// texto por su cuenta.
//
// Orden: color, longitud, tipo de base, talla, densidad. Un atributo que no
// esté en esa lista va al final, en el orden en que llegó.

export interface AtributoDeLinea {
  slug: string;
  valor: string;
}

const ORDEN_ATRIBUTOS = ['color', 'longitud', 'tipo_base', 'talla', 'densidad'];

function rango(slug: string): number {
  const indice = ORDEN_ATRIBUTOS.indexOf(slug);
  return indice === -1 ? ORDEN_ATRIBUTOS.length : indice;
}

export function describirAtributos(atributos: readonly AtributoDeLinea[]): string {
  return atributos
    .filter((atributo) => atributo.valor.trim().length > 0)
    .map((atributo, indice) => ({ atributo, indice }))
    .sort((a, b) => rango(a.atributo.slug) - rango(b.atributo.slug) || a.indice - b.indice)
    .map(({ atributo }) => atributo.valor.trim())
    .join(' / ');
}

export function describirLinea(nombre: string, atributos: readonly AtributoDeLinea[]): string {
  const texto = describirAtributos(atributos);
  return texto ? `${nombre} — ${texto}` : nombre;
}

// Las líneas de pedido guardan cinco columnas fijas (pedido_item); esto las
// pasa a la forma que recibe describirLinea.
export function atributosDeColumnas(linea: {
  tipoBase?: string | null;
  longitud?: string | null;
  colorNombre?: string | null;
  talla?: string | null;
  densidad?: string | null;
}): AtributoDeLinea[] {
  const atributos: AtributoDeLinea[] = [];
  if (linea.colorNombre) atributos.push({ slug: 'color', valor: linea.colorNombre });
  if (linea.longitud) atributos.push({ slug: 'longitud', valor: linea.longitud });
  if (linea.tipoBase) atributos.push({ slug: 'tipo_base', valor: linea.tipoBase });
  if (linea.talla) atributos.push({ slug: 'talla', valor: linea.talla });
  if (linea.densidad) atributos.push({ slug: 'densidad', valor: linea.densidad });
  return atributos;
}

// Las filas de variante_valor_atributo de una variante, con todos sus
// atributos (no solo los cinco de las columnas).
export function atributosDeVariante(
  valoresAtributo: { valorAtributo: { valor: string; atributo: { slug: string } } }[],
): AtributoDeLinea[] {
  return valoresAtributo.map(({ valorAtributo }) => ({
    slug: valorAtributo.atributo.slug,
    valor: valorAtributo.valor,
  }));
}
