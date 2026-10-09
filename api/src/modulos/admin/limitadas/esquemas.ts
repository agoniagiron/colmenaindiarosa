import { z } from 'zod';

export const esquemaQueryListadoLimitadas = z.object({
  incluirInactivas: z.coerce.boolean().optional().default(false),
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().positive().max(100).default(50),
});

// unidadesLote nullable a propósito: null significa "sin tope" (una
// edición limitada por fecha, no por cantidad), no un dato que falta.
// Cuando llega, tiene que ser positivo — ver AJUSTE 2 del pedido.
export const esquemaBodyCrearEdicion = z
  .object({
    productoId: z.string().uuid(),
    nombre: z.string().trim().min(1),
    descripcion: z.string().trim().min(1).nullable().optional(),
    unidadesLote: z.coerce.number().int().positive().nullable().optional(),
    mostrarRestantes: z.boolean().optional(),
    desde: z.coerce.date(),
    hasta: z.coerce.date().nullable().optional(),
  })
  .refine((datos) => !datos.hasta || datos.hasta > datos.desde, {
    message: 'La fecha de fin debe ser posterior a la de inicio',
    path: ['hasta'],
  });

// Sin productoId: una edición no cambia de producto una vez creada. Sin
// mínimo de piezas tipo Kits acá — es un solo producto por diseño.
// desde/hasta no se comparan entre sí en este esquema porque una edición
// parcial puede traer solo uno de los dos: esa validación cruzada con el
// valor actual vive en el servicio.
export const esquemaBodyEditarEdicion = z.object({
  nombre: z.string().trim().min(1).optional(),
  descripcion: z.string().trim().min(1).nullable().optional(),
  unidadesLote: z.coerce.number().int().positive().nullable().optional(),
  mostrarRestantes: z.boolean().optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().nullable().optional(),
  // No hay endpoint de borrado (en este proyecto no se borra, se
  // inactiva): "eliminar" en el panel es un PATCH con activa:false, y
  // "reactivar" es el mismo PATCH con activa:true.
  activa: z.boolean().optional(),
});

export type QueryListadoLimitadas = z.infer<typeof esquemaQueryListadoLimitadas>;
export type BodyCrearEdicion = z.infer<typeof esquemaBodyCrearEdicion>;
export type BodyEditarEdicion = z.infer<typeof esquemaBodyEditarEdicion>;
