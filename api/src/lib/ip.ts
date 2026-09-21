import { createHash } from 'node:crypto';
import type { Request } from 'express';

// Mismo criterio que hashearToken en lib/tokens.ts: no se guarda la IP en
// crudo, solo su hash, y para auditoría alcanza con SHA-256 (no hace
// falta el costo de bcrypt).
export function hashearIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

export function obtenerIpHash(req: Request): string | null {
  const ip = req.ip ?? req.socket.remoteAddress;
  return ip ? hashearIp(ip) : null;
}
