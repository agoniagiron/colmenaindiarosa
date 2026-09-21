import { Prisma } from '@prisma/client';
import { ErrorApi } from '../../../lib/errorApi.js';
import { prisma } from '../../../lib/prisma.js';
import type {
  BodyCrearProducto,
  BodyCrearValorAtributo,
  BodyCrearVariante,
  BodyEditarProducto,
  BodyEditarVariante,
  BodyEstadoProducto,
  BodyPreciosProducto,
  BodyPrecioVariante,
  QueryListadoProductos,
} from './esquemas.js';

function generarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tildes/diacríticos, ya separados por NFD
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

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------

const SELECT_LISTADO = {
  id: true,
  nombre: true,
  slug: true,
  estado: true,
  creadoEn: true,
  categoria: { select: { id: true, nombre: true } },
  resumen: { select: { calificacionPromedio: true, cantidadResenas: true } },
  variantes: { select: { activa: true, precioActual: true, stockActual: true } },
} satisfies Prisma.ProductoSelect;

export async function listarProductos(query: QueryListadoProductos) {
  const where: Prisma.ProductoWhereInput = {};
  if (query.categoriaId) where.categoriaId = query.categoriaId;
  if (query.estado) where.estado = query.estado;
  if (query.buscar) {
    where.nombre = { contains: query.buscar, mode: 'insensitive' };
  }

  const [total, productos] = await Promise.all([
    prisma.producto.count({ where }),
    prisma.producto.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      skip: (query.pagina - 1) * query.porPagina,
      take: query.porPagina,
      select: SELECT_LISTADO,
    }),
  ]);

  const datos = productos.map((producto) => {
    const precios = producto.variantes.map((v) => v.precioActual);
    const variantesActivas = producto.variantes.filter((v) => v.activa);
    // "Agotado" mira solo las variantes activas: una inactiva no se vende
    // igual, así que su stock no debería tapar la alerta ni evitarla.
    const agotado =
      producto.estado === 'publicado' &&
      (variantesActivas.length === 0 || variantesActivas.every((v) => v.stockActual <= 0));

    return {
      id: producto.id,
      nombre: producto.nombre,
      slug: producto.slug,
      estado: producto.estado,
      categoria: producto.categoria,
      creadoEn: producto.creadoEn,
      cantidadVariantes: producto.variantes.length,
      rangoPrecios:
        precios.length > 0 ? { min: Math.min(...precios), max: Math.max(...precios) } : null,
      stockTotal: producto.variantes.reduce((suma, v) => suma + v.stockActual, 0),
      calificacionPromedio: producto.resumen ? Number(producto.resumen.calificacionPromedio) : null,
      agotado,
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

// ---------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------

const SELECT_VARIANTE_DETALLE = {
  id: true,
  productoId: true,
  sku: true,
  peso: true,
  stockActual: true,
  stockReservado: true,
  puntoReorden: true,
  precioActual: true,
  precioAntes: true,
  costoActual: true,
  precioUsd: true,
  activa: true,
  creadoEn: true,
  valoresAtributo: {
    select: {
      valorAtributo: {
        select: {
          id: true,
          valor: true,
          hex: true,
          atributo: { select: { id: true, nombre: true, slug: true } },
        },
      },
    },
  },
  historialPrecios: {
    orderBy: { creadoEn: 'desc' },
    select: {
      id: true,
      precio: true,
      precioAntes: true,
      costo: true,
      precioUsd: true,
      motivo: true,
      creadoEn: true,
      usuario: { select: { nombre: true } },
    },
  },
} satisfies Prisma.VarianteProductoSelect;

const SELECT_DETALLE = {
  id: true,
  nombre: true,
  slug: true,
  descripcionCorta: true,
  descripcion: true,
  cuidados: true,
  envioNotas: true,
  categoriaId: true,
  estado: true,
  publicadoEn: true,
  seoTitulo: true,
  seoDescripcion: true,
  creadoEn: true,
  actualizadoEn: true,
  categoria: { select: { id: true, nombre: true, slug: true } },
  variantes: { orderBy: { creadoEn: 'asc' }, select: SELECT_VARIANTE_DETALLE },
  imagenes: {
    orderBy: { orden: 'asc' },
    select: {
      id: true,
      productoId: true,
      varianteId: true,
      url: true,
      altTexto: true,
      tipo: true,
      orden: true,
      ancho: true,
      alto: true,
      creadoEn: true,
    },
  },
} satisfies Prisma.ProductoSelect;

export async function obtenerDetalleProducto(id: string) {
  const producto = await prisma.producto.findUnique({ where: { id }, select: SELECT_DETALLE });
  if (!producto) {
    throw ErrorApi.noEncontrado('El producto no existe');
  }
  return producto;
}

// ---------------------------------------------------------------------------
// Crear / editar producto
// ---------------------------------------------------------------------------

async function validarCategoria(categoriaId: string): Promise<void> {
  const categoria = await prisma.categoria.findUnique({
    where: { id: categoriaId },
    select: { id: true },
  });
  if (!categoria) {
    throw ErrorApi.peticionInvalida('La categoría no existe');
  }
}

export async function crearProducto(datos: BodyCrearProducto, usuarioAdminId: string) {
  await validarCategoria(datos.categoriaId);

  const slug = generarSlug(datos.slug ?? datos.nombre);
  if (!slug) {
    throw ErrorApi.peticionInvalida('No se pudo generar un slug válido a partir del nombre');
  }

  try {
    return await prisma.producto.create({
      data: {
        nombre: datos.nombre,
        slug,
        categoriaId: datos.categoriaId,
        creadoPorId: usuarioAdminId,
      },
      select: SELECT_DETALLE,
    });
  } catch (error) {
    if (esColisionUnica(error, 'slug')) {
      throw ErrorApi.conflicto(`Ya existe un producto con el slug "${slug}"`);
    }
    throw error;
  }
}

export async function editarProducto(id: string, datos: BodyEditarProducto) {
  const producto = await prisma.producto.findUnique({ where: { id }, select: { id: true } });
  if (!producto) {
    throw ErrorApi.noEncontrado('El producto no existe');
  }

  if (datos.categoriaId) {
    await validarCategoria(datos.categoriaId);
  }

  const slug = datos.slug !== undefined ? generarSlug(datos.slug) : undefined;
  if (datos.slug !== undefined && !slug) {
    throw ErrorApi.peticionInvalida('El slug no puede quedar vacío');
  }

  try {
    return await prisma.producto.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        slug,
        categoriaId: datos.categoriaId,
        descripcionCorta: datos.descripcionCorta,
        descripcion: datos.descripcion,
        cuidados: datos.cuidados,
        envioNotas: datos.envioNotas,
        seoTitulo: datos.seoTitulo,
        seoDescripcion: datos.seoDescripcion,
        actualizadoEn: new Date(),
      },
      select: SELECT_DETALLE,
    });
  } catch (error) {
    if (esColisionUnica(error, 'slug')) {
      throw ErrorApi.conflicto(`Ya existe un producto con el slug "${slug}"`);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Estado (borrador / publicado / archivado)
// ---------------------------------------------------------------------------

async function obtenerKitsVigentesAfectados(
  tx: Prisma.TransactionClient,
  varianteIds: string[],
): Promise<{ id: string; nombre: string }[]> {
  if (varianteIds.length === 0) return [];
  const ahora = new Date();
  return tx.combo.findMany({
    where: {
      activo: true,
      vigenteDesde: { lte: ahora },
      OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: ahora } }],
      items: { some: { varianteId: { in: varianteIds } } },
    },
    select: { id: true, nombre: true },
  });
}

