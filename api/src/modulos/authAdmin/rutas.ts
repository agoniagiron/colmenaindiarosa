import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requiereAuthAdmin } from '../../middleware/requiereAuthAdmin.js';
import { validar } from '../../middleware/validar.js';
import { cerrarSesion, iniciarSesion, obtenerYo, refrescar } from './controlador.js';
import { esquemaLoginAdmin } from './esquemas.js';

export const rutasAuthAdmin = Router();

// Igual de estricto que /api/auth/login: el panel es un blanco típico de
// fuerza bruta.
const limitadorEstricto = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

rutasAuthAdmin.post(
  '/login',
  limitadorEstricto,
  validar({ body: esquemaLoginAdmin }),
  iniciarSesion,
);
rutasAuthAdmin.post('/refresh', refrescar);
rutasAuthAdmin.post('/logout', cerrarSesion);
rutasAuthAdmin.get('/yo', requiereAuthAdmin, obtenerYo);
