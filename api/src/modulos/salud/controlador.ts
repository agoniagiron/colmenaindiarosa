import type { Request, Response } from 'express';
import { verificarSalud } from './servicio.js';

export async function obtenerSalud(_req: Request, res: Response): Promise<void> {
  const resultado = await verificarSalud();
  res.status(resultado.ok ? 200 : 503).json(resultado);
}
