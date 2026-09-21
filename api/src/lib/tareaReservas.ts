import { prisma } from './prisma.js';

// Corre cada 5 minutos (arrancada desde index.ts, nunca desde app.ts: los
// tests importan app.ts y no deben disparar esto).
export async function liberarReservasYPagosVencidos(): Promise<void> {
  const ahora = new Date();

  const reservasVencidas = await prisma.reservaStock.findMany({
    where: { expiraEn: { lt: ahora }, liberadaEn: null },
    select: { id: true, varianteId: true, cantidad: true },
  });

  for (const reserva of reservasVencidas) {
    await prisma.$transaction([
      prisma.varianteProducto.update({
        where: { id: reserva.varianteId },
        data: { stockReservado: { decrement: reserva.cantidad } },
      }),
      prisma.reservaStock.update({ where: { id: reserva.id }, data: { liberadaEn: ahora } }),
    ]);
  }

  const pagosVencidos = await prisma.pago.findMany({
    where: { estado: 'iniciado', expiraEn: { lt: ahora } },
    select: { id: true, pedidoId: true },
  });

  for (const pago of pagosVencidos) {
    await prisma.pago.update({ where: { id: pago.id }, data: { estado: 'expirado' } });
    await prisma.pedido.updateMany({
      where: { id: pago.pedidoId, estado: 'esperandoPago' },
      data: { estado: 'cancelado', motivoCancelacion: 'El pago venció sin confirmarse' },
    });
  }
}
