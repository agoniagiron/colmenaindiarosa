import type { Request, Response } from 'express';
import { obtenerIpHash } from '../../../lib/ip.js';
import * as servicio from './servicio.js';
import type { BodyEnvio, BodyEstado, BodyReembolso, QueryListadoPedidos } from './esquemas.js';

export async function listar(req: Request, res: Response): Promise<void> {
  const query = req.queryValidada as QueryListadoPedidos;
  res.json(await servicio.listarPedidos(query));
}

export async function obtenerResumen(_req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtenerResumenEstados());
}

export async function obtenerDetalle(req: Request, res: Response): Promise<void> {
  const numero = req.params.numero as string;
  res.json(await servicio.obtenerDetallePedido(numero));
}

export async function cambiarEstado(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyEstado;
  const pedido = await servicio.cambiarEstadoPedido(
    id,
    datos,
    req.usuarioAdmin!.id,
    obtenerIpHash(req),
  );
  res.json(pedido);
}

export async function actualizarEnvio(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyEnvio;
  const pedido = await servicio.actualizarEnvioPedido(
    id,
    datos,
    req.usuarioAdmin!.id,
    obtenerIpHash(req),
  );
  res.json(pedido);
}

export async function reembolsar(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const datos = req.body as BodyReembolso;
  const reembolso = await servicio.crearReembolso(
    id,
    datos,
    req.usuarioAdmin!.id,
    obtenerIpHash(req),
  );
  res.status(201).json(reembolso);
}
