import { Router } from 'express';
import { obtenerSalud } from './controlador.js';

export const rutasSalud = Router();

rutasSalud.get('/', obtenerSalud);
