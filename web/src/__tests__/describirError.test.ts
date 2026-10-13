import { describe, expect, it } from 'vitest';
import { describirError, ErrorProductosAdmin } from '../contexto/apiProductosAdmin.ts';

const ETIQUETAS = {
  precio: 'Precio',
  'combinaciones.stock': 'Stock',
  combinaciones: 'Combinaciones',
};

describe('describirError: campos de un 400 de validación con las etiquetas del formulario', () => {
  it('nombra cada campo con su etiqueta y su problema', () => {
    const error = new ErrorProductosAdmin(400, 'Revisá estos campos: …', {
      campos: [
        { campo: 'precio', problema: 'es obligatorio' },
        { campo: 'combinaciones.3.stock', problema: 'tiene que ser un número' },
      ],
    });
    expect(describirError(error, ETIQUETAS, 'respaldo')).toBe(
      'Revisá estos campos. Precio: es obligatorio. Stock: tiene que ser un número.',
    );
  });

  it('sin etiqueta conocida usa el nombre del campo', () => {
    const error = new ErrorProductosAdmin(400, 'x', {
      campos: [{ campo: 'peso', problema: 'tiene que ser un número' }],
    });
    expect(describirError(error, ETIQUETAS, 'respaldo')).toBe(
      'Revisá este campo. peso: tiene que ser un número.',
    );
  });

  it('un error sin campos muestra el mensaje del servidor, y uno desconocido el de respaldo', () => {
    expect(describirError(new ErrorProductosAdmin(409, 'Ya existe'), ETIQUETAS, 'respaldo')).toBe(
      'Ya existe',
    );
    expect(describirError(new Error('red'), ETIQUETAS, 'respaldo')).toBe('respaldo');
  });
});
