import { describe, expect, it } from 'vitest';
import { elegirAlCambiar, estadoOpcion, ordenDeGrupos } from '../paginas/selectorVariantes.ts';
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

// Orden de pelucas (el de siempre): la longitud va antes que el color.
const PELUCAS = ordenDeGrupos(['tipo_base', 'longitud', 'color', 'talla', 'densidad']);
// Orden de extensiones: primero el color, después el largo.
const EXTENSIONES = ordenDeGrupos(['color', 'longitud']);

describe('selector de variantes jerárquico', () => {
  it('un color que no viene en el largo elegido se ve deshabilitado', () => {
    expect(estadoOpcion(extensiones, 'color', 'Negro', mediaNegro, PELUCAS)).toBe('disponible');
    expect(estadoOpcion(extensiones, 'color', 'Castaño', mediaNegro, PELUCAS)).toBe('no_existe');
    expect(estadoOpcion(extensiones, 'color', 'Chocolate', mediaNegro, PELUCAS)).toBe('no_existe');
  });

  it('el primer grupo no depende de los de abajo: nunca se traba', () => {
    // Estando en Media + Negro, "Larga" sigue disponible aunque no exista en Negro.
    expect(estadoOpcion(extensiones, 'longitud', 'Larga', mediaNegro, PELUCAS)).toBe('disponible');
  });

  it('al cambiar el largo, si el color no viene en ese largo cambia y lo avisa', () => {
    expect(elegirAlCambiar(extensiones, 'longitud', 'Larga', mediaNegro, PELUCAS)).toEqual({
      variante: largaCastano,
      ajustes: [{ clave: 'color', antes: 'Negro', despues: 'Castaño' }],
    });
  });

  it('si el color sí viene en el nuevo largo, se conserva y no hay aviso', () => {
    const largaNegro = variante('LAR-NEG', { longitud: 'Larga', color: 'Negro' });
    expect(
      elegirAlCambiar([...extensiones, largaNegro], 'longitud', 'Larga', mediaNegro, PELUCAS),
    ).toEqual({
      variante: largaNegro,
      ajustes: [],
    });
  });

  it('una combinación que existe pero sin stock se ve agotada, no inexistente', () => {
    const agotada = variante('LAR-MIE', { longitud: 'Larga', color: 'Miel' }, 0);
    expect(estadoOpcion([...extensiones, agotada], 'color', 'Miel', largaCastano, PELUCAS)).toBe(
      'agotada',
    );
  });

  it('al cambiar, prefiere una variante con stock antes que conservar un valor agotado', () => {
    const negroAgotado = variante('LAR-NEG', { longitud: 'Larga', color: 'Negro' }, 0);
    const { variante: elegida } = elegirAlCambiar(
      [...extensiones, negroAgotado],
      'longitud',
      'Larga',
      mediaNegro,
      PELUCAS,
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

    expect(estadoOpcion(valentina, 'color', 'Castaño', negro130, PELUCAS)).toBe('disponible');
    expect(estadoOpcion(valentina, 'densidad', '150%', negro130, PELUCAS)).toBe('no_existe');
    expect(elegirAlCambiar(valentina, 'color', 'Castaño', negro130, PELUCAS)).toEqual({
      variante: castano150,
      ajustes: [{ clave: 'densidad', antes: '130%', despues: '150%' }],
    });
  });

  it('el orden sale de la categoría, y lo que no usa la categoría queda al final', () => {
    expect(EXTENSIONES).toEqual(['color', 'longitud', 'tipoBase', 'talla', 'densidad']);
    expect(ordenDeGrupos(undefined)).toEqual([
      'tipoBase',
      'longitud',
      'color',
      'talla',
      'densidad',
    ]);
  });

  it('con el orden de extensiones la jerarquía se invierte: el color manda y el largo se deshabilita', () => {
    // Color arriba: todos los colores elegibles, sin importar el largo actual.
    expect(estadoOpcion(extensiones, 'color', 'Castaño', mediaNegro, EXTENSIONES)).toBe(
      'disponible',
    );
    // Largo abajo: con Negro elegido, Larga no existe.
    expect(estadoOpcion(extensiones, 'longitud', 'Larga', mediaNegro, EXTENSIONES)).toBe(
      'no_existe',
    );
    expect(estadoOpcion(extensiones, 'longitud', 'Media', mediaNegro, EXTENSIONES)).toBe(
      'disponible',
    );
  });

  it('con el orden de extensiones, al cambiar de color se acomoda el largo y se avisa', () => {
    expect(elegirAlCambiar(extensiones, 'color', 'Castaño', mediaNegro, EXTENSIONES)).toEqual({
      variante: largaCastano,
      ajustes: [{ clave: 'longitud', antes: 'Media', despues: 'Larga' }],
    });
  });
});
