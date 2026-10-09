import type { Prisma } from '@prisma/client';
import { ErrorApi } from '../../../lib/errorApi.js';
import { contarUnidadesVendidas } from '../../limitadas/servicio.js';
import { prisma } from '../../../lib/prisma.js';
import type { BodyCrearEdicion, BodyEditarEdicion, QueryListadoLimitadas } from './esquemas.js';

const SELECT_FILA = {
  id: true,
  nombre: true,
  descripcion: true,
  unidadesLote: true,
  mostrarRestantes: true,
  desde: true,
  hasta: true,
  activa: true,
  producto: {
    select: {
      id: true,
      nombre: true,
      slug: true,
      imagenes: {
        where: { varianteId: null },
        orderBy: { orden: 'asc' },
        take: 1,
        select: { url: true, altTexto: true },
      },
      variantes: { where: { activa: true }, select: { id: true } },
    },
  },
} satisfies Prisma.EdicionLimitadaSelect;

type FilaCruda = Prisma.EdicionLimitadaGetPayload<{ select: typeof SELECT_FILA }>;

// Prioridad de estados (en ese orden, el pedido lo pide explícito):
// programada > vencida > agotada > vigente. "inactiva" es aparte, para
// las que el administrador ya desactivó (AJUSTE 1) — ni vigente ni
// vencida importan si ya no está activa.
function calcularEstado(
  activa: boolean,
  desde: Date,
  hasta: Date | null,
  unidadesRestantes: number | null,
): 'inactiva' | 'programada' | 'vencida' | 'agotada' | 'vigente' {
  if (!activa) return 'inactiva';
  const ahora = new Date();
  if (ahora < desde) return 'programada';
  if (hasta !== null && ahora >= hasta) return 'vencida';
  // unidadesLote null (sin tope) nunca llega a "agotada": unidadesRestantes
  // ya sale null en ese caso (ver mapearFila) — AJUSTE 2.
  if (unidadesRestantes !== null && unidadesRestantes <= 0) return 'agotada';
  return 'vigente';
}

async function mapearFila(edicion: FilaCruda) {
  const varianteIds = edicion.producto.variantes.map((v) => v.id);
  // Misma consulta que el endpoint público (ver modulos/limitadas/servicio.ts):
  // ventas desde que arrancó el lote, no stock actual. No se duplica acá.
  const unidadesVendidas = await contarUnidadesVendidas(varianteIds, edicion.desde);
  const unidadesRestantes =
    edicion.unidadesLote === null ? null : Math.max(0, edicion.unidadesLote - unidadesVendidas);

  return {
    id: edicion.id,
    nombre: edicion.nombre,
    descripcion: edicion.descripcion,
    producto: {
      id: edicion.producto.id,
      nombre: edicion.producto.nombre,
      slug: edicion.producto.slug,
      imagen: edicion.producto.imagenes[0] ?? null,
    },
    unidadesLote: edicion.unidadesLote,
    unidadesVendidas,
    unidadesRestantes,
    mostrarRestantes: edicion.mostrarRestantes,
    desde: edicion.desde,
    hasta: edicion.hasta,
    activa: edicion.activa,
    estado: calcularEstado(edicion.activa, edicion.desde, edicion.hasta, unidadesRestantes),
  };
}

export async function listarEdicionesAdmin(query: QueryListadoLimitadas) {
  // Por defecto solo las activas (punto: "la lista del panel muestra por
  // defecto solo las activas, con un filtro para ver las inactivas").
  const where: Prisma.EdicionLimitadaWhereInput = query.incluirInactivas ? {} : { activa: true };

  const [total, filas] = await Promise.all([
    prisma.edicionLimitada.count({ where }),
    prisma.edicionLimitada.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      skip: (query.pagina - 1) * query.porPagina,
      take: query.porPagina,
      select: SELECT_FILA,
    }),
  ]);

  const datos = await Promise.all(filas.map(mapearFila));

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

