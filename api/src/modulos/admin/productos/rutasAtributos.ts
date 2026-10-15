import { Router } from 'express';
import { requierePermiso } from '../../../middleware/requiereAuthAdmin.js';
import { validar } from '../../../middleware/validar.js';
import * as controlador from './controlador.js';
import {
  esquemaBodyActivoValor,
  esquemaBodyConfiguracionCategoria,
  esquemaBodyCrearValorAtributo,
  esquemaParamsValor,
  esquemaQueryAtributos,
} from './esquemas.js';

// Montado en app.ts con requiereAuthAdmin + requierePermiso('productos.ver').
export const rutasAdminAtributos = Router();

rutasAdminAtributos.get(
  '/',
  validar({ query: esquemaQueryAtributos }),
  controlador.listarAtributos,
);

// Crear un valor y habilitarlo en categorías, en el mismo paso.
rutasAdminAtributos.post(
  '/',
  requierePermiso('productos.crear'),
  validar({ body: esquemaBodyCrearValorAtributo }),
  controlador.crearValorAtributo,
);

// Activar o desactivar un valor. Cambia lo que se ofrece en todo el
// catálogo: es configuración, productos.editar (igual que el editor de
// categorías). Un permiso menor no deshace lo que decidió uno mayor.
rutasAdminAtributos.patch(
  '/valores/:valorId',
  requierePermiso('productos.editar'),
  validar({ params: esquemaParamsValor, body: esquemaBodyActivoValor }),
  controlador.cambiarActivoValor,
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
