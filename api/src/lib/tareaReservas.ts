import { prisma } from './prisma.js';
import { consecuenciaInventario, validarTransicion } from '../modulos/admin/pedidos/maquinaEstados.js';

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
    await cancelarPedidoPorVencimiento(pago.pedidoId);
  }
}

// Única transición de pedido que el sistema dispara sin un admin de por
// medio: pasa igual por la máquina de estados (mismas reglas que
// cambiarEstadoPedido) y queda en pedido_historial con usuarioId null,
// para que no sea la única transición del sistema que no quede
// registrada. No usa cambiarEstadoPedido tal cual porque ese exige un
// usuarioAdminId y escribe auditoria_admin — acá no hay ningún admin que
// auditar, es el propio sistema.
async function cancelarPedidoPorVencimiento(pedidoId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      select: { id: true, estado: true },
    });
    // Mismo guard defensivo que tenía el updateMany original: si el
    // pedido ya salió de esperandoPago por otro camino (el webhook lo
    // pagó o lo rechazó, o un admin ya lo movió) entre el findMany de
    // arriba y acá, no hay nada que cancelar.
    if (!pedido || pedido.estado !== 'esperandoPago') return;

    validarTransicion(pedido.estado, 'cancelado');
    const consecuencia = consecuenciaInventario(pedido.estado, 'cancelado');

    if (consecuencia === 'liberarReserva') {
      // Lo normal es que esto no encuentre nada: la reserva de este mismo
      // pedido ya se liberó arriba, en el barrido de reservasVencidas
      // (comparten el mismo expiraEn, ver TANDA 1 punto 1). Se repite el
      // filtro liberadaEn: null para que, si alguna vez no coincidiera,
      // siga siendo correcto y no decremente dos veces.
      const reservas = await tx.reservaStock.findMany({
        where: { pedidoId, liberadaEn: null },
        select: { id: true, varianteId: true, cantidad: true },
      });
      for (const reserva of reservas) {
        await tx.varianteProducto.update({
          where: { id: reserva.varianteId },
          data: { stockReservado: { decrement: reserva.cantidad } },
        });
        await tx.reservaStock.update({ where: { id: reserva.id }, data: { liberadaEn: new Date() } });
      }
    }

    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        estado: 'cancelado',
        canceladoEn: new Date(),
        motivoCancelacion: 'El pago venció sin confirmarse',
      },
    });

    await tx.pedidoHistorial.create({
      data: {
        pedidoId,
        estadoAnterior: pedido.estado,
        estadoNuevo: 'cancelado',
        usuarioId: null,
        nota: 'Cancelado automáticamente por vencimiento de pago',
      },
    });
  });
}