export async function cambiarEstadoProducto(id: string, datos: BodyEstadoProducto) {
  return prisma.$transaction(async (tx) => {
    const producto = await tx.producto.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        publicadoEn: true,
        variantes: { select: { id: true, activa: true } },
        imagenes: { select: { altTexto: true } },
      },
    });
    if (!producto) {
      throw ErrorApi.noEncontrado('El producto no existe');
    }

    if (datos.estado === producto.estado) {
      throw ErrorApi.conflicto(`El producto ya está en estado "${datos.estado}"`);
    }

    if (datos.estado === 'publicado' && !producto.variantes.some((v) => v.activa)) {
      throw ErrorApi.conflicto('No se puede publicar un producto sin al menos una variante activa');
    }

    // altTexto es NOT NULL en la base, pero un string vacío la pasaría de
    // largo igual: se exige contenido real, no solo la fila presente.
    if (
      datos.estado === 'publicado' &&
      !producto.imagenes.some((img) => img.altTexto.trim().length > 0)
    ) {
      throw ErrorApi.conflicto(
        'No se puede publicar un producto sin al menos una imagen con texto alternativo',
      );
    }

    // Vale para cualquier salida de "publicado" (a borrador o a archivado):
    // en los dos casos el kit vigente queda apuntando a algo que no se
    // vende. El permiso que se exige en la ruta es otro tema (ver
    // rutasProductos.ts) y solo distingue el estado destino, no el actual.
    const dejaDeEstarPublicado = producto.estado === 'publicado' && datos.estado !== 'publicado';
    if (dejaDeEstarPublicado && !datos.confirmarKitsAfectados) {
      const kits = await obtenerKitsVigentesAfectados(
        tx,
        producto.variantes.map((v) => v.id),
      );
      if (kits.length > 0) {
        throw ErrorApi.conflicto(
          'Este producto tiene variantes dentro de kits vigentes: al despublicarlo o archivarlo, esos kits quedan apuntando a algo que ya no se vende.',
          { kits },
        );
      }
    }

    const dataActualizacion: Prisma.ProductoUpdateInput = {
      estado: datos.estado,
      actualizadoEn: new Date(),
    };
    if (datos.estado === 'publicado' && !producto.publicadoEn) {
      dataActualizacion.publicadoEn = new Date();
    }

    return tx.producto.update({ where: { id }, data: dataActualizacion, select: SELECT_DETALLE });
  });
}

