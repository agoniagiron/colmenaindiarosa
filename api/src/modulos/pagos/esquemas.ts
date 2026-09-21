import { z } from 'zod';

// Forma laxa a propósito: si el cuerpo no calza, se trata como evento no
// reconocible (se ignora, pero igual respondemos 200 — ver servicio.ts).
export const esquemaEventoWompi = z.object({
  event: z.string(),
  data: z.record(z.string(), z.unknown()),
  environment: z.string().optional(),
  signature: z
    .object({
      properties: z.array(z.string()).optional(),
      checksum: z.string().optional(),
    })
    .optional(),
  timestamp: z.number().optional(),
  sent_at: z.string().optional(),
});

export type EventoWompiBody = z.infer<typeof esquemaEventoWompi>;
