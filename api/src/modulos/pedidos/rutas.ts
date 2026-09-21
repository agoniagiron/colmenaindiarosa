import { Router } from 'express';
import { validar } from '../../middleware/validar.js';
import {
  iniciarCheckout,
  listarPedidos,
  obtenerEstadoPedido,
  obtenerPedido,
} from './controlador.js';
import { esquemaIniciarCheckout, esquemaParamsNumeroPedido } from './esquemas.js';

// Montadas en app.ts detrás de requiereAuth: el checkout y los pedidos son
// siempre del usuario logueado (ver decisión sobre GET .../estado).
export const rutasCheckout = Router();
rutasCheckout.post('/iniciar', validar({ body: esquemaIniciarCheckout }), iniciarCheckout);

export const rutasPedidos = Router();
rutasPedidos.get('/', listarPedidos);
rutasPedidos.get(
  '/:numero/estado',
  validar({ params: esquemaParamsNumeroPedido }),
  obtenerEstadoPedido,
);
rutasPedidos.get('/:numero', validar({ params: esquemaParamsNumeroPedido }), obtenerPedido);
