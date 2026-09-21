import type { NextFunction, Request, Response } from 'express';
import { ErrorApi } from '../lib/errorApi.js';
import { verificarAccessToken } from '../lib/jwt.js';

export function requiereAuth(req: Request, _res: Response, next: NextFunction): void {
  const encabezado = req.headers.authorization;
  const token = encabezado?.startsWith('Bearer ') ? encabezado.slice('Bearer '.length) : undefined;

  if (!token) {
    throw ErrorApi.noAutenticado();
  }

  try {
    const payload = verificarAccessToken(token);
    req.usuario = { id: payload.sub };
    next();
  } catch {
    throw ErrorApi.noAutenticado('Token inválido o expirado');
  }
}
