import { Prisma } from '@prisma/client';
import { ErrorApi } from '../../../lib/errorApi.js';
import { prisma } from '../../../lib/prisma.js';
import type { BodyCrearLote, BodyPrevisualizarLote } from './esquemas.js';
import { armarCodigoProducto, armarSkuVariante } from './sku.js';

// Creación de variantes: una sola lógica para la creación individual
// (crearVariante en servicio.ts) y para el asistente en lote. Valida los
// atributos, arma el SKU con sku.ts, y escribe para cada variante la fila
// de historial de precios y el movimiento de inventario del stock inicial.

const SLUG_LONGITUD = 'longitud';
const SLUG_COLOR = 'color';

// Margen para el lote: son unas pocas consultas en bloque (createMany),
// pero contra el pooler de Supabase el default de 5 s queda justo.
const TIMEOUT_TRANSACCION_LOTE_MS = 30_000;

type Cliente = Prisma.TransactionClient;

export interface VarianteNueva {
  valorIds: string[];
  precio: number;
  precioUsd?: number;
  costo?: number;
  stock: number;
  puntoReorden?: number;
  peso?: number;
}

interface ValorResuelto {
  id: string;
  valor: string;
  codigo: string | null;
  hex: string | null;
  orden: number;
  atributoId: string;
  atributoSlug: string;
  atributoNombre: string;
}

export async function obtenerCodigoProducto(tx: Cliente, productoId: string): Promise<string> {
  const producto = await tx.producto.findUnique({
    where: { id: productoId },
    select: { codigoModelo: true, categoria: { select: { nombre: true, codigo: true } } },
  });
  if (!producto) {
    throw ErrorApi.noEncontrado('El producto no existe');
  }
  if (!producto.codigoModelo) {
    throw ErrorApi.conflicto(
      'El producto no tiene código de modelo. Cargalo en la pestaña General antes de crear variantes.',
    );
  }
  if (!producto.categoria.codigo) {
    throw ErrorApi.conflicto(`La categoría ${producto.categoria.nombre} no tiene código.`);
  }
  return armarCodigoProducto(producto.categoria.codigo, producto.codigoModelo);
}

async function resolverValores(
  tx: Cliente,
  valorIds: string[],
): Promise<Map<string, ValorResuelto>> {
  const unicos = [...new Set(valorIds)];
  const filas = await tx.valorAtributo.findMany({
    where: { id: { in: unicos } },
    select: {
      id: true,
      valor: true,
      codigo: true,
      hex: true,
      orden: true,
      atributo: { select: { id: true, slug: true, nombre: true } },
    },
  });
  if (filas.length !== unicos.length) {
    throw ErrorApi.peticionInvalida('Alguno de los valores de atributo elegidos no existe');
  }
  return new Map(
    filas.map((fila) => [
      fila.id,
      {
        id: fila.id,
        valor: fila.valor,
        codigo: fila.codigo,
        hex: fila.hex,
        orden: fila.orden,
        atributoId: fila.atributo.id,
        atributoSlug: fila.atributo.slug,
        atributoNombre: fila.atributo.nombre,
      },
    ]),
  );
}

function codigoObligatorio(valor: ValorResuelto | undefined): string | null {
  if (!valor) return null;
  if (!valor.codigo) {
    throw ErrorApi.peticionInvalida(
      `El valor "${valor.valor}" de ${valor.atributoNombre} no tiene código: hace falta para armar el SKU.`,
    );
  }
  return valor.codigo;
}

function skuDeValores(codigoProducto: string, valores: ValorResuelto[]): string {
  const vistos = new Set<string>();
  for (const valor of valores) {
    if (vistos.has(valor.atributoId)) {
      throw ErrorApi.peticionInvalida(
        `Una variante no puede tener dos valores de ${valor.atributoNombre}`,
      );
    }
    vistos.add(valor.atributoId);
  }
  const largo = valores.find((v) => v.atributoSlug === SLUG_LONGITUD);
  const color = valores.find((v) => v.atributoSlug === SLUG_COLOR);
  return armarSkuVariante(codigoProducto, codigoObligatorio(largo), codigoObligatorio(color));
}

function esColisionSku(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes('sku')
  );
}

function conflictoSkus(skus: string[]): ErrorApi {
  return ErrorApi.conflicto(
    skus.length === 1
      ? `Ya existe una variante con el SKU "${skus[0]}"`
      : `Ya existen variantes con ${skus.length} de estos SKU`,
    { skus },
  );
}

