import type { Request, Response } from 'express';
import { obtenerConfiguracionPublica } from '../../lib/configuracion.js';

export async function obtenerConfiguracion(_req: Request, res: Response): Promise<void> {
  const entradas = await obtenerConfiguracionPublica();
  res.json(entradas);
}
