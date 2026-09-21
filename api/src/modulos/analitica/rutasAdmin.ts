import { Router } from 'express';
import { validar } from '../../middleware/validar.js';
import * as controlador from './controladorAdmin.js';
import {
  esquemaQueryBusquedas,
  esquemaQueryCalificaciones,
  esquemaQueryClientas,
  esquemaQueryEmbudo,
  esquemaQueryOrigen,
  esquemaQueryProductos,
  esquemaQueryResumen,
  esquemaQuerySerie,
} from './esquemasAdmin.js';

// Montado en app.ts con requiereAuthAdmin + requierePermiso('reportes.ver')
// a nivel de prefijo (/api/admin/analitica): todos los endpoints acá
// requieren el mismo permiso, no hace falta repetirlo ruta por ruta.
export const rutasAdminAnalitica = Router();

rutasAdminAnalitica.get(
  '/resumen',
  validar({ query: esquemaQueryResumen }),
  controlador.obtenerResumen,
);
rutasAdminAnalitica.get(
  '/embudo',
  validar({ query: esquemaQueryEmbudo }),
  controlador.obtenerEmbudo,
);
rutasAdminAnalitica.get('/serie', validar({ query: esquemaQuerySerie }), controlador.obtenerSerie);
rutasAdminAnalitica.get(
  '/productos',
  validar({ query: esquemaQueryProductos }),
  controlador.obtenerProductos,
);
rutasAdminAnalitica.get(
  '/calificaciones',
  validar({ query: esquemaQueryCalificaciones }),
  controlador.obtenerCalificaciones,
);
rutasAdminAnalitica.get(
  '/origen',
  validar({ query: esquemaQueryOrigen }),
  controlador.obtenerOrigen,
);
rutasAdminAnalitica.get(
  '/busquedas',
  validar({ query: esquemaQueryBusquedas }),
  controlador.obtenerBusquedas,
);
rutasAdminAnalitica.get(
  '/clientas',
  validar({ query: esquemaQueryClientas }),
  controlador.obtenerClientas,
);
