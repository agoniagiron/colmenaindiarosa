import { describe, expect, it } from 'vitest';
import { conDescripcion, describirItemPedido, resumenItemsPedido } from '../lib/lineaPedido.js';

const columnasVacias = {
  tipoBase: null,
  longitud: null,
  colorNombre: null,
  talla: null,
  densidad: null,
};

describe('describirItemPedido', () => {
  it('usa la copia en jsonb cuando existe, aunque las columnas digan otra cosa', () => {
    expect(
      describirItemPedido({
        nombreProducto: 'HANNAH',
        atributos: [
          { slug: 'color', nombre: 'Color', valor: 'Rosa', hex: '#e8a0b4' },
          { slug: 'textura', nombre: 'Textura', valor: 'Ondulada' },
        ],
        ...columnasVacias,
        colorNombre: 'Otro',
      }),
    ).toBe('HANNAH — Rosa / Ondulada');
  });

  it('un pedido anterior a la copia (atributos NULL) se describe con las cinco columnas', () => {
    expect(
      describirItemPedido({
        nombreProducto: 'HANNAH',
        atributos: null,
        ...columnasVacias,
        colorNombre: 'Rosa',
        longitud: '14',
      }),
    ).toBe('HANNAH — Rosa / 14');
  });

  it('un kit (lista vacía) es solo el nombre', () => {
    expect(
      describirItemPedido({ nombreProducto: 'Kit dúo', atributos: [], ...columnasVacias }),
    ).toBe('Kit dúo');
  });

  it('ignora elementos del jsonb que no tienen la forma esperada', () => {
    expect(
      describirItemPedido({
        nombreProducto: 'HANNAH',
        atributos: [{ slug: 'color', valor: 'Rosa' }, 'basura', null, { valor: 3 }],
        ...columnasVacias,
      }),
    ).toBe('HANNAH — Rosa');
  });

  it('conDescripcion reemplaza el jsonb crudo por el texto', () => {
    const item = conDescripcion({
      id: 'i-1',
      nombreProducto: 'HANNAH',
      atributos: [{ slug: 'color', nombre: 'Color', valor: 'Rosa' }],
      ...columnasVacias,
    });
    expect(item).not.toHaveProperty('atributos');
    expect(item.descripcion).toBe('HANNAH — Rosa');
  });
});

describe('resumenItemsPedido', () => {
  it('"HANNAH y 1 más" con la foto del ítem de mayor subtotal', () => {
    expect(
      resumenItemsPedido([
        { nombreProducto: 'Gorro de satín', imagenUrl: 'gorro.webp', subtotal: 30000 },
        { nombreProducto: 'HANNAH', imagenUrl: 'hannah.webp', subtotal: 990000 },
      ]),
    ).toEqual({ texto: 'HANNAH y 1 más', imagenUrl: 'hannah.webp' });
  });

  it('un solo ítem, solo el nombre', () => {
    expect(
      resumenItemsPedido([{ nombreProducto: 'HANNAH', imagenUrl: null, subtotal: 1 }]),
    ).toEqual({ texto: 'HANNAH', imagenUrl: null });
  });
});
