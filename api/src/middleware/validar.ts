import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ErrorValidacion } from '../lib/erroresValidacion.js';

interface EsquemasValidacion {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

// Si los datos no pasan, el error llega al manejador central como
// ErrorValidacion, con la entrada que lo provocó: así la respuesta puede
// decir qué campo falta y cuál vino mal (ver lib/erroresValidacion.ts).
function parsear<T>(esquema: ZodType<T>, entrada: unknown): T {
  const resultado = esquema.safeParse(entrada);
  if (!resultado.success) {
    throw new ErrorValidacion(resultado.error, entrada);
  }
  return resultado.data;
}

export function validar(esquemas: EsquemasValidacion) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (esquemas.body) {
      req.body = parsear(esquemas.body, req.body);
    }
    if (esquemas.params) {
      req.params = parsear(esquemas.params, req.params) as typeof req.params;
    }
    if (esquemas.query) {
      // En Express 5, req.query es de solo lectura (getter sobre la URL);
      // el resultado validado se expone aparte para que los controladores
      // lean datos ya parseados y con los tipos correctos.
      req.queryValidada = parsear(esquemas.query, req.query);
    }
    next();
  };
}
