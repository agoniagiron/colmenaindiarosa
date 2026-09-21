import { z } from 'zod';

const REGEX_CLAVE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const MENSAJE_CLAVE =
  'La contraseña debe tener al menos 8 caracteres, con al menos una letra y un número';

const esquemaClave = z.string().regex(REGEX_CLAVE, MENSAJE_CLAVE);
const esquemaCorreo = z
  .string()
  .email('El correo no es válido')
  .transform((correo) => correo.toLowerCase());

export const esquemaRegistro = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  correo: esquemaCorreo,
  clave: esquemaClave,
  telefono: z.string().trim().min(1).optional(),
  aceptoTerminos: z.boolean().refine((v) => v === true, 'Debés aceptar los términos y condiciones'),
  aceptoTratamiento: z
    .boolean()
    .refine((v) => v === true, 'Debés aceptar el tratamiento de datos personales'),
});

export const esquemaLogin = z.object({
  correo: esquemaCorreo,
  clave: z.string().min(1, 'La contraseña es obligatoria'),
});

export const esquemaVerificarCorreoConfirmar = z.object({
  token: z.string().min(1, 'Falta el token'),
});

export const esquemaRecuperarSolicitar = z.object({
  correo: esquemaCorreo,
});

export const esquemaRecuperarConfirmar = z.object({
  token: z.string().min(1, 'Falta el token'),
  claveNueva: esquemaClave,
});

export type DatosRegistro = z.infer<typeof esquemaRegistro>;
export type DatosLogin = z.infer<typeof esquemaLogin>;
export type DatosVerificarCorreoConfirmar = z.infer<typeof esquemaVerificarCorreoConfirmar>;
export type DatosRecuperarSolicitar = z.infer<typeof esquemaRecuperarSolicitar>;
export type DatosRecuperarConfirmar = z.infer<typeof esquemaRecuperarConfirmar>;