// ---------------------------------------------------------------------------
// Variantes
// ---------------------------------------------------------------------------

export async function crearVariante(
  productoId: string,
  datos: BodyCrearVariante,
  usuarioAdminId: string,
) {
  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { id: true },
  });
  if (!producto) {
    throw ErrorApi.noEncontrado('El producto no existe');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const variante = await tx.varianteProducto.create({
        data: {
          productoId,
          sku: datos.sku,
          precioActual: datos.precio,
          precioUsd: datos.precioUsd,
          costoActual: datos.costo,
          stockActual: datos.stockInicial,
          puntoReorden: datos.puntoReorden,
          peso: datos.peso,
          valoresAtributo: { create: datos.valoresAtributo.map((valorId) => ({ valorId })) },
        },
      });

      await tx.movimientoInventario.create({
        data: {
          varianteId: variante.id,
          tipo: 'entrada',
          cantidad: datos.stockInicial,
          stockResultante: datos.stockInicial,
          referenciaTipo: 'variante_creada',
          referenciaId: variante.id,
          usuarioId: usuarioAdminId,
          motivo: 'Stock inicial',
        },
      });

      return tx.varianteProducto.findUniqueOrThrow({
        where: { id: variante.id },
        select: SELECT_VARIANTE_DETALLE,
      });
    });
  } catch (error) {
    if (esColisionUnica(error, 'sku')) {
      throw ErrorApi.conflicto(`Ya existe una variante con el SKU "${datos.sku}"`);
    }
    throw error;
  }
}

export async function editarVariante(id: string, datos: BodyEditarVariante) {
  const variante = await prisma.varianteProducto.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!variante) {
    throw ErrorApi.noEncontrado('La variante no existe');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.varianteProducto.update({
        where: { id },
        data: {
          sku: datos.sku,
          puntoReorden: datos.puntoReorden,
          peso: datos.peso,
          activa: datos.activa,
          actualizadoEn: new Date(),
        },
      });

      if (datos.valoresAtributo) {
        await tx.varianteValorAtributo.deleteMany({ where: { varianteId: id } });
        if (datos.valoresAtributo.length > 0) {
          await tx.varianteValorAtributo.createMany({
            data: datos.valoresAtributo.map((valorId) => ({ varianteId: id, valorId })),
          });
        }
      }

      return tx.varianteProducto.findUniqueOrThrow({
        where: { id },
        select: SELECT_VARIANTE_DETALLE,
      });
    });
  } catch (error) {
    if (esColisionUnica(error, 'sku')) {
      throw ErrorApi.conflicto(`Ya existe una variante con el SKU "${datos.sku}"`);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Precios
// ---------------------------------------------------------------------------

function accionesDeAuditoria(
  entidad: string,
  entidadId: string,
  accion: string,
  antes: Prisma.InputJsonValue | undefined,
  despues: Prisma.InputJsonValue,
) {
  return {
    entidad,
    entidadId,
    accion,
    ...(antes !== undefined ? { datosAntes: antes } : {}),
    datosDespues: despues,
  };
}

export async function cambiarPrecioVariante(
  id: string,
  datos: BodyPrecioVariante,
  usuarioAdminId: string,
  ipHash: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const variante = await tx.varianteProducto.findUnique({
      where: { id },
      select: { precioActual: true, costoActual: true },
    });
    if (!variante) {
      throw ErrorApi.noEncontrado('La variante no existe');
    }

    const nuevoCosto = datos.costo ?? variante.costoActual;
    // precio_usd: si no llega en el body, queda en null a propósito — que
    // se calcule con la tasa vigente (lib/moneda.ts) en vez de arrastrar
    // un valor manual de un cambio de precio anterior que ya no aplica.
    const nuevoPrecioUsd = datos.precioUsd ?? null;

    await tx.varianteProducto.update({
      where: { id },
      data: {
        precioActual: datos.precio,
        precioAntes: variante.precioActual,
        costoActual: nuevoCosto,
        precioUsd: nuevoPrecioUsd,
        actualizadoEn: new Date(),
      },
    });

    await tx.precioVariante.create({
      data: {
        varianteId: id,
        precio: datos.precio,
        precioAntes: variante.precioActual,
        costo: nuevoCosto,
        precioUsd: nuevoPrecioUsd,
        motivo: datos.motivo,
        creadoPorId: usuarioAdminId,
      },
    });

    await tx.auditoriaAdmin.create({
      data: {
        usuarioAdminId,
        ipHash,
        ...accionesDeAuditoria(
          'variante_producto',
          id,
          'admin.variante.cambiar_precio',
          { precio: variante.precioActual, costo: variante.costoActual },
          { precio: datos.precio, costo: nuevoCosto, motivo: datos.motivo },
        ),
      },
    });

    return tx.varianteProducto.findUniqueOrThrow({
      where: { id },
      select: SELECT_VARIANTE_DETALLE,
    });
  });
}

