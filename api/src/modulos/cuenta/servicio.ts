import type { Prisma } from '@prisma/client';
import { ErrorApi } from '../../lib/errorApi.js';
import { prisma } from '../../lib/prisma.js';
import type { DatosActualizarDireccion, DatosCrearDireccion } from './esquemas.js';

export async function listarDirecciones(usuarioId: string) {
  return prisma.direccionUsuario.findMany({
    where: { usuarioId },
    orderBy: [{ esPrincipal: 'desc' }, { creadoEn: 'desc' }],
  });
}

async function desmarcarPrincipales(
  tx: Prisma.TransactionClient,
  usuarioId: string,
  excluirId?: string,
): Promise<void> {
  await tx.direccionUsuario.updateMany({
    where: { usuarioId, esPrincipal: true, ...(excluirId ? { id: { not: excluirId } } : {}) },
    data: { esPrincipal: false },
  });
}

export async function crearDireccion(usuarioId: string, datos: DatosCrearDireccion) {
  return prisma.$transaction(async (tx) => {
    if (datos.esPrincipal) {
      await desmarcarPrincipales(tx, usuarioId);
    }
    return tx.direccionUsuario.create({ data: { ...datos, usuarioId } });
  });
}

async function obtenerPropia(usuarioId: string, direccionId: string) {
  const direccion = await prisma.direccionUsuario.findUnique({ where: { id: direccionId } });
  if (!direccion || direccion.usuarioId !== usuarioId) {
    throw ErrorApi.noEncontrado('La dirección no existe');
  }
  return direccion;
}

export async function actualizarDireccion(
  usuarioId: string,
  direccionId: string,
  datos: DatosActualizarDireccion,
) {
  await obtenerPropia(usuarioId, direccionId);

  return prisma.$transaction(async (tx) => {
    if (datos.esPrincipal) {
      await desmarcarPrincipales(tx, usuarioId, direccionId);
    }
    return tx.direccionUsuario.update({ where: { id: direccionId }, data: datos });
  });
}

export async function eliminarDireccion(usuarioId: string, direccionId: string): Promise<void> {
  await obtenerPropia(usuarioId, direccionId);
  await prisma.direccionUsuario.delete({ where: { id: direccionId } });
}
