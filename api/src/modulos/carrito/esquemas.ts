import { z } from 'zod';

// Una línea es variante XOR combo (igual que en la base): el body trae
// varianteId o comboId, nunca los dos.
export const esquemaAgregarItem = z.union([
  z.object({
    varianteId: z.string().uuid('Id de variante inválido'),
    cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  }),
  z.object({
    comboId: z.string().uuid('Id de combo inválido'),
    cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  }),
]);

export const esquemaActualizarItem = z.object({
  cantidad: z.coerce.number().int().min(0, 'La cantidad no puede ser negativa'),
});

export const esquemaParamsItem = z.object({
  id: z.string().uuid('Id de línea inválido'),
});

export const esquemaAplicarCupon = z.object({
  codigo: z.string().trim().min(1, 'El código es obligatorio'),
});

export type DatosAgregarItem = z.infer<typeof esquemaAgregarItem>;
export type DatosActualizarItem = z.infer<typeof esquemaActualizarItem>;
export type DatosAplicarCupon = z.infer<typeof esquemaAplicarCupon>;
