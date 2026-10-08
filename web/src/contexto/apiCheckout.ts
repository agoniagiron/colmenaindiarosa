// Cliente HTTP para api/src/modulos/pedidos (checkout + historial). El
// backend es la única fuente de verdad de precios, totales y firma: acá no
// se calcula nada, solo se tipa y reenvía.

import { BASE_URL_API } from '../datos/urlApi.ts';

const BASE_URL = `${BASE_URL_API}/api`;

export class ErrorCheckout extends Error {
  readonly estadoHttp: number;
  readonly codigo?: string;
  readonly detalles?: unknown;

  constructor(estadoHttp: number, mensaje: string, codigo?: string, detalles?: unknown) {
    super(mensaje);
    this.name = 'ErrorCheckout';
    this.estadoHttp = estadoHttp;
    this.codigo = codigo;
    this.detalles = detalles;
  }
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
      error?: { codigo?: string; mensaje?: string; detalles?: unknown };
    } | null;
    throw new ErrorCheckout(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
      cuerpo?.error?.codigo,
      cuerpo?.error?.detalles,
    );
  }

  return (await respuesta.json()) as T;
}

export type MetodoPagoCheckout = 'tarjeta' | 'pse' | 'efectivo';

export interface DatosCheckout {
  // Generada una vez por checkout (ver CheckoutPagina) y persistida en
  // sessionStorage: si esta misma petición se repite (recarga de página,
  // reintento de red), el servidor devuelve el mismo pedido.
  claveIdempotencia: string;
  nombreContacto: string;
  telefonoContacto: string;
  correoContacto?: string;
  envioNombre: string;
  envioTelefono: string;
  envioDepartamento: string;
  envioCiudad: string;
  envioDireccion: string;
  envioComplemento?: string;
  envioNotas?: string;
  metodoPago: MetodoPagoCheckout;
}

export interface ResultadoCheckout {
  numeroPedido: string;
  llavePublica: string;
  referencia: string;
  montoEnCentavos: number;
  moneda: string;
  firma: string;
  urlRedireccion: string;
}

export function iniciarCheckout(
  accessToken: string | null,
  datos: DatosCheckout,
): Promise<ResultadoCheckout> {
  return solicitar('/checkout/iniciar', accessToken, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export interface PedidoResumen {
  numero: string;
  estado: string;
  subtotal: number;
  descuento: number;
  envio: number;
  total: number;
  creadoEn: string;
}

export function listarPedidos(accessToken: string | null): Promise<PedidoResumen[]> {
  return solicitar('/pedidos', accessToken);
}

export interface EstadoPedido {
  numero: string;
  estado: string;
  total: number;
}

export function obtenerEstadoPedido(
  accessToken: string | null,
  numero: string,
): Promise<EstadoPedido> {
  return solicitar(`/pedidos/${encodeURIComponent(numero)}/estado`, accessToken);
}
