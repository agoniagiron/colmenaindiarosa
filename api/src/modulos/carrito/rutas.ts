import { Router } from 'express';
import { intentaAuth } from '../../middleware/intentaAuth.js';
import { validar } from '../../middleware/validar.js';
import {
  actualizarItem,
  agregarItem,
  aplicarCupon,
  eliminarItem,
  obtenerCarrito,
  quitarCupon,
} from './controlador.js';
import {
  esquemaActualizarItem,
  esquemaAgregarItem,
  esquemaAplicarCupon,
  esquemaParamsItem,
} from './esquemas.js';

// Montado en app.ts detrás de sesionVisita (cookie de invitado + analítica).
// El carrito funciona logueado o anónimo, por eso usa intentaAuth y no
// requiereAuth.
export const rutasCarrito = Router();

rutasCarrito.use(intentaAuth);

rutasCarrito.get('/', obtenerCarrito);
rutasCarrito.post('/items', validar({ body: esquemaAgregarItem }), agregarItem);
rutasCarrito.patch(
  '/items/:id',
  validar({ params: esquemaParamsItem, body: esquemaActualizarItem }),
  actualizarItem,
);
rutasCarrito.delete('/items/:id', validar({ params: esquemaParamsItem }), eliminarItem);
rutasCarrito.post('/cupon', validar({ body: esquemaAplicarCupon }), aplicarCupon);
rutasCarrito.delete('/cupon', quitarCupon);
