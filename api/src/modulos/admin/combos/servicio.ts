import { Prisma } from '@prisma/client';
import { ErrorApi } from '../../../lib/errorApi.js';
import { prisma } from '../../../lib/prisma.js';
import type {
  BodyCrearKit,
  BodyEditarKit,
  BodyPrevisualizarKit,
  QueryBuscarVariantes,
  QueryListadoKits,
} from './esquemas.js';

// Mismo criterio que admin/productos/servicio.ts: no hay un módulo
// compartido de slugs en el proyecto, cada módulo que lo necesita lo
// resuelve igual, acá nomás.
function generarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function esColisionUnica(error: unknown, campo: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes(campo)
  );
}

// Umbral de aviso (puntos 8 y 9 del pedido): no bloquea, solo avisa en
// ámbar. 15, no 15.0 — el margen siempre se redondea a un entero antes de
// compararlo, para que el aviso y el número mostrado coincidan.
const UMBRAL_MARGEN_BAJO = 15;

const SELECT_ITEM = {
  cantidad: true,
  varianteProducto: {
    select: {
      id: true,
      sku: true,
      precioActual: true,
      costoActual: true,
      stockActual: true,
      stockReservado: true,
      producto: { select: { nombre: true } },
      valoresAtributo: {
        select: {
          valorAtributo: {
            select: { valor: true, hex: true, atributo: { select: { slug: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.ComboItemSelect;

type ItemConVariante = Prisma.ComboItemGetPayload<{ select: typeof SELECT_ITEM }>;

function colorDeVariante(item: ItemConVariante): { nombre: string; hex: string | null } | null {
  const relacion = item.varianteProducto.valoresAtributo.find(
    (v) => v.valorAtributo.atributo.slug === 'color',
  );
  return relacion
    ? { nombre: relacion.valorAtributo.valor, hex: relacion.valorAtributo.hex }
    : null;
}

// Núcleo puro: lo usan listarKits, obtenerDetalleKit, crearKit y
// editarKit, siempre sobre la misma forma de datos — así el margen que
// se ve en el listado es exactamente el mismo cálculo que el que se ve
// en el resumen del formulario, nunca dos fórmulas por separado.
function calcularResumenKit(precioKitCop: number, items: ItemConVariante[]) {
  const piezas = items.reduce((suma, item) => suma + item.cantidad, 0);
  const precioSueltoCop = items.reduce(
    (suma, item) => suma + item.varianteProducto.precioActual * item.cantidad,
    0,
  );

  const costoConocido = items.every((item) => item.varianteProducto.costoActual !== null);
  const costoCop = costoConocido
    ? items.reduce(
        (suma, item) => suma + (item.varianteProducto.costoActual ?? 0) * item.cantidad,
        0,
      )
    : null;

  const ahorroCop = precioSueltoCop - precioKitCop;
  const ahorroPorcentaje =
    precioSueltoCop > 0 ? Math.round((ahorroCop / precioSueltoCop) * 100) : 0;

  const margenCop = costoCop === null ? null : precioKitCop - costoCop;
  const margenPorcentaje =
    margenCop === null || precioKitCop <= 0 ? null : Math.round((margenCop / precioKitCop) * 100);
  const margenBajo = margenPorcentaje === null ? null : margenPorcentaje < UMBRAL_MARGEN_BAJO;

  const piezaSinStock =
    items.find(
      (item) =>
        item.varianteProducto.stockActual - item.varianteProducto.stockReservado < item.cantidad,
    )?.varianteProducto.producto.nombre ?? null;

  return {
    piezas,
    precioSueltoCop,
    costoCop,
    ahorroCop,
    ahorroPorcentaje,
    margenCop,
    margenPorcentaje,
    margenBajo,
    disponible: piezaSinStock === null,
    piezaSinStock,
  };
}

function mapearItem(item: ItemConVariante) {
  return {
    varianteId: item.varianteProducto.id,
    sku: item.varianteProducto.sku,
    nombreProducto: item.varianteProducto.producto.nombre,
    color: colorDeVariante(item),
    cantidad: item.cantidad,
    precioUnitario: item.varianteProducto.precioActual,
    costoUnitario: item.varianteProducto.costoActual,
  };
}

const SELECT_LISTADO = {
  id: true,
  nombre: true,
  slug: true,
  precioCop: true,
  vigenteDesde: true,
  vigenteHasta: true,
  activo: true,
  items: { select: SELECT_ITEM },
} satisfies Prisma.ComboSelect;

export async function listarKits(query: QueryListadoKits) {
  const where: Prisma.ComboWhereInput = query.buscar
    ? { nombre: { contains: query.buscar, mode: 'insensitive' } }
    : {};

  const [total, kits] = await Promise.all([
    prisma.combo.count({ where }),
    prisma.combo.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      skip: (query.pagina - 1) * query.porPagina,
      take: query.porPagina,
      select: SELECT_LISTADO,
    }),
  ]);

  const datos = kits.map((kit) => {
    const resumen = calcularResumenKit(kit.precioCop, kit.items);
    return {
      id: kit.id,
      nombre: kit.nombre,
      slug: kit.slug,
      precioCop: kit.precioCop,
      vigenteDesde: kit.vigenteDesde,
      vigenteHasta: kit.vigenteHasta,
      activo: kit.activo,
      ...resumen,
    };
  });

  return {
    datos,
    paginacion: {
      pagina: query.pagina,
      porPagina: query.porPagina,
      total,
      totalPaginas: Math.ceil(total / query.porPagina),
    },
  };
}

const SELECT_DETALLE = {
  id: true,
  nombre: true,
  slug: true,
  descripcion: true,
  imagenUrl: true,
  precioCop: true,
  precioUsd: true,
  vigenteDesde: true,
  vigenteHasta: true,
  activo: true,
  destacado: true,
  items: { select: SELECT_ITEM },
} satisfies Prisma.ComboSelect;

function mapearDetalle(kit: Prisma.ComboGetPayload<{ select: typeof SELECT_DETALLE }>) {
  const resumen = calcularResumenKit(kit.precioCop, kit.items);
  return {
    id: kit.id,
    nombre: kit.nombre,
    slug: kit.slug,
    descripcion: kit.descripcion,
    imagenUrl: kit.imagenUrl,
    precioCop: kit.precioCop,
    precioUsd: kit.precioUsd,
    vigenteDesde: kit.vigenteDesde,
    vigenteHasta: kit.vigenteHasta,
    activo: kit.activo,
    destacado: kit.destacado,
    items: kit.items.map(mapearItem),
    ...resumen,
  };
}

export async function obtenerDetalleKit(id: string) {
  const kit = await prisma.combo.findUnique({ where: { id }, select: SELECT_DETALLE });
  if (!kit) throw ErrorApi.noEncontrado('El kit no existe');
  return mapearDetalle(kit);
}

async function validarItems(
  tx: Prisma.TransactionClient,
  items: { varianteId: string; cantidad: number }[],
): Promise<void> {
  const variantes = await tx.varianteProducto.findMany({
    where: { id: { in: items.map((i) => i.varianteId) }, activa: true },
    select: { id: true },
  });
  if (variantes.length !== new Set(items.map((i) => i.varianteId)).size) {
    throw ErrorApi.peticionInvalida('Alguna de las variantes elegidas no existe o no está activa');
  }
}

async function precioSueltoDeItems(
  tx: Prisma.TransactionClient,
  items: { varianteId: string; cantidad: number }[],
): Promise<number> {
  const variantes = await tx.varianteProducto.findMany({
    where: { id: { in: items.map((i) => i.varianteId) } },
    select: { id: true, precioActual: true },
  });
  const precioPorId = new Map(variantes.map((v) => [v.id, v.precioActual]));
  return items.reduce(
    (suma, item) => suma + (precioPorId.get(item.varianteId) ?? 0) * item.cantidad,
    0,
  );
}

// Punto 13: si el precio del kit no deja ningún ahorro frente a comprar
// las piezas sueltas, no se guarda — no sería un kit.
function validarPrecioFrenteASuelto(precioKitCop: number, precioSueltoCop: number): void {
  if (precioKitCop >= precioSueltoCop) {
    throw ErrorApi.conflicto(
      'El precio del kit es igual o mayor al de las piezas por separado: no sería un kit',
    );
  }
}

export async function crearKit(datos: BodyCrearKit, usuarioAdminId: string) {
  const slug = generarSlug(datos.slug ?? datos.nombre);
  if (!slug)
    throw ErrorApi.peticionInvalida('No se pudo generar un slug válido a partir del nombre');

  try {
    return await prisma.$transaction(async (tx) => {
      await validarItems(tx, datos.items);
      const precioSueltoCop = await precioSueltoDeItems(tx, datos.items);
      validarPrecioFrenteASuelto(datos.precioCop, precioSueltoCop);

      const kit = await tx.combo.create({
        data: {
          nombre: datos.nombre,
          slug,
          descripcion: datos.descripcion ?? null,
          imagenUrl: datos.imagenUrl ?? null,
          precioCop: datos.precioCop,
          precioUsd: datos.precioUsd ?? null,
          vigenteDesde: datos.vigenteDesde,
          vigenteHasta: datos.vigenteHasta ?? null,
          destacado: datos.destacado ?? false,
          creadoPorId: usuarioAdminId,
          items: {
            create: datos.items.map((item) => ({
              varianteId: item.varianteId,
              cantidad: item.cantidad,
            })),
          },
        },
        select: SELECT_DETALLE,
      });
      return mapearDetalle(kit);
    });
  } catch (error) {
    if (esColisionUnica(error, 'slug')) {
      throw ErrorApi.conflicto(`Ya existe un kit con el slug "${slug}"`);
    }
    throw error;
  }
}

export async function editarKit(id: string, datos: BodyEditarKit) {
  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await tx.combo.findUnique({
        where: { id },
        select: {
          id: true,
          precioCop: true,
          items: { select: { varianteId: true, cantidad: true } },
        },
      });
      if (!actual) throw ErrorApi.noEncontrado('El kit no existe');

      if (datos.items) {
        await validarItems(tx, datos.items);
      }
      const itemsAValidar = datos.items ?? actual.items;
      const precioKitAValidar = datos.precioCop ?? actual.precioCop;
      const precioSueltoCop = await precioSueltoDeItems(tx, itemsAValidar);
      validarPrecioFrenteASuelto(precioKitAValidar, precioSueltoCop);

      const slug = datos.slug !== undefined ? generarSlug(datos.slug) : undefined;
      if (datos.slug !== undefined && !slug) {
        throw ErrorApi.peticionInvalida('El slug no puede quedar vacío');
      }

      if (datos.items) {
        // Reemplazo completo: más simple y más seguro que diffear altas/
        // bajas/cambios de cantidad por separado, y un kit no tiene
        // historial por ítem que proteger (a diferencia de los precios
        // de producto, que sí lo tienen).
        await tx.comboItem.deleteMany({ where: { comboId: id } });
      }

      const kit = await tx.combo.update({
        where: { id },
        data: {
          nombre: datos.nombre,
          slug,
          descripcion: datos.descripcion,
          imagenUrl: datos.imagenUrl,
          precioCop: datos.precioCop,
          precioUsd: datos.precioUsd,
          vigenteDesde: datos.vigenteDesde,
          vigenteHasta: datos.vigenteHasta,
          activo: datos.activo,
          destacado: datos.destacado,
          actualizadoEn: new Date(),
          ...(datos.items
            ? {
                items: {
                  create: datos.items.map((item) => ({
                    varianteId: item.varianteId,
                    cantidad: item.cantidad,
                  })),
                },
              }
            : {}),
        },
        select: SELECT_DETALLE,
      });
      return mapearDetalle(kit);
    });
  } catch (error) {
    if (esColisionUnica(error, 'slug')) {
      throw ErrorApi.conflicto('Ya existe un kit con ese slug');
    }
    throw error;
  }
}

export async function buscarVariantes(query: QueryBuscarVariantes) {
  const variantes = await prisma.varianteProducto.findMany({
    where: {
      activa: true,
      OR: [
        { sku: { contains: query.buscar, mode: 'insensitive' } },
        { producto: { nombre: { contains: query.buscar, mode: 'insensitive' } } },
      ],
    },
    take: 20,
    select: {
      id: true,
      sku: true,
      precioActual: true,
      costoActual: true,
      producto: { select: { nombre: true } },
      valoresAtributo: {
        select: {
          valorAtributo: {
            select: { valor: true, hex: true, atributo: { select: { slug: true } } },
          },
        },
      },
    },
  });

  return variantes.map((variante) => {
    const relacionColor = variante.valoresAtributo.find(
      (v) => v.valorAtributo.atributo.slug === 'color',
    );
    return {
      id: variante.id,
      sku: variante.sku,
      nombreProducto: variante.producto.nombre,
      precioActual: variante.precioActual,
      costoActual: variante.costoActual,
      color: relacionColor
        ? { nombre: relacionColor.valorAtributo.valor, hex: relacionColor.valorAtributo.hex }
        : null,
    };
  });
}

// Resumen vivo del formulario (punto 12): mismas piezas que calcularResumenKit
// usa en el listado y el detalle, para que el número que se ve mientras se
// arma el kit sea exactamente el que se va a guardar — no una segunda
// fórmula en el frontend.
export async function previsualizarKit(datos: BodyPrevisualizarKit) {
  const variantes = await prisma.varianteProducto.findMany({
    where: { id: { in: datos.items.map((i) => i.varianteId) } },
    select: SELECT_ITEM.varianteProducto.select,
  });
  const varientePorId = new Map(variantes.map((v) => [v.id, v]));

  const items: ItemConVariante[] = datos.items.flatMap((item) => {
    const variante = varientePorId.get(item.varianteId);
    return variante ? [{ cantidad: item.cantidad, varianteProducto: variante }] : [];
  });

  return calcularResumenKit(datos.precioCop, items);
}
