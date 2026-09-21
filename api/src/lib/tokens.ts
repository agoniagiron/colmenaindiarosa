import { createHash, randomBytes } from 'node:crypto';

// Para tokens aleatorios de alta entropía (refresh tokens, verificación de
// correo, recuperación de clave) alcanza con un hash rápido: a diferencia
// de una contraseña, no hay diccionario de fuerza bruta viable contra 32
// bytes aleatorios, así que no hace falta el costo de bcrypt.

export function generarTokenCrudo(): string {
  return randomBytes(32).toString('hex');
}

export function hashearToken(tokenCrudo: string): string {
  return createHash('sha256').update(tokenCrudo).digest('hex');
}
