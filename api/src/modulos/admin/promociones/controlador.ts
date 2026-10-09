import type { Request, Response } from 'express';
import * as servicio from './servicio.js';
import type {
  BodyCrearPromocion,
  BodyEditarPromocion,
  BodyPrevisualizar,
  QueryListadoPromociones,
} from './esquemas.js';

export async function listar(req: Request, res: Response): Promise<void> {
  const query = req.queryValidada as QueryListadoPromociones;
  res.json(await servicio.listarPromociones(query));
}

export async function obtenerDetalle(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  res.json(await servicio.obtenerDetallePromocion(id));
}

export async function crear(req: Request, res: Response): Promise<void> {
  const datos = req.body as BodyCrearPromocion;
  const promocion = await servicio.crearPromocion(datos, req.usuarioAdmin!.id);
  res.status(201).json(promocion);
}

export async function editar(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyEditarPromocion;
  res.json(await servicio.editarPromocion(id, datos));
}

export async function previsualizar(req: Request, res: Response): Promise<void> {
  const datos = req.body as BodyPrevisualizar;
  res.json(await servicio.previsualizar(datos));
}
