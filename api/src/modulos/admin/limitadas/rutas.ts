import { Router } from 'express';
import { validar } from '../../../middleware/validar.js';
import * as controlador from './controlador.js';
import {
  esquemaBodyCrearEdicion,
  esquemaBodyEditarEdicion,
  esquemaQueryListadoLimitadas,
} from './esquemas.js';

// Montado en app.ts con requiereAuthAdmin + requierePermiso('limitadas.gestionar')
// a nivel de prefijo (/api/admin/limitadas): no hay un permiso '.ver'
// separado para este módulo, así que lecturas y escrituras piden el
// mismo permiso.
export const rutasAdminLimitadas = Router();

rutasAdminLimitadas.get('/', validar({ query: esquemaQueryListadoLimitadas }), controlador.listar);
rutasAdminLimitadas.get('/:id', controlador.obtenerDetalle);

rutasAdminLimitadas.post('/', validar({ body: esquemaBodyCrearEdicion }), controlador.crear);

// Sin ruta DELETE a propósito: no se borra, se desactiva vía PATCH.
rutasAdminLimitadas.patch('/:id', validar({ body: esquemaBodyEditarEdicion }), controlador.editar);
