import type { Request, Response } from 'express';
import * as servicio from './servicio.js';
import type { BodyCrearEdicion, BodyEditarEdicion, QueryListadoLimitadas } from './esquemas.js';

export async function listar(req: Request, res: Response): Promise<void> {
  const query = req.queryValidada as QueryListadoLimitadas;
  res.json(await servicio.listarEdicionesAdmin(query));
}

export async function obtenerDetalle(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  res.json(await servicio.obtenerDetalleEdicion(id));
}

export async function crear(req: Request, res: Response): Promise<void> {
  const datos = req.body as BodyCrearEdicion;
  const edicion = await servicio.crearEdicion(datos, req.usuarioAdmin!.id);
  res.status(201).json(edicion);
}

// No hay "eliminar": una edición nunca se borra, solo se desactiva — eso
// es un PATCH con { activa: false } como cualquier otro cambio (ver
// AJUSTE 1 del pedido). Reactivar es el mismo PATCH con activa:true.
export async function editar(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyEditarEdicion;
  res.json(await servicio.editarEdicion(id, datos));
}
