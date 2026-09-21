import { z } from 'zod';

export const esquemaCrearDireccion = z.object({
  etiqueta: z.string().trim().min(1).optional(),
  nombreRecibe: z.string().trim().min(1, 'El nombre de quien recibe es obligatorio'),
  telefono: z.string().trim().min(1, 'El teléfono es obligatorio'),
  departamento: z.string().trim().min(1, 'El departamento es obligatorio'),
  ciudad: z.string().trim().min(1, 'La ciudad es obligatoria'),
  direccion: z.string().trim().min(1, 'La dirección es obligatoria'),
  complemento: z.string().trim().min(1).optional(),
  esPrincipal: z.boolean().optional().default(false),
});

export const esquemaActualizarDireccion = esquemaCrearDireccion.partial();

export const esquemaParamsDireccion = z.object({
  id: z.string().uuid('Id de dirección inválido'),
});

export type DatosCrearDireccion = z.infer<typeof esquemaCrearDireccion>;
export type DatosActualizarDireccion = z.infer<typeof esquemaActualizarDireccion>;
