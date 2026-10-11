import { beforeEach, describe, expect, it, vi } from 'vitest';

const comboFindUniqueMock = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    combo: { findUnique: comboFindUniqueMock },
  },
}));

const { obtenerDetalleKit } = await import('../modulos/admin/combos/servicio.js');

function itemFalso({
  cantidad = 1,
  nombre = 'Extensión lisa',
  estado = 'publicado',
  ...overridesVariante
}: Partial<Record<string, unknown>> & { cantidad?: number; nombre?: string; estado?: string } = {}) {
  return {
    cantidad,
    varianteProducto: {
      id: `var-${nombre}`,
      sku: 'SKU-1',
      precioActual: 50000,
      costoActual: 20000,
      stockActual: 10,
      stockReservado: 0,
      activa: true,
      producto: { nombre, estado },
      valoresAtributo: [],
      ...overridesVariante,
    },
  };
}

function kitFalso(items: ReturnType<typeof itemFalso>[]) {
  return {
    id: 'kit-1',
    nombre: 'Kit dúo',
    slug: 'kit-duo',
    descripcion: null,
    imagenUrl: null,
    precioCop: 90000,
    precioUsd: null,
    vigenteDesde: new Date('2026-01-01'),
    vigenteHasta: null,
    activo: true,
    destacado: false,
    items,
    imagenes: [],
  };
}

describe('obtenerDetalleKit: etiqueta de disponibilidad del encabezado', () => {
  beforeEach(() => {
    comboFindUniqueMock.mockReset();
  });

  it('con todas las piezas en orden, el kit es comprable y no hay problemas', async () => {
    comboFindUniqueMock.mockResolvedValueOnce(
      kitFalso([itemFalso(), itemFalso({ nombre: 'Gorro', estado: 'solo_kits' })]),
    );

    const kit = await obtenerDetalleKit('kit-1');

    expect(kit.comprable).toBe(true);
    expect(kit.problemas).toEqual([]);
  });

  it('una pieza archivada con stock de sobra deja el kit no comprable', async () => {
    comboFindUniqueMock.mockResolvedValueOnce(
      kitFalso([itemFalso({ nombre: 'Peine', estado: 'archivado', stockActual: 50 })]),
    );

    const kit = await obtenerDetalleKit('kit-1');

    expect(kit.comprable).toBe(false);
    expect(kit.problemas).toEqual([{ nombreProducto: 'Peine', motivo: 'Producto archivado' }]);
  });

  it('los motivos coinciden con la columna Estado de cada pieza, y los bloqueos van primero', async () => {
    comboFindUniqueMock.mockResolvedValueOnce(
      kitFalso([
        itemFalso({ nombre: 'Extensión lisa', cantidad: 2, stockActual: 1 }),
        itemFalso({ nombre: 'Gorro', activa: false }),
      ]),
    );

    const kit = await obtenerDetalleKit('kit-1');

    expect(kit.comprable).toBe(false);
    expect(kit.problemas).toEqual([
      { nombreProducto: 'Gorro', motivo: 'Variante desactivada' },
      { nombreProducto: 'Extensión lisa', motivo: 'Sin stock suficiente: el kit lleva 2 y hay 1' },
    ]);
    for (const problema of kit.problemas) {
      const item = kit.items.find((i) => i.nombreProducto === problema.nombreProducto);
      expect(item?.motivo).toBe(problema.motivo);
    }
  });
});
