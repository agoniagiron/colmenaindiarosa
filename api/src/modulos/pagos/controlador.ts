import type { Request, Response } from 'express';
import * as pagosServicio from './servicio.js';

export async function recibirWebhook(req: Request, res: Response): Promise<void> {
  try {
    await pagosServicio.procesarWebhook(req.body);
  } catch (error) {
    req.log?.error({ err: error }, 'Error procesando webhook de Wompi');
  }
  // Siempre 200 y rápido: Wompi reintenta si no responde 200, y reintentar
  // no ayuda en los casos que no procesamos (firma inválida, referencia
  // desconocida). El procesamiento pesado ya terminó acá arriba; nada queda
  // pendiente después de responder.
  res.status(200).json({ ok: true });
}
