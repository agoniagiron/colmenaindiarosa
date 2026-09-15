import { describe, expect, it } from 'vitest';
import { calcularTotales } from '../dominio/calcularTotales.ts';
import { construirMensajeWhatsapp } from '../dominio/construirMensajeWhatsapp.ts';
import { formatearPesos } from '../utilidades/formatearPesos.ts';
import type { Cupon, LineaCarrito } from '../tipos/index.ts';

function linea(overrides: Partial<LineaCarrito> = {}): LineaCarrito {
  return {
    varianteId: 'var-1',
    productoId: 'prod-1',
    nombreProducto: 'Peluca de prueba',
    tipoBase: 'Lace front',
    longitud: 'Larga',
    color: { nombre: 'Negro natural', hex: '#1c1412' },
    talla: 'Mediana',
    densidad: '130%',
    precioUnitario: 100000,
    cantidad: 2,
    ...overrides,
  };
}

describe('construirMensajeWhatsapp', () => {
  it('incluye la línea de descuento cuando hay cupón', () => {
    const lineas = [linea({ precioUnitario: 100000, cantidad: 2 })];
    const cupon: Cupon = { codigo: 'INDIAROSA10', tipo: 'porcentaje', valor: 10, montoMinimo: 0 };
    const totales = calcularTotales(lineas, cupon);

    const mensaje = construirMensajeWhatsapp({
      numeroPedido: 'INR-000001',
      lineas,
      cupon,
      totales,
    });

    expect(mensaje).toContain(`Descuento (INDIAROSA10): -${formatearPesos(totales.descuento)}`);
  });

  it('omite la línea de descuento cuando no hay cupón', () => {
    const lineas = [linea()];
    const totales = calcularTotales(lineas, null);

    const mensaje = construirMensajeWhatsapp({ numeroPedido: 'INR-000002', lineas, totales });

    expect(mensaje).not.toContain('Descuento');
  });

  it('incluye la línea de especificaciones cuando la variante tiene atributos', () => {
    const lineas = [linea()];
    const totales = calcularTotales(lineas, null);

    const mensaje = construirMensajeWhatsapp({ numeroPedido: 'INR-000003', lineas, totales });

    expect(mensaje).toContain('Lace front · Larga · Negro natural · Talla Mediana · 130%');
  });

  it('omite la línea de especificaciones cuando la variante no tiene atributos', () => {
    const lineas = [
      linea({
        tipoBase: undefined,
        longitud: undefined,
        color: undefined,
        talla: undefined,
        densidad: undefined,
        nombreProducto: 'Shampoo de prueba',
      }),
    ];
    const totales = calcularTotales(lineas, null);

    const mensaje = construirMensajeWhatsapp({ numeroPedido: 'INR-000004', lineas, totales });

    const lineasMensaje = mensaje.split('\n');
    const indiceItem = lineasMensaje.findIndex((linea) => linea.startsWith('1. Shampoo de prueba'));
    expect(indiceItem).toBeGreaterThanOrEqual(0);
    // La línea siguiente al nombre del producto debe ser cantidad x precio,
    // no una especificación (que no existe para este producto).
    expect(lineasMensaje[indiceItem + 1]?.trim()).toMatch(/^\d+ x/);
  });

  it('el total del mensaje coincide con el total calculado por calcularTotales', () => {
    const lineas = [linea({ precioUnitario: 250000, cantidad: 3 })];
    const totales = calcularTotales(lineas, null);

    const mensaje = construirMensajeWhatsapp({ numeroPedido: 'INR-000005', lineas, totales });

    expect(mensaje).toContain(`*Total a pagar: ${formatearPesos(totales.total)}*`);
  });
});
