import { env } from '../config/env.js';

export interface CorreoAEnviar {
  para: string;
  asunto: string;
  // Siempre: es lo que leen los clientes de correo que no muestran HTML y
  // lo que se guarda como constancia.
  texto: string;
  html?: string;
  // Misma clave y mismo contenido: Resend no lo vuelve a mandar y devuelve
  // el id del envío original (vale 24 horas). Sirve para repetir sin miedo
  // un envío cuyo resultado no se llegó a saber.
  claveIdempotencia?: string;
}

export interface ResultadoEnvio {
  // Id que devuelve el proveedor; null en la implementación de consola.
  idExterno: string | null;
}

export interface ServicioCorreo {
  enviar(correo: CorreoAEnviar): Promise<ResultadoEnvio>;
}

// El proveedor no aceptó el correo, o no respondió a tiempo. Quien llama
// decide: los correos de cuenta avisan a la persona; las notificaciones de
// pedido lo registran y reintentan.
export class ErrorEnvioCorreo extends Error {
  constructor(
    mensaje: string,
    readonly estadoHttp: number | null,
  ) {
    super(mensaje);
  }
}

const URL_RESEND = 'https://api.resend.com/emails';
// Un proveedor colgado no puede dejar esperando a quien manda (un webhook
// de Wompi, una clienta que pidió recuperar la clave).
const TIEMPO_MAXIMO_MS = 8000;

export class ServicioCorreoResend implements ServicioCorreo {
  constructor(
    private readonly apiKey: string,
    private readonly remitente: string,
    private readonly respuesta: string,
  ) {}

  async enviar(correo: CorreoAEnviar): Promise<ResultadoEnvio> {
    let respuesta: Response;
    try {
      respuesta = await fetch(URL_RESEND, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(correo.claveIdempotencia ? { 'Idempotency-Key': correo.claveIdempotencia } : {}),
        },
        body: JSON.stringify({
          from: this.remitente,
          to: [correo.para],
          reply_to: this.respuesta,
          subject: correo.asunto,
          text: correo.texto,
          ...(correo.html ? { html: correo.html } : {}),
        }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
    } catch (error) {
      const porTiempo = error instanceof Error && error.name === 'TimeoutError';
      throw new ErrorEnvioCorreo(
        porTiempo
          ? `Resend no respondió en ${TIEMPO_MAXIMO_MS / 1000} segundos`
          : `No se pudo conectar con Resend: ${error instanceof Error ? error.message : String(error)}`,
        null,
      );
    }

    const cuerpo = (await respuesta.json().catch(() => null)) as {
      id?: string;
      message?: string;
      name?: string;
    } | null;
    if (!respuesta.ok) {
      throw new ErrorEnvioCorreo(
        `Resend respondió ${respuesta.status}${cuerpo?.name ? ` (${cuerpo.name})` : ''}: ${
          cuerpo?.message ?? 'sin detalle'
        }`,
        respuesta.status,
      );
    }
    return { idExterno: cuerpo?.id ?? null };
  }
}

// Desarrollo y pruebas, sin RESEND_API_KEY: solo se imprime en consola. En
// producción env.ts exige las variables de Resend, así que esto nunca
// corre ahí.
class ServicioCorreoConsola implements ServicioCorreo {
  async enviar(correo: CorreoAEnviar): Promise<ResultadoEnvio> {
    console.log(
      `--- correo (dev) ---\nPara: ${correo.para}\nAsunto: ${correo.asunto}\n\n${correo.texto}\n--------------------`,
    );
    return { idExterno: null };
  }
}

function crearServicioCorreo(): ServicioCorreo {
  if (env.RESEND_API_KEY && env.CORREO_REMITENTE && env.CORREO_RESPUESTA) {
    const remitente = env.CORREO_NOMBRE_REMITENTE
      ? `${env.CORREO_NOMBRE_REMITENTE} <${env.CORREO_REMITENTE}>`
      : env.CORREO_REMITENTE;
    return new ServicioCorreoResend(env.RESEND_API_KEY, remitente, env.CORREO_RESPUESTA);
  }
  return new ServicioCorreoConsola();
}

export const servicioCorreo: ServicioCorreo = crearServicioCorreo();
