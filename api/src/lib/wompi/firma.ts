import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';

// Firma de integridad de Wompi: SHA-256 de la concatenación, en este orden
// exacto: referencia + montoEnCentavos + moneda + secretoIntegridad.
// Se genera siempre acá (servidor); si el secreto aparece en algún archivo
// bajo web/, es un error de seguridad.
export function generarFirmaIntegridad(
  referencia: string,
  montoEnCentavos: number,
  moneda: string,
): string {
  const cadena = `${referencia}${montoEnCentavos}${moneda}${env.WOMPI_SECRETO_INTEGRIDAD}`;
  return createHash('sha256').update(cadena).digest('hex');
}
