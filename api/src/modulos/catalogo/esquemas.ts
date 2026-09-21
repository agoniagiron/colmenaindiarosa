import { z } from 'zod';

const listaDesdeQuery = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((valor) => (valor === undefined ? undefined : Array.isArray(valor) ? valor : [valor]));

const booleanoDesdeQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((valor) => (valor === undefined ? undefined : valor === 'true'));

export const ORDENES_PRODUCTO = [
  'relevancia',
  'precio_asc',
  'precio_desc',
  'calificacion',
  'recientes',
] as const;

export const esquemaFiltrosProducto = z.object({
  categoria: z.string().optional(),
  tipo: listaDesdeQuery,
  longitud: listaDesdeQuery,
  color: listaDesdeQuery,
  talla: listaDesdeQuery,
  densidad: listaDesdeQuery,
  precioMin: z.coerce.number().nonnegative().optional(),
  precioMax: z.coerce.number().nonnegative().optional(),
  destacado: booleanoDesdeQuery,
  busqueda: z.string().trim().min(1).optional(),
});

export const esquemaQueryProductos = esquemaFiltrosProducto.extend({
  orden: z.enum(ORDENES_PRODUCTO).default('relevancia'),
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().positive().max(48).default(24),
});

export type FiltrosProducto = z.infer<typeof esquemaFiltrosProducto>;
export type QueryProductos = z.infer<typeof esquemaQueryProductos>;

export const esquemaParamsSlug = z.object({
  slug: z.string().min(1),
});
