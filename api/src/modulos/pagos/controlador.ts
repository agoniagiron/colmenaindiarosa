import type { Request, Response } from 'express';
import * as pagosServicio from './servicio.js';

// Wompi reintenta mientras no reciba 200. Por eso:
//  - 200 cuando el evento se procesó o no había nada que hacer (firma
//    inválida, referencia desconocida, reenvío de algo ya procesado):
//    reintentar no ayuda.
//  - 503 cuando otro envío del mismo evento lo está procesando ahora: el
//    próximo reintento lo encuentra procesado, o lo retoma si se colgó.
//  - 500 cuando el procesamiento falló: el error quedó en el evento y el
//    reintento lo retoma. Un pago aprobado no puede quedar sin procesar por
//    haber respondido 200 a un fallo.
export async function recibirWebhook(req: Request, res: Response): Promise<void> {
  try {
    await pagosServicio.procesarWebhook(req.body);
  } catch (error) {
    if (error instanceof pagosServicio.ErrorEventoEnProceso) {
      req.log?.info('Webhook de Wompi: el evento ya se está procesando');
      res.status(503).json({ ok: false });
      return;
    }
    req.log?.error({ err: error }, 'Error procesando webhook de Wompi');
    res.status(500).json({ ok: false });
    return;
  }
  res.status(200).json({ ok: true });
}
