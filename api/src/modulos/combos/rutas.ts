import { Router } from 'express';
import { obtenerCombo, obtenerCombos } from './controlador.js';

export const rutasCombos = Router();

rutasCombos.get('/', obtenerCombos);
rutasCombos.get('/:slug', obtenerCombo);
