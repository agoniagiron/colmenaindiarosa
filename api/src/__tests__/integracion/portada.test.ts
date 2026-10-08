// Prueba de integración real: GET /api/portada de punta a punta (ruta +
// controlador + servicio) y, sobre la misma fila, que seccion:'portada'
// no se cuele en el "Destacado" de catálogo (seccion:'inicio') — el
// catalogo.test.ts mockeado ya prueba que la consulta pedida está acotada;
// esto prueba que Postgres de verdad la respeta. Mismo criterio que
// authRegistroLogin.test.ts: requiere DATABASE_URL_TEST y la base
// preparada con `npx tsx scripts/preparar-db-prueba.ts`; si no está
// configurada, se salta en vez de romper `npm test`.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (!DATABASE_URL_TEST) {
  console.warn(
    'DATABASE_URL_TEST no está configurada: se salta la prueba de integración de portada. ' +
      'Corré npx tsx scripts/preparar-db-prueba.ts y configurá la variable en api/.env para incluirla.',
  );
} else {
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.DIRECT_URL = DATABASE_URL_TEST;
}

const describeConDbReal = DATABASE_URL_TEST ? describe : describe.skip;

const { app } = await import('../../app.js');
const { prisma } = await import('../../lib/prisma.js');

const SUFIJO = `portada-${Date.now()}`;

describeConDbReal('GET /api/portada contra PostgreSQL real', () => {
  let categoriaId: string;
  let atributoColorId: string;
  let valorRubioId: string;
  let valorCastanoId: string;
  const idsProducto: string[] = [];

  beforeAll(async () => {
    const categoria = await prisma.categoria.upsert({
      where: { slug: 'pelucas' },
      update: {},
      create: { nombre: 'Pelucas', slug: 'pelucas' },
    });
    categoriaId = categoria.id;

    const atributoColor = await prisma.atributo.upsert({
      where: { slug: 'color' },
      update: {},
      create: { nombre: 'Color', slug: 'color' },
    });
    atributoColorId = atributoColor.id;

    const valorRubio = await prisma.valorAtributo.upsert({
      where: { atributoId_valor: { atributoId: atributoColorId, valor: `Rubio ${SUFIJO}` } },
      update: {},
      create: { atributoId: atributoColorId, valor: `Rubio ${SUFIJO}`, hex: '#e8c27a', orden: 0 },
    });
    valorRubioId = valorRubio.id;

    const valorCastano = await prisma.valorAtributo.upsert({
      where: { atributoId_valor: { atributoId: atributoColorId, valor: `Castaño ${SUFIJO}` } },
      update: {},
      create: { atributoId: atributoColorId, valor: `Castaño ${SUFIJO}`, hex: '#4a2d1b', orden: 1 },
    });
    valorCastanoId = valorCastano.id;
  });

  afterAll(async () => {
    await prisma.productoDestacado.deleteMany({ where: { productoId: { in: idsProducto } } });
    await prisma.varianteValorAtributo.deleteMany({
      where: { varianteProducto: { productoId: { in: idsProducto } } },
    });
    await prisma.varianteProducto.deleteMany({ where: { productoId: { in: idsProducto } } });
    await prisma.producto.deleteMany({ where: { id: { in: idsProducto } } });
    await prisma.valorAtributo.deleteMany({
      where: { id: { in: [valorRubioId, valorCastanoId] } },
    });
    await prisma.$disconnect();
  });

  it('devuelve las destacadas con su foto principal y sus colores, y la unión ordenada', async () => {
    const producto = await prisma.producto.create({
      data: {
        nombre: `Peluca héroe ${SUFIJO}`,
        slug: `peluca-heroe-${SUFIJO}`,
        categoriaId,
        estado: 'publicado',
      },
    });
    idsProducto.push(producto.id);

    const variante = await prisma.varianteProducto.create({
      data: {
        productoId: producto.id,
        sku: `SKU-HEROE-${SUFIJO}`,
        precioActual: 250000,
        stockActual: 10,
        stockReservado: 0,
        activa: true,
      },
    });
    await prisma.varianteValorAtributo.create({
      data: { varianteId: variante.id, valorId: valorCastanoId },
    });

    await prisma.imagenProducto.create({
      data: {
        productoId: producto.id,
        url: `https://ejemplo.com/${SUFIJO}.jpg`,
        altTexto: 'Peluca del héroe',
        orden: 0,
      },
    });

    await prisma.productoDestacado.create({
      data: { productoId: producto.id, seccion: 'portada', orden: 0 },
    });

    const respuesta = await request(app).get('/api/portada').expect(200);

    const destacada = respuesta.body.destacadas.find((d: { id: string }) => d.id === producto.id);
    expect(destacada).toMatchObject({
      slug: `peluca-heroe-${SUFIJO}`,
      imagenPrincipal: { url: `https://ejemplo.com/${SUFIJO}.jpg`, altTexto: 'Peluca del héroe' },
      colores: [{ nombre: `Castaño ${SUFIJO}`, hex: '#4a2d1b' }],
    });
    expect(respuesta.body.colores).toEqual(
      expect.arrayContaining([{ nombre: `Castaño ${SUFIJO}`, hex: '#4a2d1b' }]),
    );
  });

  it('seccion:"portada" no aparece como Destacado en el catálogo ni en ?destacado=true', async () => {
    const producto = await prisma.producto.create({
      data: {
        nombre: `Peluca sin badge ${SUFIJO}`,
        slug: `peluca-sin-badge-${SUFIJO}`,
        categoriaId,
        estado: 'publicado',
      },
    });
    idsProducto.push(producto.id);

    await prisma.varianteProducto.create({
      data: {
        productoId: producto.id,
        sku: `SKU-SINBADGE-${SUFIJO}`,
        precioActual: 180000,
        stockActual: 5,
        stockReservado: 0,
        activa: true,
      },
    });

    await prisma.productoDestacado.create({
      data: { productoId: producto.id, seccion: 'portada', orden: 1 },
    });

    const detalle = await request(app)
      .get(`/api/productos/${producto.slug}`)
      .expect(200);
    expect(detalle.body.destacado).toBe(false);

    const listadoDestacados = await request(app)
      .get('/api/productos?destacado=true')
      .expect(200);
    const idsListados = listadoDestacados.body.datos.map((p: { id: string }) => p.id);
    expect(idsListados).not.toContain(producto.id);
  });
});
