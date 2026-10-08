// Cliente HTTP para api/src/modulos/cuenta (direcciones de envío).

import { BASE_URL_API } from '../datos/urlApi.ts';

const BASE_URL = `${BASE_URL_API}/api/cuenta`;

export class ErrorCuenta extends Error {
  readonly estadoHttp: number;

  constructor(estadoHttp: number, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorCuenta';
    this.estadoHttp = estadoHttp;
  }
}

export interface DireccionApi {
  id: string;
  etiqueta: string | null;
  nombreRecibe: string;
  telefono: string;
  departamento: string;
  ciudad: string;
  direccion: string;
  complemento: string | null;
  esPrincipal: boolean;
}

export interface DatosDireccion {
  etiqueta?: string;
  nombreRecibe: string;
  telefono: string;
  departamento: string;
  ciudad: string;
  direccion: string;
  complemento?: string;
  esPrincipal?: boolean;
}

async function solicitar<T>(
  ruta: string,
  accessToken: string | null,
  opciones: RequestInit = {},
): Promise<T> {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    ...opciones,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...opciones.headers,
    },
  });

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: { mensaje?: string };
    } | null;
    throw new ErrorCuenta(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
    );
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

// Usada también solo-lectura por el checkout, para precargar la dirección
// principal si existe. No falla ruidosamente: sin sesión o sin conexión,
// simplemente no hay nada que precargar.
export async function listarDirecciones(accessToken: string | null): Promise<DireccionApi[]> {
  try {
    return await solicitar<DireccionApi[]>('/direcciones', accessToken);
  } catch {
    return [];
  }
}

export function crearDireccion(
  accessToken: string | null,
  datos: DatosDireccion,
): Promise<DireccionApi> {
  return solicitar('/direcciones', accessToken, { method: 'POST', body: JSON.stringify(datos) });
}

export function actualizarDireccion(
  accessToken: string | null,
  id: string,
  datos: Partial<DatosDireccion>,
): Promise<DireccionApi> {
  return solicitar(`/direcciones/${encodeURIComponent(id)}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function eliminarDireccion(accessToken: string | null, id: string): Promise<void> {
  return solicitar(`/direcciones/${encodeURIComponent(id)}`, accessToken, { method: 'DELETE' });
}
