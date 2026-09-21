// Prueba de integración real: recalcularDia compone muchas consultas
// (groupBy, distinct, relaciones) cuya semántica no vale la pena imitar
// con un Prisma mockeado — mismo criterio que authRegistroLogin.test.ts.
// Requiere DATABASE_URL_TEST y la base preparada con
// `npx tsx scripts/preparar-db-prueba.ts`; si no está configurada, se
// salta en vez de romper `npm test`.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (!DATABASE_URL_TEST) {
  console.warn(
    'DATABASE_URL_TEST no está configurada: se salta la prueba de integración de analítica. ' +
      'Corré npx tsx scripts/preparar-db-prueba.ts y configurá la variable en api/.env para incluirla.',
  );
} else {
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.DIRECT_URL = DATABASE_URL_TEST;
}

const describeConDbReal = DATABASE_URL_TEST ? describe : describe.skip;

const { prisma } = await import('../../lib/prisma.js');
const { recalcularDia } = await import('../../modulos/analitica/agregacion.js');
const { obtenerEmbudo, obtenerProductos, obtenerCalificaciones } =
  await import('../../modulos/analitica/servicioReportes.js');
const { claveDia, limitesDia } = await import('../../lib/fechasReporte.js');

const SUFIJO = `analitica-${Date.now()}`;

