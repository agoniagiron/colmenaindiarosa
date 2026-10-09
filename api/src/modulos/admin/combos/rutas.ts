import { Router } from 'express';
import { requierePermiso } from '../../../middleware/requiereAuthAdmin.js';
import { validar } from '../../../middleware/validar.js';
import * as controlador from './controlador.js';
import {
  esquemaBodyCrearKit,
  esquemaBodyEditarKit,
  esquemaBodyPrevisualizarKit,
  esquemaQueryBuscarVariantes,
  esquemaQueryListadoKits,
} from './esquemas.js';

// Montado en app.ts con requiereAuthAdmin + requierePermiso('combos.ver')
// a nivel de prefijo (/api/admin/combos): cubre las lecturas. Crear y
// editar (combos.gestionar) lo piden acá, ruta por ruta.
export const rutasAdminCombos = Router();

// Antes de '/:id' por el mismo motivo que catalogo/rutas.ts con
// /productos/facetas: si no, Express toma "variantes"/"previsualizar"
// como un :id.
rutasAdminCombos.get(
  '/variantes',
  validar({ query: esquemaQueryBuscarVariantes }),
  controlador.buscarVariantes,
);
rutasAdminCombos.post(
  '/previsualizar',
  validar({ body: esquemaBodyPrevisualizarKit }),
  controlador.previsualizar,
);

rutasAdminCombos.get('/', validar({ query: esquemaQueryListadoKits }), controlador.listar);
rutasAdminCombos.get('/:id', controlador.obtenerDetalle);

rutasAdminCombos.post(
  '/',
  requierePermiso('combos.gestionar'),
  validar({ body: esquemaBodyCrearKit }),
  controlador.crear,
);

rutasAdminCombos.patch(
  '/:id',
  requierePermiso('combos.gestionar'),
  validar({ body: esquemaBodyEditarKit }),
  controlador.editar,
);
