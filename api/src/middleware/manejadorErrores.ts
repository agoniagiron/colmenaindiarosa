import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ErrorApi } from '../lib/errorApi.js';

export function rutaNoEncontrada(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      codigo: 'ruta_no_encontrada',
      mensaje: `No existe la ruta ${req.method} ${req.originalUrl}`,
    },
  });
}

export function manejadorErrores(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof ErrorApi) {
    res.status(err.estadoHttp).json({
      error: {
        codigo: err.codigo,
        mensaje: err.message,
        ...(err.detalles !== undefined ? { detalles: err.detalles } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        codigo: 'peticion_invalida',
        mensaje: 'Los datos enviados no son válidos',
        detalles: err.issues,
      },
    });
    return;
  }

  req.log?.error({ err }, 'Error no controlado');
  res.status(500).json({
    error: {
      codigo: 'error_interno',
      mensaje: 'Error interno del servidor',
    },
  });
}