describeConDbReal('Analítica: agregación y consultas contra PostgreSQL real (sin mocks)', () => {
  let categoriaId: string;
  let productoConVentasId: string;
  let productoSinVentasId: string;
  let varianteId: string;
  let usuarioId: string;
  const idsSesion: string[] = [];
  const idsPedido: string[] = [];

  beforeAll(async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat ${SUFIJO}`, slug: `cat-${SUFIJO}` },
    });
    categoriaId = categoria.id;

    const productoConVentas = await prisma.producto.create({
      data: {
        nombre: `Con ventas ${SUFIJO}`,
        slug: `con-ventas-${SUFIJO}`,
        categoriaId,
        estado: 'publicado',
      },
    });
    productoConVentasId = productoConVentas.id;

    const productoSinVentas = await prisma.producto.create({
      data: {
        nombre: `Sin ventas ${SUFIJO}`,
        slug: `sin-ventas-${SUFIJO}`,
        categoriaId,
        estado: 'publicado',
      },
    });
    productoSinVentasId = productoSinVentas.id;

    const variante = await prisma.varianteProducto.create({
      data: {
        productoId: productoConVentasId,
        sku: `SKU-${SUFIJO}`,
        precioActual: 50000,
        costoActual: 20000,
        stockActual: 100,
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
    await prisma.pedidoItem.deleteMany({ where: { pedidoId: { in: idsPedido } } });
    await prisma.pedido.deleteMany({ where: { id: { in: idsPedido } } });
    await prisma.eventoAnalitica.deleteMany({ where: { sesionId: { in: idsSesion } } });
    await prisma.sesionVisita.deleteMany({ where: { id: { in: idsSesion } } });
    await prisma.metricaDiaria.deleteMany({
      where: { fecha: { in: ['2024-06-10', '2024-06-11', '2024-06-12'].map((f) => claveDia(f)) } },
    });
    await prisma.productoMetricaDiaria.deleteMany({
      where: { productoId: { in: [productoConVentasId, productoSinVentasId] } },
    });
    await prisma.productoResumen.deleteMany({
      where: { productoId: { in: [productoConVentasId, productoSinVentasId] } },
    });
    await prisma.varianteProducto.deleteMany({ where: { id: varianteId } });
    await prisma.producto.deleteMany({
      where: { id: { in: [productoConVentasId, productoSinVentasId] } },
    });
    await prisma.categoria.deleteMany({ where: { id: categoriaId } });
    await prisma.usuario.deleteMany({ where: { id: usuarioId } });
    await prisma.$disconnect();
  });

  it('recalcularDia es idempotente: correrla dos veces sobre el mismo día da el mismo resultado', async () => {
    const fecha = '2024-06-10';
    const { inicio } = limitesDia(fecha);

    const sesion = await prisma.sesionVisita.create({
      data: {
        visitanteId: `visitante-${SUFIJO}-idem`,
        inicioEn: new Date(inicio.getTime() + 3600_000),
      },
    });
    idsSesion.push(sesion.id);

    const pedido = await prisma.pedido.create({
      data: {
        numero: `INR-IDEM-${SUFIJO}`,
        usuarioId,
        nombreContacto: 'Clienta',
        telefonoContacto: '3000000000',
        envioNombre: 'Clienta',
        envioTelefono: '3000000000',
        envioDepartamento: 'Valle',
        envioCiudad: 'Cali',
        envioDireccion: 'Calle falsa 123',
        subtotal: 50000,
        total: 50000,
        estado: 'pagado',
        pagadoEn: new Date(inicio.getTime() + 3600_000),
        items: {
          create: [
            {
              varianteId,
              nombreProducto: 'Con ventas',
              sku: `SKU-${SUFIJO}`,
              precioUnitario: 50000,
              costoUnitario: 20000,
              cantidad: 1,
              subtotal: 50000,
            },
          ],
        },
      },
    });
    idsPedido.push(pedido.id);

    await recalcularDia(fecha);
    const primeraVez = await prisma.metricaDiaria.findUnique({ where: { fecha: claveDia(fecha) } });
    const primeraVezProducto = await prisma.productoMetricaDiaria.findUnique({
      where: { productoId_fecha: { productoId: productoConVentasId, fecha: claveDia(fecha) } },
    });

    await recalcularDia(fecha);
    const segundaVez = await prisma.metricaDiaria.findUnique({ where: { fecha: claveDia(fecha) } });
    const segundaVezProducto = await prisma.productoMetricaDiaria.findUnique({
      where: { productoId_fecha: { productoId: productoConVentasId, fecha: claveDia(fecha) } },
    });

    expect(primeraVez?.sesiones).toBe(1);
    expect(primeraVez?.pedidosPagados).toBe(1);
    expect(Number(primeraVez?.ingresos)).toBe(50000);

    // Mismos valores en ambas corridas (nunca duplica, nunca cambia).
    expect(segundaVez?.sesiones).toBe(primeraVez?.sesiones);
    expect(segundaVez?.pedidosPagados).toBe(primeraVez?.pedidosPagados);
    expect(Number(segundaVez?.ingresos)).toBe(Number(primeraVez?.ingresos));
    expect(Number(segundaVez?.unidadesVendidas)).toBe(Number(primeraVez?.unidadesVendidas));
    expect(segundaVezProducto?.unidadesVendidas).toBe(primeraVezProducto?.unidadesVendidas);
    expect(Number(segundaVezProducto?.ingresos)).toBe(Number(primeraVezProducto?.ingresos));
  });

  it('el embudo cuenta sesiones distintas, no eventos: 3 vistas de la misma sesión cuentan 1', async () => {
    const fecha = '2024-06-11';
    const { inicio } = limitesDia(fecha);

    const sesion = await prisma.sesionVisita.create({
      data: {
        visitanteId: `visitante-${SUFIJO}-embudo`,
        inicioEn: new Date(inicio.getTime() + 3600_000),
      },
    });
    idsSesion.push(sesion.id);

    await prisma.eventoAnalitica.createMany({
      data: [
        {
          sesionId: sesion.id,
          tipo: 'vistaProducto',
          creadoEn: new Date(inicio.getTime() + 3700_000),
        },
        {
          sesionId: sesion.id,
          tipo: 'vistaProducto',
          creadoEn: new Date(inicio.getTime() + 3800_000),
        },
        {
          sesionId: sesion.id,
          tipo: 'vistaProducto',
          creadoEn: new Date(inicio.getTime() + 3900_000),
        },
      ],
    });

    const embudo = await obtenerEmbudo(fecha, fecha);

    expect(embudo.pasos.find((p) => p.paso === 'visitaron')?.sesiones).toBe(1);
    expect(embudo.pasos.find((p) => p.paso === 'vieron_producto')?.sesiones).toBe(1);
  });

  it('menos_vendidos incluye un producto con cero ventas (parte de producto, no de pedido_item)', async () => {
    const fecha = '2024-06-12';
    const { inicio } = limitesDia(fecha);

    const pedido = await prisma.pedido.create({
      data: {
        numero: `INR-MENOSV-${SUFIJO}`,
        usuarioId,
        nombreContacto: 'Clienta',
        telefonoContacto: '3000000000',
        envioNombre: 'Clienta',
        envioTelefono: '3000000000',
        envioDepartamento: 'Valle',
        envioCiudad: 'Cali',
        envioDireccion: 'Calle falsa 123',
        subtotal: 50000,
        total: 50000,
        estado: 'pagado',
        pagadoEn: new Date(inicio.getTime() + 3600_000),
        items: {
          create: [
            {
              varianteId,
              nombreProducto: 'Con ventas',
              sku: `SKU-${SUFIJO}`,
              precioUnitario: 50000,
              costoUnitario: 20000,
              cantidad: 2,
              subtotal: 100000,
            },
          ],
        },
      },
    });
    idsPedido.push(pedido.id);

    const filas = await obtenerProductos(fecha, fecha, 'menos_vendidos', 50);
    const filaConVentas = filas.find((f) => f.productoId === productoConVentasId);
    const filaSinVentas = filas.find((f) => f.productoId === productoSinVentasId);

    expect(filaSinVentas).toBeDefined();
    expect(filaSinVentas?.unidadesVendidas).toBe(0);
    expect(filaConVentas?.unidadesVendidas).toBe(2);

    // Ascendente: el de cero ventas va antes que el que sí vendió.
    const indiceSinVentas = filas.findIndex((f) => f.productoId === productoSinVentasId);
    const indiceConVentas = filas.findIndex((f) => f.productoId === productoConVentasId);
    expect(indiceSinVentas).toBeLessThan(indiceConVentas);
  });

  it('calificaciones respeta el mínimo de reseñas: un producto con menos reseñas que el mínimo no aparece', async () => {
    await prisma.productoResumen.create({
      data: { productoId: productoConVentasId, calificacionPromedio: 2.0, cantidadResenas: 1 },
    });
    await prisma.productoResumen.create({
      data: { productoId: productoSinVentasId, calificacionPromedio: 4.5, cantidadResenas: 10 },
    });

    const peores = await obtenerCalificaciones('peor', 5);

    const idsDevueltos = peores.map((f) => f.productoId);
    expect(idsDevueltos).not.toContain(productoConVentasId); // 1 reseña, por debajo del mínimo
    expect(idsDevueltos).toContain(productoSinVentasId); // 10 reseñas, sí califica
  });
});
