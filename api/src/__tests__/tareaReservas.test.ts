import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  reservaStock: { findMany: vi.fn(), update: vi.fn() },
  varianteProducto: { update: vi.fn() },
  pago: { findMany: vi.fn(), update: vi.fn() },
  pedido: { updateMany: vi.fn() },
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

  it('expira los pagos que pasaron su expira_en y cancela el pedido', async () => {
    prismaMock.reservaStock.findMany.mockResolvedValueOnce([]);
    prismaMock.pago.findMany.mockResolvedValueOnce([{ id: 'pago-1', pedidoId: 'pedido-1' }]);
    prismaMock.pago.update.mockResolvedValueOnce({});
    prismaMock.pedido.updateMany.mockResolvedValueOnce({});

    await liberarReservasYPagosVencidos();

    expect(prismaMock.pago.update).toHaveBeenCalledWith({
      where: { id: 'pago-1' },
      data: { estado: 'expirado' },
    });
    expect(prismaMock.pedido.updateMany).toHaveBeenCalledWith({
      where: { id: 'pedido-1', estado: 'esperandoPago' },
      data: expect.objectContaining({ estado: 'cancelado' }),
    });
  });
});
