import { beforeEach, describe, expect, it, vi } from 'vitest';

// Las opciones de filtro del catálogo salen de las variantes que existen,
// no de la lista de valores: un color recién creado, sin productos, no
// aparece como opción que al hacer clic no devuelve nada.

const atributoFindManyMock = vi.fn();
const productoFindManyMock = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    atributo: { findMany: atributoFindManyMock },
    producto: { findMany: productoFindManyMock },
  },
}));

const { listarFacetas } = await import('../modulos/catalogo/servicio.js');

const colores = {
  id: 'a-color',
  slug: 'color',
  valoresAtributo: [
    { id: 'v-negro', valor: 'Negro', hex: '#000000' },
    { id: 'v-rubio', valor: 'Rubio', hex: '#e5c07b' },
    // Recién creado: ninguna variante lo usa.
    { id: 'v-borgona', valor: 'Borgoña', hex: '#5b1a2a' },
  ],
};

// Dos productos: uno en negro y rubio, otro solo en negro.
const productos = [
  {
    variantes: [
      { valoresAtributo: [{ valorId: 'v-negro' }] },
      { valoresAtributo: [{ valorId: 'v-rubio' }] },
    ],
  },
  { variantes: [{ valoresAtributo: [{ valorId: 'v-negro' }] }] },
];

describe('facetas del catálogo: solo valores con variantes', () => {
  beforeEach(() => {
    atributoFindManyMock.mockReset().mockResolvedValue([colores]);
    productoFindManyMock.mockReset().mockResolvedValue(productos);
  });

  it('un color sin variantes no aparece como opción', async () => {
    const facetas = await listarFacetas({});
    expect(facetas.color).toEqual([
      { valor: 'Negro', hex: '#000000', conteo: 2 },
      { valor: 'Rubio', hex: '#e5c07b', conteo: 1 },
    ]);
  });

  it('un color ya elegido se muestra aunque dé 0, para poder sacarlo', async () => {
    const facetas = await listarFacetas({ color: ['Borgoña'] });
    expect(facetas.color.map((c) => c.valor)).toEqual(['Negro', 'Rubio', 'Borgoña']);
    expect(facetas.color.find((c) => c.valor === 'Borgoña')?.conteo).toBe(0);
  });
});
