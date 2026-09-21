import type { Request, Response } from 'express';
import * as limitadasServicio from './servicio.js';

export async function obtenerLimitadas(_req: Request, res: Response): Promise<void> {
  const ediciones = await limitadasServicio.listarEdicionesLimitadasVigentes();
  res.json(ediciones);
}
