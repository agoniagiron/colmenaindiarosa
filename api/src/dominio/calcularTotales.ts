// Módulo puro movido tal cual desde web/src/dominio/calcularTotales.ts (ver
// CLAUDE.md): la lógica no cambia, solo los tipos importados (acá locales,
// ya que el backend no puede importar de web/). No dupliques esta lógica en
// ningún otro lugar del backend.
//
// Los montos de envío/descuento ya no son constantes: salen de la tabla
// configuracion (ver lib/configuracion.ts) y se pasan como parámetro.

export type TipoCupon = 'porcentaje' | 'monto' | 'envio';

export interface LineaParaTotales {
  precioUnitario: number;
  cantidad: number;
}

export interface CuponParaTotales {
  tipo: TipoCupon;
  valor: number;
  montoMinimo: number;
}

export interface ConfigTotales {
  envioCosto: number;
  descuentoUmbral: number;
  descuentoPorcentaje: number;
  descuentoActivo: boolean;
}

export type OrigenDescuento = 'automatico' | 'cupon';

export interface TotalesCarrito {
  subtotal: number;
  descuento: number;
  envio: number;
  total: number;
  // Cuál de los dos descuentos (automático por monto vs. cupón) ganó, para
  // que el frontend se lo explique a la clienta. Nunca se suman.
  descuentoAplicado: OrigenDescuento | 'ninguno';
  descuentoDescartado: { origen: OrigenDescuento; monto: number } | null;
}

export function calcularTotales(
  lineas: LineaParaTotales[],
  cupon: CuponParaTotales | null | undefined,
  config: ConfigTotales,
): TotalesCarrito {
  const subtotal = Math.round(
    lineas.reduce((acumulado, linea) => acumulado + linea.precioUnitario * linea.cantidad, 0),
  );

  const descuentoAutomatico =
    config.descuentoActivo && subtotal >= config.descuentoUmbral
      ? Math.round(subtotal * (config.descuentoPorcentaje / 100))
      : 0;

  const cuponAplica = Boolean(cupon) && subtotal >= (cupon?.montoMinimo ?? 0);
  let descuentoCupon = 0;
  if (cuponAplica && cupon) {
    if (cupon.tipo === 'porcentaje') {
      descuentoCupon = Math.round(subtotal * (cupon.valor / 100));
    } else if (cupon.tipo === 'monto') {
      descuentoCupon = Math.round(cupon.valor);
    }
  }

  // El automático (por monto) y el del cupón nunca se suman: gana el
  // mayor de los dos, y el otro queda registrado como descartado.
  let descuento = 0;
  let descuentoAplicado: TotalesCarrito['descuentoAplicado'] = 'ninguno';
  let descuentoDescartado: TotalesCarrito['descuentoDescartado'] = null;

  if (descuentoAutomatico > 0 || descuentoCupon > 0) {
    if (descuentoAutomatico >= descuentoCupon) {
      descuento = descuentoAutomatico;
      descuentoAplicado = 'automatico';
      if (descuentoCupon > 0) descuentoDescartado = { origen: 'cupon', monto: descuentoCupon };
    } else {
      descuento = descuentoCupon;
      descuentoAplicado = 'cupon';
      if (descuentoAutomatico > 0) {
        descuentoDescartado = { origen: 'automatico', monto: descuentoAutomatico };
      }
    }
  }
  descuento = Math.min(descuento, subtotal);

  // El envío ya no tiene umbral de gratuidad: se cobra siempre, salvo un
  // cupón de tipo "envio" (mecanismo aparte, no compite con el descuento).
  const envioGratisPorCupon = cuponAplica && cupon?.tipo === 'envio';
  const envio = envioGratisPorCupon ? 0 : config.envioCosto;

  const total = subtotal - descuento + envio;

  return { subtotal, descuento, envio, total, descuentoAplicado, descuentoDescartado };
}
