// Cliente HTTP para api/src/modulos/auth y cuenta. Deliberadamente aparte
// de datos/ (que es el contrato Repositorio de catálogo/carrito): esto es
// autenticación, no datos de catálogo.

import type { Usuario } from '../tipos/index.ts';

const BASE_URL = '/api/auth';

export class ErrorAuth extends Error {
  readonly estadoHttp: number;

  constructor(estadoHttp: number, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorAuth';
    this.estadoHttp = estadoHttp;
  }
}

interface PerfilApi {
  id: string;
  nombre: string;
  apellido: string | null;
  correo: string;
  telefono: string | null;
  correoVerificado: boolean;
  creadoEn: string;
}

function mapearUsuario(perfil: PerfilApi): Usuario {
  return {
    id: perfil.id,
    nombre: perfil.nombre,
    correo: perfil.correo,
    ...(perfil.telefono ? { telefono: perfil.telefono } : {}),
  };
}

async function solicitar<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    ...opciones,
    // Necesario para que /refresh y /logout viajen con la cookie httpOnly
    // del refresh token, aunque sea "mismo origen" vía el proxy de Vite.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opciones.headers },
  });

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: { mensaje?: string };
    } | null;
    throw new ErrorAuth(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
    );
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export interface DatosRegistro {
  nombre: string;
  correo: string;
  clave: string;
  telefono?: string;
  aceptoTerminos: boolean;
  aceptoTratamiento: boolean;
}

export async function registrar(datos: DatosRegistro): Promise<void> {
  await solicitar('/registro', { method: 'POST', body: JSON.stringify(datos) });
}

export async function iniciarSesion(
  correo: string,
  clave: string,
): Promise<{ accessToken: string; usuario: Usuario }> {
  const datos = await solicitar<{ accessToken: string; usuario: PerfilApi }>('/login', {
    method: 'POST',
    body: JSON.stringify({ correo, clave }),
  });
  return { accessToken: datos.accessToken, usuario: mapearUsuario(datos.usuario) };
}

export async function refrescarSesion(): Promise<{ accessToken: string }> {
  return solicitar('/refresh', { method: 'POST' });
}

export async function cerrarSesion(): Promise<void> {
  await solicitar('/logout', { method: 'POST' });
}

export async function obtenerYo(accessToken: string): Promise<Usuario> {
  const perfil = await solicitar<PerfilApi>('/yo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return mapearUsuario(perfil);
}
