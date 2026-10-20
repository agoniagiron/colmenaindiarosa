import { describe, expect, it } from 'vitest';
import { imagenDeVariante, resolverImagenesVariante } from '../lib/imagenesVariante.js';

const ROSA = 'valor-rosa';
const RUBIO = 'valor-rubio-arena';
const NEGRO = 'valor-negro';
const LONGITUD_14 = 'valor-14';

function foto(id: string, valorAtributoId: string | null, orden: number) {
  return { id, valorAtributoId, orden };
}

const ids = (imagenes: { id: string }[]) => imagenes.map((i) => i.id);

// Como HANNAH: fotos del rosa, del rubio y genéricas, mezcladas en el orden.
const hannah = [
  foto('rosa-1', ROSA, 0),
  foto('generica-1', null, 1),
  foto('rubio-1', RUBIO, 2),
  foto('rosa-2', ROSA, 3),
  foto('generica-2', null, 4),
  foto('rubio-2', RUBIO, 5),
];

describe('resolverImagenesVariante', () => {
  it('primero las fotos del color de la variante, después las genéricas, nunca las de otro color', () => {
    expect(ids(resolverImagenesVariante(hannah, [ROSA, LONGITUD_14]))).toEqual([
      'rosa-1',
      'rosa-2',
      'generica-1',
      'generica-2',
    ]);
    expect(ids(resolverImagenesVariante(hannah, [RUBIO, LONGITUD_14]))).toEqual([
      'rubio-1',
      'rubio-2',
      'generica-1',
      'generica-2',
    ]);
  });

  it('un color sin fotos asignadas ve solo las genéricas', () => {
    expect(ids(resolverImagenesVariante(hannah, [NEGRO]))).toEqual(['generica-1', 'generica-2']);
  });

  it('sin fotos del color ni genéricas, se muestran todas antes que una galería vacía', () => {
    const soloDeColores = hannah.filter((f) => f.valorAtributoId !== null);
    expect(ids(resolverImagenesVariante(soloDeColores, [NEGRO]))).toEqual([
      'rosa-1',
      'rubio-1',
      'rosa-2',
      'rubio-2',
    ]);
  });

  it('todas genéricas (lo que hay hoy cargado): las muestra todas, por orden', () => {
    const genericas = [foto('b', null, 1), foto('a', null, 0)];
    expect(ids(resolverImagenesVariante(genericas, [ROSA]))).toEqual(['a', 'b']);
  });

  it('respeta el orden aunque lleguen desordenadas', () => {
    const desordenadas = [...hannah].reverse();
    expect(ids(resolverImagenesVariante(desordenadas, [ROSA]))).toEqual([
      'rosa-1',
      'rosa-2',
      'generica-1',
      'generica-2',
    ]);
  });

  it('sin fotos devuelve una lista vacía', () => {
    expect(resolverImagenesVariante([], [ROSA])).toEqual([]);
  });

  it('no modifica la lista que recibe', () => {
    const copia = [...hannah];
    resolverImagenesVariante(hannah, [RUBIO]);
    expect(hannah).toEqual(copia);
  });
});

describe('imagenDeVariante', () => {
  it('es la primera de la galería de la variante', () => {
    expect(imagenDeVariante(hannah, [RUBIO])?.id).toBe('rubio-1');
    expect(imagenDeVariante(hannah, [NEGRO])?.id).toBe('generica-1');
  });

  it('null si el producto no tiene fotos', () => {
    expect(imagenDeVariante([], [ROSA])).toBeNull();
  });
});
