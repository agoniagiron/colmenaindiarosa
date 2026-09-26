import { z } from 'zod';

export const METODOS_PAGO_CHECKOUT = ['tarjeta', 'pse', 'efectivo'] as const;
export type MetodoPagoCheckout = (typeof METODOS_PAGO_CHECKOUT)[number];

export const esquemaIniciarCheckout = z.object({
  // Generada una sola vez por el frontend al entrar al paso de pago y
  // persistida en sessionStorage: si la misma clave llega dos veces (doble
  // envío, recarga de página, reintento de red), el servidor devuelve el
  // mismo pedido en vez de crear otro o reservar stock de nuevo.
  claveIdempotencia: z.string().trim().min(1, 'Falta la clave de idempotencia'),
  nombreContacto: z.string().trim().min(1, 'El nombre de contacto es obligatorio'),
  telefonoContacto: z.string().trim().min(1, 'El teléfono de contacto es obligatorio'),
  correoContacto: z.string().trim().email('El correo no es válido').optional(),
  envioNombre: z.string().trim().min(1, 'El nombre de quien recibe es obligatorio'),
  envioTelefono: z.string().trim().min(1, 'El teléfono de envío es obligatorio'),
  envioDepartamento: z.string().trim().min(1, 'El departamento es obligatorio'),
  envioCiudad: z.string().trim().min(1, 'La ciudad es obligatoria'),
  envioDireccion: z.string().trim().min(1, 'La dirección es obligatoria'),
  envioComplemento: z.string().trim().min(1).optional(),
  envioNotas: z.string().trim().min(1).optional(),
  metodoPago: z.enum(METODOS_PAGO_CHECKOUT),
  // Qué moneda estaba viendo la clienta al pagar (el cobro real siempre es
  // en COP vía Wompi). Todavía no hay selector en el frontend, por eso el
  // default — lo va a mandar el prompt del selector de moneda.
  monedaMostrada: z.enum(['COP', 'USD']).default('COP'),
});

export type DatosIniciarCheckout = z.infer<typeof esquemaIniciarCheckout>;

export const esquemaParamsNumeroPedido = z.object({
  numero: z.string().trim().min(1, 'Número de pedido inválido'),
});