export async function cambiarPreciosProducto(
  productoId: string,
  datos: BodyPreciosProducto,
  usuarioAdminId: string,
  ipHash: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const variantes = await tx.varianteProducto.findMany({
      where: { productoId },
      select: { id: true, precioActual: true, precioUsd: true, costoActual: true },
    });
    if (variantes.length === 0) {
      throw ErrorApi.peticionInvalida('El producto no tiene variantes');
    }

    for (const variante of variantes) {
      let nuevoPrecio: number;
      let nuevoPrecioUsd: number | null;

      if (datos.modo === 'porcentaje') {
        const factor = 1 + datos.porcentaje / 100;
        nuevoPrecio = Math.max(1, Math.round(variante.precioActual * factor));
        nuevoPrecioUsd =
          variante.precioUsd !== null ? Math.round(variante.precioUsd * factor) : null;
      } else {
        nuevoPrecio = datos.precio;
        nuevoPrecioUsd = datos.precioUsd ?? null;
      }

      await tx.varianteProducto.update({
        where: { id: variante.id },
        data: {
          precioActual: nuevoPrecio,
          precioAntes: variante.precioActual,
          precioUsd: nuevoPrecioUsd,
          actualizadoEn: new Date(),
        },
      });

      await tx.precioVariante.create({
        data: {
          varianteId: variante.id,
          precio: nuevoPrecio,
          precioAntes: variante.precioActual,
          costo: variante.costoActual,
          precioUsd: nuevoPrecioUsd,
          motivo: datos.motivo,
          creadoPorId: usuarioAdminId,
        },
      });
    }

    await tx.auditoriaAdmin.create({
      data: {
        usuarioAdminId,
        ipHash,
        ...accionesDeAuditoria(
          'producto',
          productoId,
          'admin.producto.cambiar_precios',
          undefined,
          datos as unknown as Prisma.InputJsonValue,
        ),
      },
    });

    return tx.producto.findUniqueOrThrow({ where: { id: productoId }, select: SELECT_DETALLE });
  });
}

// ---------------------------------------------------------------------------
// Atributos
// ---------------------------------------------------------------------------

export async function listarAtributos() {
  return prisma.atributo.findMany({
    orderBy: { orden: 'asc' },
    select: {
      id: true,
      nombre: true,
      slug: true,
      orden: true,
      valoresAtributo: { orderBy: { orden: 'asc' }, select: { id: true, valor: true, hex: true } },
    },
  });
}

export async function crearValorAtributo(datos: BodyCrearValorAtributo) {
  const atributo = await prisma.atributo.findUnique({
    where: { id: datos.atributoId },
    select: { id: true },
  });
  if (!atributo) {
    throw ErrorApi.noEncontrado('El atributo no existe');
  }

  try {
    return await prisma.valorAtributo.create({
      data: { atributoId: datos.atributoId, valor: datos.valor, hex: datos.hex ?? null },
      select: { id: true, valor: true, hex: true, atributoId: true },
    });
  } catch (error) {
    if (esColisionUnica(error, 'valor')) {
      throw ErrorApi.conflicto(`Ya existe el valor "${datos.valor}" para este atributo`);
    }
    throw error;
  }
}
