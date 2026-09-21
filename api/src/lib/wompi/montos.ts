// Wompi trabaja en centavos; nuestra base guarda pesos enteros. Cualquier
// punto de contacto con Wompi (firma, widget, webhook) pasa por acá: ningún
// otro archivo multiplica o divide por 100 a mano.

export function aPesosACentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export function aCentavosAPesos(centavos: number): number {
  return Math.round(centavos / 100);
}
