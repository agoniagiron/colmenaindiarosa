import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const DURACION_ACCESS_TOKEN = '15m';

// `tipo` es una segunda barrera además del secreto: aunque JWT_SECRET y
// JWT_SECRET_ADMIN nunca se comparten, este campo deja explícito que un
// payload de cliente no es intercambiable con uno de admin.
export interface PayloadAccessToken {
  sub: string;
  tipo: 'cliente';
}

export function firmarAccessToken(sub: string): string {
  const payload: PayloadAccessToken = { sub, tipo: 'cliente' };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: DURACION_ACCESS_TOKEN });
}

export function verificarAccessToken(token: string): PayloadAccessToken {
  const payload = jwt.verify(token, env.JWT_SECRET) as PayloadAccessToken;
  if (payload.tipo !== 'cliente') {
    throw new Error('Token no es de tipo cliente');
  }
  return payload;
}
