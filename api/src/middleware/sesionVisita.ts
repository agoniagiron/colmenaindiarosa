import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

const NOMBRE_COOKIE = 'visitante_id';
const VENTANA_SESION_ACTIVA_MS = 30 * 60 * 1000;
const DURACION_COOKIE_MS = 365 * 24 * 60 * 60 * 1000;

async function resolverOCrearSesion(visitanteId: string): Promise<string> {
  const sesionReciente = await prisma.sesionVisita.findFirst({
    where: {
      visitanteId,
      ultimaActividadEn: { gte: new Date(Date.now() - VENTANA_SESION_ACTIVA_MS) },
    },
    orderBy: { ultimaActividadEn: 'desc' },
    select: { id: true },
  });

  if (sesionReciente) {
    await prisma.sesionVisita.update({
      where: { id: sesionReciente.id },
      data: { ultimaActividadEn: new Date(), paginasVistas: { increment: 1 } },
    });
    return sesionReciente.id;
  }

  const sesionNueva = await prisma.sesionVisita.create({
    data: { visitanteId },
    select: { id: true },
  });
  return sesionNueva.id;
}

// Resuelve (y crea si hace falta) una sesión de visita anónima a partir de
// una cookie de visitante, para poder cumplir la FK obligatoria
// evento_analitica.sesion_id sin pedir autenticación ni carrito.
//
// Las dos consultas que esto dispara (buscar + crear/actualizar) no son
// parte de ninguna respuesta: nada en el camino síncrono de la petición
// depende de que terminen antes de seguir. Por eso se lanzan sin esperar
// (fire-and-forget) y la petición continúa de inmediato — lo peor que
// puede pasar es que req.sesionVisitaId llegue undefined para ESTA
// petición puntual (todo lo que lo consume ya lo trata como opcional:
// carrito usa visitanteId, no sesionVisitaId; analítica y registro de
// búsqueda son no-op sin sesionId), nunca que la petición se vuelva más
// lenta o se caiga por esto.
export function sesionVisita(req: Request, res: Response, next: NextFunction): void {
  let visitanteId = req.cookies?.[NOMBRE_COOKIE] as string | undefined;

  if (!visitanteId) {
    visitanteId = randomUUID();
    res.cookie(NOMBRE_COOKIE, visitanteId, {
      maxAge: DURACION_COOKIE_MS,
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
    });
  }

  req.visitanteId = visitanteId;

  resolverOCrearSesion(visitanteId)
    .then((id) => {
      req.sesionVisitaId = id;
    })
    .catch((error: unknown) => {
      req.log?.error({ err: error }, 'No se pudo resolver la sesión de visita');
    });

  next();
}
