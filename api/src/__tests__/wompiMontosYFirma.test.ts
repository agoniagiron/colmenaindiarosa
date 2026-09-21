import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { env } from '../config/env.js';
import { generarFirmaIntegridad } from '../lib/wompi/firma.js';
import { aCentavosAPesos, aPesosACentavos } from '../lib/wompi/montos.js';

describe('conversión de montos Wompi', () => {
  it('380000 pesos son 38000000 centavos', () => {
    expect(aPesosACentavos(380000)).toBe(38000000);
  });

  it('convierte centavos de vuelta a pesos', () => {
    expect(aCentavosAPesos(38000000)).toBe(380000);
  });

  it('redondea centavos fraccionarios', () => {
    expect(aCentavosAPesos(38000001)).toBe(380000);
  });
});

describe('generarFirmaIntegridad', () => {
  it('es SHA-256 de referencia + montoEnCentavos + moneda + secreto, en ese orden exacto', () => {
    const referencia = 'INR-000001-1';
    const montoEnCentavos = 38000000;
    const moneda = 'COP';

    const esperado = createHash('sha256')
      .update(`${referencia}${montoEnCentavos}${moneda}${env.WOMPI_SECRETO_INTEGRIDAD}`)
      .digest('hex');

    expect(generarFirmaIntegridad(referencia, montoEnCentavos, moneda)).toBe(esperado);
  });

  it('cambia si cambia cualquiera de los cuatro valores', () => {
    const base = generarFirmaIntegridad('INR-000001-1', 38000000, 'COP');
    expect(generarFirmaIntegridad('INR-000002-1', 38000000, 'COP')).not.toBe(base);
    expect(generarFirmaIntegridad('INR-000001-1', 40000000, 'COP')).not.toBe(base);
  });
});
