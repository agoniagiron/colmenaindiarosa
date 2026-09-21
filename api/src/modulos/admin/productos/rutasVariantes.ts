import { Router } from 'express';
import { requierePermiso } from '../../../middleware/requiereAuthAdmin.js';
import { validar } from '../../../middleware/validar.js';
import * as controlador from './controlador.js';
import { esquemaBodyEditarVariante, esquemaBodyPrecioVariante } from './esquemas.js';

// Montado en app.ts con requiereAuthAdmin + requierePermiso('productos.ver').
export const rutasAdminVariantes = Router();

rutasAdminVariantes.patch(
  '/:id',
  requierePermiso('productos.editar'),
  validar({ body: esquemaBodyEditarVariante }),
  controlador.editarVariante,
);

rutasAdminVariantes.patch(
  '/:id/precio',
  requierePermiso('productos.precios'),
  validar({ body: esquemaBodyPrecioVariante }),
  controlador.cambiarPrecioVariante,
);
