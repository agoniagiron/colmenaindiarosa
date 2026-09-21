import { describe, expect, it } from 'vitest';
import { aplicarPromocionAPrecio, obtenerMejorPromocionDePrecio } from '../lib/promociones.js';
import type { PromocionVigente } from '../lib/promociones.js';

function promocionFalsa(overrides: Partial<PromocionVigente> = {}): PromocionVigente {
  return {
    id: 'promo-1',
    nombre: 'Promo de prueba',
    tipo: 'descuentoPorcentaje',
    valor: 20,
    alcance: 'global',
    prioridad: 0,
    bannerTitulo: null,
    bannerTexto: null,
    bannerImagenUrl: null,
    bannerColorFondo: null,
    objetivos: [],
    ...overrides,
  };
}

const CONTEXTO = { varianteId: 'var-1', productoId: 'prod-1', categoriaId: 'cat-pelucas' };

describe('promociones: alcance por categoría', () => {
  it('aplica una promoción de categoría cuando la variante pertenece a esa categoría', () => {
    const promoCategoria = promocionFalsa({
      alcance: 'categoria',
      tipo: 'descuentoPorcentaje',
      valor: 15,
      objetivos: [{ categoriaId: 'cat-pelucas', productoId: null, varianteId: null }],
    });

    const mejor = obtenerMejorPromocionDePrecio([promoCategoria], CONTEXTO);

    expect(mejor).toBe(promoCategoria);
    expect(aplicarPromocionAPrecio(100000, mejor!)).toBe(85000);
  });

  it('no aplica una promoción de categoría cuando la variante es de otra categoría', () => {
    const promoOtraCategoria = promocionFalsa({
      alcance: 'categoria',
      objetivos: [{ categoriaId: 'cat-extensiones', productoId: null, varianteId: null }],
    });

    const mejor = obtenerMejorPromocionDePrecio([promoOtraCategoria], CONTEXTO);

    expect(mejor).toBeNull();
  });

  it('cuando hay varias promociones vigentes, elige la de mayor prioridad entre las que aplican', () => {
    // Simula el orden que ya trae listarPromocionesVigentes (prioridad desc).
    const promoAlta = promocionFalsa({
      id: 'promo-alta',
      prioridad: 10,
      alcance: 'categoria',
      tipo: 'descuentoMonto',
      valor: 5000,
      objetivos: [{ categoriaId: 'cat-pelucas', productoId: null, varianteId: null }],
    });
    const promoBaja = promocionFalsa({
      id: 'promo-baja',
      prioridad: 1,
      alcance: 'global',
      tipo: 'descuentoPorcentaje',
      valor: 50,
    });

    const mejor = obtenerMejorPromocionDePrecio([promoAlta, promoBaja], CONTEXTO);

    expect(mejor?.id).toBe('promo-alta');
    expect(aplicarPromocionAPrecio(100000, mejor!)).toBe(95000);
  });

  it('un anuncio (no afecta precio) no debe elegirse como la mejor promoción de precio', () => {
    const anuncio = promocionFalsa({
      tipo: 'anuncio',
      alcance: 'categoria',
      objetivos: [{ categoriaId: 'cat-pelucas', productoId: null, varianteId: null }],
    });

    const mejor = obtenerMejorPromocionDePrecio([anuncio], CONTEXTO);

    expect(mejor).toBeNull();
  });
});
