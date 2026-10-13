// Única fuente del código de producto y del SKU de variante. La usan la
// creación individual de variantes, la vista previa del asistente en lote
// y la creación en lote: lo que se ve en la vista previa es exactamente lo
// que se guarda. Todo sale de las columnas `codigo` (categoria.codigo,
// producto.codigo_modelo, valor_atributo.codigo), nunca de nombres.
//
//   Código de producto: IR-{categoria.codigo}-{producto.codigo_modelo}
//                       IR-PEL-VAL, IR-CUI-CREMA300
//   SKU de variante:    código de producto + largo + color, los que tenga
//                       IR-PEL-VAL-24-NEG; sin largo ni color, igual al
//                       código de producto.

const PREFIJO = 'IR';

// El guion es el separador del SKU: un código con guion volvería ambiguo
// dónde termina el modelo y empieza el largo.
const PATRON_CODIGO_MODELO = /^[A-Z0-9]{2,20}$/;

export function normalizarCodigoModelo(texto: string): string {
  return texto.trim().toUpperCase();
}

export function esCodigoModeloValido(codigo: string): boolean {
  return PATRON_CODIGO_MODELO.test(codigo);
}

export function armarCodigoProducto(codigoCategoria: string, codigoModelo: string): string {
  return `${PREFIJO}-${codigoCategoria}-${codigoModelo}`;
}

export function armarSkuVariante(
  codigoProducto: string,
  codigoLargo: string | null,
  codigoColor: string | null,
): string {
  return [codigoProducto, codigoLargo, codigoColor].filter(Boolean).join('-');
}
