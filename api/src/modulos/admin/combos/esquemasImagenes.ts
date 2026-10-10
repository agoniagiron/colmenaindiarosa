import { z } from 'zod';
import { TIPOS_IMAGEN_PERMITIDOS } from '../../../lib/supabaseStorage.js';

const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;

export const esquemaBodyFirmarImagenCombo = z.object({
  tipo: z.enum(TIPOS_IMAGEN_PERMITIDOS as [string, ...string[]], {
    message: 'El tipo debe ser jpeg, png o webp',
  }),
  tamano: z.coerce
    .number()
    .int()
    .positive()
    .max(TAMANO_MAXIMO_BYTES, `La imagen no puede superar los 5 MB`),
});

// Un kit no tiene variantes propias ni el resto de los tipos de imagen de
// producto (modelo, medida, video no aplican a una foto de vitrina
// armada): solo galería. La portada es la primera foto por `orden`, no
// un tipo — acá nunca se escribe 'principal' (ver servicioImagenes.ts).
const TIPOS_IMAGEN_COMBO = ['galeria'] as const;

export const esquemaBodyCrearImagenCombo = z.object({
  url: z.string().url(),
  altTexto: z.string().trim().min(1),
  tipo: z.enum(TIPOS_IMAGEN_COMBO).default('galeria'),
  orden: z.coerce.number().int().nonnegative().default(0),
  ancho: z.coerce.number().int().positive().optional(),
  alto: z.coerce.number().int().positive().optional(),
});

export const esquemaBodyEditarImagenCombo = z.object({
  altTexto: z.string().trim().min(1).optional(),
  tipo: z.enum(TIPOS_IMAGEN_COMBO).optional(),
});

export const esquemaBodyOrdenImagenesCombo = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export type BodyFirmarImagenCombo = z.infer<typeof esquemaBodyFirmarImagenCombo>;
export type BodyCrearImagenCombo = z.infer<typeof esquemaBodyCrearImagenCombo>;
export type BodyEditarImagenCombo = z.infer<typeof esquemaBodyEditarImagenCombo>;
export type BodyOrdenImagenesCombo = z.infer<typeof esquemaBodyOrdenImagenesCombo>;
