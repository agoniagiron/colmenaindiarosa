import { Router } from 'express';
import { requierePermiso } from '../../../middleware/requiereAuthAdmin.js';
import { validar } from '../../../middleware/validar.js';
import * as controlador from './controladorImagenes.js';
import { esquemaBodyEditarImagenCombo } from './esquemasImagenes.js';

// Montado en app.ts con requiereAuthAdmin + requierePermiso('combos.ver')
// a nivel de prefijo (/api/admin/imagenes-combo) — mismo patrón que
// rutasImagenes.ts de productos. Mutar pide 'combos.gestionar', el mismo
// permiso que ya usa el resto de la sección de kits (no uno nuevo).
export const rutasAdminImagenesCombo = Router();

rutasAdminImagenesCombo.patch(
  '/:id',
  requierePermiso('combos.gestionar'),
  validar({ body: esquemaBodyEditarImagenCombo }),
  controlador.editar,
);

rutasAdminImagenesCombo.delete('/:id', requierePermiso('combos.gestionar'), controlador.eliminar);
