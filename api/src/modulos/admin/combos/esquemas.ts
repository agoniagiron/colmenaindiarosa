import { z } from 'zod';

export const esquemaQueryListadoKits = z.object({
  buscar: z.string().trim().min(1).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().positive().max(100).default(20),
});

export const esquemaQueryBuscarVariantes = z.object({
  buscar: z.string().trim().min(1),
});

// Mínimo dos piezas (punto 13 del pedido): un kit de una sola pieza no es
// un kit. Se valida en el esquema para que ni siquiera llegue al
// servicio, ni en crear ni en editar.
const esquemaItemKit = z.object({
  varianteId: z.string().uuid(),
  cantidad: z.coerce.number().int().positive().default(1),
});

export const esquemaBodyCrearKit = z.object({
  nombre: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  descripcion: z.string().trim().min(1).nullable().optional(),
  imagenUrl: z.string().trim().url().nullable().optional(),
  precioCop: z.coerce.number().int().positive(),
  precioUsd: z.coerce.number().int().nonnegative().nullable().optional(),
  items: z.array(esquemaItemKit).min(2, 'Un kit necesita al menos dos piezas'),
  vigenteDesde: z.coerce.date().optional(),
  vigenteHasta: z.coerce.date().nullable().optional(),
  destacado: z.boolean().optional(),
});

export const esquemaBodyEditarKit = z.object({
  nombre: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  descripcion: z.string().trim().min(1).nullable().optional(),
  imagenUrl: z.string().trim().url().nullable().optional(),
  precioCop: z.coerce.number().int().positive().optional(),
  precioUsd: z.coerce.number().int().nonnegative().nullable().optional(),
  items: z.array(esquemaItemKit).min(2, 'Un kit necesita al menos dos piezas').optional(),
  vigenteDesde: z.coerce.date().optional(),
  vigenteHasta: z.coerce.date().nullable().optional(),
  activo: z.boolean().optional(),
  destacado: z.boolean().optional(),
});

// Para el resumen vivo del formulario (punto 12 del pedido): a diferencia
// de crear/editar, acá no se exige el mínimo de dos piezas — mientras se
// está armando el kit puede haber una sola todavía, y el resumen tiene
// que poder mostrarse igual (el formulario avisa aparte que faltan
// piezas para poder guardar).
export const esquemaBodyPrevisualizarKit = z.object({
  precioCop: z.coerce.number().int().positive(),
  items: z.array(esquemaItemKit).min(1),
});

export type QueryListadoKits = z.infer<typeof esquemaQueryListadoKits>;
export type QueryBuscarVariantes = z.infer<typeof esquemaQueryBuscarVariantes>;
export type BodyCrearKit = z.infer<typeof esquemaBodyCrearKit>;
export type BodyEditarKit = z.infer<typeof esquemaBodyEditarKit>;
export type BodyPrevisualizarKit = z.infer<typeof esquemaBodyPrevisualizarKit>;
