import type { Request, Response } from 'express';
import { ErrorApi } from '../../lib/errorApi.js';
import type { FiltrosProducto, QueryProductos } from './esquemas.js';
import * as catalogoServicio from './servicio.js';

export async function obtenerCategorias(_req: Request, res: Response): Promise<void> {
  const categorias = await catalogoServicio.listarCategorias();
  res.json(categorias);
}

export async function obtenerProductos(req: Request, res: Response): Promise<void> {
  const query = req.queryValidada as QueryProductos;
  const resultado = await catalogoServicio.listarProductos(query, req.sesionVisitaId);
  res.json(resultado);
}

export async function obtenerFacetas(req: Request, res: Response): Promise<void> {
  const filtros = req.queryValidada as FiltrosProducto;
  const facetas = await catalogoServicio.listarFacetas(filtros);
  res.json(facetas);
}

export async function obtenerProductoDetalle(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  const producto = await catalogoServicio.obtenerProductoPorSlug(slug as string);

  if (!producto) {
    throw ErrorApi.noEncontrado('El producto no existe o no está disponible');
  }

  await catalogoServicio.registrarVistaProducto(
    producto.id,
    producto.categoriaId,
    req.sesionVisitaId,
  );
  res.json(producto);
}

export async function obtenerProductoRelacionados(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  const relacionados = await catalogoServicio.listarRelacionados(slug as string);
  res.json(relacionados);
}
