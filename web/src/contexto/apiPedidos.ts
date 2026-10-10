// Cliente HTTP para api/src/modulos/pedidos del lado de la clienta (sesión
// de cuenta, no la de admin — ver apiPedidosAdmin.ts para esa). iniciarCheckout
// se queda en apiCheckout.ts porque es un paso distinto del flujo (crear el
// pedido), esto es todo lo de consultarlo después: lista en /cuenta, detalle
// con línea de tiempo, y el sondeo de ResultadoPedidoPagina.

import { BASE_URL_API } from '../datos/urlApi.ts';

const BASE_URL = `${BASE_URL_API}/api/pedidos`;

export class ErrorPedidos extends Error {
  readonly estadoHttp: number;
  readonly codigo?: string;
  readonly detalles?: unknown;

  constructor(estadoHttp: number, mensaje: string, codigo?: string, detalles?: unknown) {
    super(mensaje);
    this.name = 'ErrorPedidos';
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
    throw new ErrorPedidos(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
      cuerpo?.error?.codigo,
      cuerpo?.error?.detalles,
    );
  }

  return (await respuesta.json()) as T;
}

export type EstadoPedido =
  | 'esperandoPago'
  | 'pagoRechazado'
  | 'pagado'
  | 'enPreparacion'
  | 'despachado'
  | 'entregado'
  | 'cancelado'
  | 'reembolsado';

export interface PedidoResumen {
  numero: string;
  estado: EstadoPedido;
  subtotal: number;
  descuento: number;
  envio: number;
  total: number;
  creadoEn: string;
}

export function listarPedidos(accessToken: string | null): Promise<PedidoResumen[]> {
  return solicitar('', accessToken);
}

export interface EstadoPedidoResumen {
  numero: string;
  estado: EstadoPedido;
  total: number;
}

export function obtenerEstadoPedido(
  accessToken: string | null,
  numero: string,
): Promise<EstadoPedidoResumen> {
  return solicitar(`/${encodeURIComponent(numero)}/estado`, accessToken);
}

export interface PiezaComboPedido {
  varianteId: string;
  nombreProducto: string;
  sku: string;
  cantidad: number;
}

export interface ItemPedido {
  id: string;
  nombreProducto: string;
  sku: string;
  tipoBase: string | null;
  longitud: string | null;
  colorNombre: string | null;
  colorHex: string | null;
  talla: string | null;
  densidad: string | null;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
  comboId: string | null;
  nombreCombo: string | null;
  detallesCombo: PiezaComboPedido[];
}

export interface HistorialPedido {
  id: string;
  estadoAnterior: EstadoPedido | null;
  estadoNuevo: EstadoPedido;
  creadoEn: string;
}

export interface PedidoDetalle extends PedidoResumen {
  nombreContacto: string;
  telefonoContacto: string;
  correoContacto: string | null;
  envioNombre: string;
  envioTelefono: string;
  envioDepartamento: string;
  envioCiudad: string;
  envioDireccion: string;
  envioComplemento: string | null;
  envioNotas: string | null;
  cuponCodigo: string | null;
  monedaMostrada: string;
  tasaUsdUsada: number | null;
  items: ItemPedido[];
  historial: HistorialPedido[];
}

export function obtenerPedido(accessToken: string | null, numero: string): Promise<PedidoDetalle> {
  return solicitar(`/${encodeURIComponent(numero)}`, accessToken);
}
