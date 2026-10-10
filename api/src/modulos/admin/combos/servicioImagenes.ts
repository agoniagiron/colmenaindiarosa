import { Prisma } from '@prisma/client';
import { ErrorApi } from '../../../lib/errorApi.js';
import { prisma } from '../../../lib/prisma.js';
import {
  crearUrlFirmada,
  eliminarArchivo,
  generarRutaImagenCombo,
  rutaDesdeUrlPublica,
} from '../../../lib/supabaseStorage.js';
import type {
  BodyCrearImagenCombo,
  BodyEditarImagenCombo,
  BodyFirmarImagenCombo,
  BodyOrdenImagenesCombo,
} from './esquemasImagenes.js';

const SELECT_IMAGEN = {
  id: true,
  comboId: true,
  url: true,
  altTexto: true,
  tipo: true,
  orden: true,
  ancho: true,
  alto: true,
  creadoEn: true,
} satisfies Prisma.ImagenComboSelect;

async function obtenerComboOFallar(comboId: string): Promise<void> {
  const combo = await prisma.combo.findUnique({ where: { id: comboId }, select: { id: true } });
  if (!combo) {
    throw ErrorApi.noEncontrado('El kit no existe');
  }
}

// La base garantiza que no haya dos 'principal' del mismo kit (índice
// único parcial idx_imagen_combo_principal, ver el SQL que corrió el
// usuario) — esto solo traduce esa violación a un mensaje claro en vez de
// dejar pasar el 500 crudo de Postgres. No hace falta distinguir el
// nombre del índice en el error: en este módulo, el único insert/update
// que puede chocar con esa restricción es justo el que está marcando una
// imagen como 'principal'.
function esColisionPrincipal(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const MENSAJE_COLISION_PRINCIPAL = 'Este kit ya tiene una foto marcada como principal';

export async function firmarSubidaImagenCombo(comboId: string, datos: BodyFirmarImagenCombo) {
  await obtenerComboOFallar(comboId);
  const ruta = generarRutaImagenCombo(comboId, datos.tipo);
  return crearUrlFirmada(ruta);
}

export async function crearImagenCombo(comboId: string, datos: BodyCrearImagenCombo) {
  await obtenerComboOFallar(comboId);

  try {
    return await prisma.imagenCombo.create({
      data: {
        comboId,
        url: datos.url,
        altTexto: datos.altTexto,
        tipo: datos.tipo,
        orden: datos.orden,
        ancho: datos.ancho,
        alto: datos.alto,
      },
      select: SELECT_IMAGEN,
    });
  } catch (error) {
    if (datos.tipo === 'principal' && esColisionPrincipal(error)) {
      throw ErrorApi.conflicto(MENSAJE_COLISION_PRINCIPAL);
    }
    throw error;
  }
}

export async function editarImagenCombo(id: string, datos: BodyEditarImagenCombo) {
  const imagen = await prisma.imagenCombo.findUnique({ where: { id }, select: { id: true } });
  if (!imagen) {
    throw ErrorApi.noEncontrado('La imagen no existe');
  }

  try {
    return await prisma.imagenCombo.update({
      where: { id },
      data: {
        altTexto: datos.altTexto,
        tipo: datos.tipo,
      },
      select: SELECT_IMAGEN,
    });
  } catch (error) {
    if (datos.tipo === 'principal' && esColisionPrincipal(error)) {
      throw ErrorApi.conflicto(MENSAJE_COLISION_PRINCIPAL);
    }
    throw error;
  }
}

export async function reordenarImagenesCombo(comboId: string, datos: BodyOrdenImagenesCombo) {
  const imagenes = await prisma.imagenCombo.findMany({
    where: { comboId },
    select: { id: true },
  });
  const idsExistentes = new Set(imagenes.map((i) => i.id));
  const idsRecibidos = new Set(datos.ids);

  if (
    idsExistentes.size !== idsRecibidos.size ||
    [...idsExistentes].some((id) => !idsRecibidos.has(id))
  ) {
    throw ErrorApi.peticionInvalida('La lista de ids no coincide con las imágenes de este kit');
  }

  await prisma.$transaction(
    datos.ids.map((id, indice) =>
      prisma.imagenCombo.update({ where: { id }, data: { orden: indice } }),
    ),
  );

  return prisma.imagenCombo.findMany({
    where: { comboId },
    orderBy: { orden: 'asc' },
    select: SELECT_IMAGEN,
  });
}

export async function eliminarImagenCombo(id: string): Promise<{ huerfano: boolean }> {
  const imagen = await prisma.imagenCombo.findUnique({ where: { id }, select: { url: true } });
  if (!imagen) {
    throw ErrorApi.noEncontrado('La imagen no existe');
  }

  await prisma.imagenCombo.delete({ where: { id } });

  const ruta = rutaDesdeUrlPublica(imagen.url);
  if (!ruta) {
    console.error(
      `[imagenesCombo] Fila borrada pero la url no es del bucket, no se intenta borrar archivo: ${imagen.url}`,
    );
    return { huerfano: true };
  }

  const resultado = await eliminarArchivo(ruta);
  if (!resultado.ok) {
    console.error(
      `[imagenesCombo] Fila borrada pero falló el borrado del archivo en el bucket: ${ruta} — ${resultado.error}`,
    );
    return { huerfano: true };
  }
  return { huerfano: false };
}
