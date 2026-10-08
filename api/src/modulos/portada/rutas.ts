import { Router } from 'express';
import { obtenerHeroe } from './controlador.js';

export const rutasPortada = Router();

rutasPortada.get('/', obtenerHeroe);
