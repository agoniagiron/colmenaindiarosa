import { z } from 'zod';

// 'YYYY-MM-DD', día calendario en Bogotá (ver lib/fechasReporte.ts).
const esquemaFecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Se espera una fecha YYYY-MM-DD');

const esquemaRango = z
  .object({
    desde: esquemaFecha,
    hasta: esquemaFecha,
  })
  .refine((datos) => datos.desde <= datos.hasta, {
    message: '"desde" no puede ser posterior a "hasta"',
  });

export const esquemaQueryResumen = esquemaRango;
export const esquemaQueryEmbudo = esquemaRango;
export const esquemaQueryOrigen = esquemaRango;

export const esquemaQuerySerie = z.object({
  meses: z.coerce.number().int().positive().max(24).default(6),
  // Mismo formato que el resto de endpoints (YYYY-MM-DD, día Bogotá). Si
  // no llega, el backend usa hoy en Bogotá — ver servicioReportes.ts.
  hasta: esquemaFecha.optional(),
});

export const ORDENES_PRODUCTOS = ['vistos', 'agregados', 'vendidos', 'menos_vendidos'] as const;

export const esquemaQueryProductos = esquemaRango.and(
  z.object({
    orden: z.enum(ORDENES_PRODUCTOS).default('vistos'),
    limite: z.coerce.number().int().positive().max(100).default(10),
  }),
);

export const esquemaQueryCalificaciones = z.object({
  orden: z.enum(['mejor', 'peor']),
  // Obligatorio a propósito (punto 7): sin mínimo, un producto con una
  // sola reseña de 2 estrellas encabeza "peores" y la tabla no sirve.
  minimo: z.coerce.number().int().positive(),
});

const booleanoDesdeQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((valor) => (valor === undefined ? undefined : valor === 'true'));

export const esquemaQueryBusquedas = esquemaRango.and(
  z.object({
    sinResultados: booleanoDesdeQuery,
  }),
);

export const esquemaQueryClientas = esquemaRango;

export type QueryRango = z.infer<typeof esquemaRango>;
export type QuerySerie = z.infer<typeof esquemaQuerySerie>;
export type QueryProductosAdmin = z.infer<typeof esquemaQueryProductos>;
export type QueryCalificaciones = z.infer<typeof esquemaQueryCalificaciones>;
export type QueryBusquedas = z.infer<typeof esquemaQueryBusquedas>;
