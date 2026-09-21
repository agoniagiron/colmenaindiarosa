import type { Request, Response } from 'express';
import * as cuentaServicio from './servicio.js';
import type { DatosActualizarDireccion, DatosCrearDireccion } from './esquemas.js';

export async function listarDirecciones(req: Request, res: Response): Promise<void> {
  const direcciones = await cuentaServicio.listarDirecciones(req.usuario!.id);
  res.json(direcciones);
}

export async function crearDireccion(req: Request, res: Response): Promise<void> {
  const datos = req.body as DatosCrearDireccion;
  const direccion = await cuentaServicio.crearDireccion(req.usuario!.id, datos);
  res.status(201).json(direccion);
}

export async function actualizarDireccion(req: Request, res: Response): Promise<void> {
  const datos = req.body as DatosActualizarDireccion;
  const direccion = await cuentaServicio.actualizarDireccion(
    req.usuario!.id,
    req.params.id as string,
    datos,
  );
  res.json(direccion);
}

export async function eliminarDireccion(req: Request, res: Response): Promise<void> {
  await cuentaServicio.eliminarDireccion(req.usuario!.id, req.params.id as string);
  res.status(204).send();
}
