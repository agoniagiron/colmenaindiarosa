import type { Request, Response } from 'express';
import * as combosServicio from './servicio.js';

export async function obtenerCombos(_req: Request, res: Response): Promise<void> {
  const combos = await combosServicio.listarCombosVigentes();
  res.json(combos);
}
