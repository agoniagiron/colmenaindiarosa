import { Router } from 'express';
import { validar } from '../../middleware/validar.js';
import { registrarEvento } from './controlador.js';
import { esquemaRegistrarEvento } from './esquemas.js';

// Montado en app.ts detrás de sesionVisita (necesita el sesionId).
export const rutasAnalitica = Router();

rutasAnalitica.post('/evento', validar({ body: esquemaRegistrarEvento }), registrarEvento);
