import { Router } from 'express';
import { obtenerCombos } from './controlador.js';

export const rutasCombos = Router();

rutasCombos.get('/', obtenerCombos);
