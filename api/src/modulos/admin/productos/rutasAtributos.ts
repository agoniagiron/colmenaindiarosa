import { Router } from 'express';
import { requierePermiso } from '../../../middleware/requiereAuthAdmin.js';
import { validar } from '../../../middleware/validar.js';
import * as controlador from './controlador.js';
import { esquemaBodyCrearValorAtributo } from './esquemas.js';

// Montado en app.ts con requiereAuthAdmin + requierePermiso('productos.ver').
export const rutasAdminAtributos = Router();

rutasAdminAtributos.get('/', controlador.listarAtributos);

rutasAdminAtributos.post(
  '/',
  requierePermiso('productos.crear'),
  validar({ body: esquemaBodyCrearValorAtributo }),
  controlador.crearValorAtributo,
);
