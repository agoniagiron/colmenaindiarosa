// Prueba de integración real: cambiarEstadoPedido y crearReembolso
// componen varias escrituras en una sola transacción (pedido, reserva_stock,
// variante_producto, movimiento_inventario, pedido_historial,
// auditoria_admin) cuya semántica no vale la pena imitar con un Prisma
// mockeado — mismo criterio que agregacionAnalitica.test.ts.
// Requiere DATABASE_URL_TEST y la base preparada con
// `npx tsx scripts/preparar-db-prueba.ts`; si no está configurada, se
// salta en vez de romper `npm test`.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (!DATABASE_URL_TEST) {
  console.warn(
    'DATABASE_URL_TEST no está configurada: se salta la prueba de integración de pedidos admin. ' +
      'Corré npx tsx scripts/preparar-db-prueba.ts y configurá la variable en api/.env para incluirla.',
  );
} else {
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.DIRECT_URL = DATABASE_URL_TEST;
}

const describeConDbReal = DATABASE_URL_TEST ? describe : describe.skip;

const { prisma } = await import('../../lib/prisma.js');
const { cambiarEstadoPedido, crearReembolso } =
  await import('../../modulos/admin/pedidos/servicio.js');

const SUFIJO = `pedidos-admin-${Date.now()}`;

