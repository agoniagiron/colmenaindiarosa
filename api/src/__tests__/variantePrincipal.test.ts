import { describe, expect, it } from 'vitest';
import { resolverVarianteMostrada } from '../modulos/catalogo/variantePrincipal.js';

const v26 = { id: 'v26', precio: 990000, disponible: 3 };
const v28 = { id: 'v28', precio: 1050000, disponible: 2 };

describe('resolverVarianteMostrada: la variante principal manda', () => {
  it('con la principal en la más barata: su precio, con "desde"', () => {
    expect(resolverVarianteMostrada([v28, v26], 'v26')).toEqual({
      varianteId: 'v26',
      precio: 990000,
      desde: true,
      origen: 'principal',
    });
  });

  it('con la principal en una más cara: su precio, sin "desde" (no es el mínimo)', () => {
    expect(resolverVarianteMostrada([v26, v28], 'v28')).toEqual({
      varianteId: 'v28',
      precio: 1050000,
      desde: false,
      origen: 'principal',
    });
  });

  it('con un solo precio no hay "desde"', () => {
    const otra26 = { id: 'otra', precio: 990000, disponible: 1 };
    expect(resolverVarianteMostrada([v26, otra26], 'v26').desde).toBe(false);
  });

  it('si la principal está agotada, muestra la más barata con stock', () => {
    const agotada = { ...v26, disponible: 0 };
    const v30 = { id: 'v30', precio: 1100000, disponible: 1 };
    expect(resolverVarianteMostrada([agotada, v28, v30], 'v26')).toEqual({
      varianteId: 'v28',
      precio: 1050000,
      desde: true,
      origen: 'principal_sin_stock',
    });
  });

  it('una principal inactiva no llega en la lista: cae al reemplazo igual que una agotada', () => {
    expect(resolverVarianteMostrada([v28], 'v26')).toMatchObject({
      varianteId: 'v28',
      origen: 'principal_sin_stock',
    });
  });

  it('sin principal (productos anteriores a la columna): la más barata con stock', () => {
    const barataAgotada = { id: 'v20', precio: 800000, disponible: 0 };
    expect(resolverVarianteMostrada([barataAgotada, v28, v26], null)).toEqual({
      varianteId: 'v26',
      precio: 990000,
      desde: true,
      origen: 'sin_principal',
    });
  });

  it('todo agotado: se queda en la principal, o en la más barata si no hay principal', () => {
    const a = { ...v26, disponible: 0 };
    const b = { ...v28, disponible: 0 };
    expect(resolverVarianteMostrada([a, b], 'v28').varianteId).toBe('v28');
    expect(resolverVarianteMostrada([a, b], null).varianteId).toBe('v26');
  });

  it('sin variantes activas no hay nada que mostrar', () => {
    expect(resolverVarianteMostrada([], 'v26')).toEqual({
      varianteId: null,
      precio: 0,
      desde: false,
      origen: 'principal_sin_stock',
    });
  });
});
