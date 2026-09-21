import { Router } from 'express';
import { obtenerPromociones } from './controlador.js';

export const rutasPromociones = Router();

rutasPromociones.get('/', obtenerPromociones);
