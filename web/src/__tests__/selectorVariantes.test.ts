import { describe, expect, it } from 'vitest';
import { elegirAlCambiar, estadoOpcion } from '../paginas/selectorVariantes.ts';
import type { VarianteProducto } from '../tipos/index.ts';

function variante(
  sku: string,
  atributos: { longitud?: string; color?: string; densidad?: string },
  stock = 5,
): VarianteProducto {
  const precio = { cop: 1, usd: 0 };
  return {
    id: sku,
    sku,
    precioOriginal: precio,
    precioConDescuento: precio,
    stockActual: stock,
    stockReservado: 0,
    longitud: atributos.longitud,
    densidad: atributos.densidad,
    ...(atributos.color ? { color: { nombre: atributos.color, hex: '#000' } } : {}),
  } as VarianteProducto;
}

// Grilla incompleta, como las extensiones del seed: Media solo en Negro,
// Larga solo en Castaño y Chocolate.
const mediaNegro = variante('MED-NEG', { longitud: 'Media', color: 'Negro' });
const largaCastano = variante('LAR-CAS', { longitud: 'Larga', color: 'Castaño' });
const largaChocolate = variante('LAR-CHO', { longitud: 'Larga', color: 'Chocolate' });
const extensiones = [mediaNegro, largaCastano, largaChocolate];

describe('selector de variantes jerárquico', () => {
  it('un color que no viene en el largo elegido se ve deshabilitado', () => {
    expect(estadoOpcion(extensiones, 'color', 'Negro', mediaNegro)).toBe('disponible');
    expect(estadoOpcion(extensiones, 'color', 'Castaño', mediaNegro)).toBe('no_existe');
    expect(estadoOpcion(extensiones, 'color', 'Chocolate', mediaNegro)).toBe('no_existe');
  });

  it('el primer grupo no depende de los de abajo: nunca se traba', () => {
    // Estando en Media + Negro, "Larga" sigue disponible aunque no exista en Negro.
    expect(estadoOpcion(extensiones, 'longitud', 'Larga', mediaNegro)).toBe('disponible');
  });

  it('al cambiar el largo, si el color no viene en ese largo cambia y lo avisa', () => {
    expect(elegirAlCambiar(extensiones, 'longitud', 'Larga', mediaNegro)).toEqual({
      variante: largaCastano,
      ajustes: [{ clave: 'color', antes: 'Negro', despues: 'Castaño' }],
    });
  });

  it('si el color sí viene en el nuevo largo, se conserva y no hay aviso', () => {
    const largaNegro = variante('LAR-NEG', { longitud: 'Larga', color: 'Negro' });
    expect(elegirAlCambiar([...extensiones, largaNegro], 'longitud', 'Larga', mediaNegro)).toEqual({
      variante: largaNegro,
      ajustes: [],
    });
  });

  it('una combinación que existe pero sin stock se ve agotada, no inexistente', () => {
    const agotada = variante('LAR-MIE', { longitud: 'Larga', color: 'Miel' }, 0);
    expect(estadoOpcion([...extensiones, agotada], 'color', 'Miel', largaCastano)).toBe('agotada');
  });

  it('al cambiar, prefiere una variante con stock antes que conservar un valor agotado', () => {
    const negroAgotado = variante('LAR-NEG', { longitud: 'Larga', color: 'Negro' }, 0);
    const { variante: elegida } = elegirAlCambiar(
      [...extensiones, negroAgotado],
      'longitud',
      'Larga',
      mediaNegro,
    );
    expect(elegida.sku).toBe('LAR-CAS');
  });

  it('con atributos atados (color ↔ densidad, como la Valentina) no se traba al cambiar de color', () => {
    const negro130 = variante('NEG-130', { longitud: 'Larga', color: 'Negro', densidad: '130%' });
    const castano150 = variante('CAS-150', {
      longitud: 'Larga',
      color: 'Castaño',
      densidad: '150%',
    });
    const valentina = [negro130, castano150];

    expect(estadoOpcion(valentina, 'color', 'Castaño', negro130)).toBe('disponible');
    expect(estadoOpcion(valentina, 'densidad', '150%', negro130)).toBe('no_existe');
    expect(elegirAlCambiar(valentina, 'color', 'Castaño', negro130)).toEqual({
      variante: castano150,
      ajustes: [{ clave: 'densidad', antes: '130%', despues: '150%' }],
    });
  });
});
