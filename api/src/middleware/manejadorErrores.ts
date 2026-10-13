import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ErrorApi } from '../lib/errorApi.js';
import {
  camposInvalidos,
  ErrorValidacion,
  mensajeCamposInvalidos,
} from '../lib/erroresValidacion.js';

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

  // ErrorValidacion: lo lanza el middleware validar, con la entrada. Un
  // ZodError suelto puede venir de un .parse() en otro lado, sin entrada.
  if (err instanceof ErrorValidacion || err instanceof ZodError) {
    // Qué campo falló y por qué, nunca los issues crudos de Zod. Queda en el
    // log también: sin esto, un 400 de validación no dejaba ningún rastro
    // del motivo en el servidor.
    const campos =
      err instanceof ErrorValidacion
        ? camposInvalidos(err.errorZod, err.entrada)
        : camposInvalidos(err);
    req.log?.warn({ campos }, 'Validación rechazada');
    res.status(400).json({
      error: {
        codigo: 'peticion_invalida',
        mensaje: mensajeCamposInvalidos(campos),
        detalles: { campos },
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
