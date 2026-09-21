export type CodigoErrorHttp = 400 | 401 | 403 | 404 | 409 | 500;

export class ErrorApi extends Error {
  readonly estadoHttp: CodigoErrorHttp;
  readonly codigo: string;
  readonly detalles?: unknown;

  constructor(estadoHttp: CodigoErrorHttp, codigo: string, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estadoHttp = estadoHttp;
    this.codigo = codigo;
    this.detalles = detalles;
  }

  static peticionInvalida(mensaje: string, detalles?: unknown): ErrorApi {
    return new ErrorApi(400, 'peticion_invalida', mensaje, detalles);
  }

  static noAutenticado(mensaje = 'No autenticado'): ErrorApi {
    return new ErrorApi(401, 'no_autenticado', mensaje);
  }

  static sinPermiso(mensaje = 'No tiene permiso para realizar esta acción'): ErrorApi {
    return new ErrorApi(403, 'sin_permiso', mensaje);
  }

  static noEncontrado(mensaje = 'Recurso no encontrado'): ErrorApi {
    return new ErrorApi(404, 'no_encontrado', mensaje);
  }

  static conflicto(mensaje: string, detalles?: unknown): ErrorApi {
    return new ErrorApi(409, 'conflicto', mensaje, detalles);
  }

  static interno(mensaje = 'Error interno del servidor'): ErrorApi {
    return new ErrorApi(500, 'error_interno', mensaje);
  }
}
