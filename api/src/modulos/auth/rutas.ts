import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requiereAuth } from '../../middleware/requiereAuth.js';
import { validar } from '../../middleware/validar.js';
import {
  actualizarPerfil,
  cerrarSesion,
  confirmarRecuperacion,
  confirmarVerificacionCorreo,
  iniciarSesion,
  obtenerYo,
  refrescar,
  registrar,
  solicitarRecuperacion,
  solicitarVerificacionCorreo,
} from './controlador.js';
import {
  esquemaActualizarPerfil,
  esquemaLogin,
  esquemaRecuperarConfirmar,
  esquemaRecuperarSolicitar,
  esquemaRegistro,
  esquemaVerificarCorreoConfirmar,
} from './esquemas.js';

export const rutasAuth = Router();

// Más estricto que el límite global: estas rutas son blanco típico de
// fuerza bruta y de spam de correos (login, registro, recuperación).
const limitadorEstricto = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

rutasAuth.post('/registro', limitadorEstricto, validar({ body: esquemaRegistro }), registrar);
rutasAuth.post('/login', limitadorEstricto, validar({ body: esquemaLogin }), iniciarSesion);
rutasAuth.post('/refresh', refrescar);
rutasAuth.post('/logout', cerrarSesion);
rutasAuth.get('/yo', requiereAuth, obtenerYo);
rutasAuth.patch(
  '/perfil',
  requiereAuth,
  validar({ body: esquemaActualizarPerfil }),
  actualizarPerfil,
);

rutasAuth.post('/verificar-correo/solicitar', requiereAuth, solicitarVerificacionCorreo);
rutasAuth.post(
  '/verificar-correo/confirmar',
  validar({ body: esquemaVerificarCorreoConfirmar }),
  confirmarVerificacionCorreo,
);

rutasAuth.post(
  '/recuperar/solicitar',
  limitadorEstricto,
  validar({ body: esquemaRecuperarSolicitar }),
  solicitarRecuperacion,
);
rutasAuth.post(
  '/recuperar/confirmar',
  validar({ body: esquemaRecuperarConfirmar }),
  confirmarRecuperacion,
);
