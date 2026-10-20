// Prueba de integración real del webhook de Wompi: un fallo a mitad del
// procesamiento no puede dejar un pago aprobado registrado y sin procesar.
// HTTP de punta a punta (ruta + controlador + servicio) contra PostgreSQL.
// Requiere DATABASE_URL_TEST y la base preparada con
// `npx tsx scripts/preparar-db-prueba.ts`; si no está, se salta.
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (!DATABASE_URL_TEST) {
  console.warn(
    'DATABASE_URL_TEST no está configurada: se salta la prueba de integración del webhook. ' +
      'Corré npx tsx scripts/preparar-db-prueba.ts y configurá la variable en api/.env para incluirla.',
  );
} else {
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.DIRECT_URL = DATABASE_URL_TEST;
}

const describeConDbReal = DATABASE_URL_TEST ? describe : describe.skip;

const { app } = await import('../../app.js');
const { prisma } = await import('../../lib/prisma.js');
const { env } = await import('../../config/env.js');

const SUFIJO = `webhook-${Date.now()}`;
const TIMESTAMP = 1700000000;
const MONTO_CENTAVOS = 21500000;

function eventoAprobado(idTransaccion: string, referencia: string) {
  const estado = 'APPROVED';
  const checksum = createHash('sha256')
    .update(`${idTransaccion}${estado}${MONTO_CENTAVOS}${TIMESTAMP}${env.WOMPI_SECRETO_EVENTOS}`)
    .digest('hex');
  return {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: idTransaccion,
        reference: referencia,
        status: estado,
        amount_in_cents: MONTO_CENTAVOS,
      },
    },
    timestamp: TIMESTAMP,
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum,
    },
  };
}

const enviar = (evento: unknown) => request(app).post('/api/webhooks/wompi').send(evento);

