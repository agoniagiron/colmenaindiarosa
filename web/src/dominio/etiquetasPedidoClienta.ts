import type { EstadoPedido } from '../contexto/apiPedidos.ts';

// Etiquetas de estado_pedido para la clienta (/cuenta), a propósito
// separadas de ETIQUETAS_ESTADO_PEDIDO en etiquetasPedido.ts: esa es jerga
// operativa para el panel admin ("Despachado", "Pagado"); esta es tono
// cercano para quien compró (ver TANDA 3).
export const ETIQUETAS_ESTADO_PEDIDO_CLIENTA: Record<EstadoPedido, string> = {
  esperandoPago: 'Pago pendiente',
  pagoRechazado: 'El pago no se pudo confirmar',
  pagado: 'Pago confirmado',
  enPreparacion: 'Preparando tu pedido',
  despachado: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  reembolsado: 'Reembolsado',
};

// El camino feliz, en orden, para la línea de tiempo de
// DetallePedidoClientaPagina. Los demás estados (pagoRechazado, cancelado,
// reembolsado) son salidas de este camino, no un paso más — se muestran
// aparte como aviso, nunca forzados dentro de la fila de pasos.
export const PASOS_CAMINO_FELIZ: readonly EstadoPedido[] = [
  'esperandoPago',
  'pagado',
  'enPreparacion',
  'despachado',
  'entregado',
];

export const ESTADOS_FUERA_DE_CAMINO: readonly EstadoPedido[] = [
  'pagoRechazado',
  'cancelado',
  'reembolsado',
];