export async function obtenerDetalleEdicion(id: string) {
  const edicion = await prisma.edicionLimitada.findUnique({ where: { id }, select: SELECT_FILA });
  if (!edicion) throw ErrorApi.noEncontrado('La edición limitada no existe');
  return mapearFila(edicion);
}

async function validarProductoPublicado(productoId: string): Promise<void> {
  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { id: true, estado: true },
  });
  if (!producto) {
    throw ErrorApi.peticionInvalida('El producto no existe');
  }
  // archivado o solo_kits (cuando exista) quedan afuera por igual: un
  // producto que no aparece en el catálogo no puede anunciar un lote.
  if (producto.estado !== 'publicado') {
    throw ErrorApi.peticionInvalida(
      'Solo un producto publicado puede tener una edición limitada: uno archivado o solo en kits no aparece en el catálogo',
    );
  }
}

// Punto 4: un producto no puede tener dos ediciones VIGENTES (activas,
// sin mirar fechas vencidas de otras) al mismo tiempo. Dos rangos
// [desde, hasta) se solapan si cada uno empieza antes de que el otro
// termine — hasta null se trata como "sin fin" para esta comparación.
const SIN_FIN = new Date('9999-12-31T00:00:00.000Z');

async function validarSinSolapamiento(
  productoId: string,
  desde: Date,
  hasta: Date | null,
  excluirId?: string,
): Promise<void> {
  const otras = await prisma.edicionLimitada.findMany({
    where: {
      productoId,
      activa: true,
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    select: { id: true, nombre: true, desde: true, hasta: true },
  });

  const finNueva = hasta ?? SIN_FIN;
  const solapada = otras.find((existente) => {
    const finExistente = existente.hasta ?? SIN_FIN;
    return existente.desde < finNueva && desde < finExistente;
  });

  if (solapada) {
    throw ErrorApi.conflicto(
      `Este producto ya tiene una edición limitada vigente en ese rango de fechas: "${solapada.nombre}"`,
    );
  }
}

export async function crearEdicion(datos: BodyCrearEdicion, usuarioAdminId: string) {
  await validarProductoPublicado(datos.productoId);
  await validarSinSolapamiento(datos.productoId, datos.desde, datos.hasta ?? null);

  const creada = await prisma.edicionLimitada.create({
    data: {
      productoId: datos.productoId,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      unidadesLote: datos.unidadesLote ?? null,
      mostrarRestantes: datos.mostrarRestantes ?? true,
      desde: datos.desde,
      hasta: datos.hasta ?? null,
      creadoPorId: usuarioAdminId,
    },
    select: SELECT_FILA,
  });
  return mapearFila(creada);
}

export async function editarEdicion(id: string, datos: BodyEditarEdicion) {
  const actual = await prisma.edicionLimitada.findUnique({
    where: { id },
    select: { id: true, productoId: true, desde: true, hasta: true },
  });
  if (!actual) {
    throw ErrorApi.noEncontrado('La edición limitada no existe');
  }

  const nuevaDesde = datos.desde ?? actual.desde;
  const nuevaHasta = datos.hasta !== undefined ? datos.hasta : actual.hasta;
  if (nuevaHasta !== null && nuevaHasta <= nuevaDesde) {
    throw ErrorApi.peticionInvalida('La fecha de fin debe ser posterior a la de inicio');
  }

  if (datos.desde !== undefined || datos.hasta !== undefined) {
    await validarSinSolapamiento(actual.productoId, nuevaDesde, nuevaHasta, id);
  }

  const actualizada = await prisma.edicionLimitada.update({
    where: { id },
    data: {
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      unidadesLote: datos.unidadesLote,
      mostrarRestantes: datos.mostrarRestantes,
      desde: datos.desde,
      hasta: datos.hasta,
      activa: datos.activa,
      actualizadoEn: new Date(),
    },
    select: SELECT_FILA,
  });
  return mapearFila(actualizada);
}
