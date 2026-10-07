import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { ErrorApi } from '../../lib/errorApi.js';
import { obtenerIpHash } from '../../lib/ip.js';
import * as authAdminServicio from './servicio.js';
import type { DatosLoginAdmin } from './esquemas.js';

const NOMBRE_COOKIE_REFRESH = 'refresh_token_admin';
const RUTA_COOKIE_REFRESH = '/api/admin/auth';
const DURACION_COOKIE_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

function opcionesCookieRefresh() {
  // Mismo criterio que la cookie de clientes (ver auth/controlador.ts):
  // en desarrollo lax/sin secure porque comparten localhost, en producción
  // none + secure porque panel y API quedan en dominios distintos.
  const esProduccion = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: esProduccion ? ('none' as const) : ('lax' as const),
    secure: esProduccion,
    path: RUTA_COOKIE_REFRESH,
    maxAge: DURACION_COOKIE_REFRESH_MS,
  };
}

export async function iniciarSesion(req: Request, res: Response): Promise<void> {
  const datos = req.body as DatosLoginAdmin;
  const { accessToken, refreshTokenCrudo, usuarioAdmin } = await authAdminServicio.loginAdmin(
    datos,
    obtenerIpHash(req),
  );

  res.cookie(NOMBRE_COOKIE_REFRESH, refreshTokenCrudo, opcionesCookieRefresh());
  res.json({ accessToken, usuarioAdmin });
}

export async function refrescar(req: Request, res: Response): Promise<void> {
  const refreshTokenCrudo = req.cookies?.[NOMBRE_COOKIE_REFRESH] as string | undefined;
  if (!refreshTokenCrudo) {
    throw ErrorApi.noAutenticado('No hay sesión activa');
  }

  const resultado = await authAdminServicio.refrescarAdmin(refreshTokenCrudo);

  res.cookie(NOMBRE_COOKIE_REFRESH, resultado.refreshTokenCrudo, opcionesCookieRefresh());
  res.json({ accessToken: resultado.accessToken });
}

export async function cerrarSesion(req: Request, res: Response): Promise<void> {
  const refreshTokenCrudo = req.cookies?.[NOMBRE_COOKIE_REFRESH] as string | undefined;
  await authAdminServicio.cerrarSesionAdmin(refreshTokenCrudo);
  res.clearCookie(NOMBRE_COOKIE_REFRESH, { path: RUTA_COOKIE_REFRESH });
  res.status(204).send();
}

export async function obtenerYo(req: Request, res: Response): Promise<void> {
  const usuarioAdmin = await authAdminServicio.obtenerPerfilAdmin(req.usuarioAdmin!.id);
  if (!usuarioAdmin) {
    throw ErrorApi.noEncontrado('Administrador no encontrado');
  }
  res.json(usuarioAdmin);
}