// Núcleo compartido. Corre dentro de la transacción de quien llama: si algo
// falla, no queda ninguna variante a medias. Devuelve los ids en el mismo
// orden que `variantes`.
export async function insertarVariantes(
  tx: Cliente,
  productoId: string,
  codigoProducto: string,
  variantes: VarianteNueva[],
  usuarioAdminId: string,
): Promise<string[]> {
  const valores = await resolverValores(
    tx,
    variantes.flatMap((v) => v.valorIds),
  );

  const preparadas = variantes.map((variante) => ({
    ...variante,
    sku: skuDeValores(
      codigoProducto,
      variante.valorIds.map((id) => valores.get(id)!),
    ),
  }));

  const skus = preparadas.map((p) => p.sku);
  const repetidosEnLote = skus.filter((sku, i) => skus.indexOf(sku) !== i);
  if (repetidosEnLote.length > 0) {
    throw conflictoSkus([...new Set(repetidosEnLote)]);
  }

  const existentes = await tx.varianteProducto.findMany({
    where: { sku: { in: skus } },
    select: { sku: true },
  });
  if (existentes.length > 0) {
    throw conflictoSkus(existentes.map((e) => e.sku));
  }

  let creadas: { id: string; sku: string }[];
  try {
    creadas = await tx.varianteProducto.createManyAndReturn({
      data: preparadas.map((p) => ({
        productoId,
        sku: p.sku,
        precioActual: p.precio,
        precioUsd: p.precioUsd,
        costoActual: p.costo,
        stockActual: p.stock,
        puntoReorden: p.puntoReorden ?? 0,
        peso: p.peso,
      })),
      select: { id: true, sku: true },
    });
  } catch (error) {
    // Otra creación ganó la carrera entre el chequeo de arriba y el insert.
    if (esColisionSku(error)) throw conflictoSkus(skus);
    throw error;
  }
  const idPorSku = new Map(creadas.map((c) => [c.sku, c.id]));
  const ids = preparadas.map((p) => idPorSku.get(p.sku)!);

  const relaciones = preparadas.flatMap((p, i) =>
    p.valorIds.map((valorId) => ({ varianteId: ids[i]!, valorId })),
  );
  if (relaciones.length > 0) {
    await tx.varianteValorAtributo.createMany({ data: relaciones });
  }

  await tx.precioVariante.createMany({
    data: preparadas.map((p, i) => ({
      varianteId: ids[i]!,
      precio: p.precio,
      precioAntes: null,
      costo: p.costo ?? null,
      precioUsd: p.precioUsd ?? null,
      motivo: 'Precio inicial',
      creadoPorId: usuarioAdminId,
    })),
  });

  await tx.movimientoInventario.createMany({
    data: preparadas.map((p, i) => ({
      varianteId: ids[i]!,
      tipo: 'entrada' as const,
      cantidad: p.stock,
      stockResultante: p.stock,
      referenciaTipo: 'variante_creada',
      referenciaId: ids[i]!,
      usuarioId: usuarioAdminId,
      motivo: 'Stock inicial',
    })),
  });

  return ids;
}

// ---------------------------------------------------------------------------
// Asistente en lote
// ---------------------------------------------------------------------------

export interface CombinacionLote {
  longitud: { id: string; valor: string };
  color: { id: string; valor: string; hex: string | null } | null;
  sku: string;
  precio: number;
  costo: number | null;
  // Ya hay una variante con este largo y este color: se salta, no se duplica.
  yaExiste: boolean;
  // El SKU lo usa otra variante (de otro producto, o de este con otros
  // atributos): crear esta combinación daría 409.
  skuOcupado: boolean;
}

function claveCombinacion(longitudId: string, colorId: string | null): string {
  return `${longitudId}:${colorId ?? ''}`;
}

