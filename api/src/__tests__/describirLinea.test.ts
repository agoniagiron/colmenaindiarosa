import { describe, expect, it } from 'vitest';
import {
  atributosDeColumnas,
  describirAtributos,
  describirLinea,
} from '../dominio/describirLinea.js';

describe('describirLinea', () => {
  it('arma "NOMBRE — color / longitud / tipo de base / talla / densidad"', () => {
    // Llegan en el orden de la categoría Pelucas (tipo_base primero).
    const atributos = [
      { slug: 'tipo_base', valor: 'Lace frontal 13x4' },
      { slug: 'longitud', valor: '14' },
      { slug: 'color', valor: 'Rosa' },
      { slug: 'talla', valor: 'Mediana' },
      { slug: 'densidad', valor: '210' },
    ];
    expect(describirLinea('HANNAH', atributos)).toBe(
      'HANNAH — Rosa / 14 / Lace frontal 13x4 / Mediana / 210',
    );
  });

  it('una extensión con solo color y longitud', () => {
    expect(
      describirLinea('Extensión lisa', [
        { slug: 'longitud', valor: '22"' },
        { slug: 'color', valor: 'Negro' },
      ]),
    ).toBe('Extensión lisa — Negro / 22"');
  });

  it('sin atributos es solo el nombre', () => {
    expect(describirLinea('Shampoo', [])).toBe('Shampoo');
  });

  it('un atributo que no está en la lista va al final, en el orden en que llegó', () => {
    expect(
      describirAtributos([
        { slug: 'textura', valor: 'Ondulada' },
        { slug: 'color', valor: 'Rosa' },
        { slug: 'acabado', valor: 'Mate' },
      ]),
    ).toBe('Rosa / Ondulada / Mate');
  });

  it('ignora valores vacíos', () => {
    expect(describirAtributos([{ slug: 'color', valor: '  ' }])).toBe('');
  });

  it('las cinco columnas de pedido_item dan el mismo texto', () => {
    expect(
      describirLinea(
        'HANNAH',
        atributosDeColumnas({
          tipoBase: 'Lace frontal 13x4',
          longitud: '14',
          colorNombre: 'Rosa',
          talla: 'Mediana',
          densidad: '210',
        }),
      ),
    ).toBe('HANNAH — Rosa / 14 / Lace frontal 13x4 / Mediana / 210');
  });
});
