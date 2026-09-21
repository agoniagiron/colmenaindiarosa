import { obtenerNumero } from './configuracion.js';

export interface PrecioDual {
  cop: number;
  // Centavos de dólar enteros (ej. USD 12.34 => 1234).
  usd: number;
}

export async function obtenerTasaUsdVigente(): Promise<number> {
  return obtenerNumero('moneda.tasa_usd');
}

// Núcleo puro y sincrónico: recibe la tasa ya resuelta para no pegarle a
// la caché de configuración una vez por cada precio cuando se mapean
// varios productos/variantes en un mismo listado.
export function calcularPrecioDualConTasa(
  precioCop: number,
  precioUsdCentavos: number | null | undefined,
  tasaUsd: number,
): PrecioDual {
  if (precioUsdCentavos !== null && precioUsdCentavos !== undefined) {
    return { cop: precioCop, usd: precioUsdCentavos };
  }
  return { cop: precioCop, usd: Math.round((precioCop / tasaUsd) * 100) };
}

// Conveniencia para un solo precio: resuelve la tasa vigente y calcula.
export async function calcularPrecioDual(
  precioCop: number,
  precioUsdCentavos?: number | null,
): Promise<PrecioDual> {
  const tasaUsd = await obtenerTasaUsdVigente();
  return calcularPrecioDualConTasa(precioCop, precioUsdCentavos, tasaUsd);
}
