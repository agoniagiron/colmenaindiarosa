import type { NextFunction, Request, Response } from 'express';
import { ErrorApi } from '../lib/errorApi.js';
import { verificarAccessTokenAdmin } from '../lib/jwtAdmin.js';
import { obtenerPermisosEfectivos } from '../lib/permisosAdmin.js';
import { prisma } from '../lib/prisma.js';

export async function requiereAuthAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const encabezado = req.headers.authorization;
  const token = encabezado?.startsWith('Bearer ') ? encabezado.slice('Bearer '.length) : undefined;

  if (!token) {
    throw ErrorApi.noAutenticado();
  }

  let usuarioAdminId: string;
  try {
    usuarioAdminId = verificarAccessTokenAdmin(token).sub;
  } catch {
    throw ErrorApi.noAutenticado('Token inválido o expirado');
  }

  const usuarioAdmin = await prisma.usuarioAdmin.findUnique({
    where: { id: usuarioAdminId },
    select: { id: true, activo: true },
  });
  if (!usuarioAdmin || !usuarioAdmin.activo) {
    throw ErrorApi.noAutenticado();
  }

  req.usuarioAdmin = {
    id: usuarioAdmin.id,
    permisos: await obtenerPermisosEfectivos(usuarioAdmin.id),
  };
  next();
}

// Se monta después de requiereAuthAdmin en la misma ruta.
export function requierePermiso(clave: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.usuarioAdmin) {
      throw ErrorApi.noAutenticado();
    }
    if (!req.usuarioAdmin.permisos.has(clave)) {
      throw ErrorApi.sinPermiso();
    }
    next();
  };
}
