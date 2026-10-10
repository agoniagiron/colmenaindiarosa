import type { Request, Response } from 'express';
import * as servicio from './servicioImagenes.js';
import type {
  BodyCrearImagenCombo,
  BodyEditarImagenCombo,
  BodyFirmarImagenCombo,
  BodyOrdenImagenesCombo,
} from './esquemasImagenes.js';

export async function firmar(req: Request, res: Response): Promise<void> {
  const comboId = req.params.id as string;
  const datos = req.body as BodyFirmarImagenCombo;
  res.json(await servicio.firmarSubidaImagenCombo(comboId, datos));
}

export async function crear(req: Request, res: Response): Promise<void> {
  const comboId = req.params.id as string;
  const datos = req.body as BodyCrearImagenCombo;
  const imagen = await servicio.crearImagenCombo(comboId, datos);
  res.status(201).json(imagen);
}

export async function editar(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyEditarImagenCombo;
  res.json(await servicio.editarImagenCombo(id, datos));
}

export async function reordenar(req: Request, res: Response): Promise<void> {
  const comboId = req.params.id as string;
  const datos = req.body as BodyOrdenImagenesCombo;
  res.json(await servicio.reordenarImagenesCombo(comboId, datos));
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  await servicio.eliminarImagenCombo(id);
  res.status(204).send();
}
