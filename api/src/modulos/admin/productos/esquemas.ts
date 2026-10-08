import { z } from 'zod';

const ESTADOS_PUBLICACION = ['borrador', 'publicado', 'archivado'] as const;

export const esquemaQueryListado = z.object({
  categoriaId: z.string().uuid().optional(),
  estado: z.enum(ESTADOS_PUBLICACION).optional(),
  buscar: z.string().trim().min(1).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().positive().max(100).default(20),
});

export const esquemaBodyCrearProducto = z.object({
  nombre: z.string().trim().min(1),
  categoriaId: z.string().uuid(),
  // Si no llega, se genera del nombre (ver generarSlug en servicio.ts).
  slug: z.string().trim().min(1).optional(),
});

export const esquemaBodyEditarProducto = z.object({
  nombre: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  categoriaId: z.string().uuid().optional(),
  descripcionCorta: z.string().trim().max(280).nullable().optional(),
  descripcion: z.string().optional(),
  cuidados: z.string().nullable().optional(),
  envioNotas: z.string().nullable().optional(),
  seoTitulo: z.string().trim().nullable().optional(),
  seoDescripcion: z.string().trim().nullable().optional(),
});

export const esquemaBodyPortadaProducto = z.object({
  destacado: z.boolean(),
  // Ignorado cuando destacado es false. Si destacado es true y no llega,
  // el servicio usa 0 para una fila nueva o conserva el orden actual si ya
  // existía (ver cambiarPortadaProducto en servicio.ts).
  orden: z.coerce.number().int().nonnegative().optional(),
});

export const esquemaBodyEstadoProducto = z.object({
  estado: z.enum(ESTADOS_PUBLICACION),
  // Cuando se despublica/archiva un producto con variantes en un kit
  // vigente, el servicio devuelve 409 con los kits afectados en vez de
  // aplicar el cambio; el panel reintenta con esto en true tras mostrar
  // la advertencia.
  confirmarKitsAfectados: z.boolean().optional().default(false),
});

const esquemaValorAtributoId = z.string().uuid();

export const esquemaBodyCrearVariante = z.object({
  sku: z.string().trim().min(1),
  precio: z.coerce.number().int().positive(),
  precioUsd: z.coerce.number().int().nonnegative().optional(),
  costo: z.coerce.number().int().nonnegative().optional(),
  stockInicial: z.coerce.number().int().nonnegative().default(0),
  puntoReorden: z.coerce.number().int().nonnegative().default(0),
  peso: z.coerce.number().int().nonnegative().optional(),
  valoresAtributo: z.array(esquemaValorAtributoId).default([]),
});

export const esquemaBodyEditarVariante = z.object({
  sku: z.string().trim().min(1).optional(),
  puntoReorden: z.coerce.number().int().nonnegative().optional(),
  peso: z.coerce.number().int().nonnegative().nullable().optional(),
  activa: z.boolean().optional(),
  valoresAtributo: z.array(esquemaValorAtributoId).optional(),
});

export const esquemaBodyPrecioVariante = z.object({
  precio: z.coerce.number().int().positive(),
  // Si no llega, precio_usd queda en null (se calcula con la tasa vigente
  // en la vitrina) — ver comentario en servicio.ts.
  precioUsd: z.coerce.number().int().nonnegative().optional(),
  costo: z.coerce.number().int().nonnegative().optional(),
  motivo: z.string().trim().min(1),
});

export const esquemaBodyPreciosProducto = z.discriminatedUnion('modo', [
  z.object({
    modo: z.literal('porcentaje'),
    // Positivo sube, negativo baja. Ej: 8 = +8%, -5 = -5%.
    porcentaje: z.coerce.number().min(-95).max(500),
    motivo: z.string().trim().min(1),
  }),
  z.object({
    modo: z.literal('precioUnico'),
    precio: z.coerce.number().int().positive(),
    precioUsd: z.coerce.number().int().nonnegative().optional(),
    motivo: z.string().trim().min(1),
  }),
]);

export const esquemaBodyCrearValorAtributo = z.object({
  atributoId: z.string().uuid(),
  valor: z.string().trim().min(1),
  hex: z.string().trim().min(1).nullable().optional(),
});

export type QueryListadoProductos = z.infer<typeof esquemaQueryListado>;
export type BodyCrearProducto = z.infer<typeof esquemaBodyCrearProducto>;
export type BodyEditarProducto = z.infer<typeof esquemaBodyEditarProducto>;
export type BodyEstadoProducto = z.infer<typeof esquemaBodyEstadoProducto>;
export type BodyPortadaProducto = z.infer<typeof esquemaBodyPortadaProducto>;
export type BodyCrearVariante = z.infer<typeof esquemaBodyCrearVariante>;
export type BodyEditarVariante = z.infer<typeof esquemaBodyEditarVariante>;
export type BodyPrecioVariante = z.infer<typeof esquemaBodyPrecioVariante>;
export type BodyPreciosProducto = z.infer<typeof esquemaBodyPreciosProducto>;
export type BodyCrearValorAtributo = z.infer<typeof esquemaBodyCrearValorAtributo>;
