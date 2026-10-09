import type { Request, Response } from 'express';
import * as servicio from './servicio.js';
import type {
  BodyCrearKit,
  BodyEditarKit,
  BodyPrevisualizarKit,
  QueryBuscarVariantes,
  QueryListadoKits,
} from './esquemas.js';

export async function listar(req: Request, res: Response): Promise<void> {
  const query = req.queryValidada as QueryListadoKits;
  res.json(await servicio.listarKits(query));
}

export async function obtenerDetalle(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  res.json(await servicio.obtenerDetalleKit(id));
}

export async function crear(req: Request, res: Response): Promise<void> {
  const datos = req.body as BodyCrearKit;
  const kit = await servicio.crearKit(datos, req.usuarioAdmin!.id);
  res.status(201).json(kit);
}

export async function editar(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyEditarKit;
  res.json(await servicio.editarKit(id, datos));
}

export async function buscarVariantes(req: Request, res: Response): Promise<void> {
  const query = req.queryValidada as QueryBuscarVariantes;
  res.json(await servicio.buscarVariantes(query));
}

export async function previsualizar(req: Request, res: Response): Promise<void> {
  const datos = req.body as BodyPrevisualizarKit;
  res.json(await servicio.previsualizarKit(datos));
}
