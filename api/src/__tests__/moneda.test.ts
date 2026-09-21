import { describe, expect, it } from 'vitest';
import { calcularPrecioDualConTasa } from '../lib/moneda.js';

describe('calcularPrecioDualConTasa', () => {
  it('con precioUsd propio, lo devuelve tal cual (no lo recalcula con la tasa)', () => {
    const resultado = calcularPrecioDualConTasa(150000, 3500, 4100);

    expect(resultado).toEqual({ cop: 150000, usd: 3500 });
  });

  it('sin precioUsd (null), lo calcula con la tasa vigente, en centavos enteros', () => {
    // 380000 COP a una tasa de 4100 COP/USD = 92.68... USD => 9268 centavos.
    const resultado = calcularPrecioDualConTasa(380000, null, 4100);

    expect(resultado).toEqual({ cop: 380000, usd: 9268 });
  });

  it('sin precioUsd (undefined), también lo calcula con la tasa', () => {
    const resultado = calcularPrecioDualConTasa(4100, undefined, 4100);

    expect(resultado).toEqual({ cop: 4100, usd: 100 });
  });

  it('redondea a centavos enteros, nunca deja fracción', () => {
    const resultado = calcularPrecioDualConTasa(100000, null, 3333);

    expect(Number.isInteger(resultado.usd)).toBe(true);
  });
});
