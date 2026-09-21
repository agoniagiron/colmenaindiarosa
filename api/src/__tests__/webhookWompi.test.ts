import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  eventoPasarela: { create: vi.fn(), update: vi.fn() },
  pago: { findUnique: vi.fn(), update: vi.fn() },
  pedido: { findUnique: vi.fn(), update: vi.fn() },
  pedidoItem: { findMany: vi.fn() },
  varianteProducto: { update: vi.fn() },
  movimientoInventario: { create: vi.fn() },
  reservaStock: { updateMany: vi.fn() },
  cupon: { update: vi.fn() },
  carrito: { updateMany: vi.fn() },
  pedidoHistorial: { create: vi.fn() },
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === 'function') return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../lib/notificacionTienda.js', () => ({
  servicioNotificacionTienda: { notificarPedidoPagado: vi.fn().mockResolvedValue(undefined) },
}));

const { procesarWebhook } = await import('../modulos/pagos/servicio.js');
const { env } = await import('../config/env.js');

const PROPIEDADES = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
const TIMESTAMP = 1700000000;

function checksumValido(idTransaccion: string, estado: string, montoEnCentavos: number): string {
  const valores = [idTransaccion, estado, String(montoEnCentavos)];
  return createHash('sha256')
    .update(`${valores.join('')}${TIMESTAMP}${env.WOMPI_SECRETO_EVENTOS}`)
    .digest('hex');
}

function eventoWompi(
  idTransaccion: string,
  referencia: string,
  estado: string,
  montoEnCentavos = 21500000,
  checksum?: string,
) {
  return {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: idTransaccion,
        reference: referencia,
        status: estado,
        amount_in_cents: montoEnCentavos,
      },
    },
    timestamp: TIMESTAMP,
    signature: {
      properties: PROPIEDADES,
      checksum: checksum ?? checksumValido(idTransaccion, estado, montoEnCentavos),
    },
  };
}

describe('POST /api/webhooks/wompi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  it('con firma inválida: registra el evento con firma_valida false y no procesa nada más', async () => {
    const evento = eventoWompi(
      'txn-invalida',
      'INR-000009-1',
      'APPROVED',
      21500000,
      'checksum-incorrecto',
    );

    prismaMock.eventoPasarela.create.mockResolvedValueOnce({ id: 'evt-invalido' });

    await procesarWebhook(evento);

    expect(prismaMock.eventoPasarela.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ firmaValida: false }) }),
    );
    expect(prismaMock.pago.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.varianteProducto.update).not.toHaveBeenCalled();
  });

  it('duplicado: el segundo envío del mismo evento no descuenta stock otra vez', async () => {
    const evento = eventoWompi('txn-1', 'INR-000001-1', 'APPROVED');

    prismaMock.eventoPasarela.create.mockResolvedValueOnce({ id: 'evt-1' });
    prismaMock.pago.findUnique.mockResolvedValueOnce({
      id: 'pago-1',
      pedidoId: 'pedido-1',
      estado: 'iniciado',
    });
    prismaMock.pedido.findUnique.mockResolvedValueOnce({
      id: 'pedido-1',
      numero: 'INR-000001',
      estado: 'esperandoPago',
      usuarioId: 'usuario-1',
      cuponId: null,
    });
    prismaMock.pago.update.mockResolvedValueOnce({});
    prismaMock.pedido.update.mockResolvedValueOnce({});
    prismaMock.pedidoItem.findMany.mockResolvedValueOnce([{ varianteId: 'var-1', cantidad: 2 }]);
    prismaMock.varianteProducto.update.mockResolvedValueOnce({ stockActual: 8 });
    prismaMock.movimientoInventario.create.mockResolvedValueOnce({});
    prismaMock.reservaStock.updateMany.mockResolvedValueOnce({});
    prismaMock.carrito.updateMany.mockResolvedValueOnce({});
    prismaMock.pedidoHistorial.create.mockResolvedValueOnce({});
    prismaMock.eventoPasarela.update.mockResolvedValueOnce({});

    await procesarWebhook(evento);

    expect(prismaMock.varianteProducto.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.varianteProducto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'var-1' },
        data: { stockActual: { decrement: 2 }, stockReservado: { decrement: 2 } },
      }),
    );

    // Segundo envío del MISMO evento: id_evento_externo ya existe -> choque de unique.
    prismaMock.eventoPasarela.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await procesarWebhook(evento);

    // No se volvió a tocar stock ni nada del procesamiento de negocio.
    expect(prismaMock.varianteProducto.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.pago.findUnique).toHaveBeenCalledTimes(1);
  });
});
