// Cliente HTTP para api/src/modulos/carrito. El backend es la única fuente
// de verdad de precios y totales: este archivo solo tipa y reenvía la
// respuesta, no recalcula nada.

import type { Cupon, LineaCarrito, TotalesCarrito } from '../tipos/index.ts';

const BASE_URL = '/api/carrito';

export class ErrorCarrito extends Error {
  readonly estadoHttp: number;

  constructor(estadoHttp: number, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorCarrito';
    this.estadoHttp = estadoHttp;
  }
}

export interface CarritoApi {
  lineas: LineaCarrito[];
  cupon: Cupon | null;
  totales: TotalesCarrito;
}

async function solicitar(
  ruta: string,
  accessToken: string | null,
  opciones: RequestInit = {},
): Promise<CarritoApi> {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    ...opciones,
    // El carrito de invitado depende de la cookie visitante_id.
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
    throw new ErrorCarrito(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
    );
  }

  return (await respuesta.json()) as CarritoApi;
}

export function obtenerCarrito(accessToken: string | null): Promise<CarritoApi> {
  return solicitar('', accessToken);
}

export function agregarItem(
  accessToken: string | null,
  varianteId: string,
  cantidad: number,
): Promise<CarritoApi> {
  return solicitar('/items', accessToken, {
    method: 'POST',
    body: JSON.stringify({ varianteId, cantidad }),
  });
}

export function agregarCombo(
  accessToken: string | null,
  comboId: string,
  cantidad: number,
): Promise<CarritoApi> {
  return solicitar('/items', accessToken, {
    method: 'POST',
    body: JSON.stringify({ comboId, cantidad }),
  });
}

export function actualizarCantidad(
  accessToken: string | null,
  itemId: string,
  cantidad: number,
): Promise<CarritoApi> {
  return solicitar(`/items/${encodeURIComponent(itemId)}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ cantidad }),
  });
}

export function eliminarItem(accessToken: string | null, itemId: string): Promise<CarritoApi> {
  return solicitar(`/items/${encodeURIComponent(itemId)}`, accessToken, { method: 'DELETE' });
}

export function aplicarCupon(accessToken: string | null, codigo: string): Promise<CarritoApi> {
  return solicitar('/cupon', accessToken, { method: 'POST', body: JSON.stringify({ codigo }) });
}

export function quitarCupon(accessToken: string | null): Promise<CarritoApi> {
  return solicitar('/cupon', accessToken, { method: 'DELETE' });
}
