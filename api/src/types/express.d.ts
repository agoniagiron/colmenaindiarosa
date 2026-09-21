import 'express-serve-static-core';

// En Express 5, `req.query` es un getter de solo lectura calculado desde la
// URL: no se puede reasignar con el resultado ya validado por Zod. Se
// expone aparte; cada controlador lo castea al tipo inferido de su esquema.
declare module 'express-serve-static-core' {
  interface Request {
    queryValidada?: unknown;
    // Id de la fila en sesion_visita asociada a la cookie visitante_id de
    // este request; la resuelve middleware/sesionVisita.ts.
    sesionVisitaId?: string;
    // Valor crudo de la cookie visitante_id (identifica el carrito de
    // invitado); la resuelve middleware/sesionVisita.ts.
    visitanteId?: string;
    // Cliente autenticado a partir del access token de auth/; lo resuelve
    // middleware/requiereAuth.ts o middleware/intentaAuth.ts. Todo usuario
    // es cliente: no hay rol en este token.
    usuario?: { id: string };
    // Administrador autenticado a partir del access token de authAdmin/;
    // lo resuelve middleware/requiereAuthAdmin.ts. `permisos` ya trae
    // resueltos los permisos efectivos (usuarioAdminRol + rolPermiso) para
    // que requierePermiso no repita la consulta en cada middleware.
    usuarioAdmin?: { id: string; permisos: Set<string> };
  }
}
