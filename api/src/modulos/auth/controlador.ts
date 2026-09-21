import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { ErrorApi } from '../../lib/errorApi.js';
import * as authServicio from './servicio.js';
import type {
  DatosLogin,
  DatosRecuperarConfirmar,
  DatosRecuperarSolicitar,
  DatosRegistro,
  DatosVerificarCorreoConfirmar,
} from './esquemas.js';

const NOMBRE_COOKIE_REFRESH = 'refresh_token';
const RUTA_COOKIE_REFRESH = '/api/auth';
const DURACION_COOKIE_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

function opcionesCookieRefresh() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: RUTA_COOKIE_REFRESH,
    maxAge: DURACION_COOKIE_REFRESH_MS,
  };
}

export async function registrar(req: Request, res: Response): Promise<void> {
  const datos = req.body as DatosRegistro;
  const usuario = await authServicio.registrar(datos);
  res.status(201).json(usuario);
}

export async function iniciarSesion(req: Request, res: Response): Promise<void> {
  const datos = req.body as DatosLogin;
  const { accessToken, refreshTokenCrudo, usuario, avisoCarrito } = await authServicio.login(
    datos,
    req.visitanteId,
  );

  res.cookie(NOMBRE_COOKIE_REFRESH, refreshTokenCrudo, opcionesCookieRefresh());
  res.json({ accessToken, usuario, ...(avisoCarrito.length > 0 ? { avisoCarrito } : {}) });
}

export async function refrescar(req: Request, res: Response): Promise<void> {
  const refreshTokenCrudo = req.cookies?.[NOMBRE_COOKIE_REFRESH] as string | undefined;
  if (!refreshTokenCrudo) {
    throw ErrorApi.noAutenticado('No hay sesión activa');
  }

  const resultado = await authServicio.refrescar(refreshTokenCrudo);

  res.cookie(NOMBRE_COOKIE_REFRESH, resultado.refreshTokenCrudo, opcionesCookieRefresh());
  res.json({ accessToken: resultado.accessToken });
}

export async function cerrarSesion(req: Request, res: Response): Promise<void> {
  const refreshTokenCrudo = req.cookies?.[NOMBRE_COOKIE_REFRESH] as string | undefined;
  await authServicio.cerrarSesion(refreshTokenCrudo);
  res.clearCookie(NOMBRE_COOKIE_REFRESH, { path: RUTA_COOKIE_REFRESH });
  res.status(204).send();
}

export async function obtenerYo(req: Request, res: Response): Promise<void> {
  const usuario = await authServicio.obtenerPerfil(req.usuario!.id);
  if (!usuario) {
    throw ErrorApi.noEncontrado('Usuario no encontrado');
  }
  res.json(usuario);
}

export async function solicitarVerificacionCorreo(req: Request, res: Response): Promise<void> {
  await authServicio.solicitarVerificacionCorreo(req.usuario!.id);
  res.json({ ok: true });
}

export async function confirmarVerificacionCorreo(req: Request, res: Response): Promise<void> {
  const { token } = req.body as DatosVerificarCorreoConfirmar;
  await authServicio.confirmarVerificacionCorreo(token);
  res.json({ ok: true });
}

export async function solicitarRecuperacion(req: Request, res: Response): Promise<void> {
  const { correo } = req.body as DatosRecuperarSolicitar;
  await authServicio.solicitarRecuperacion(correo);
  // Siempre 200, exista o no la cuenta: revelarlo es una fuga de información.
  res.json({ ok: true });
}

export async function confirmarRecuperacion(req: Request, res: Response): Promise<void> {
  const { token, claveNueva } = req.body as DatosRecuperarConfirmar;
  await authServicio.confirmarRecuperacion(token, claveNueva);
  res.json({ ok: true });
}
