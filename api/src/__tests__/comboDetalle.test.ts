import { beforeEach, describe, expect, it, vi } from 'vitest';

const comboFindFirstMock = vi.fn();

const FILAS_CONFIGURACION = [
  { clave: 'moneda.tasa_usd', valor: '4100', tipo: 'entero', grupo: 'moneda', etiqueta: '' },
];

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    combo: { findFirst: comboFindFirstMock },
    configuracion: { findMany: vi.fn().mockResolvedValue(FILAS_CONFIGURACION) },
  },
}));

const { diagnosticarPieza, obtenerComboPorSlug } = await import('../modulos/combos/servicio.js');

function piezaFalsa({
  cantidad = 1,
  ...overridesVariante
}: Partial<Record<string, unknown>> & { cantidad?: number } = {}) {
  return {
    cantidad,
    varianteProducto: {
      id: 'var-1',
      sku: 'SKU-1',
      precioActual: 50000,
      precioUsd: null,
      stockActual: 10,
      stockReservado: 0,
      activa: true,
      producto: {
        nombre: 'Extensión lisa',
        slug: 'extension-lisa',
        estado: 'publicado',
        imagenes: [{ url: 'https://ejemplo.com/extension.webp', altTexto: 'Extensión lisa' }],
      },
      ...overridesVariante,
    },
  };
}

function comboFalso(items: ReturnType<typeof piezaFalsa>[]) {
  return {
    id: 'combo-1',
    nombre: 'Kit dúo',
    slug: 'kit-duo',
    descripcion: 'Dos piezas a buen precio',
    precioCop: 90000,
    precioUsd: null,
    imagenes: [{ url: 'https://ejemplo.com/kit.webp', altTexto: 'Kit dúo' }],
    items,
  };
}
describe('obtenerComboPorSlug', () => {
  beforeEach(() => {
    comboFindFirstMock.mockReset();
  });

  it('con un kit inactivo o fuera de vigencia (findFirst no lo trae), rechaza con 404', async () => {
    comboFindFirstMock.mockResolvedValueOnce(null);

    await expect(obtenerComboPorSlug('kit-que-no-existe')).rejects.toMatchObject({
      estadoHttp: 404,
      codigo: 'no_encontrado',
    });
  });

  it('con todas las piezas publicadas, activas y con stock, el kit es comprable', async () => {
    comboFindFirstMock.mockResolvedValueOnce(comboFalso([piezaFalsa()]));

    const combo = await obtenerComboPorSlug('kit-duo');

    expect(combo.comprable).toBe(true);
    expect(combo.piezas[0]!.productoSlug).toBe('extension-lisa');
  });

  it('una pieza en solo_kits no bloquea la compra y no enlaza a su ficha', async () => {
    comboFindFirstMock.mockResolvedValueOnce(
      comboFalso([piezaFalsa({ producto: { nombre: 'Pieza exclusiva', slug: 'pieza-exclusiva', estado: 'solo_kits', imagenes: [] } })]),
    );

    const combo = await obtenerComboPorSlug('kit-duo');

    expect(combo.comprable).toBe(true);
    expect(combo.piezas[0]!.productoSlug).toBeNull();
  });

  it('una pieza archivada bloquea la compra y no enlaza', async () => {
    comboFindFirstMock.mockResolvedValueOnce(
      comboFalso([piezaFalsa({ producto: { nombre: 'Pieza vieja', slug: 'pieza-vieja', estado: 'archivado', imagenes: [] } })]),
    );

    const combo = await obtenerComboPorSlug('kit-duo');

    expect(combo.comprable).toBe(false);
    expect(combo.piezas[0]!.productoSlug).toBeNull();
  });

  it('una variante inactiva bloquea la compra aunque el producto esté publicado', async () => {
    comboFindFirstMock.mockResolvedValueOnce(comboFalso([piezaFalsa({ activa: false })]));

    const combo = await obtenerComboPorSlug('kit-duo');

    expect(combo.comprable).toBe(false);
  });

  it('sin stock suficiente el kit no es comprable, pero la pieza publicada sigue enlazando', async () => {
    comboFindFirstMock.mockResolvedValueOnce(
      comboFalso([piezaFalsa({ cantidad: 2, stockActual: 1, stockReservado: 0 })]),
    );

    const combo = await obtenerComboPorSlug('kit-duo');

    expect(combo.disponible).toBe(false);
    expect(combo.comprable).toBe(false);
    expect(combo.piezas[0]!.productoSlug).toBe('extension-lisa');
  });

  it('la respuesta pública nunca trae motivos, estados ni cantidades de stock', async () => {
    comboFindFirstMock.mockResolvedValueOnce(
      comboFalso([
        piezaFalsa({ producto: { nombre: 'Peine', slug: 'peine', estado: 'archivado', imagenes: [] } }),
        piezaFalsa({ id: 'var-2', cantidad: 2, stockActual: 1, stockReservado: 0 }),
      ]),
    );

    const combo = await obtenerComboPorSlug('kit-duo');
    const json = JSON.stringify(combo);

    expect(combo).not.toHaveProperty('motivoNoComprable');
    for (const pieza of combo.piezas) {
      expect(pieza).not.toHaveProperty('motivo');
      expect(pieza).not.toHaveProperty('bloqueaCompra');
    }
    expect(json).not.toMatch(/archivad|borrador|stock/i);
  });
});

