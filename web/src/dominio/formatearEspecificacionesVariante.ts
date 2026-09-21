// Módulo puro: único lugar que decide cómo se ve el resumen de atributos de
// una variante (usado en la ficha de producto y en el carrito). Omite los
// atributos que no existan; si no hay ninguno, devuelve una cadena vacía.

import type { ValorAtributo } from '../tipos/index.ts';

export interface AtributosVariante {
  tipoBase?: string;
  longitud?: string;
  color?: ValorAtributo;
  talla?: string;
  densidad?: string;
}

export function formatearEspecificacionesVariante(atributos: AtributosVariante): string {
  const partes: string[] = [];

  if (atributos.tipoBase) partes.push(atributos.tipoBase);
  if (atributos.longitud) partes.push(atributos.longitud);
  if (atributos.color) partes.push(atributos.color.nombre);
  if (atributos.talla) partes.push(`Talla ${atributos.talla}`);
  if (atributos.densidad) partes.push(atributos.densidad);

  return partes.join(' · ');
}
