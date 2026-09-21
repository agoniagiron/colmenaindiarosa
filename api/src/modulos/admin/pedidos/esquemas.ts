import { z } from 'zod';

const ESTADOS_PEDIDO = [
  'esperandoPago',
  'pagoRechazado',
  'pagado',
  'enPreparacion',
  'despachado',
  'entregado',
  'cancelado',
  'reembolsado',
] as const;

// 'YYYY-MM-DD', día calendario en Bogotá — misma convención que
// modulos/analitica/esquemasAdmin.ts (lib/fechasReporte.ts).
const esquemaFecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Se espera una fecha YYYY-MM-DD');

export const esquemaQueryListado = z
  .object({
    estado: z.enum(ESTADOS_PEDIDO).optional(),
    desde: esquemaFecha.optional(),
    hasta: esquemaFecha.optional(),
    buscar: z.string().trim().min(1).optional(),
    pagina: z.coerce.number().int().positive().default(1),
    porPagina: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine((datos) => (datos.desde && datos.hasta ? datos.desde <= datos.hasta : true), {
    message: '"desde" no puede ser posterior a "hasta"',
  });

export const esquemaBodyEstado = z.object({
  estado: z.enum(ESTADOS_PEDIDO),
  nota: z.string().trim().min(1).optional(),
});

export const esquemaBodyEnvio = z
  .object({
    transportadora: z.string().trim().min(1).optional(),
    numeroGuia: z.string().trim().min(1).optional(),
    urlSeguimiento: z.string().trim().url().optional(),
  })
  .refine((datos) => Object.values(datos).some((v) => v !== undefined), {
    message: 'Debes enviar al menos un campo de envío',
  });

// El motivo puntual (texto libre del admin) y el tipo (categoría fija, ver
// punto 3 del ajuste al plan: no es total/parcial, eso ya lo dice el
// monto — es por qué se reembolsa).
const TIPOS_REEMBOLSO = ['retracto', 'defecto', 'no_disponible'] as const;

export const esquemaBodyReembolso = z.object({
  pagoId: z.string().uuid(),
  monto: z.coerce.number().int().positive(),
  tipo: z.enum(TIPOS_REEMBOLSO),
  motivo: z.string().trim().min(1),
});

export type QueryListadoPedidos = z.infer<typeof esquemaQueryListado>;
export type BodyEstado = z.infer<typeof esquemaBodyEstado>;
export type BodyEnvio = z.infer<typeof esquemaBodyEnvio>;
export type BodyReembolso = z.infer<typeof esquemaBodyReembolso>;
export type TipoReembolso = (typeof TIPOS_REEMBOLSO)[number];
