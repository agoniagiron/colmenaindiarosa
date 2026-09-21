import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const DURACION_ACCESS_TOKEN_ADMIN = '15m';

// Firma con JWT_SECRET_ADMIN, no con JWT_SECRET: un token de cliente no
// verifica ni siquiera llega a comparar el campo `tipo`, porque la firma
// misma no coincide contra este secreto.
export interface PayloadAccessTokenAdmin {
  sub: string;
  tipo: 'admin';
}

export function firmarAccessTokenAdmin(sub: string): string {
  const payload: PayloadAccessTokenAdmin = { sub, tipo: 'admin' };
  return jwt.sign(payload, env.JWT_SECRET_ADMIN, { expiresIn: DURACION_ACCESS_TOKEN_ADMIN });
}

export function verificarAccessTokenAdmin(token: string): PayloadAccessTokenAdmin {
  const payload = jwt.verify(token, env.JWT_SECRET_ADMIN) as PayloadAccessTokenAdmin;
  if (payload.tipo !== 'admin') {
    throw new Error('Token no es de tipo admin');
  }
  return payload;
}
