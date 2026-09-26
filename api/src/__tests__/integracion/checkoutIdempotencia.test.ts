// Prueba de integración real: iniciarCheckout con la misma clave de
// idempotencia dos veces no debe crear un segundo pedido ni reservar stock
// dos veces. Esto depende de la restricción unique real de la columna
// clave_idempotencia (Prisma no la simula igual con un mock), así que va
// contra PostgreSQL real, mismo criterio que el resto de src/__tests__/
// integracion/.
// Requiere DATABASE_URL_TEST y la base preparada con
// `npx tsx scripts/preparar-db-prueba.ts`; si no está configurada, se
// salta en vez de romper `npm test`.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (!DATABASE_URL_TEST) {
  console.warn(
    'DATABASE_URL_TEST no está configurada: se salta la prueba de integración de idempotencia ' +
      'del checkout. Corré npx tsx scripts/preparar-db-prueba.ts y configurá la variable en ' +
      'api/.env para incluirla.',
  );
} else {
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.DIRECT_URL = DATABASE_URL_TEST;
}

const describeConDbReal = DATABASE_URL_TEST ? describe : describe.skip;

const { prisma } = await import('../../lib/prisma.js');
const { iniciarCheckout } = await import('../../modulos/pedidos/servicio.js');

const SUFIJO = `checkout-idempotencia-${Date.now()}`;

const FILAS_CONFIGURACION = [
  { clave: 'envio.costo', valor: '15000', tipo: 'entero' as const, grupo: 'envio', etiqueta: '' },
  {
    clave: 'descuento.umbral',
    valor: '400000',
    tipo: 'entero' as const,
    grupo: 'descuento',
    etiqueta: '',
  },
  {
    clave: 'descuento.porcentaje',
    valor: '10',
    tipo: 'entero' as const,
    grupo: 'descuento',
    etiqueta: '',
  },
  {
    clave: 'descuento.activo',
    valor: 'true',
    tipo: 'booleano' as const,
    grupo: 'descuento',
    etiqueta: '',
  },
  {
    clave: 'moneda.tasa_usd',
    valor: '4100',
    tipo: 'entero' as const,
    grupo: 'moneda',
    etiqueta: '',
  },
];

describeConDbReal('Checkout: clave de idempotencia contra PostgreSQL real', () => {
  let categoriaId: string;
  let productoId: string;
  let varianteId: string;
  let usuarioId: string;

  beforeAll(async () => {
    await prisma.configuracion.createMany({ data: FILAS_CONFIGURACION, skipDuplicates: true });

    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat ${SUFIJO}`, slug: `cat-${SUFIJO}` },
    });
    categoriaId = categoria.id;

    const producto = await prisma.producto.create({
      data: { nombre: `Prod ${SUFIJO}`, slug: `prod-${SUFIJO}`, categoriaId, estado: 'publicado' },
    });
    productoId = producto.id;

    const variante = await prisma.varianteProducto.create({
      data: {
        productoId,
        sku: `SKU-${SUFIJO}`,
        precioActual: 100000,
        stockActual: 10,
        stockReservado: 0,
        activa: true,
      },
    });
    varianteId = variante.id;

    const usuario = await prisma.usuario.create({
      data: {
        nombre: 'Clienta de prueba',
        correo: `${SUFIJO}@example.com`,
        claveHash: 'hash-no-usado-en-esta-prueba',
      },
    });
    usuarioId = usuario.id;
  });

  afterAll(async () => {
    const pedidos = await prisma.pedido.findMany({ where: { usuarioId }, select: { id: true } });
    const idsPedido = pedidos.map((p) => p.id);

    await prisma.reservaStock.deleteMany({ where: { varianteId } });
    await prisma.pago.deleteMany({ where: { pedidoId: { in: idsPedido } } });
    await prisma.pedidoItem.deleteMany({ where: { pedidoId: { in: idsPedido } } });
    await prisma.pedido.deleteMany({ where: { id: { in: idsPedido } } });
    await prisma.carrito.deleteMany({ where: { usuarioId } });
    await prisma.usuario.deleteMany({ where: { id: usuarioId } });
    await prisma.varianteProducto.deleteMany({ where: { id: varianteId } });
    await prisma.producto.deleteMany({ where: { id: productoId } });
    await prisma.categoria.deleteMany({ where: { id: categoriaId } });
    await prisma.$disconnect();
  });

  async function crearCarritoConItem(cantidad: number) {
    return prisma.carrito.create({
      data: {
        usuarioId,
        items: { create: [{ varianteId, cantidad }] },
      },
    });
  }

  function datosCheckout(claveIdempotencia: string) {
    return {
      claveIdempotencia,
      nombreContacto: 'Clienta',
      telefonoContacto: '3000000000',
      envioNombre: 'Clienta',
      envioTelefono: '3000000000',
      envioDepartamento: 'Valle',
      envioCiudad: 'Cali',
      envioDireccion: 'Calle falsa 123',
      metodoPago: 'tarjeta' as const,
      monedaMostrada: 'COP' as const,
    };
  }

  it('la misma clave dos veces devuelve el mismo pedido y reserva stock una sola vez', async () => {
    const clave = `clave-${SUFIJO}`;
    const carrito = await crearCarritoConItem(2);

    const primero = await iniciarCheckout(usuarioId, datosCheckout(clave));
    const segundo = await iniciarCheckout(usuarioId, datosCheckout(clave));

    expect(segundo.numeroPedido).toBe(primero.numeroPedido);
    expect(segundo.referencia).toBe(primero.referencia);
    expect(segundo.firma).toBe(primero.firma);

    const pedidos = await prisma.pedido.findMany({ where: { claveIdempotencia: clave } });
    expect(pedidos).toHaveLength(1);

    const variante = await prisma.varianteProducto.findUniqueOrThrow({
      where: { id: varianteId },
    });
    expect(variante.stockReservado).toBe(2);

    // iniciarCheckout no marca el carrito de origen como convertido (no es
    // parte de este prompt): se marca acá a mano para que el próximo
    // findFirst({ convertidoEn: null }) de este mismo usuario no lo vuelva
    // a encontrar.
    await prisma.carrito.update({ where: { id: carrito.id }, data: { convertidoEn: new Date() } });
  });

  it('una clave distinta sí crea un pedido nuevo (no queda pegado a la anterior)', async () => {
    const carrito = await crearCarritoConItem(1);

    const resultado = await iniciarCheckout(usuarioId, datosCheckout(`clave-otra-${SUFIJO}`));
    await prisma.carrito.update({ where: { id: carrito.id }, data: { convertidoEn: new Date() } });

    const pedidos = await prisma.pedido.findMany({
      where: { claveIdempotencia: `clave-otra-${SUFIJO}` },
    });
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]!.numero).toBe(resultado.numeroPedido);

    const variante = await prisma.varianteProducto.findUniqueOrThrow({
      where: { id: varianteId },
    });
    // 2 del primer pedido + 1 de este.
    expect(variante.stockReservado).toBe(3);
  });
});
