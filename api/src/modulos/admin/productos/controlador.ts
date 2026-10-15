import type { Request, Response } from 'express';
import { obtenerIpHash } from '../../../lib/ip.js';
import * as servicio from './servicio.js';
import * as servicioAtributos from './servicioAtributos.js';
import * as variantes from './variantes.js';
import type {
  BodyConfiguracionCategoria,
  BodyCrearLote,
  BodyCrearProducto,
  BodyCrearValorAtributo,
  BodyCrearVariante,
  BodyEditarProducto,
  BodyEditarVariante,
  BodyEstadoProducto,
  BodyPortadaProducto,
  BodyPreciosProducto,
  BodyPrecioVariante,
  BodyPrevisualizarLote,
  BodyVariantePrincipal,
  QueryAtributos,
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

export async function cambiarPortada(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyPortadaProducto;
  res.json(await servicio.cambiarPortadaProducto(id, datos));
}

export async function crearVariante(req: Request, res: Response): Promise<void> {
  const productoId = req.params.id as string;
  const datos = req.body as BodyCrearVariante;
  const variante = await servicio.crearVariante(productoId, datos, req.usuarioAdmin!.id);
  res.status(201).json(variante);
}

export async function cambiarVariantePrincipal(req: Request, res: Response): Promise<void> {
  const productoId = req.params.id as string;
  const datos = req.body as BodyVariantePrincipal;
  res.json(await servicio.cambiarVariantePrincipal(productoId, datos.varianteId));
}

export async function previsualizarLoteVariantes(req: Request, res: Response): Promise<void> {
  const productoId = req.params.id as string;
  const datos = req.body as BodyPrevisualizarLote;
  res.json(await variantes.previsualizarLote(productoId, datos));
}

export async function crearLoteVariantes(req: Request, res: Response): Promise<void> {
  const productoId = req.params.id as string;
  const datos = req.body as BodyCrearLote;
  res.status(201).json(await variantes.crearLote(productoId, datos, req.usuarioAdmin!.id));
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

export async function listarAtributos(req: Request, res: Response): Promise<void> {
  const query = req.queryValidada as QueryAtributos;
  res.json(await servicio.listarAtributos(query.categoriaId));
}

export async function crearValorAtributo(req: Request, res: Response): Promise<void> {
  const datos = req.body as BodyCrearValorAtributo;
  res.status(201).json(await servicioAtributos.crearValorAtributo(datos));
}

export async function obtenerConfiguracionAtributos(_req: Request, res: Response): Promise<void> {
  res.json(await servicioAtributos.obtenerConfiguracionAtributos());
}

export async function guardarConfiguracionCategoria(req: Request, res: Response): Promise<void> {
  const categoriaId = req.params.categoriaId as string;
  const datos = req.body as BodyConfiguracionCategoria;
  res.json(await servicioAtributos.guardarConfiguracionCategoria(categoriaId, datos));
}
