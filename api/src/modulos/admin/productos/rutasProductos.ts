import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { ErrorApi } from '../../../lib/errorApi.js';
import { requierePermiso } from '../../../middleware/requiereAuthAdmin.js';
import { validar } from '../../../middleware/validar.js';
import * as controlador from './controlador.js';
import * as controladorImagenes from './controladorImagenes.js';
import {
  esquemaBodyCrearProducto,
  esquemaBodyCrearVariante,
  esquemaBodyEditarProducto,
  esquemaBodyEstadoProducto,
  esquemaBodyPreciosProducto,
  esquemaQueryListado,
} from './esquemas.js';
import type { BodyEstadoProducto } from './esquemas.js';
import {
  esquemaBodyCrearImagen,
  esquemaBodyFirmarImagen,
  esquemaBodyOrdenImagenes,
} from './esquemasImagenes.js';

// Montado en app.ts con requiereAuthAdmin + requierePermiso('productos.ver')
// a nivel de prefijo (/api/admin/productos): cubre las lecturas. Las
// mutaciones agregan acá el permiso específico que corresponda.
export const rutasAdminProductos = Router();

rutasAdminProductos.get('/', validar({ query: esquemaQueryListado }), controlador.listar);
rutasAdminProductos.get('/:id', controlador.obtenerDetalle);

rutasAdminProductos.post(
  '/',
  requierePermiso('productos.crear'),
  validar({ body: esquemaBodyCrearProducto }),
  controlador.crear,
);

rutasAdminProductos.patch(
  '/:id',
  requierePermiso('productos.editar'),
  validar({ body: esquemaBodyEditarProducto }),
  controlador.editar,
);

// El permiso depende del estado DESTINO (dato ya validado del body), no
// del estado actual del producto (eso requeriría leer la base antes de
// poder decidir el permiso, y acá alcanza con lo que ya llegó validado):
// archivar pide el permiso específico, cualquier otro cambio de estado
// (incluyendo publicar) pide el de editar.
function requierePermisoEstado(req: Request, _res: Response, next: NextFunction): void {
  const datos = req.body as BodyEstadoProducto;
  const clave = datos.estado === 'archivado' ? 'productos.archivar' : 'productos.editar';
  if (!req.usuarioAdmin!.permisos.has(clave)) {
    throw ErrorApi.sinPermiso();
  }
  next();
}

rutasAdminProductos.patch(
  '/:id/estado',
  validar({ body: esquemaBodyEstadoProducto }),
  requierePermisoEstado,
  controlador.cambiarEstado,
);

// Crear una variante da de alta un SKU y su stock: mismo permiso que dar
// de alta un producto, no el de solo editar textos.
rutasAdminProductos.post(
  '/:id/variantes',
  requierePermiso('productos.crear'),
  validar({ body: esquemaBodyCrearVariante }),
  controlador.crearVariante,
);

rutasAdminProductos.post(
  '/:id/precios',
  requierePermiso('productos.precios'),
  validar({ body: esquemaBodyPreciosProducto }),
  controlador.cambiarPreciosProducto,
);

rutasAdminProductos.post(
  '/:id/imagenes/firmar',
  requierePermiso('productos.imagenes'),
  validar({ body: esquemaBodyFirmarImagen }),
  controladorImagenes.firmar,
);

rutasAdminProductos.post(
  '/:id/imagenes',
  requierePermiso('productos.imagenes'),
  validar({ body: esquemaBodyCrearImagen }),
  controladorImagenes.crear,
);

rutasAdminProductos.patch(
  '/:id/imagenes/orden',
  requierePermiso('productos.imagenes'),
  validar({ body: esquemaBodyOrdenImagenes }),
  controladorImagenes.reordenar,
);
