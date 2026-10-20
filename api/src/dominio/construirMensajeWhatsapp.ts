// Movido desde web/src/dominio/construirMensajeWhatsapp.ts. Cambió el uso:
// antes lo armaba el cliente para escribirle a la tienda antes de pagar;
// ahora lo arma el servidor para notificar a la tienda cuando el webhook
// confirma un pago. Por eso los datos de cada línea vienen de pedido_item
// (copia histórica), no del catálogo vivo, y cambió la frase de cierre.

import { formatearPesos } from '../lib/formatearPesos.js';
import type { TotalesCarrito } from './calcularTotales.js';

// Solo los cuatro montos: este mensaje nunca necesitó saber cuál de los
// dos descuentos ganó (ver dominio/calcularTotales.ts), así que no hace
// falta que quien lo arme fabrique esos campos.
type TotalesParaMensaje = Pick<TotalesCarrito, 'subtotal' | 'descuento' | 'envio' | 'total'>;

export interface LineaParaMensaje {
  // "HANNAH — Rosa / 14 / …", de describirLinea (para una línea de pedido,
  // lib/lineaPedido.ts: describirItemPedido).
  descripcion: string;
  precioUnitario: number;
  cantidad: number;
}

export interface DatosMensajeWhatsapp {
  numeroPedido: string;
  nombreCliente?: string;
  lineas: LineaParaMensaje[];
  cuponCodigo?: string | null;
  totales: TotalesParaMensaje;
}

// El texto de la línea es el mismo que ven la clienta y el panel.
function bloqueItem(linea: LineaParaMensaje, indice: number): string {
  const subtotalLinea = linea.precioUnitario * linea.cantidad;
  const encabezado = `${indice + 1}. ${linea.descripcion}`;
  const cantidadPrecio = `\n   ${linea.cantidad} x ${formatearPesos(linea.precioUnitario)} = ${formatearPesos(subtotalLinea)}`;
  return `${encabezado}${cantidadPrecio}`;
}

export function construirMensajeWhatsapp({
  numeroPedido,
  nombreCliente,
  lineas,
  cuponCodigo,
  totales,
}: DatosMensajeWhatsapp): string {
  const cliente = nombreCliente?.trim() ? nombreCliente.trim() : 'Invitado';

  const lineasDescuento =
    totales.descuento > 0
      ? [
          `Descuento${cuponCodigo ? ` (${cuponCodigo})` : ''}: -${formatearPesos(totales.descuento)}`,
        ]
      : [];

  const envioTexto = totales.envio === 0 ? 'Gratis' : formatearPesos(totales.envio);

  const lineasMensaje = [
    `*Pedido ${numeroPedido} — India Rosa*`,
    `Cliente: ${cliente}`,
    '',
    lineas.map((linea, indice) => bloqueItem(linea, indice)).join('\n'),
    '',
    `Subtotal: ${formatearPesos(totales.subtotal)}`,
    ...lineasDescuento,
    `Envío: ${envioTexto}`,
    `*Total a pagar: ${formatearPesos(totales.total)}*`,
    '',
    'Pedido pagado. Confirmar despacho.',
  ];

  return lineasMensaje.join('\n');
}
