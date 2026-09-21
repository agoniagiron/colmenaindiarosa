import { Router } from 'express';
import { obtenerConfiguracion } from './controlador.js';

export const rutasConfiguracion = Router();

rutasConfiguracion.get('/', obtenerConfiguracion);
