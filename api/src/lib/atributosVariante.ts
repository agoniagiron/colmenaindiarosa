// Compartido entre modulos/catalogo y modulos/carrito: ambos necesitan
// armar tipoBase/longitud/color/talla/densidad a partir de las filas de
// variante_valor_atributo de una variante.

export interface RelacionValorAtributo {
  valorAtributo: {
    valor: string;
    hex: string | null;
    atributo: { slug: string };
  };
}

export interface AtributosExtraidos {
  tipoBase?: string;
  longitud?: string;
  talla?: string;
  densidad?: string;
  color?: { nombre: string; hex?: string };
}

export function extraerAtributosVariante(
  valoresAtributo: RelacionValorAtributo[],
): AtributosExtraidos {
  const resultado: AtributosExtraidos = {};

  for (const relacion of valoresAtributo) {
    const { slug } = relacion.valorAtributo.atributo;
    const { valor, hex } = relacion.valorAtributo;
    if (slug === 'tipo_base') resultado.tipoBase = valor;
    else if (slug === 'longitud') resultado.longitud = valor;
    else if (slug === 'talla') resultado.talla = valor;
    else if (slug === 'densidad') resultado.densidad = valor;
    else if (slug === 'color') resultado.color = hex ? { nombre: valor, hex } : { nombre: valor };
  }

  return resultado;
}
