import type { Request, Response } from 'express';
import * as portadaServicio from './servicio.js';

export async function obtenerHeroe(_req: Request, res: Response): Promise<void> {
  const heroe = await portadaServicio.obtenerHeroePortada();
  res.json(heroe);
}
