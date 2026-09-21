import type { NextFunction, Request, Response } from 'express';
import { verificarAccessToken } from '../lib/jwt.js';

// A diferencia de requiereAuth, nunca rechaza la petición: si hay un access
// token válido setea req.usuario, si no sigue como invitado. Lo usa
// modulos/carrito porque el carrito funciona logueado o anónimo.
export function intentaAuth(req: Request, _res: Response, next: NextFunction): void {
  const encabezado = req.headers.authorization;
  const token = encabezado?.startsWith('Bearer ') ? encabezado.slice('Bearer '.length) : undefined;

  if (token) {
    try {
      const payload = verificarAccessToken(token);
      req.usuario = { id: payload.sub };
    } catch {
      // Token inválido o vencido: sigue como invitado en vez de fallar.
    }
  }

  next();
}
