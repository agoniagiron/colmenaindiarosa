import { describe, expect, it } from 'vitest';
import { extraerAtributosVariante } from '../lib/atributosVariante.js';

const color = (valor: string, hex: string | null, hexSecundario: string | null) => ({
  valorAtributo: { valor, hex, hexSecundario, atributo: { slug: 'color' } },
});

describe('extraerAtributosVariante: color', () => {
  it('un color combinado llega con sus dos tonos', () => {
    expect(extraerAtributosVariante([color('Caramelo rubio', '#8a5a34', '#d9b98a')]).color).toEqual(
      { nombre: 'Caramelo rubio', hex: '#8a5a34', hexSecundario: '#d9b98a' },
    );
  });

  it('un color sólido no trae hexSecundario', () => {
    expect(extraerAtributosVariante([color('Negro', '#111111', null)]).color).toEqual({
      nombre: 'Negro',
      hex: '#111111',
    });
  });

  it('sin primario no hay esfera: el secundario solo no se manda', () => {
    expect(extraerAtributosVariante([color('Raro', null, '#d9b98a')]).color).toEqual({
      nombre: 'Raro',
    });
  });
});