async function armarCombinaciones(
  tx: Cliente,
  productoId: string,
  datos: BodyPrevisualizarLote,
): Promise<{ codigoProducto: string; combinaciones: CombinacionLote[] }> {
  const codigoProducto = await obtenerCodigoProducto(tx, productoId);

  const longitudIds = datos.longitudes.map((l) => l.valorId);
  if (new Set(longitudIds).size !== longitudIds.length) {
    throw ErrorApi.peticionInvalida('Hay una longitud repetida');
  }
  if (new Set(datos.colores).size !== datos.colores.length) {
    throw ErrorApi.peticionInvalida('Hay un color repetido');
  }

  const valores = await resolverValores(tx, [...longitudIds, ...datos.colores, ...datos.fijos]);
  const valor = (id: string) => valores.get(id)!;

  for (const id of longitudIds) {
    if (valor(id).atributoSlug !== SLUG_LONGITUD) {
      throw ErrorApi.peticionInvalida(`"${valor(id).valor}" no es una longitud`);
    }
  }
  for (const id of datos.colores) {
    if (valor(id).atributoSlug !== SLUG_COLOR) {
      throw ErrorApi.peticionInvalida(`"${valor(id).valor}" no es un color`);
    }
  }
  for (const id of datos.fijos) {
    if (valor(id).atributoSlug === SLUG_LONGITUD || valor(id).atributoSlug === SLUG_COLOR) {
      throw ErrorApi.peticionInvalida('Largo y color no van como atributos fijos');
    }
  }
  // Un valor por atributo entre los fijos: lo valida skuDeValores más
  // abajo, que recibe largo + color + fijos de cada combinación.

  // Una variante existente "es" esta combinación si tiene el mismo largo y
  // el mismo color (o ninguno, cuando el lote no varía por color): es la
  // misma identidad que da el SKU. Los fijos no cuentan.
  const existentes = await tx.varianteProducto.findMany({
    where: { productoId },
    select: {
      valoresAtributo: {
        select: {
          valorId: true,
          valorAtributo: { select: { atributo: { select: { slug: true } } } },
        },
      },
    },
  });
  const clavesExistentes = new Set(
    existentes.map((variante) => {
      const delAtributo = (slug: string) =>
        variante.valoresAtributo.find((r) => r.valorAtributo.atributo.slug === slug)?.valorId ??
        null;
      return claveCombinacion(delAtributo(SLUG_LONGITUD) ?? '', delAtributo(SLUG_COLOR));
    }),
  );

  const porOrden = (a: ValorResuelto, b: ValorResuelto) => a.orden - b.orden;
  const longitudes = datos.longitudes
    .map((l) => ({ ...l, valor: valor(l.valorId) }))
    .sort((a, b) => porOrden(a.valor, b.valor));
  const colores: (ValorResuelto | null)[] =
    datos.colores.length > 0 ? datos.colores.map(valor).sort(porOrden) : [null];
  const fijos = datos.fijos.map(valor);

  const combinaciones: CombinacionLote[] = [];
  for (const longitud of longitudes) {
    for (const color of colores) {
      const valoresCombinacion = [longitud.valor, ...(color ? [color] : []), ...fijos];
      combinaciones.push({
        longitud: { id: longitud.valor.id, valor: longitud.valor.valor },
        color: color ? { id: color.id, valor: color.valor, hex: color.hex } : null,
        sku: skuDeValores(codigoProducto, valoresCombinacion),
        precio: longitud.precio,
        costo: longitud.costo ?? null,
        yaExiste: clavesExistentes.has(claveCombinacion(longitud.valor.id, color?.id ?? null)),
        skuOcupado: false,
      });
    }
  }

  const ocupados = await tx.varianteProducto.findMany({
    where: { sku: { in: combinaciones.filter((c) => !c.yaExiste).map((c) => c.sku) } },
    select: { sku: true },
  });
  const skusOcupados = new Set(ocupados.map((o) => o.sku));
  for (const combinacion of combinaciones) {
    combinacion.skuOcupado = !combinacion.yaExiste && skusOcupados.has(combinacion.sku);
  }

  return { codigoProducto, combinaciones };
}

export async function previsualizarLote(productoId: string, datos: BodyPrevisualizarLote) {
  return armarCombinaciones(prisma, productoId, datos);
}

export async function crearLote(productoId: string, datos: BodyCrearLote, usuarioAdminId: string) {
  return prisma.$transaction(
    async (tx) => {
      // Se recalcula todo acá, dentro de la transacción: nunca se confía en
      // el SKU, la existencia ni el precio por longitud que vio el navegador.
      const { codigoProducto, combinaciones } = await armarCombinaciones(tx, productoId, datos);
      const porClave = new Map(
        combinaciones.map((c) => [claveCombinacion(c.longitud.id, c.color?.id ?? null), c]),
      );

      const vistas = new Set<string>();
      const saltadas: string[] = [];
      const nuevas: VarianteNueva[] = [];
      const skusNuevos: string[] = [];

      for (const elegida of datos.combinaciones) {
        const clave = claveCombinacion(elegida.longitudId, elegida.colorId);
        const combinacion = porClave.get(clave);
        if (!combinacion) {
          throw ErrorApi.peticionInvalida(
            'Hay una combinación que no corresponde a las longitudes y colores elegidos',
          );
        }
        if (vistas.has(clave)) {
          throw ErrorApi.peticionInvalida(`La combinación ${combinacion.sku} está repetida`);
        }
        vistas.add(clave);

        if (combinacion.yaExiste) {
          saltadas.push(combinacion.sku);
          continue;
        }
        nuevas.push({
          valorIds: [
            elegida.longitudId,
            ...(elegida.colorId ? [elegida.colorId] : []),
            ...datos.fijos,
          ],
          precio: elegida.precio ?? combinacion.precio,
          costo: combinacion.costo ?? undefined,
          stock: elegida.stock,
        });
        skusNuevos.push(combinacion.sku);
      }

      if (nuevas.length === 0) {
        throw ErrorApi.conflicto('Todas las combinaciones elegidas ya existen en este producto');
      }

      await insertarVariantes(tx, productoId, codigoProducto, nuevas, usuarioAdminId);
      return { creadas: skusNuevos, saltadas };
    },
    { timeout: TIMEOUT_TRANSACCION_LOTE_MS },
  );
}