// piezaFalsa arma overrides sueltos (estado como string, no como el enum
// de Prisma): el cast queda acá, en un solo lugar, y no en cada prueba.
function diagnosticar(pieza: ReturnType<typeof piezaFalsa>) {
  return diagnosticarPieza(pieza as unknown as Parameters<typeof diagnosticarPieza>[0]);
}

describe('diagnosticarPieza (desglose del panel)', () => {
  it('pieza publicada, activa y con stock: en orden', () => {
    expect(diagnosticar(piezaFalsa())).toEqual({ bloqueaCompra: false, motivo: null });
  });

  it('solo_kits no bloquea ni tiene motivo', () => {
    const pieza = piezaFalsa({ producto: { nombre: 'X', slug: 'x', estado: 'solo_kits', imagenes: [] } });
    expect(diagnosticar(pieza)).toEqual({ bloqueaCompra: false, motivo: null });
  });

  it('archivado, borrador y variante desactivada bloquean, cada uno con su motivo', () => {
    const archivada = piezaFalsa({ producto: { nombre: 'X', slug: 'x', estado: 'archivado', imagenes: [] } });
    const borrador = piezaFalsa({ producto: { nombre: 'X', slug: 'x', estado: 'borrador', imagenes: [] } });
    const inactiva = piezaFalsa({ activa: false });

    expect(diagnosticar(archivada)).toEqual({ bloqueaCompra: true, motivo: 'Producto archivado' });
    expect(diagnosticar(borrador)).toEqual({
      bloqueaCompra: true,
      motivo: 'Producto en borrador, sin publicar',
    });
    expect(diagnosticar(inactiva)).toEqual({ bloqueaCompra: true, motivo: 'Variante desactivada' });
  });

  it('sin stock suficiente no bloquea pero da el motivo con cantidades, descontando lo reservado', () => {
    const pieza = piezaFalsa({ cantidad: 2, stockActual: 3, stockReservado: 2 });
    expect(diagnosticar(pieza)).toEqual({
      bloqueaCompra: false,
      motivo: 'Sin stock suficiente: el kit lleva 2 y hay 1',
    });
  });

  it('con bloqueo y falta de stock a la vez, el motivo es solo el bloqueo', () => {
    const pieza = piezaFalsa({
      cantidad: 2,
      stockActual: 0,
      stockReservado: 0,
      producto: { nombre: 'X', slug: 'x', estado: 'archivado', imagenes: [] },
    });
    expect(diagnosticar(pieza)).toEqual({ bloqueaCompra: true, motivo: 'Producto archivado' });
  });
});
