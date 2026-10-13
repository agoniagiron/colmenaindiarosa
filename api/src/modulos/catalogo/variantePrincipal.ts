// Única fuente de "qué variante y qué precio muestra la tienda para un
// producto". La usan la tarjeta del catálogo, la ficha (variante con la que
// abre), el orden y el filtro por precio, y las facetas: los cinco miran el
// mismo número. Mismo criterio que diagnosticarPieza en combos/servicio.ts.
//
// Reglas:
//  - Manda la variante principal (producto.variante_principal_id).
//  - Si la principal está agotada, o el producto no tiene principal (los
//    anteriores a la columna), se muestra la más barata que tenga stock: no
//    tiene sentido recibir a la clienta con algo que no puede comprar.
//  - "desde" solo si hay más de un precio Y el mostrado es el mínimo. Si la
//    principal no es la más barata, el número va solo: un "desde" con un
//    número que no es el mínimo sería engañar.
//
// Recibe solo variantes ACTIVAS, con el precio que ve la clienta (con la
// promoción ya aplicada). Una principal inactiva no llega acá, así que cae
// sola en el reemplazo.

export interface VarianteParaMostrar {
  id: string;
  precio: number;
  disponible: number;
}

export type OrigenVarianteMostrada =
  // La principal, con stock.
  | 'principal'
  // Hay principal pero está agotada (o inactiva): se muestra un reemplazo.
  | 'principal_sin_stock'
  // El producto no tiene principal definida: se muestra la más barata.
  | 'sin_principal';

export interface VarianteMostrada {
  varianteId: string | null;
  precio: number;
  desde: boolean;
  origen: OrigenVarianteMostrada;
}

function masBarata(variantes: VarianteParaMostrar[]): VarianteParaMostrar {
  return variantes.reduce((mejor, v) => (v.precio < mejor.precio ? v : mejor));
}

export function resolverVarianteMostrada(
  variantes: VarianteParaMostrar[],
  variantePrincipalId: string | null,
): VarianteMostrada {
  const principal = variantePrincipalId
    ? variantes.find((v) => v.id === variantePrincipalId)
    : undefined;
  const origenSinPrincipal: OrigenVarianteMostrada = variantePrincipalId
    ? 'principal_sin_stock'
    : 'sin_principal';

  if (variantes.length === 0) {
    return { varianteId: null, precio: 0, desde: false, origen: origenSinPrincipal };
  }

  const conStock = variantes.filter((v) => v.disponible > 0);
  // Lo que se puede comprar hoy. Si no hay nada con stock, el producto está
  // agotado entero y se muestra igual (la tarjeta lo marca como agotado).
  const comprables = conStock.length > 0 ? conStock : variantes;

  let mostrada: VarianteParaMostrar;
  let origen: OrigenVarianteMostrada;
  if (principal && principal.disponible > 0) {
    mostrada = principal;
    origen = 'principal';
  } else if (conStock.length === 0 && principal) {
    // Todo agotado: la principal sigue siendo la referencia.
    mostrada = principal;
    origen = 'principal_sin_stock';
  } else {
    mostrada = masBarata(comprables);
    origen = origenSinPrincipal;
  }

  const minimo = masBarata(comprables).precio;
  const hayVariosPrecios = new Set(comprables.map((v) => v.precio)).size > 1;

  return {
    varianteId: mostrada.id,
    precio: mostrada.precio,
    desde: hayVariosPrecios && mostrada.precio === minimo,
    origen,
  };
}
