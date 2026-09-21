import type { Request, Response } from 'express';
import * as promocionesServicio from './servicio.js';

export async function obtenerPromociones(_req: Request, res: Response): Promise<void> {
  const promociones = await promocionesServicio.listarPromocionesBanda();
  res.json(promociones);
}
