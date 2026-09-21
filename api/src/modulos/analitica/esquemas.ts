import { z } from 'zod';

// Solo estos 6: eventos de navegación del checkout que no tienen una
// acción de servidor que los dispare naturalmente (a diferencia de
// vista_producto o agregar_carrito). No es un endpoint abierto para
// cualquier tipo de evento_analitica.
export const TIPOS_EVENTO_CLIENTE = [
  'iniciarCheckout',
  'pasoCheckout',
  'seleccionarMetodoPago',
  'iniciarPago',
  'pagoAprobado',
  'pagoRechazado',
] as const;

export const esquemaRegistrarEvento = z.object({
  tipo: z.enum(TIPOS_EVENTO_CLIENTE),
  pedidoId: z.string().uuid().optional(),
  ruta: z.string().max(500).optional(),
  metadatos: z.record(z.string(), z.unknown()).optional(),
});

export type DatosRegistrarEvento = z.infer<typeof esquemaRegistrarEvento>;
