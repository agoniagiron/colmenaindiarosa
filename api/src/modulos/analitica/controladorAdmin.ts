import type { Request, Response } from 'express';
import * as servicio from './servicioReportes.js';
import type {
  QueryBusquedas,
  QueryCalificaciones,
  QueryProductosAdmin,
  QueryRango,
  QuerySerie,
} from './esquemasAdmin.js';

export async function obtenerResumen(req: Request, res: Response): Promise<void> {
  const { desde, hasta } = req.queryValidada as QueryRango;
  res.json(await servicio.obtenerResumen(desde, hasta));
}

export async function obtenerEmbudo(req: Request, res: Response): Promise<void> {
  const { desde, hasta } = req.queryValidada as QueryRango;
  res.json(await servicio.obtenerEmbudo(desde, hasta));
}

export async function obtenerSerie(req: Request, res: Response): Promise<void> {
  const { meses, hasta } = req.queryValidada as QuerySerie;
  res.json(await servicio.obtenerSerie(meses, hasta));
}

export async function obtenerProductos(req: Request, res: Response): Promise<void> {
  const { desde, hasta, orden, limite } = req.queryValidada as QueryProductosAdmin;
  res.json(await servicio.obtenerProductos(desde, hasta, orden, limite));
}

export async function obtenerCalificaciones(req: Request, res: Response): Promise<void> {
  const { orden, minimo } = req.queryValidada as QueryCalificaciones;
  res.json(await servicio.obtenerCalificaciones(orden, minimo));
}

export async function obtenerOrigen(req: Request, res: Response): Promise<void> {
  const { desde, hasta } = req.queryValidada as QueryRango;
  res.json(await servicio.obtenerOrigen(desde, hasta));
}

export async function obtenerBusquedas(req: Request, res: Response): Promise<void> {
  const { desde, hasta, sinResultados } = req.queryValidada as QueryBusquedas;
  res.json(await servicio.obtenerBusquedas(desde, hasta, sinResultados));
}

export async function obtenerClientas(req: Request, res: Response): Promise<void> {
  const { desde, hasta } = req.queryValidada as QueryRango;
  res.json(await servicio.obtenerClientas(desde, hasta));
}
