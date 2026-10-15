import { Router } from 'express';
import { requierePermiso } from '../../../middleware/requiereAuthAdmin.js';
import { validar } from '../../../middleware/validar.js';
import * as controlador from './controlador.js';
import {
  esquemaBodyConfiguracionCategoria,
  esquemaBodyCrearValorAtributo,
  esquemaQueryAtributos,
} from './esquemas.js';

// Montado en app.ts con requiereAuthAdmin + requierePermiso('productos.ver').
export const rutasAdminAtributos = Router();

rutasAdminAtributos.get('/', validar({ query: esquemaQueryAtributos }), controlador.listarAtributos);

// Crear un valor y habilitarlo en categorías, en el mismo paso.
rutasAdminAtributos.post(
  '/',
  requierePermiso('productos.crear'),
  validar({ body: esquemaBodyCrearValorAtributo }),
  controlador.crearValorAtributo,
);

// Pantalla de atributos: todos los atributos con sus valores y la
// configuración de cada categoría.
rutasAdminAtributos.get('/configuracion', controlador.obtenerConfiguracionAtributos);

// Reemplaza qué atributos usa una categoría, su orden, si son obligatorios
// y qué valores permite. Es configuración del catálogo: productos.editar.
rutasAdminAtributos.put(
  '/categorias/:categoriaId',
  requierePermiso('productos.editar'),
  validar({ body: esquemaBodyConfiguracionCategoria }),
  controlador.guardarConfiguracionCategoria,
);
