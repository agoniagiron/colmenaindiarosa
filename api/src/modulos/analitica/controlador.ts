import type { Request, Response } from 'express';
import * as analiticaServicio from './servicio.js';
import type { DatosRegistrarEvento } from './esquemas.js';

export async function registrarEvento(req: Request, res: Response): Promise<void> {
  const datos = req.body as DatosRegistrarEvento;
  await analiticaServicio.registrarEvento(datos, req.sesionVisitaId);
  res.status(204).send();
}
