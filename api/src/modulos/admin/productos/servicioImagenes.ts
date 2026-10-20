import type { Prisma } from '@prisma/client';
import { ErrorApi } from '../../../lib/errorApi.js';
import { prisma } from '../../../lib/prisma.js';
import {
  crearUrlFirmada,
  eliminarArchivo,
  generarRutaImagen,
  rutaDesdeUrlPublica,
} from '../../../lib/supabaseStorage.js';
import type {
  BodyCrearImagen,
  BodyEditarImagen,
  BodyFirmarImagen,
  BodyOrdenImagenes,
  BodyValorImagenes,
} from './esquemasImagenes.js';

const SELECT_IMAGEN = {
  id: true,
  productoId: true,
  valorAtributoId: true,
  url: true,
  altTexto: true,
  tipo: true,
  orden: true,
  ancho: true,
  alto: true,
  creadoEn: true,
} satisfies Prisma.ImagenProductoSelect;

async function obtenerProductoOFallar(productoId: string): Promise<void> {
  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { id: true },
  });
  if (!producto) {
    throw ErrorApi.noEncontrado('El producto no existe');
  }
}

// Una foto solo puede ir a un valor que use alguna variante del producto:
// si no, nunca se mostraría.
async function validarValorDelProducto(productoId: string, valorAtributoId: string): Promise<void> {
  const usado = await prisma.varianteValorAtributo.findFirst({
    where: { valorId: valorAtributoId, varianteProducto: { productoId } },
    select: { valorId: true },
  });
  if (!usado) {
    throw ErrorApi.peticionInvalida('Ninguna variante de este producto usa ese valor');
  }
}

export async function firmarSubidaImagen(productoId: string, datos: BodyFirmarImagen) {
  await obtenerProductoOFallar(productoId);
  const ruta = generarRutaImagen(productoId, datos.tipo);
  return crearUrlFirmada(ruta);
}

export async function crearImagen(productoId: string, datos: BodyCrearImagen) {
  await obtenerProductoOFallar(productoId);

  if (datos.valorAtributoId) {
    await validarValorDelProducto(productoId, datos.valorAtributoId);
  }

  return prisma.imagenProducto.create({
    data: {
      productoId,
      valorAtributoId: datos.valorAtributoId,
      url: datos.url,
      altTexto: datos.altTexto,
      tipo: datos.tipo,
      orden: datos.orden,
      ancho: datos.ancho,
      alto: datos.alto,
    },
    select: SELECT_IMAGEN,
  });
}

export async function editarImagen(id: string, datos: BodyEditarImagen) {
  const imagen = await prisma.imagenProducto.findUnique({
    where: { id },
    select: { productoId: true },
  });
  if (!imagen) {
    throw ErrorApi.noEncontrado('La imagen no existe');
  }

  if (datos.valorAtributoId) {
    await validarValorDelProducto(imagen.productoId, datos.valorAtributoId);
  }

  return prisma.imagenProducto.update({
    where: { id },
    data: {
      altTexto: datos.altTexto,
      tipo: datos.tipo,
      valorAtributoId: datos.valorAtributoId,
    },
    select: SELECT_IMAGEN,
  });
}

export async function reordenarImagenes(productoId: string, datos: BodyOrdenImagenes) {
  const imagenes = await prisma.imagenProducto.findMany({
    where: { productoId },
    select: { id: true },
  });
  const idsExistentes = new Set(imagenes.map((i) => i.id));
  const idsRecibidos = new Set(datos.ids);

  if (
    idsExistentes.size !== idsRecibidos.size ||
    [...idsExistentes].some((id) => !idsRecibidos.has(id))
  ) {
    throw ErrorApi.peticionInvalida(
      'La lista de ids no coincide con las imágenes de este producto',
    );
  }

  await prisma.$transaction(
    datos.ids.map((id, indice) =>
      prisma.imagenProducto.update({ where: { id }, data: { orden: indice } }),
    ),
  );

  return prisma.imagenProducto.findMany({
    where: { productoId },
    orderBy: { orden: 'asc' },
    select: SELECT_IMAGEN,
  });
}

// Marca varias fotos del producto con el mismo valor (o como genéricas)
// en una sola transacción: subís diez fotos rosas y las marcás juntas.
export async function asignarValorImagenes(productoId: string, datos: BodyValorImagenes) {
  await obtenerProductoOFallar(productoId);

  const ids = [...new Set(datos.ids)];
  const delProducto = await prisma.imagenProducto.count({
    where: { id: { in: ids }, productoId },
  });
  if (delProducto !== ids.length) {
    throw ErrorApi.peticionInvalida('Alguna de las imágenes no es de este producto');
  }
  if (datos.valorAtributoId) {
    await validarValorDelProducto(productoId, datos.valorAtributoId);
  }

  await prisma.imagenProducto.updateMany({
    where: { id: { in: ids }, productoId },
    data: { valorAtributoId: datos.valorAtributoId },
  });

  return prisma.imagenProducto.findMany({
    where: { productoId },
    orderBy: { orden: 'asc' },
    select: SELECT_IMAGEN,
  });
}

export async function eliminarImagen(id: string): Promise<{ huerfano: boolean }> {
  const imagen = await prisma.imagenProducto.findUnique({ where: { id }, select: { url: true } });
  if (!imagen) {
    throw ErrorApi.noEncontrado('La imagen no existe');
  }

  await prisma.imagenProducto.delete({ where: { id } });

  const ruta = rutaDesdeUrlPublica(imagen.url);
  if (!ruta) {
    console.error(
      `[imagenes] Fila borrada pero la url no es del bucket, no se intenta borrar archivo: ${imagen.url}`,
    );
    return { huerfano: true };
  }

  const resultado = await eliminarArchivo(ruta);
  if (!resultado.ok) {
    console.error(
      `[imagenes] Fila borrada pero falló el borrado del archivo en el bucket: ${ruta} — ${resultado.error}`,
    );
    return { huerfano: true };
  }
  return { huerfano: false };
}
