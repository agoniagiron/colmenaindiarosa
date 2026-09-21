// Cliente para POST /api/analitica/evento: los 6 eventos de navegación del
// checkout que no tienen una acción de servidor que los dispare. Fire-and-
// forget a propósito: nunca debe bloquear ni romper la UI si falla.

const BASE_URL = '/api/analitica';

export type TipoEventoCliente =
  | 'iniciarCheckout'
  | 'pasoCheckout'
  | 'seleccionarMetodoPago'
  | 'iniciarPago'
  | 'pagoAprobado'
  | 'pagoRechazado';

export function registrarEvento(
  tipo: TipoEventoCliente,
  extra: { pedidoId?: string; ruta?: string; metadatos?: Record<string, unknown> } = {},
): void {
  fetch(`${BASE_URL}/evento`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, ...extra }),
  }).catch(() => {});
}
