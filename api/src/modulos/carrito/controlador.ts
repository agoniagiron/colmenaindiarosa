import type { Request, Response } from 'express';
import { ErrorApi } from '../../lib/errorApi.js';
import * as carritoServicio from './servicio.js';
import type { Propietario } from './servicio.js';
import type { DatosActualizarItem, DatosAgregarItem, DatosAplicarCupon } from './esquemas.js';

function propietarioDe(req: Request): Propietario {
  if (req.usuario) return { usuarioId: req.usuario.id };
  if (req.visitanteId) return { visitanteId: req.visitanteId };
  // No debería pasar: sesionVisita corre antes en todas las rutas de carrito
  // y siempre deja una cookie de visitante, con o sin usuario logueado.
  throw ErrorApi.interno('No se pudo identificar el carrito');
}

export async function obtenerCarrito(req: Request, res: Response): Promise<void> {
  const carrito = await carritoServicio.obtenerCarrito(propietarioDe(req));
  res.json(carrito);
}

export async function agregarItem(req: Request, res: Response): Promise<void> {
  const datos = req.body as DatosAgregarItem;
  const carrito = await carritoServicio.agregarItem(propietarioDe(req), datos, req.sesionVisitaId);
  res.status(201).json(carrito);
}

export async function actualizarItem(req: Request, res: Response): Promise<void> {
  const { cantidad } = req.body as DatosActualizarItem;
  const carrito = await carritoServicio.actualizarCantidad(
    propietarioDe(req),
    req.params.id as string,
    cantidad,
  );
  res.json(carrito);
}

export async function eliminarItem(req: Request, res: Response): Promise<void> {
  const carrito = await carritoServicio.eliminarItem(propietarioDe(req), req.params.id as string);
  res.json(carrito);
}

export async function aplicarCupon(req: Request, res: Response): Promise<void> {
  const { codigo } = req.body as DatosAplicarCupon;
  const carrito = await carritoServicio.aplicarCupon(
    propietarioDe(req),
    codigo,
    req.sesionVisitaId,
  );
  res.json(carrito);
}

export async function quitarCupon(req: Request, res: Response): Promise<void> {
  const carrito = await carritoServicio.quitarCupon(propietarioDe(req));
  res.json(carrito);
}
