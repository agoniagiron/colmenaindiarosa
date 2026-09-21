import { Router } from 'express';
import { requierePermiso } from '../../../middleware/requiereAuthAdmin.js';
import { validar } from '../../../middleware/validar.js';
import * as controlador from './controladorImagenes.js';
import { esquemaBodyEditarImagen } from './esquemasImagenes.js';

// Montado en app.ts con requiereAuthAdmin + requierePermiso('productos.ver').
export const rutasAdminImagenes = Router();

rutasAdminImagenes.patch(
  '/:id',
  requierePermiso('productos.imagenes'),
  validar({ body: esquemaBodyEditarImagen }),
  controlador.editar,
);

rutasAdminImagenes.delete('/:id', requierePermiso('productos.imagenes'), controlador.eliminar);
