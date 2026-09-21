import { z } from 'zod';

const esquemaCorreo = z
  .string()
  .email('El correo no es válido')
  .transform((correo) => correo.toLowerCase());

// Sin esquema de registro: los usuario_admin no se autorregistran. Se
// crean solo por SQL directo hasta el prompt del panel de usuarios, que
// agregará el flujo de invitación sobre tokenAdmin (tipo 'invitacion').
export const esquemaLoginAdmin = z.object({
  correo: esquemaCorreo,
  clave: z.string().min(1, 'La contraseña es obligatoria'),
});

export type DatosLoginAdmin = z.infer<typeof esquemaLoginAdmin>;
