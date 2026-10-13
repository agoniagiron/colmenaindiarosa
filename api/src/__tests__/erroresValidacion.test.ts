import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';
import { camposInvalidos, mensajeCamposInvalidos } from '../lib/erroresValidacion.js';
import { esquemaBodyCrearVariante } from '../modulos/admin/productos/esquemas.js';

function errorDe(esquema: z.ZodType, datos: unknown): ZodError {
  const resultado = esquema.safeParse(datos);
  if (resultado.success) throw new Error('se esperaba que fallara');
  return resultado.error;
}

describe('erroresValidacion: qué campo falló y por qué', () => {
  it('un campo que falta se nombra como obligatorio (el caso del sku de esta tanda)', () => {
    const esquemaViejo = z.object({ sku: z.string().trim().min(1), precio: z.number() });
    const campos = camposInvalidos(errorDe(esquemaViejo, { precio: 990000 }));

    expect(campos).toEqual([{ campo: 'sku', problema: 'es obligatorio' }]);
    expect(mensajeCamposInvalidos(campos)).toBe('Revisá estos campos: sku (es obligatorio)');
  });

  it('nombra la ruta completa dentro de arrays y describe límites y formatos', () => {
    const campos = camposInvalidos(
      errorDe(esquemaBodyCrearVariante, {
        precio: 0,
        stockInicial: -1,
        valoresAtributo: ['no-es-un-uuid'],
      }),
    );

    expect(campos).toEqual(
      expect.arrayContaining([
        { campo: 'precio', problema: 'tiene que ser mayor a 0' },
        { campo: 'stockInicial', problema: 'tiene que ser mayor o igual a 0' },
        { campo: 'valoresAtributo.0', problema: 'no tiene un formato válido' },
      ]),
    );
  });

  it('nunca expone la estructura interna de Zod', () => {
    const campos = camposInvalidos(errorDe(esquemaBodyCrearVariante, {}));
    for (const campo of campos) {
      expect(Object.keys(campo).sort()).toEqual(['campo', 'problema']);
      expect(campo.problema).not.toMatch(/Invalid|expected|received/);
    }
  });

  it('los mensajes escritos a mano en un esquema pasan tal cual', () => {
    const esquema = z.object({ correo: z.string().email('El correo no es válido') });
    expect(camposInvalidos(errorDe(esquema, { correo: 'x' }))).toEqual([
      { campo: 'correo', problema: 'El correo no es válido' },
    ]);
  });

  it('con la entrada a mano distingue un número que falta de uno que vino mal (z.coerce)', () => {
    const entrada = { stockInicial: 'tres', valoresAtributo: [] };
    const campos = camposInvalidos(errorDe(esquemaBodyCrearVariante, entrada), entrada);
    expect(campos).toEqual(
      expect.arrayContaining([
        { campo: 'precio', problema: 'es obligatorio' },
        { campo: 'stockInicial', problema: 'tiene que ser un número' },
      ]),
    );
  });
});
