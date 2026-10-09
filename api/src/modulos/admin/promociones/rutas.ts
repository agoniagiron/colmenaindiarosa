import { Router } from 'express';
import { requierePermiso } from '../../../middleware/requiereAuthAdmin.js';
import { validar } from '../../../middleware/validar.js';
import * as controlador from './controlador.js';
import {
  esquemaBodyCrearPromocion,
  esquemaBodyEditarPromocion,
  esquemaBodyPrevisualizar,
  esquemaQueryListadoPromociones,
} from './esquemas.js';

// Montado en app.ts con requiereAuthAdmin + requierePermiso('promociones.ver')
// a nivel de prefijo (/api/admin/promociones): cubre las lecturas. Crear
// y editar (promociones.gestionar) lo piden acá, ruta por ruta.
export const rutasAdminPromociones = Router();

// Antes de '/:id': no hay colisión real hoy (no hay ruta '/previsualizar'
// con :id ambiguo), pero se deja la convención del resto del proyecto
// (ver catalogo/rutas.ts, admin/combos/rutas.ts) de declarar las rutas
// fijas antes de las paramétricas.
rutasAdminPromociones.post(
  '/previsualizar',
  validar({ body: esquemaBodyPrevisualizar }),
  controlador.previsualizar,
);

rutasAdminPromociones.get(
  '/',
  validar({ query: esquemaQueryListadoPromociones }),
  controlador.listar,
);
rutasAdminPromociones.get('/:id', controlador.obtenerDetalle);

rutasAdminPromociones.post(
  '/',
  requierePermiso('promociones.gestionar'),
  validar({ body: esquemaBodyCrearPromocion }),
  controlador.crear,
);

rutasAdminPromociones.patch(
  '/:id',
  requierePermiso('promociones.gestionar'),
  validar({ body: esquemaBodyEditarPromocion }),
  controlador.editar,
);
