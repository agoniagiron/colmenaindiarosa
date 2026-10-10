import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  reservaStock: { findMany: vi.fn(), update: vi.fn() },
  varianteProducto: { update: vi.fn() },
  pago: { findMany: vi.fn(), update: vi.fn() },
  pedido: { findUnique: vi.fn(), update: vi.fn() },
  pedidoHistorial: { create: vi.fn() },
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === 'function') return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { liberarReservasYPagosVencidos } = await import('../lib/tareaReservas.js');

describe('liberarReservasYPagosVencidos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve el stock_reservado de cada reserva vencida y la marca liberada', async () => {
    prismaMock.reservaStock.findMany.mockResolvedValueOnce([
      { id: 'reserva-1', varianteId: 'var-1', cantidad: 3 },
      { id: 'reserva-2', varianteId: 'var-2', cantidad: 1 },
    ]);
    prismaMock.varianteProducto.update.mockResolvedValue({});
    prismaMock.reservaStock.update.mockResolvedValue({});
    prismaMock.pago.findMany.mockResolvedValueOnce([]);

    await liberarReservasYPagosVencidos();

    expect(prismaMock.reservaStock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ liberadaEn: null }),
      }),
    );

    expect(prismaMock.varianteProducto.update).toHaveBeenCalledWith({
      where: { id: 'var-1' },
      data: { stockReservado: { decrement: 3 } },
    });
    expect(prismaMock.varianteProducto.update).toHaveBeenCalledWith({
      where: { id: 'var-2' },
      data: { stockReservado: { decrement: 1 } },
    });
    expect(prismaMock.reservaStock.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'reserva-1' } }),
    );
    expect(prismaMock.reservaStock.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'reserva-2' } }),
    );
  });

  it('expira los pagos que pasaron su expira_en y cancela el pedido pasando por la máquina de estados', async () => {
    prismaMock.reservaStock.findMany.mockResolvedValueOnce([]);
    prismaMock.pago.findMany.mockResolvedValueOnce([{ id: 'pago-1', pedidoId: 'pedido-1' }]);
    prismaMock.pago.update.mockResolvedValueOnce({});
    prismaMock.pedido.findUnique.mockResolvedValueOnce({ id: 'pedido-1', estado: 'esperandoPago' });
    // La reserva de este pedido ya se liberó arriba (mismo expiraEn que el
    // pago): acá no debería quedar ninguna con liberadaEn: null.
    prismaMock.reservaStock.findMany.mockResolvedValueOnce([]);
    prismaMock.pedido.update.mockResolvedValueOnce({});
    prismaMock.pedidoHistorial.create.mockResolvedValueOnce({});

    await liberarReservasYPagosVencidos();

    expect(prismaMock.pago.update).toHaveBeenCalledWith({
      where: { id: 'pago-1' },
      data: { estado: 'expirado' },
    });
    expect(prismaMock.pedido.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pedido-1' },
        data: expect.objectContaining({ estado: 'cancelado' }),
      }),
    );
    // Única transición del sistema (sin admin de por medio): usuarioId
    // null, y una nota que diga que fue automático.
    expect(prismaMock.pedidoHistorial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pedidoId: 'pedido-1',
          estadoAnterior: 'esperandoPago',
          estadoNuevo: 'cancelado',
          usuarioId: null,
          nota: expect.stringContaining('vencimiento'),
        }),
      }),
    );
  });

  it('si el pedido ya salió de esperandoPago por otro camino (webhook, admin), no lo toca', async () => {
    prismaMock.reservaStock.findMany.mockResolvedValueOnce([]);
    prismaMock.pago.findMany.mockResolvedValueOnce([{ id: 'pago-2', pedidoId: 'pedido-2' }]);
    prismaMock.pago.update.mockResolvedValueOnce({});
    // Entre el findMany de pagos vencidos y acá, el webhook ya lo pagó.
    prismaMock.pedido.findUnique.mockResolvedValueOnce({ id: 'pedido-2', estado: 'pagado' });

    await liberarReservasYPagosVencidos();

    expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    expect(prismaMock.pedidoHistorial.create).not.toHaveBeenCalled();
  });
});
