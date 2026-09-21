import { formatearPesos } from './formatearPesos.ts';

const UN_MILLON = 1_000_000;

const formateadorMillones = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// Para cifras grandes de un panel de métricas ($34,8 M en vez de
// $34.812.400): debajo de un millón se ve el peso completo, arriba se
// abrevia a millones con un decimal.
export function formatearPesosCompacto(valor: number): string {
  if (Math.abs(valor) < UN_MILLON) return formatearPesos(valor);
  return `$${formateadorMillones.format(valor / UN_MILLON)} M`;
}
