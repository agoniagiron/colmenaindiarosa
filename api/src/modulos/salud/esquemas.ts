import { z } from 'zod';

export const esquemaRespuestaSalud = z.object({
  ok: z.boolean(),
  baseDatos: z.enum(['conectada', 'error']),
});

export type RespuestaSalud = z.infer<typeof esquemaRespuestaSalud>;
