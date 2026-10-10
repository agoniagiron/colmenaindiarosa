import { env } from '../config/env.js';

export interface ServicioNotificacionTienda {
  notificarPedidoPagado(mensaje: string): Promise<void>;
  // Distinto de notificarPedidoPagado a propósito: ese le dice al local
  // "pedido nuevo, prepará el envío". Este es para un conflicto de plata
  // (ver procesarAprobado en modulos/pagos/servicio.ts) — si usaran el
  // mismo mensaje, alguien podría preparar un envío que no debería salir
  // todavía.
  alertarConflictoPago(mensaje: string): Promise<void>;
}

// Implementación de desarrollo: no hay integración con la API de WhatsApp
// Business todavía, así que solo se imprime en consola (mismo patrón que
// lib/correo.ts). Cuando exista un proveedor real, se reemplaza esta
// implementación sin tocar quien la usa.
class NotificacionTiendaConsola implements ServicioNotificacionTienda {
  async notificarPedidoPagado(mensaje: string): Promise<void> {
    console.log(
      `--- WhatsApp a la tienda (dev) ---\nPara: ${env.NUMERO_WHATSAPP}\n\n${mensaje}\n----------------------------------`,
    );
  }

  async alertarConflictoPago(mensaje: string): Promise<void> {
    console.error(
      `--- ALERTA PARA EL ADMIN (dev) ---\nPara: ${env.NUMERO_WHATSAPP}\n\n${mensaje}\n----------------------------------`,
    );
  }
}

export const servicioNotificacionTienda: ServicioNotificacionTienda =
  new NotificacionTiendaConsola();
