import { prisma } from '../../lib/prisma.js';
import type { RespuestaSalud } from './esquemas.js';

export async function verificarSalud(): Promise<RespuestaSalud> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, baseDatos: 'conectada' };
  } catch {
    return { ok: false, baseDatos: 'error' };
  }
}
