import { Router } from 'express';
import { validar } from '../../middleware/validar.js';
import {
  obtenerCategorias,
  obtenerFacetas,
  obtenerProductoDetalle,
  obtenerProductoRelacionados,
  obtenerProductos,
} from './controlador.js';
import { esquemaFiltrosProducto, esquemaParamsSlug, esquemaQueryProductos } from './esquemas.js';

export const rutasCatalogo = Router();

rutasCatalogo.get('/categorias', obtenerCategorias);

rutasCatalogo.get('/productos', validar({ query: esquemaQueryProductos }), obtenerProductos);

// Antes de /productos/:slug para que Express no confunda "facetas" con un slug.
rutasCatalogo.get('/productos/facetas', validar({ query: esquemaFiltrosProducto }), obtenerFacetas);

rutasCatalogo.get(
  '/productos/:slug/relacionados',
  validar({ params: esquemaParamsSlug }),
  obtenerProductoRelacionados,
);

rutasCatalogo.get(
  '/productos/:slug',
  validar({ params: esquemaParamsSlug }),
  obtenerProductoDetalle,
);