describeConDbReal('Webhook de Wompi: reintento tras un fallo, contra PostgreSQL real', () => {
  let categoriaId: string;
  let productoId: string;
  let varianteId: string;
  let usuarioId: string;
  let contador = 0;

  // Un pedido esperando pago, con 2 unidades reservadas y su pago iniciado.
  async function pedidoEsperandoPago() {
    contador += 1;
    const numero = `W${contador}-${SUFIJO}`;
    const pedido = await prisma.pedido.create({
      data: {
        numero,
        usuarioId,
        nombreContacto: 'Clienta',
        telefonoContacto: '3000000000',
        envioNombre: 'Clienta',
        envioTelefono: '3000000000',
        envioDepartamento: 'Valle',
        envioCiudad: 'Cali',
        envioDireccion: 'Calle 1',
        subtotal: 200000,
        envio: 15000,
        total: 215000,
        items: {
          create: [
            {
              varianteId,
              nombreProducto: 'Prod',
              sku: `SKU-${SUFIJO}`,
              precioUnitario: 100000,
              cantidad: 2,
              subtotal: 200000,
            },
          ],
        },
        reservasStock: {
          create: [{ varianteId, cantidad: 2, expiraEn: new Date(Date.now() + 3600_000) }],
        },
        pagos: {
          create: [
            {
              pasarela: 'wompi',
              referenciaInterna: `${numero}-1`,
              metodo: 'tarjetaCredito',
              monto: 215000,
            },
          ],
        },
      },
    });
    await prisma.varianteProducto.update({
      where: { id: varianteId },
      data: { stockReservado: { increment: 2 } },
    });
    return { pedidoId: pedido.id, referencia: `${numero}-1`, idTransaccion: `txn-${numero}` };
  }

  const stock = async () =>
    prisma.varianteProducto.findUniqueOrThrow({
      where: { id: varianteId },
      select: { stockActual: true, stockReservado: true },
    });

  beforeAll(async () => {
    categoriaId = (
      await prisma.categoria.create({ data: { nombre: `Cat ${SUFIJO}`, slug: `cat-${SUFIJO}` } })
    ).id;
    productoId = (
      await prisma.producto.create({
        data: { nombre: `Prod ${SUFIJO}`, slug: `prod-${SUFIJO}`, categoriaId },
      })
    ).id;
    varianteId = (
      await prisma.varianteProducto.create({
        data: { productoId, sku: `SKU-${SUFIJO}`, precioActual: 100000, stockActual: 20 },
      })
    ).id;
    usuarioId = (
      await prisma.usuario.create({
        data: { nombre: 'Clienta', correo: `${SUFIJO}@example.com`, claveHash: 'x' },
      })
    ).id;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    const pedidos = await prisma.pedido.findMany({ where: { usuarioId }, select: { id: true } });
    const ids = pedidos.map((p) => p.id);
    await prisma.eventoPasarela.deleteMany({ where: { idEventoExterno: { contains: SUFIJO } } });
    await prisma.movimientoInventario.deleteMany({ where: { varianteId } });
    await prisma.pedido.deleteMany({ where: { id: { in: ids } } });
    await prisma.usuario.delete({ where: { id: usuarioId } });
    await prisma.varianteProducto.delete({ where: { id: varianteId } });
    await prisma.producto.delete({ where: { id: productoId } });
    await prisma.categoria.delete({ where: { id: categoriaId } });
    await prisma.$disconnect();
  });

  it('si el procesamiento falla responde 500, guarda el error, y el reintento lo procesa', async () => {
    const { pedidoId, referencia, idTransaccion } = await pedidoEsperandoPago();
    const evento = eventoAprobado(idTransaccion, referencia);
    const antes = await stock();

    // La base "se cae" justo en la transacción del pago aprobado.
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('base caída (simulada)'));
    const fallido = await enviar(evento);
    expect(fallido.status).toBe(500);

    const registro = await prisma.eventoPasarela.findUniqueOrThrow({
      where: { idEventoExterno: `${idTransaccion}:APPROVED` },
    });
    expect(registro.procesadoEn).toBeNull();
    expect(registro.errorProceso).toMatch(/base caída/);
    expect((await prisma.pago.findFirstOrThrow({ where: { pedidoId } })).estado).toBe('iniciado');

    // Wompi reintenta: ahora sí.
    const reintento = await enviar(evento);
    expect(reintento.status).toBe(200);
    expect((await prisma.pago.findFirstOrThrow({ where: { pedidoId } })).estado).toBe('aprobado');
    expect((await prisma.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe(
      'pagado',
    );
    expect(await stock()).toEqual({
      stockActual: antes.stockActual - 2,
      stockReservado: antes.stockReservado - 2,
    });
    const procesado = await prisma.eventoPasarela.findUniqueOrThrow({
      where: { idEventoExterno: `${idTransaccion}:APPROVED` },
    });
    expect(procesado.procesadoEn).not.toBeNull();
    expect(procesado.errorProceso).toBeNull();

    // Un tercer envío del mismo evento ya no toca nada.
    const despues = await stock();
    expect((await enviar(evento)).status).toBe(200);
    expect(await stock()).toEqual(despues);
  });

  it('dos envíos simultáneos del mismo evento descuentan stock una sola vez', async () => {
    const { pedidoId, referencia, idTransaccion } = await pedidoEsperandoPago();
    const evento = eventoAprobado(idTransaccion, referencia);
    const antes = await stock();

    const respuestas = await Promise.all([enviar(evento), enviar(evento)]);
    // Uno lo procesa; el otro lo encuentra procesado (200) o en curso (503).
    expect(respuestas.map((r) => r.status)).toContain(200);
    for (const r of respuestas) expect([200, 503]).toContain(r.status);

    expect((await prisma.pago.findFirstOrThrow({ where: { pedidoId } })).estado).toBe('aprobado');
    expect(await stock()).toEqual({
      stockActual: antes.stockActual - 2,
      stockReservado: antes.stockReservado - 2,
    });
  });

  it('un evento colgado (sin error, sin procesar) se responde 503 y se retoma pasado el abandono', async () => {
    const { pedidoId, referencia, idTransaccion } = await pedidoEsperandoPago();
    const evento = eventoAprobado(idTransaccion, referencia);
    // Como si el proceso hubiera muerto después de registrarlo.
    const colgado = await prisma.eventoPasarela.create({
      data: {
        pasarela: 'wompi',
        idEventoExterno: `${idTransaccion}:APPROVED`,
        tipo: 'transaction.updated',
        cuerpo: evento,
        firmaValida: true,
      },
    });

    expect((await enviar(evento)).status).toBe(503);
    expect((await prisma.pago.findFirstOrThrow({ where: { pedidoId } })).estado).toBe('iniciado');

    await prisma.eventoPasarela.update({
      where: { id: colgado.id },
      data: { recibidoEn: new Date(Date.now() - 3 * 60 * 1000) },
    });
    expect((await enviar(evento)).status).toBe(200);
    expect((await prisma.pago.findFirstOrThrow({ where: { pedidoId } })).estado).toBe('aprobado');
  });
});
