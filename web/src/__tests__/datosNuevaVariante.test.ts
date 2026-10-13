import { describe, expect, it } from 'vitest';
import { armarDatosNuevaVariante } from '../paginas/admin/datosNuevaVariante.ts';
// Contrato compartido con la API: el mismo JSON lo manda por HTTP
// api/src/__tests__/integracion/crearVarianteHttp.test.ts.
import contrato from '../../../api/src/__tests__/contratos/nuevaVariante.json';

describe('Formulario "Agregar una variante"', () => {
  it('arma exactamente el payload del contrato con la API', () => {
    expect(armarDatosNuevaVariante(contrato.formulario)).toEqual(contrato.payload);
  });

  it('sin costo no manda costo, y los atributos sin valor no viajan', () => {
    const datos = armarDatosNuevaVariante({
      ...contrato.formulario,
      costo: '',
      seleccion: { ...contrato.formulario.seleccion, 'atributo-talla': '' },
    });
    expect(datos.costo).toBeUndefined();
    expect(datos.valoresAtributo).toEqual(['VALOR_0', 'VALOR_1', 'VALOR_2', 'VALOR_4']);
  });
});
