import { Router } from 'express';
import { obtenerLimitadas } from './controlador.js';

export const rutasLimitadas = Router();

rutasLimitadas.get('/', obtenerLimitadas);
