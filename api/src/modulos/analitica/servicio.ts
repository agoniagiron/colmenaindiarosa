import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DatosRegistrarEvento } from './esquemas.js';

export async function registrarEvento(
  datos: DatosRegistrarEvento,
  sesionId: string | undefined,
): Promise<void> {
  if (!sesionId) return;
  try {
    await prisma.eventoAnalitica.create({
      data: {
        sesionId,
        tipo: datos.tipo,
        pedidoId: datos.pedidoId,
        ruta: datos.ruta,
        metadatos: datos.metadatos as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // No bloquea al frontend si el registro de analítica falla.
  }
}
