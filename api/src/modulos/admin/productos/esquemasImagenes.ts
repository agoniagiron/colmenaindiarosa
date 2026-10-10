import { z } from 'zod';
import { TIPOS_IMAGEN_PERMITIDOS } from '../../../lib/supabaseStorage.js';

const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;

export const esquemaBodyFirmarImagen = z.object({
  tipo: z.enum(TIPOS_IMAGEN_PERMITIDOS as [string, ...string[]], {
    message: 'El tipo debe ser jpeg, png o webp',
  }),
  tamano: z.coerce
    .number()
    .int()
    .positive()
    .max(TAMANO_MAXIMO_BYTES, `La imagen no puede superar los 5 MB`),
});

// La portada es la primera foto por `orden`, no un tipo — acá nunca se
// escribe 'principal' (el valor sigue existiendo en la columna de la
// base para clasificar, no para marcar portada).
const TIPOS_IMAGEN_PRODUCTO = ['galeria', 'detalle', 'modelo', 'medida', 'video'] as const;

export const esquemaBodyCrearImagen = z.object({
  url: z.string().url(),
  altTexto: z.string().trim().min(1),
  tipo: z.enum(TIPOS_IMAGEN_PRODUCTO).default('galeria'),
  orden: z.coerce.number().int().nonnegative().default(0),
  ancho: z.coerce.number().int().positive().optional(),
  alto: z.coerce.number().int().positive().optional(),
  varianteId: z.string().uuid().optional(),
});

export const esquemaBodyEditarImagen = z.object({
  altTexto: z.string().trim().min(1).optional(),
  tipo: z.enum(TIPOS_IMAGEN_PRODUCTO).optional(),
  varianteId: z.string().uuid().nullable().optional(),
});

export const esquemaBodyOrdenImagenes = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export type BodyFirmarImagen = z.infer<typeof esquemaBodyFirmarImagen>;
export type BodyCrearImagen = z.infer<typeof esquemaBodyCrearImagen>;
export type BodyEditarImagen = z.infer<typeof esquemaBodyEditarImagen>;
export type BodyOrdenImagenes = z.infer<typeof esquemaBodyOrdenImagenes>;
