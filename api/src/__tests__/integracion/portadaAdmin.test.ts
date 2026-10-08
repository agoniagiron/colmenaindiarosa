// Prueba de integración real: cambiarPortadaProducto (admin) y
// obtenerHeroePortada (público) contra la validación de categoría, la
// auto-remoción al cambiar de categoría y el filtro de disponibilidad —
// lógica de varias tablas (producto, categoria, producto_destacado,
// variante_producto) que no vale la pena imitar con un Prisma mockeado,
// mismo criterio que productosAdmin.test.ts.
// Requiere DATABASE_URL_TEST y la base preparada con
// `npx tsx scripts/preparar-db-prueba.ts`; si no está configurada, se
// salta en vez de romper `npm test`.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (!DATABASE_URL_TEST) {
  console.warn(
    'DATABASE_URL_TEST no está configurada: se salta la prueba de integración de portada admin. ' +
      'Corré npx tsx scripts/preparar-db-prueba.ts y configurá la variable en api/.env para incluirla.',
  );
} else {
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.DIRECT_URL = DATABASE_URL_TEST;
}

const describeConDbReal = DATABASE_URL_TEST ? describe : describe.skip;

const { prisma } = await import('../../lib/prisma.js');
const { editarProducto, cambiarPortadaProducto } = await import(
  '../../modulos/admin/productos/servicio.js'
);
const { obtenerHeroePortada } = await import('../../modulos/portada/servicio.js');

const SUFIJO = `portada-admin-${Date.now()}`;

describeConDbReal('Admin/Productos: portada (seccion:"portada") contra PostgreSQL real', () => {
  let categoriaPelucasId: string;
  let categoriaOtraId: string;
  const idsProducto: string[] = [];

  beforeAll(async () => {
    // upsert, no create: 'pelucas' es un slug compartido con el resto del
    // negocio (ver admin/productos/servicio.ts, SLUG_CATEGORIA_PORTADA),
    // así que no se puede asumir que esta prueba es la única dueña de la
    // fila. Nunca se borra en el afterAll por la misma razón.
    const categoriaPelucas = await prisma.categoria.upsert({
      where: { slug: 'pelucas' },
      update: {},
      create: { nombre: 'Pelucas', slug: 'pelucas' },
    });
    categoriaPelucasId = categoriaPelucas.id;

    const categoriaOtra = await prisma.categoria.create({
      data: { nombre: `Cuidado ${SUFIJO}`, slug: `cuidado-${SUFIJO}` },
    });
    categoriaOtraId = categoriaOtra.id;
  });

  afterAll(async () => {
    await prisma.productoDestacado.deleteMany({ where: { productoId: { in: idsProducto } } });
    await prisma.producto.deleteMany({ where: { id: { in: idsProducto } } });
    await prisma.categoria.deleteMany({ where: { id: categoriaOtraId } });
    await prisma.$disconnect();
  });

  it('rechaza marcar como destacado de portada un producto que no es de Pelucas', async () => {
    const producto = await prisma.producto.create({
      data: {
        nombre: `Shampoo ${SUFIJO}`,
        slug: `shampoo-${SUFIJO}`,
        categoriaId: categoriaOtraId,
      },
    });
    idsProducto.push(producto.id);

    await expect(
      cambiarPortadaProducto(producto.id, { destacado: true }),
    ).rejects.toMatchObject({ estadoHttp: 400 });

    const filas = await prisma.productoDestacado.findMany({ where: { productoId: producto.id } });
    expect(filas).toHaveLength(0);
  });

  it('marca y desmarca una peluca para portada, respetando el orden recibido', async () => {
    const producto = await prisma.producto.create({
      data: {
        nombre: `Peluca portada ${SUFIJO}`,
        slug: `peluca-portada-${SUFIJO}`,
        categoriaId: categoriaPelucasId,
      },
    });
    idsProducto.push(producto.id);

    const marcado = await cambiarPortadaProducto(producto.id, { destacado: true, orden: 3 });
    expect(marcado.destacadoPortada).toBe(true);
    expect(marcado.ordenPortada).toBe(3);

    // Reafirmar con un orden distinto no debe crear una segunda fila.
    const reafirmado = await cambiarPortadaProducto(producto.id, { destacado: true, orden: 7 });
    expect(reafirmado.ordenPortada).toBe(7);
    const filasTrasReafirmar = await prisma.productoDestacado.findMany({
      where: { productoId: producto.id, seccion: 'portada' },
    });
    expect(filasTrasReafirmar).toHaveLength(1);

    const desmarcado = await cambiarPortadaProducto(producto.id, { destacado: false });
    expect(desmarcado.destacadoPortada).toBe(false);
    expect(desmarcado.ordenPortada).toBeNull();
  });

  it('al cambiar de categoría a una distinta de Pelucas, sale de producto_destacado', async () => {
    const producto = await prisma.producto.create({
      data: {
        nombre: `Peluca que cambia ${SUFIJO}`,
        slug: `peluca-que-cambia-${SUFIJO}`,
        categoriaId: categoriaPelucasId,
      },
    });
    idsProducto.push(producto.id);

    await cambiarPortadaProducto(producto.id, { destacado: true, orden: 0 });

    const actualizado = await editarProducto(producto.id, { categoriaId: categoriaOtraId });
    expect(actualizado.destacadoPortada).toBe(false);

    const filas = await prisma.productoDestacado.findMany({
      where: { productoId: producto.id, seccion: 'portada' },
    });
    expect(filas).toHaveLength(0);
  });

  it('el héroe público no incluye una peluca destacada cuyas variantes están todas agotadas', async () => {
    const producto = await prisma.producto.create({
      data: {
        nombre: `Peluca agotada ${SUFIJO}`,
        slug: `peluca-agotada-${SUFIJO}`,
        categoriaId: categoriaPelucasId,
        estado: 'publicado',
      },
    });
    idsProducto.push(producto.id);

    await prisma.varianteProducto.create({
      data: {
        productoId: producto.id,
        sku: `SKU-AGOTADA-${SUFIJO}`,
        precioActual: 100000,
        stockActual: 2,
        stockReservado: 2,
        activa: true,
      },
    });

    await cambiarPortadaProducto(producto.id, { destacado: true, orden: 0 });

    const heroe = await obtenerHeroePortada();
    expect(heroe.destacadas.some((d) => d.id === producto.id)).toBe(false);
  });
});
