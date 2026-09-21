import { Router } from 'express';
import { validar } from '../../middleware/validar.js';
import {
  actualizarDireccion,
  crearDireccion,
  eliminarDireccion,
  listarDirecciones,
} from './controlador.js';
import {
  esquemaActualizarDireccion,
  esquemaCrearDireccion,
  esquemaParamsDireccion,
} from './esquemas.js';

// Montado en app.ts detrás de requiereAuth: todo acá es del usuario logueado.
export const rutasCuenta = Router();

rutasCuenta.get('/direcciones', listarDirecciones);
rutasCuenta.post('/direcciones', validar({ body: esquemaCrearDireccion }), crearDireccion);
rutasCuenta.patch(
  '/direcciones/:id',
  validar({ params: esquemaParamsDireccion, body: esquemaActualizarDireccion }),
  actualizarDireccion,
);
rutasCuenta.delete(
  '/direcciones/:id',
  validar({ params: esquemaParamsDireccion }),
  eliminarDireccion,
);
