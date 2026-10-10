// Cliente HTTP para api/src/modulos/admin/pedidos. Mismo patrón que
// apiAnaliticaAdmin.ts (token del panel admin) más las mutaciones al estilo
// de apiCarrito.ts (POST/PATCH con cuerpo JSON).

import { BASE_URL_API } from '../datos/urlApi.ts';

const BASE_URL = `${BASE_URL_API}/api/admin/pedidos`;

export class ErrorPedidosAdmin extends Error {
  readonly estadoHttp: number;
  readonly detalles?: unknown;

  constructor(estadoHttp: number, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.name = 'ErrorPedidosAdmin';
    this.estadoHttp = estadoHttp;
    this.detalles = detalles;
  }
}

async function solicitar<T>(
  ruta: string,
  accessToken: string,
  opciones: RequestInit = {},
): Promise<T> {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...opciones.headers,
    },
  });

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: { mensaje?: string; detalles?: unknown };
    } | null;
    throw new ErrorPedidosAdmin(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
      cuerpo?.error?.detalles,
    );
  }

  if (respuesta.status === 204) return undefined as T;
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

export type MetodoPago =
  'tarjetaCredito' | 'tarjetaDebito' | 'pse' | 'nequi' | 'daviplata' | 'efectivo' | 'contraentrega';

export type EstadoPago =
  | 'iniciado'
  | 'pendiente'
  | 'aprobado'
  | 'rechazado'
  | 'expirado'
  | 'reembolsado'
  // Wompi aprobó el pago, pero el pedido ya no estaba en condiciones de
  // recibirlo (carrera con el vencimiento de la reserva — ver TANDA 1):
  // nunca se marca pagado en silencio, queda acá para que un admin decida.
  | 'requiereRevision';

export type EstadoReembolso = 'solicitado' | 'procesado' | 'rechazado';

export type TipoReembolso = 'retracto' | 'defecto' | 'no_disponible';

export interface FilaPedidoAdmin {
  numero: string;
  creadoEn: string;
  nombreContacto: string;
  telefonoContacto: string;
  articulos: number;
  total: number;
  estado: EstadoPedido;
  metodoPago: MetodoPago | null;
  // true si este pedido tiene al menos un pago en estado requiereRevision,
  // sin importar en qué estado_pedido esté (ver TANDA 1).
  requiereRevision: boolean;
}

export interface Paginacion {
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
}

export interface ListadoPedidos {
  datos: FilaPedidoAdmin[];
  paginacion: Paginacion;
}

export interface FiltrosListadoPedidos {
  estado?: EstadoPedido;
  // Mutuamente excluyente con `estado` (ver servicio.ts en el backend):
  // si viene en true, gana sobre `estado`.
  requiereRevision?: boolean;
  desde?: string;
  hasta?: string;
  buscar?: string;
  pagina?: number;
  porPagina?: number;
}

export function listarPedidos(
  accessToken: string,
  filtros: FiltrosListadoPedidos,
): Promise<ListadoPedidos> {
  const params = new URLSearchParams();
  if (filtros.requiereRevision) params.set('requiereRevision', 'true');
  else if (filtros.estado) params.set('estado', filtros.estado);
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  if (filtros.buscar) params.set('buscar', filtros.buscar);
  params.set('pagina', String(filtros.pagina ?? 1));
  params.set('porPagina', String(filtros.porPagina ?? 20));
  return solicitar(`?${params.toString()}`, accessToken);
}

export type ResumenEstadosPedidos = {
  todos: number;
  esperandoPago: number;
  pagado: number;
  enPreparacion: number;
  despachado: number;
  entregado: number;
  cancelado: number;
  requiereRevision: number;
};

export function obtenerResumenEstados(accessToken: string): Promise<ResumenEstadosPedidos> {
  return solicitar('/resumen', accessToken);
}

export interface DetallePiezaCombo {
  id: string;
  nombreProducto: string;
  sku: string;
  descripcionVariante: string | null;
  cantidad: number;
}

export interface DetalleItemPedido {
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
  detallesCombo: DetallePiezaCombo[];
}

export interface DetalleHistorialPedido {
  id: string;
  estadoAnterior: EstadoPedido | null;
  estadoNuevo: EstadoPedido;
  nota: string | null;
  creadoEn: string;
  usuario: { nombre: string } | null;
}

export interface DetalleReembolso {
  id: string;
  monto: number;
  motivo: string;
  tipo: string;
  estado: EstadoReembolso;
  referenciaExterna: string | null;
  creadoEn: string;
  procesadoEn: string | null;
}

export interface DetallePago {
  id: string;
  pasarela: string;
  referenciaExterna: string | null;
  referenciaInterna: string;
  metodo: MetodoPago;
  estado: EstadoPago;
  monto: number;
  comision: number | null;
  montoNeto: number | null;
  moneda: string;
  ultimosCuatro: string | null;
  franquicia: string | null;
  bancoPse: string | null;
  cuotas: number | null;
  mensajeError: string | null;
  aprobadoEn: string | null;
  rechazadoEn: string | null;
  creadoEn: string;
  reembolsos: DetalleReembolso[];
}

export interface DetalleReservaStock {
  id: string;
  varianteId: string;
  cantidad: number;
  expiraEn: string;
  liberadaEn: string | null;
}

export interface DetallePedido {
  id: string;
  numero: string;
  estado: EstadoPedido;
  // Calculado en el servidor desde maquinaEstados.ts (ver
  // transicionesDisponibles en admin/pedidos/servicio.ts): única fuente de
  // verdad, el <select> de "Cambiar estado" no tiene su propia copia.
  transicionesDisponibles: EstadoPedido[];
  creadoEn: string;
  actualizadoEn: string;
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
  transportadora: string | null;
  numeroGuia: string | null;
  urlSeguimiento: string | null;
  subtotal: number;
  descuento: number;
  envio: number;
  total: number;
  cuponCodigo: string | null;
  pagadoEn: string | null;
  despachadoEn: string | null;
  entregadoEn: string | null;
  canceladoEn: string | null;
  motivoCancelacion: string | null;
  items: DetalleItemPedido[];
  historial: DetalleHistorialPedido[];
  pagos: DetallePago[];
  reservasStock: DetalleReservaStock[];
}

export function obtenerDetallePedido(accessToken: string, numero: string): Promise<DetallePedido> {
  return solicitar(`/${encodeURIComponent(numero)}`, accessToken);
}

export function cambiarEstadoPedido(
  accessToken: string,
  id: string,
  estado: EstadoPedido,
  nota?: string,
): Promise<DetallePedido> {
  return solicitar(`/${encodeURIComponent(id)}/estado`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ estado, nota }),
  });
}

export interface DatosEnvio {
  transportadora?: string;
  numeroGuia?: string;
  urlSeguimiento?: string;
}

export function actualizarEnvioPedido(
  accessToken: string,
  id: string,
  datos: DatosEnvio,
): Promise<DetallePedido> {
  return solicitar(`/${encodeURIComponent(id)}/envio`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export interface DatosReembolso {
  pagoId: string;
  monto: number;
  tipo: TipoReembolso;
  motivo: string;
}

export function crearReembolso(
  accessToken: string,
  id: string,
  datos: DatosReembolso,
): Promise<DetalleReembolso> {
  return solicitar(`/${encodeURIComponent(id)}/reembolsar`, accessToken, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}
