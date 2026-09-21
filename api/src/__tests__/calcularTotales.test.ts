import { describe, expect, it } from 'vitest';
import { calcularTotales } from '../dominio/calcularTotales.js';
import type {
  ConfigTotales,
  CuponParaTotales,
  LineaParaTotales,
} from '../dominio/calcularTotales.js';

function linea(precioUnitario: number, cantidad: number): LineaParaTotales {
  return { precioUnitario, cantidad };
}

// Mismos valores que trae hoy la tabla configuracion (envio.costo,
// descuento.umbral, descuento.porcentaje, descuento.activo).
const CONFIG_ACTIVA: ConfigTotales = {
  envioCosto: 15000,
  descuentoUmbral: 400000,
  descuentoPorcentaje: 10,
  descuentoActivo: true,
};
const CONFIG_INACTIVA: ConfigTotales = { ...CONFIG_ACTIVA, descuentoActivo: false };

describe('calcularTotales', () => {
  it('sin cupón ni umbral alcanzado, cobra el envío completo y no aplica descuento', () => {
    const totales = calcularTotales([linea(100000, 1)], null, CONFIG_ACTIVA);

    expect(totales).toEqual({
      subtotal: 100000,
      descuento: 0,
      envio: 15000,
      total: 115000,
      descuentoAplicado: 'ninguno',
      descuentoDescartado: null,
    });
  });

  it('el envío se cobra siempre, incluso alcanzando el umbral (ya no hay envío gratis por monto)', () => {
    const totales = calcularTotales([linea(400000, 1)], null, CONFIG_ACTIVA);

    expect(totales.envio).toBe(15000);
  });

  it('alcanzando el umbral con descuento.activo=true, aplica el porcentaje automático sobre el subtotal', () => {
    const totales = calcularTotales([linea(400000, 1)], null, CONFIG_ACTIVA);

    expect(totales.subtotal).toBe(400000);
    expect(totales.descuento).toBe(40000); // 10% de 400000
    expect(totales.envio).toBe(15000);
    expect(totales.total).toBe(375000);
    expect(totales.descuentoAplicado).toBe('automatico');
    expect(totales.descuentoDescartado).toBeNull();
  });

  it('con descuento.activo=false, no aplica el descuento automático aunque se alcance el umbral', () => {
    const totales = calcularTotales([linea(400000, 1)], null, CONFIG_INACTIVA);

    expect(totales.descuento).toBe(0);
    expect(totales.descuentoAplicado).toBe('ninguno');
    expect(totales.envio).toBe(15000);
    expect(totales.total).toBe(415000);
  });

  it('aplica el descuento de un cupón de porcentaje cuando no hay descuento automático', () => {
    const cupon: CuponParaTotales = { tipo: 'porcentaje', valor: 10, montoMinimo: 0 };

    const totales = calcularTotales([linea(100000, 2)], cupon, CONFIG_ACTIVA);

    expect(totales.subtotal).toBe(200000);
    expect(totales.descuento).toBe(20000);
    expect(totales.envio).toBe(15000);
    expect(totales.total).toBe(195000);
    expect(totales.descuentoAplicado).toBe('cupon');
    expect(totales.descuentoDescartado).toBeNull();
  });

  it('no aplica el cupón cuando no se alcanza su monto mínimo', () => {
    const cupon: CuponParaTotales = { tipo: 'porcentaje', valor: 20, montoMinimo: 500000 };

    const totales = calcularTotales([linea(100000, 1)], cupon, CONFIG_ACTIVA);

    expect(totales.descuento).toBe(0);
    expect(totales.descuentoAplicado).toBe('ninguno');
    expect(totales.envio).toBe(15000);
    expect(totales.total).toBe(115000);
  });

  it('descuento automático y cupón compitiendo: gana el automático (mayor) y el cupón queda descartado', () => {
    // Subtotal 500000: automático = 10% = 50000. Cupón 5% = 25000 (menor).
    const cupon: CuponParaTotales = { tipo: 'porcentaje', valor: 5, montoMinimo: 0 };

    const totales = calcularTotales([linea(500000, 1)], cupon, CONFIG_ACTIVA);

    expect(totales.descuento).toBe(50000);
    expect(totales.descuentoAplicado).toBe('automatico');
    expect(totales.descuentoDescartado).toEqual({ origen: 'cupon', monto: 25000 });
  });

  it('descuento automático y cupón compitiendo: gana el cupón (mayor) y el automático queda descartado', () => {
    // Subtotal 500000: automático = 10% = 50000. Cupón 30% = 150000 (mayor).
    const cupon: CuponParaTotales = { tipo: 'porcentaje', valor: 30, montoMinimo: 0 };

    const totales = calcularTotales([linea(500000, 1)], cupon, CONFIG_ACTIVA);

    expect(totales.descuento).toBe(150000);
    expect(totales.descuentoAplicado).toBe('cupon');
    expect(totales.descuentoDescartado).toEqual({ origen: 'automatico', monto: 50000 });
  });

  it('un cupón de envío deja el envío en cero aunque no se alcance el umbral, y no compite con el descuento', () => {
    const cupon: CuponParaTotales = { tipo: 'envio', valor: 0, montoMinimo: 0 };

    const totales = calcularTotales([linea(50000, 1)], cupon, CONFIG_ACTIVA);

    expect(totales.descuento).toBe(0);
    expect(totales.descuentoAplicado).toBe('ninguno');
    expect(totales.envio).toBe(0);
    expect(totales.total).toBe(50000);
  });
});
