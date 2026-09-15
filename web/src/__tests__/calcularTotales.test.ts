import { describe, expect, it } from 'vitest';
import { calcularTotales } from '../dominio/calcularTotales.ts';
import type { Cupon, LineaCarrito } from '../tipos/index.ts';

function linea(precioUnitario: number, cantidad: number): LineaCarrito {
  return {
    varianteId: 'var-1',
    productoId: 'prod-1',
    nombreProducto: 'Producto de prueba',
    precioUnitario,
    cantidad,
  };
}

describe('calcularTotales', () => {
  it('sin cupón cobra el envío completo cuando no se alcanza el umbral', () => {
    const totales = calcularTotales([linea(100000, 1)]);

    expect(totales).toEqual({ subtotal: 100000, descuento: 0, envio: 15000, total: 115000 });
  });

  it('aplica el descuento de un cupón de porcentaje', () => {
    const cupon: Cupon = { codigo: 'INDIAROSA10', tipo: 'porcentaje', valor: 10, montoMinimo: 0 };

    const totales = calcularTotales([linea(100000, 2)], cupon);

    expect(totales.subtotal).toBe(200000);
    expect(totales.descuento).toBe(20000);
    expect(totales.envio).toBe(15000);
    expect(totales.total).toBe(195000);
  });

  it('no aplica el cupón cuando no se alcanza el monto mínimo', () => {
    const cupon: Cupon = { codigo: 'ROSA20', tipo: 'porcentaje', valor: 20, montoMinimo: 500000 };

    const totales = calcularTotales([linea(100000, 1)], cupon);

    expect(totales.descuento).toBe(0);
    expect(totales.envio).toBe(15000);
    expect(totales.total).toBe(115000);
  });

  it('el envío es gratis cuando el subtotal menos el descuento alcanza el umbral', () => {
    const totales = calcularTotales([linea(400000, 1)]);

    expect(totales.envio).toBe(0);
    expect(totales.total).toBe(400000);
  });

  it('un cupón de envío deja el envío en cero aunque no se alcance el umbral', () => {
    const cupon: Cupon = { codigo: 'ENVIOGRATIS', tipo: 'envio', valor: 0, montoMinimo: 0 };

    const totales = calcularTotales([linea(50000, 1)], cupon);

    expect(totales.descuento).toBe(0);
    expect(totales.envio).toBe(0);
    expect(totales.total).toBe(50000);
  });
});
