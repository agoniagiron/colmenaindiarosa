// Cliente HTTP para api/src/modulos/authAdmin. Deliberadamente aparte de
// contexto/apiAuth.ts: son dos sistemas de sesión independientes, con
// cookies, tokens y secretos distintos en el backend. Un token de acá
// nunca sirve contra /api/auth/ ni viceversa.

import { BASE_URL_API } from '../datos/urlApi.ts';

const BASE_URL = `${BASE_URL_API}/api/admin/auth`;

export class ErrorAuthAdmin extends Error {
  readonly estadoHttp: number;

  constructor(estadoHttp: number, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorAuthAdmin';
    this.estadoHttp = estadoHttp;
  }
}

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  correo: string;
  telefono?: string;
  debeCambiarClave: boolean;
  permisos: string[];
}

interface PerfilAdminApi {
  id: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  debeCambiarClave: boolean;
  permisos: string[];
}

function mapearUsuarioAdmin(perfil: PerfilAdminApi): UsuarioAdmin {
  return {
    id: perfil.id,
    nombre: perfil.nombre,
    correo: perfil.correo,
    debeCambiarClave: perfil.debeCambiarClave,
    permisos: perfil.permisos,
    ...(perfil.telefono ? { telefono: perfil.telefono } : {}),
  };
}

async function solicitar<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    ...opciones,
    // Necesario para que /refresh y /logout viajen con la cookie httpOnly
    // refresh_token_admin.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opciones.headers },
  });

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: { mensaje?: string };
    } | null;
    throw new ErrorAuthAdmin(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
    );
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export async function iniciarSesion(
  correo: string,
  clave: string,
): Promise<{ accessToken: string; usuarioAdmin: UsuarioAdmin }> {
  const datos = await solicitar<{ accessToken: string; usuarioAdmin: PerfilAdminApi }>('/login', {
    method: 'POST',
    body: JSON.stringify({ correo, clave }),
  });
  return { accessToken: datos.accessToken, usuarioAdmin: mapearUsuarioAdmin(datos.usuarioAdmin) };
}

export async function refrescarSesion(): Promise<{ accessToken: string }> {
  return solicitar('/refresh', { method: 'POST' });
}

export async function cerrarSesion(): Promise<void> {
  await solicitar('/logout', { method: 'POST' });
}

export async function obtenerYo(accessToken: string): Promise<UsuarioAdmin> {
  const perfil = await solicitar<PerfilAdminApi>('/yo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return mapearUsuarioAdmin(perfil);
}
