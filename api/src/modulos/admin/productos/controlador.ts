import type { Request, Response } from 'express';
import { obtenerIpHash } from '../../../lib/ip.js';
import * as servicio from './servicio.js';
import type {
  BodyCrearProducto,
  BodyCrearValorAtributo,
  BodyCrearVariante,
  BodyEditarProducto,
  BodyEditarVariante,
  BodyEstadoProducto,
  BodyPreciosProducto,
  BodyPrecioVariante,
  QueryListadoProductos,
} from './esquemas.js';

export async function listar(req: Request, res: Response): Promise<void> {
  const query = req.queryValidada as QueryListadoProductos;
  res.json(await servicio.listarProductos(query));
}

export async function obtenerDetalle(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  res.json(await servicio.obtenerDetalleProducto(id));
}

export async function crear(req: Request, res: Response): Promise<void> {
  const datos = req.body as BodyCrearProducto;
  const producto = await servicio.crearProducto(datos, req.usuarioAdmin!.id);
  res.status(201).json(producto);
}

export async function editar(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyEditarProducto;
  res.json(await servicio.editarProducto(id, datos));
}

export async function cambiarEstado(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyEstadoProducto;
  res.json(await servicio.cambiarEstadoProducto(id, datos));
}

export async function crearVariante(req: Request, res: Response): Promise<void> {
  const productoId = req.params.id as string;
  const datos = req.body as BodyCrearVariante;
  const variante = await servicio.crearVariante(productoId, datos, req.usuarioAdmin!.id);
  res.status(201).json(variante);
}

export async function cambiarPreciosProducto(req: Request, res: Response): Promise<void> {
  const productoId = req.params.id as string;
  const datos = req.body as BodyPreciosProducto;
  const producto = await servicio.cambiarPreciosProducto(
    productoId,
    datos,
    req.usuarioAdmin!.id,
    obtenerIpHash(req),
  );
  res.json(producto);
}

export async function editarVariante(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyEditarVariante;
  res.json(await servicio.editarVariante(id, datos));
}

export async function cambiarPrecioVariante(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyPrecioVariante;
  const variante = await servicio.cambiarPrecioVariante(
    id,
    datos,
    req.usuarioAdmin!.id,
    obtenerIpHash(req),
  );
  res.json(variante);
}

export async function listarAtributos(_req: Request, res: Response): Promise<void> {
  res.json(await servicio.listarAtributos());
}

export async function crearValorAtributo(req: Request, res: Response): Promise<void> {
  const datos = req.body as BodyCrearValorAtributo;
  const valor = await servicio.crearValorAtributo(datos);
  res.status(201).json(valor);
}
