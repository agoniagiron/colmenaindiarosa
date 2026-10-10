import type { EstadoPedido, MetodoPago } from '../contexto/apiPedidosAdmin.ts';

// Único lugar con las etiquetas/colores de estado_pedido y metodo_pago para
// el panel admin: AdminPedidos.tsx (lista) y AdminPedidoDetalle.tsx
// (detalle) importan de acá, así no se desincronizan entre sí.
export const ETIQUETAS_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  esperandoPago: 'Esperando pago',
  pagoRechazado: 'Pago rechazado',
  pagado: 'Pagado',
  enPreparacion: 'En preparación',
  despachado: 'Despachado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  reembolsado: 'Reembolsado',
};

export const CLASES_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  esperandoPago: 'bg-ambar-luz text-ambar',
  pagoRechazado: 'bg-rosa-palo text-rosa',
  pagado: 'bg-verde-luz text-verde',
  enPreparacion: 'bg-verde-luz text-verde',
  despachado: 'bg-verde-luz text-verde',
  entregado: 'bg-verde-luz text-verde',
  cancelado: 'bg-arena text-texto-secundario',
  reembolsado: 'bg-arena text-texto-secundario',
};

export const ETIQUETAS_METODO_PAGO: Record<MetodoPago, string> = {
  tarjetaCredito: 'Tarjeta de crédito',
  tarjetaDebito: 'Tarjeta débito',
  pse: 'PSE',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  efectivo: 'Efectivo',
  contraentrega: 'Contraentrega',
};

export const ETIQUETAS_TIPO_REEMBOLSO: Record<string, string> = {
  retracto: 'Retracto',
  defecto: 'Producto con defecto',
  no_disponible: 'Producto no disponible',
};
