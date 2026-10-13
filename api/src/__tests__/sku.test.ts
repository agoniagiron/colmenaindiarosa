import { describe, expect, it } from 'vitest';
import {
  armarCodigoProducto,
  armarSkuVariante,
  esCodigoModeloValido,
  normalizarCodigoModelo,
} from '../modulos/admin/productos/sku.js';

describe('sku: código de producto y SKU de variante', () => {
  it('el código de producto es IR-{categoría}-{modelo}', () => {
    expect(armarCodigoProducto('PEL', 'VAL')).toBe('IR-PEL-VAL');
  });

  it('la variante agrega largo y color al código de producto', () => {
    expect(armarSkuVariante('IR-PEL-VAL', '24', 'NEG')).toBe('IR-PEL-VAL-24-NEG');
  });

  it('sin largo ni color, el SKU es el código de producto', () => {
    expect(armarSkuVariante('IR-CUI-CREMA300', null, null)).toBe('IR-CUI-CREMA300');
  });

  it('con uno solo de los dos, agrega solo ese', () => {
    expect(armarSkuVariante('IR-EXT-SED', '18', null)).toBe('IR-EXT-SED-18');
    expect(armarSkuVariante('IR-ACC-GOR', null, 'NEG')).toBe('IR-ACC-GOR-NEG');
  });

  it('el código de modelo se normaliza a mayúsculas y no admite guiones ni espacios', () => {
    expect(normalizarCodigoModelo('  val ')).toBe('VAL');
    expect(esCodigoModeloValido('CREMA300')).toBe(true);
    expect(esCodigoModeloValido('IR-PEL-VAL')).toBe(false);
    expect(esCodigoModeloValido('VA L')).toBe(false);
    expect(esCodigoModeloValido('V')).toBe(false);
  });
});
