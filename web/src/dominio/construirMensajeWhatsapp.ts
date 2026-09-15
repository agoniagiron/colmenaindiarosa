// Módulo puro: arma el texto exacto que se envía por WhatsApp. No calcula
// totales (llegan ya resueltos por calcularTotales) ni conoce nada de la UI.

import { formatearEspecificacionesVariante } from './formatearEspecificacionesVariante.ts';
import { formatearPesos } from '../utilidades/formatearPesos.ts';
import type { Cupon, LineaCarrito, TotalesCarrito } from '../tipos/index.ts';

export interface DatosMensajeWhatsapp {
  numeroPedido: string;
  nombreCliente?: string;
  lineas: LineaCarrito[];
  cupon?: Cupon | null;
  totales: TotalesCarrito;
}

function bloqueItem(linea: LineaCarrito, indice: number): string {
  const subtotalLinea = linea.precioUnitario * linea.cantidad;
  const encabezado = `${indice + 1}. ${linea.nombreProducto}`;
  // formatearEspecificacionesVariante ya omite los atributos que no existen;
  // si el producto no tiene ninguno, devuelve '' y esta línea se omite.
  const textoEspecificaciones = formatearEspecificacionesVariante(linea);
  const especificaciones = textoEspecificaciones ? `\n   ${textoEspecificaciones}` : '';
  const cantidadPrecio = `\n   ${linea.cantidad} x ${formatearPesos(linea.precioUnitario)} = ${formatearPesos(subtotalLinea)}`;
  return `${encabezado}${especificaciones}${cantidadPrecio}`;
}

export function construirMensajeWhatsapp({
  numeroPedido,
  nombreCliente,
  lineas,
  cupon,
  totales,
}: DatosMensajeWhatsapp): string {
  const cliente = nombreCliente?.trim() ? nombreCliente.trim() : 'Invitado';

  const lineasDescuento =
    totales.descuento > 0
      ? [`Descuento${cupon ? ` (${cupon.codigo})` : ''}: -${formatearPesos(totales.descuento)}`]
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
    'Quiero confirmar disponibilidad y forma de pago.',
  ];

  return lineasMensaje.join('\n');
}
