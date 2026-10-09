import { z } from 'zod';

const TIPOS_PROMOCION = [
  'descuentoPorcentaje',
  'descuentoMonto',
  'precioFijo',
  'envioGratis',
  'anuncio',
] as const;
const ALCANCES_PROMOCION = ['global', 'categoria', 'producto', 'variante'] as const;

export const esquemaQueryListadoPromociones = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().positive().max(100).default(20),
});

const esquemaObjetivo = z.object({
  categoriaId: z.string().uuid().optional(),
  productoId: z.string().uuid().optional(),
  varianteId: z.string().uuid().optional(),
});

// Compartido entre crear, editar y la vista previa (misma forma, porque
// la vista previa necesita validar lo mismo antes de mostrar nada): el
// tope de 90% (punto 11) se valida acá porque depende de `tipo`, algo
// que z.object() a secas no puede expresar.
const camposPromocion = {
  tipo: z.enum(TIPOS_PROMOCION),
  valor: z.coerce.number().int().nonnegative().default(0),
  alcance: z.enum(ALCANCES_PROMOCION),
  objetivos: z.array(esquemaObjetivo).default([]),
};

function validarValorYObjetivos(
  datos: { tipo: string; valor: number; alcance: string; objetivos: unknown[] },
  ctx: z.RefinementCtx,
): void {
  if (datos.tipo === 'descuentoPorcentaje' && datos.valor > 90) {
    ctx.addIssue({
      code: 'custom',
      path: ['valor'],
      message: 'Un descuento porcentual no puede superar el 90%',
    });
  }
  if (datos.alcance !== 'global' && datos.objetivos.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['objetivos'],
      message: 'Este alcance necesita al menos un objetivo',
    });
  }
}

export const esquemaBodyPrevisualizar = z
  .object(camposPromocion)
  .superRefine(validarValorYObjetivos);

export const esquemaBodyCrearPromocion = z
  .object({
    nombre: z.string().trim().min(1),
    descripcion: z.string().trim().min(1).nullable().optional(),
    ...camposPromocion,
    prioridad: z.coerce.number().int().default(0),
    acumulable: z.boolean().optional(),
    bannerTitulo: z.string().trim().min(1).nullable().optional(),
    bannerTexto: z.string().trim().min(1).nullable().optional(),
    bannerImagenUrl: z.string().trim().url().nullable().optional(),
    bannerColorFondo: z.string().trim().min(1).nullable().optional(),
    vigenteDesde: z.coerce.date(),
    vigenteHasta: z.coerce.date().nullable().optional(),
  })
  .superRefine(validarValorYObjetivos);

export const esquemaBodyEditarPromocion = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    descripcion: z.string().trim().min(1).nullable().optional(),
    tipo: z.enum(TIPOS_PROMOCION).optional(),
    valor: z.coerce.number().int().nonnegative().optional(),
    alcance: z.enum(ALCANCES_PROMOCION).optional(),
    objetivos: z.array(esquemaObjetivo).optional(),
    prioridad: z.coerce.number().int().optional(),
    acumulable: z.boolean().optional(),
    bannerTitulo: z.string().trim().min(1).nullable().optional(),
    bannerTexto: z.string().trim().min(1).nullable().optional(),
    bannerImagenUrl: z.string().trim().url().nullable().optional(),
    bannerColorFondo: z.string().trim().min(1).nullable().optional(),
    vigenteDesde: z.coerce.date().optional(),
    vigenteHasta: z.coerce.date().nullable().optional(),
    activa: z.boolean().optional(),
  })
  .superRefine((datos, ctx) => {
    if (datos.tipo === 'descuentoPorcentaje' && datos.valor !== undefined && datos.valor > 90) {
      ctx.addIssue({
        code: 'custom',
        path: ['valor'],
        message: 'Un descuento porcentual no puede superar el 90%',
      });
    }
    if (datos.alcance && datos.alcance !== 'global' && datos.objetivos?.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['objetivos'],
        message: 'Este alcance necesita al menos un objetivo',
      });
    }
  });

export type QueryListadoPromociones = z.infer<typeof esquemaQueryListadoPromociones>;
export type BodyPrevisualizar = z.infer<typeof esquemaBodyPrevisualizar>;
export type BodyCrearPromocion = z.infer<typeof esquemaBodyCrearPromocion>;
export type BodyEditarPromocion = z.infer<typeof esquemaBodyEditarPromocion>;
