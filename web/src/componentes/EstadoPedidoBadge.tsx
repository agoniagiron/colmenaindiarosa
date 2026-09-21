import type { EstadoPedido } from '../contexto/apiPedidosAdmin.ts';
import { CLASES_ESTADO_PEDIDO, ETIQUETAS_ESTADO_PEDIDO } from '../dominio/etiquetasPedido.ts';

export function EstadoPedidoBadge({ estado }: { estado: EstadoPedido }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[12px] ${CLASES_ESTADO_PEDIDO[estado]}`}>
      {ETIQUETAS_ESTADO_PEDIDO[estado]}
    </span>
  );
}
