import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

interface EsquemasValidacion {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

// Los esquemas de Zod pueden fallar por datos inválidos: dejamos que el
// ZodError llegue al manejador de errores central en vez de atraparlo acá.
export function validar(esquemas: EsquemasValidacion) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (esquemas.body) {
      req.body = esquemas.body.parse(req.body);
    }
    if (esquemas.params) {
      req.params = esquemas.params.parse(req.params) as typeof req.params;
    }
    if (esquemas.query) {
      // En Express 5, req.query es de solo lectura (getter sobre la URL);
      // el resultado validado se expone aparte para que los controladores
      // lean datos ya parseados y con los tipos correctos.
      req.queryValidada = esquemas.query.parse(req.query);
    }
    next();
  };
}
