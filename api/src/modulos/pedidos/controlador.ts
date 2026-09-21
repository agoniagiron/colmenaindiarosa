import type { Request, Response } from 'express';
import * as pedidosServicio from './servicio.js';
import type { DatosIniciarCheckout } from './esquemas.js';

export async function iniciarCheckout(req: Request, res: Response): Promise<void> {
  const datos = req.body as DatosIniciarCheckout;
  const resultado = await pedidosServicio.iniciarCheckout(req.usuario!.id, datos);
  res.status(201).json(resultado);
}

export async function listarPedidos(req: Request, res: Response): Promise<void> {
  const pedidos = await pedidosServicio.listarPedidosUsuario(req.usuario!.id);
  res.json(pedidos);
}

export async function obtenerPedido(req: Request, res: Response): Promise<void> {
  const { numero } = req.params;
  const pedido = await pedidosServicio.obtenerPedidoDelUsuario(req.usuario!.id, numero as string);
  res.json(pedido);
}

export async function obtenerEstadoPedido(req: Request, res: Response): Promise<void> {
  const { numero } = req.params;
  const estado = await pedidosServicio.obtenerEstadoPedido(req.usuario!.id, numero as string);
  res.json(estado);
}
