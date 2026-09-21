import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';

// Estructura del evento que manda Wompi (Eventos/Webhooks). No tipamos todo
// el payload: solo lo que hace falta para validar la firma y despachar el
// procesamiento.
export interface EventoWebhookWompi {
  event: string;
  data: Record<string, unknown>;
  environment?: string;
  signature?: {
    properties?: string[];
    checksum?: string;
  };
  timestamp?: number;
  sent_at?: string;
}

function leerPropiedad(objeto: unknown, ruta: string): unknown {
  return ruta.split('.').reduce<unknown>((actual, clave) => {
    if (actual && typeof actual === 'object' && clave in actual) {
      return (actual as Record<string, unknown>)[clave];
    }
    return undefined;
  }, objeto);
}

// Checksum de Wompi: SHA-256 de la concatenación, en orden, de los valores
// de signature.properties (leídos de `data` por ruta con puntos), más el
// timestamp del evento, más WOMPI_SECRETO_EVENTOS. Pendiente de confirmar
// contra un webhook real de sandbox una vez haya credenciales de Wompi.
export function validarFirmaWebhook(evento: EventoWebhookWompi): boolean {
  const propiedades = evento.signature?.properties;
  const checksumRecibido = evento.signature?.checksum;

  if (!propiedades || propiedades.length === 0 || !checksumRecibido || !evento.timestamp) {
    return false;
  }

  const valores = propiedades.map((ruta) => String(leerPropiedad(evento.data, ruta) ?? ''));
  const cadena = `${valores.join('')}${evento.timestamp}${env.WOMPI_SECRETO_EVENTOS}`;
  const checksumCalculado = createHash('sha256').update(cadena).digest('hex');

  return checksumCalculado.toLowerCase() === checksumRecibido.toLowerCase();
}
