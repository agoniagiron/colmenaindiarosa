// Módulo puro: cuando exista el backend se mueve al servidor sin
// reescribirse (ver CLAUDE.md). No dupliques esta lógica en componentes.

import type { Cupon, LineaCarrito, TotalesCarrito } from '../tipos/index.ts';

export const COSTO_ENVIO = 15000;
export const UMBRAL_ENVIO_GRATIS = 400000;

export function calcularTotales(lineas: LineaCarrito[], cupon?: Cupon | null): TotalesCarrito {
  const subtotal = Math.round(
    lineas.reduce((acumulado, linea) => acumulado + linea.precioUnitario * linea.cantidad, 0),
  );

  const cuponAplica = Boolean(cupon) && subtotal >= (cupon?.montoMinimo ?? 0);

  let descuento = 0;
  if (cuponAplica && cupon) {
    if (cupon.tipo === 'porcentaje') {
      descuento = Math.round(subtotal * (cupon.valor / 100));
    } else if (cupon.tipo === 'monto') {
      descuento = Math.round(cupon.valor);
    }
  }
  descuento = Math.min(descuento, subtotal);

  const envioGratisPorMonto = subtotal - descuento >= UMBRAL_ENVIO_GRATIS;
  const envioGratisPorCupon = cuponAplica && cupon?.tipo === 'envio';
  const envio = envioGratisPorMonto || envioGratisPorCupon ? 0 : COSTO_ENVIO;

  const total = subtotal - descuento + envio;

  return { subtotal, descuento, envio, total };
}
