import type { DatosCrearVariante } from '../../contexto/apiProductosAdmin.ts';

// Lo que tiene el formulario "Agregar una variante" en el momento de crear,
// tal cual lo escribió la persona (los inputs numéricos son texto).
export interface FormularioNuevaVariante {
  precio: string;
  costo: string;
  stockInicial: string;
  puntoReorden: string;
  // atributoId -> valorId elegido ('' = sin valor)
  seleccion: Record<string, string>;
}

// Separado del modal para poder probarlo contra el contrato compartido con
// la API (api/src/__tests__/contratos/nuevaVariante.json): si el formulario
// y el esquema de la API se desincronizan, falla un test.
export function armarDatosNuevaVariante(formulario: FormularioNuevaVariante): DatosCrearVariante {
  return {
    precio: Number(formulario.precio),
    costo: formulario.costo ? Number(formulario.costo) : undefined,
    stockInicial: Number(formulario.stockInicial),
    puntoReorden: Number(formulario.puntoReorden),
    valoresAtributo: Object.values(formulario.seleccion).filter(Boolean),
  };
}