describeConDbReal('Admin/Pedidos: cambio de estado y reembolso contra PostgreSQL real', () => {
  let categoriaId: string;
  let productoId: string;
  let usuarioAdminId: string;
  const idsVariante: string[] = [];
  const idsPedido: string[] = [];

  beforeAll(async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat ${SUFIJO}`, slug: `cat-${SUFIJO}` },
    });
    categoriaId = categoria.id;

    const producto = await prisma.producto.create({
      data: { nombre: `Prod ${SUFIJO}`, slug: `prod-${SUFIJO}`, categoriaId, estado: 'publicado' },
    });
    productoId = producto.id;

    const usuarioAdmin = await prisma.usuarioAdmin.create({
      data: {
        nombre: 'Admin de prueba',
        correo: `${SUFIJO}@example.com`,
        claveHash: 'hash-no-usado-en-esta-prueba',
      },
    });
    usuarioAdminId = usuarioAdmin.id;
  });

  afterAll(async () => {
    await prisma.reservaStock.deleteMany({ where: { pedidoId: { in: idsPedido } } });
    await prisma.movimientoInventario.deleteMany({ where: { varianteId: { in: idsVariante } } });
    await prisma.pedidoHistorial.deleteMany({ where: { pedidoId: { in: idsPedido } } });
    await prisma.auditoriaAdmin.deleteMany({ where: { entidadId: { in: idsPedido } } });
    await prisma.reembolso.deleteMany({ where: { pago: { pedidoId: { in: idsPedido } } } });
    await prisma.pago.deleteMany({ where: { pedidoId: { in: idsPedido } } });
    await prisma.pedidoItem.deleteMany({ where: { pedidoId: { in: idsPedido } } });
    await prisma.pedido.deleteMany({ where: { id: { in: idsPedido } } });
    await prisma.varianteProducto.deleteMany({ where: { id: { in: idsVariante } } });
    await prisma.producto.deleteMany({ where: { id: productoId } });
    await prisma.categoria.deleteMany({ where: { id: categoriaId } });
    await prisma.usuarioAdmin.deleteMany({ where: { id: usuarioAdminId } });
    await prisma.$disconnect();
  });

  function datosBasePedido(numero: string) {
    return {
      numero,
      nombreContacto: 'Clienta',
      telefonoContacto: '3000000000',
      envioNombre: 'Clienta',
      envioTelefono: '3000000000',
      envioDepartamento: 'Valle',
      envioCiudad: 'Cali',
      envioDireccion: 'Calle falsa 123',
    };
  }

  it('rechaza una transición inválida (entregado -> esperandoPago)', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        ...datosBasePedido(`INR-INVALIDA-${SUFIJO}`),
        subtotal: 50000,
        total: 50000,
        estado: 'entregado',
        entregadoEn: new Date(),
      },
    });
    idsPedido.push(pedido.id);

    await expect(
      cambiarEstadoPedido(pedido.id, { estado: 'esperandoPago' }, usuarioAdminId, null),
    ).rejects.toMatchObject({ estadoHttp: 409 });

    const pedidoSinCambios = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(pedidoSinCambios.estado).toBe('entregado');
  });

  it('cancelar desde esperandoPago libera la reserva y devuelve stock_reservado', async () => {
    const variante = await prisma.varianteProducto.create({
      data: {
        productoId,
        sku: `SKU-RESERVA-${SUFIJO}`,
        precioActual: 50000,
        stockActual: 10,
        stockReservado: 2,
      },
    });
    idsVariante.push(variante.id);

    const pedido = await prisma.pedido.create({
      data: {
        ...datosBasePedido(`INR-RESERVA-${SUFIJO}`),
        subtotal: 100000,
        total: 100000,
        estado: 'esperandoPago',
        items: {
          create: [
            {
              varianteId: variante.id,
              nombreProducto: 'Prod',
              sku: variante.sku,
              precioUnitario: 50000,
              cantidad: 2,
              subtotal: 100000,
            },
          ],
        },
      },
    });
    idsPedido.push(pedido.id);

    const reserva = await prisma.reservaStock.create({
      data: {
        varianteId: variante.id,
        pedidoId: pedido.id,
        cantidad: 2,
        expiraEn: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await cambiarEstadoPedido(
      pedido.id,
      { estado: 'cancelado', nota: 'sin pago' },
      usuarioAdminId,
      null,
    );

    const reservaActualizada = await prisma.reservaStock.findUniqueOrThrow({
      where: { id: reserva.id },
    });
    expect(reservaActualizada.liberadaEn).not.toBeNull();

    const varianteActualizada = await prisma.varianteProducto.findUniqueOrThrow({
      where: { id: variante.id },
    });
    expect(varianteActualizada.stockReservado).toBe(0);
    // Nunca se descontó stock_actual: la reserva no llegó a convertirse en venta.
    expect(varianteActualizada.stockActual).toBe(10);

    const pedidoActualizado = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(pedidoActualizado.estado).toBe('cancelado');
    expect(pedidoActualizado.canceladoEn).not.toBeNull();

    const historial = await prisma.pedidoHistorial.findFirst({
      where: { pedidoId: pedido.id, estadoNuevo: 'cancelado' },
    });
    expect(historial?.estadoAnterior).toBe('esperandoPago');
  });

  it('cancelar desde pagado devuelve stock_actual y crea un movimiento de inventario', async () => {
    const variante = await prisma.varianteProducto.create({
      data: { productoId, sku: `SKU-PAGADO-${SUFIJO}`, precioActual: 50000, stockActual: 8 },
    });
    idsVariante.push(variante.id);

    const pedido = await prisma.pedido.create({
      data: {
        ...datosBasePedido(`INR-PAGADO-${SUFIJO}`),
        subtotal: 150000,
        total: 150000,
        estado: 'pagado',
        pagadoEn: new Date(),
        items: {
          create: [
            {
              varianteId: variante.id,
              nombreProducto: 'Prod',
              sku: variante.sku,
              precioUnitario: 50000,
              cantidad: 3,
              subtotal: 150000,
            },
          ],
        },
      },
    });
    idsPedido.push(pedido.id);

    await cambiarEstadoPedido(pedido.id, { estado: 'cancelado' }, usuarioAdminId, null);

    const varianteActualizada = await prisma.varianteProducto.findUniqueOrThrow({
      where: { id: variante.id },
    });
    expect(varianteActualizada.stockActual).toBe(11);

    const movimiento = await prisma.movimientoInventario.findFirst({
      where: { varianteId: variante.id, referenciaId: pedido.id },
    });
    expect(movimiento).not.toBeNull();
    expect(movimiento?.tipo).toBe('entrada');
    expect(movimiento?.cantidad).toBe(3);

    const pedidoActualizado = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(pedidoActualizado.estado).toBe('cancelado');
  });

  it('un reembolso parcial que no supera lo pagado se registra, y uno que sí lo supera se rechaza', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        ...datosBasePedido(`INR-REEMBOLSO-${SUFIJO}`),
        subtotal: 100000,
        total: 100000,
        estado: 'pagado',
        pagadoEn: new Date(),
      },
    });
    idsPedido.push(pedido.id);

    const pago = await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        pasarela: 'wompi',
        referenciaInterna: `REF-${SUFIJO}`,
        metodo: 'tarjetaCredito',
        estado: 'aprobado',
        monto: 100000,
        aprobadoEn: new Date(),
      },
    });

    const reembolso = await crearReembolso(
      pedido.id,
      { pagoId: pago.id, monto: 40000, tipo: 'defecto', motivo: 'Pieza con defecto' },
      usuarioAdminId,
      null,
    );
    expect(reembolso.monto).toBe(40000);
    expect(reembolso.tipo).toBe('defecto');
    expect(reembolso.estado).toBe('solicitado');

    // Ya reembolsados 40.000 de 100.000: quedan 60.000 disponibles. Pedir
    // 70.000 más supera lo pagado y debe rechazarse.
    await expect(
      crearReembolso(
        pedido.id,
        { pagoId: pago.id, monto: 70000, tipo: 'defecto', motivo: 'Pieza con defecto' },
        usuarioAdminId,
        null,
      ),
    ).rejects.toMatchObject({ estadoHttp: 409 });
  });
});
