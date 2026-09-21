import type { EstadoPedido } from '@prisma/client';
import { ErrorApi } from '../../../lib/errorApi.js';

// Único lugar del backend que sabe qué transición de estado_pedido es
// válida. PATCH /api/admin/pedidos/:id/estado consulta esto en vez de
// repartir ifs por el servicio.
//
// El webhook de Wompi (modulos/pagos/servicio.ts, procesarAprobado /
// procesarRechazado) NO pasa por esta máquina: cambia pedido.estado
// directamente con Prisma. No lo necesita porque no depende de un admin
// autenticado ni de una transición "arbitraria" — solo mueve
// esperandoPago -> pagado o esperandoPago -> pagoRechazado, y su propia
// idempotencia (comparar pago.estado) le alcanza. Si algún día ese webhook
// necesita validar transiciones más raras, revisar ahí, no acá.
const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  esperandoPago: ['pagado', 'pagoRechazado', 'cancelado'],
  // Una clienta con pago rechazado puede reintentar; el webhook del
  // segundo intento confirma directo (no pasa por acá), pero un admin
  // también puede necesitar moverlo a mano si el reintento se coordinó
  // por fuera de Wompi (p. ej. transferencia).
  pagoRechazado: ['pagado', 'cancelado'],
  pagado: ['enPreparacion', 'cancelado'],
  enPreparacion: ['despachado', 'cancelado'],
  despachado: ['entregado', 'cancelado'],
  // Terminal: nunca puede volver a esperandoPago (ni a ningún otro
  // estado salvo cancelado, ver "pagado o posterior" en las consecuencias
  // de inventario).
  entregado: ['cancelado'],
  cancelado: [],
  reembolsado: [],
};

// Estados desde los que cancelar implica devolver stock_actual (ya se
// descontó al aprobarse el pago). Esperando_pago y pago_rechazado quedan
// fuera: ahí el stock nunca se descontó, solo se reservó (o la reserva ya
// se liberó al rechazar el pago).
export const ESTADOS_POSTERIORES_A_PAGADO: readonly EstadoPedido[] = [
  'pagado',
  'enPreparacion',
  'despachado',
  'entregado',
];

export function validarTransicion(actual: EstadoPedido, nuevo: EstadoPedido): void {
  if (actual === nuevo) {
    throw ErrorApi.conflicto(`El pedido ya está en estado "${nuevo}"`);
  }
  if (!TRANSICIONES[actual].includes(nuevo)) {
    throw ErrorApi.conflicto(`No se puede pasar de "${actual}" a "${nuevo}"`);
  }
}

export type ConsecuenciaInventario = 'liberarReserva' | 'devolverStock' | 'ninguna';

export function consecuenciaInventario(
  actual: EstadoPedido,
  nuevo: EstadoPedido,
): ConsecuenciaInventario {
  if (nuevo !== 'cancelado') return 'ninguna';
  if (actual === 'esperandoPago') return 'liberarReserva';
  if (ESTADOS_POSTERIORES_A_PAGADO.includes(actual)) return 'devolverStock';
  // pagoRechazado: la reserva ya se liberó en el webhook al rechazar el pago.
  return 'ninguna';
}
