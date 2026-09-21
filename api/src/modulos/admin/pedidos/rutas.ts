import { Router } from 'express';
import { requierePermiso } from '../../../middleware/requiereAuthAdmin.js';
import { validar } from '../../../middleware/validar.js';
import * as controlador from './controlador.js';
import {
  esquemaBodyEnvio,
  esquemaBodyEstado,
  esquemaBodyReembolso,
  esquemaQueryListado,
} from './esquemas.js';

// Montado en app.ts con requiereAuthAdmin + requierePermiso('pedidos.ver')
// a nivel de prefijo (/api/admin/pedidos): eso cubre las lecturas. Las
// mutaciones necesitan permisos más específicos, así que se agregan acá,
// ruta por ruta, encima del de lectura ya aplicado.
export const rutasAdminPedidos = Router();

rutasAdminPedidos.get('/', validar({ query: esquemaQueryListado }), controlador.listar);
rutasAdminPedidos.get('/resumen', controlador.obtenerResumen);
rutasAdminPedidos.get('/:numero', controlador.obtenerDetalle);

rutasAdminPedidos.patch(
  '/:id/estado',
  requierePermiso('pedidos.cambiar_estado'),
  validar({ body: esquemaBodyEstado }),
  controlador.cambiarEstado,
);

rutasAdminPedidos.patch(
  '/:id/envio',
  requierePermiso('pedidos.cambiar_estado'),
  validar({ body: esquemaBodyEnvio }),
  controlador.actualizarEnvio,
);

rutasAdminPedidos.post(
  '/:id/reembolsar',
  requierePermiso('pedidos.reembolsar'),
  validar({ body: esquemaBodyReembolso }),
  controlador.reembolsar,
);
