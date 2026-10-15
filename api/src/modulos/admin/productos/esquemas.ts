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
  // Solo la parte del modelo (VAL), no el código completo (IR-PEL-VAL):
  // el prefijo sale de la categoría. Formato validado en el servicio con
  // sku.ts, la misma fuente que arma el SKU.
  codigoModelo: z.string().trim().min(1),
});

export const esquemaBodyEditarProducto = z.object({
  nombre: z.string().trim().min(1).optional(),
  codigoModelo: z.string().trim().min(1).optional(),
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

// Sin sku: lo genera el sistema (sku.ts) a partir del código de producto y
// de los códigos de largo y color.
export const esquemaBodyVariantePrincipal = z.object({
  varianteId: esquemaValorAtributoId,
});

export const esquemaBodyCrearVariante = z.object({
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

export const esquemaQueryAtributos = z.object({
  categoriaId: z.string().uuid().optional(),
});

export const esquemaBodyCrearValorAtributo = z.object({
  atributoId: z.string().uuid(),
  valor: z.string().trim().min(1),
  hex: z.string().trim().min(1).nullable().optional(),
  // Obligatorio para longitud y color (va en el SKU); lo valida el servicio.
  codigo: z.string().trim().min(1).optional(),
  // En qué categorías se habilita, en el mismo paso que se crea: un valor
  // creado sin categoría no aparecería en ningún lado.
  categoriaIds: z
    .array(z.string().uuid())
    .min(1, 'Elegí al menos una categoría donde habilitarlo'),
});

// Configuración completa de una categoría. El orden de la lista es el orden
// en que se muestran los atributos (en el panel y en la ficha).
export const esquemaBodyConfiguracionCategoria = z.object({
  atributos: z
    .array(
      z.object({
        atributoId: z.string().uuid(),
        obligatorio: z.boolean(),
        valorIds: z.array(z.string().uuid()),
      }),
    )
    .max(20),
});

// --- Variantes en lote (asistente) ------------------------------------------
// Mismo patrón que kits: previsualizar no guarda nada; crear recibe lo que
// la persona eligió y editó, y el servidor recalcula SKU, existencia y
// validaciones por su cuenta.

const LIMITE_VALORES_LOTE = 40;
const LIMITE_COMBINACIONES_LOTE = 400;

const esquemaLongitudLote = z.object({
  valorId: esquemaValorAtributoId,
  precio: z.coerce.number().int().positive(),
  costo: z.coerce.number().int().nonnegative().optional(),
});

export const esquemaBodyPrevisualizarLote = z.object({
  longitudes: z.array(esquemaLongitudLote).min(1).max(LIMITE_VALORES_LOTE),
  // Vacío = el producto no varía por color: una variante por longitud.
  colores: z.array(esquemaValorAtributoId).max(LIMITE_VALORES_LOTE).default([]),
  // Tipo de base, densidad, talla…: un valor por atributo, igual para
  // todas las combinaciones.
  fijos: z.array(esquemaValorAtributoId).max(LIMITE_VALORES_LOTE).default([]),
});

export const esquemaBodyCrearLote = esquemaBodyPrevisualizarLote.extend({
  // Solo las combinaciones marcadas. stock es obligatorio a propósito:
  // hasta que exista la pantalla de inventario, es la única oportunidad
  // de cargarlo. precio solo llega si se corrigió esa combinación suelta.
  combinaciones: z
    .array(
      z.object({
        longitudId: esquemaValorAtributoId,
        colorId: esquemaValorAtributoId.nullable(),
        precio: z.coerce.number().int().positive().optional(),
        stock: z.coerce.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(LIMITE_COMBINACIONES_LOTE),
});

export type QueryListadoProductos = z.infer<typeof esquemaQueryListado>;
export type BodyPrevisualizarLote = z.infer<typeof esquemaBodyPrevisualizarLote>;
export type BodyCrearLote = z.infer<typeof esquemaBodyCrearLote>;
export type BodyVariantePrincipal = z.infer<typeof esquemaBodyVariantePrincipal>;
export type BodyCrearProducto = z.infer<typeof esquemaBodyCrearProducto>;
export type BodyEditarProducto = z.infer<typeof esquemaBodyEditarProducto>;
export type BodyEstadoProducto = z.infer<typeof esquemaBodyEstadoProducto>;
export type BodyPortadaProducto = z.infer<typeof esquemaBodyPortadaProducto>;
export type BodyCrearVariante = z.infer<typeof esquemaBodyCrearVariante>;
export type BodyEditarVariante = z.infer<typeof esquemaBodyEditarVariante>;
export type BodyPrecioVariante = z.infer<typeof esquemaBodyPrecioVariante>;
export type BodyPreciosProducto = z.infer<typeof esquemaBodyPreciosProducto>;
export type BodyCrearValorAtributo = z.infer<typeof esquemaBodyCrearValorAtributo>;
export type QueryAtributos = z.infer<typeof esquemaQueryAtributos>;
export type BodyConfiguracionCategoria = z.infer<typeof esquemaBodyConfiguracionCategoria>;
