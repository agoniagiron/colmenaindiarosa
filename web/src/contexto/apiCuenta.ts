// Solo lo que necesita el checkout: precargar la dirección principal si
// existe. El resto del módulo cuenta/direcciones no tiene UI todavía.

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

export async function listarDirecciones(accessToken: string | null): Promise<DireccionApi[]> {
  try {
    const respuesta = await fetch('/api/cuenta/direcciones', {
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!respuesta.ok) return [];
    return (await respuesta.json()) as DireccionApi[];
  } catch {
    return [];
  }
}
