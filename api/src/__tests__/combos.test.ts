import { beforeEach, describe, expect, it, vi } from 'vitest';

const comboFindManyMock = vi.fn();

const FILAS_CONFIGURACION = [
  { clave: 'moneda.tasa_usd', valor: '4100', tipo: 'entero', grupo: 'moneda', etiqueta: '' },
];

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    combo: { findMany: comboFindManyMock },
    configuracion: { findMany: vi.fn().mockResolvedValue(FILAS_CONFIGURACION) },
  },
}));

const { listarCombosVigentes } = await import('../modulos/combos/servicio.js');

function itemCombo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    cantidad: 2,
    varianteProducto: {
      id: 'var-1',
      sku: 'SKU-1',
      precioActual: 50000,
      precioUsd: null,
      stockActual: 10,
      stockReservado: 0,
      producto: { nombre: 'Extensión lisa' },
      ...overrides,
    },
  };
}

function comboFalso(items: ReturnType<typeof itemCombo>[]) {
  return {
    id: 'combo-1',
    nombre: 'Combo dúo',
    slug: 'combo-duo',
    descripcion: 'Dos piezas a buen precio',
    precioCop: 90000,
    precioUsd: null,
    imagenUrl: null,
    items,
  };
}

describe('listarCombosVigentes', () => {
  beforeEach(() => {
    comboFindManyMock.mockReset();
  });

  it('devuelve arreglo vacío si no hay ningún combo vigente', async () => {
    comboFindManyMock.mockResolvedValueOnce([]);

    const resultado = await listarCombosVigentes();

    expect(resultado).toEqual([]);
  });

  it('disponible es true cuando todas las piezas tienen stock suficiente para la cantidad pedida', async () => {
    comboFindManyMock.mockResolvedValueOnce([
      comboFalso([
        itemCombo({ stockActual: 10, stockReservado: 0 }), // pide 2, hay 10 libres
      ]),
    ]);

    const [combo] = await listarCombosVigentes();

    expect(combo!.disponible).toBe(true);
  });

  it('disponible es false cuando UNA sola pieza no alcanza el stock, aunque las demás sí', async () => {
    comboFindManyMock.mockResolvedValueOnce([
      comboFalso([
        itemCombo({ stockActual: 10, stockReservado: 0 }), // esta sí alcanza
        itemCombo({ stockActual: 3, stockReservado: 2 }), // libres: 1, pide 2 => no alcanza
      ]),
    ]);

    const [combo] = await listarCombosVigentes();

    expect(combo!.disponible).toBe(false);
  });

  it('descuenta el stock reservado al calcular el stock libre de cada pieza', async () => {
    comboFindManyMock.mockResolvedValueOnce([
      comboFalso([itemCombo({ cantidad: 2, stockActual: 2, stockReservado: 0 })]), // libres: 2, pide 2, justo alcanza
    ]);

    const [combo] = await listarCombosVigentes();

    expect(combo!.disponible).toBe(true);
  });
});
