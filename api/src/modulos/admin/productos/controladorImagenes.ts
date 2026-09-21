import type { Request, Response } from 'express';
import * as servicio from './servicioImagenes.js';
import type {
  BodyCrearImagen,
  BodyEditarImagen,
  BodyFirmarImagen,
  BodyOrdenImagenes,
} from './esquemasImagenes.js';

export async function firmar(req: Request, res: Response): Promise<void> {
  const productoId = req.params.id as string;
  const datos = req.body as BodyFirmarImagen;
  res.json(await servicio.firmarSubidaImagen(productoId, datos));
}

export async function crear(req: Request, res: Response): Promise<void> {
  const productoId = req.params.id as string;
  const datos = req.body as BodyCrearImagen;
  const imagen = await servicio.crearImagen(productoId, datos);
  res.status(201).json(imagen);
}

export async function editar(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyEditarImagen;
  res.json(await servicio.editarImagen(id, datos));
}

export async function reordenar(req: Request, res: Response): Promise<void> {
  const productoId = req.params.id as string;
  const datos = req.body as BodyOrdenImagenes;
  res.json(await servicio.reordenarImagenes(productoId, datos));
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  await servicio.eliminarImagen(id);
  res.status(204).send();
}
