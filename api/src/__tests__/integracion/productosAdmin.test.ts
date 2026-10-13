// Prueba de integración real: cambiarEstadoProducto, cambiarPrecioVariante
// y crearVariante componen varias escrituras/validaciones (producto,
// variante_producto, precio_variante, restricción única de sku) cuya
// semántica no vale la pena imitar con un Prisma mockeado — mismo criterio
// que agregacionAnalitica.test.ts y pedidosAdmin.test.ts.
// Requiere DATABASE_URL_TEST y la base preparada con
// `npx tsx scripts/preparar-db-prueba.ts`; si no está configurada, se
// salta en vez de romper `npm test`.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (!DATABASE_URL_TEST) {
  console.warn(
    'DATABASE_URL_TEST no está configurada: se salta la prueba de integración de productos admin. ' +
      'Corré npx tsx scripts/preparar-db-prueba.ts y configurá la variable en api/.env para incluirla.',
  );
} else {
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.DIRECT_URL = DATABASE_URL_TEST;
}

const describeConDbReal = DATABASE_URL_TEST ? describe : describe.skip;

const { prisma } = await import('../../lib/prisma.js');
const { cambiarEstadoProducto, cambiarPrecioVariante, crearProducto, crearVariante } =
  await import('../../modulos/admin/productos/servicio.js');

const SUFIJO = `productos-admin-${Date.now()}`;
// Códigos solo con letras y números (sku.ts), únicos por corrida.
const CODIGO = Date.now().toString(36).toUpperCase();

describeConDbReal('Admin/Productos: estado, precios y variantes contra PostgreSQL real', () => {
  let categoriaId: string;
  let usuarioAdminId: string;
  const idsProducto: string[] = [];
  const idsVariante: string[] = [];

  beforeAll(async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat ${SUFIJO}`, slug: `cat-${SUFIJO}`, codigo: `C${CODIGO}` },
    });
    categoriaId = categoria.id;

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
    await prisma.movimientoInventario.deleteMany({ where: { varianteId: { in: idsVariante } } });
    await prisma.precioVariante.deleteMany({ where: { varianteId: { in: idsVariante } } });
    await prisma.varianteValorAtributo.deleteMany({
      where: { varianteId: { in: idsVariante } },
    });
    await prisma.varianteProducto.deleteMany({ where: { id: { in: idsVariante } } });
    await prisma.producto.deleteMany({ where: { id: { in: idsProducto } } });
    await prisma.categoria.deleteMany({ where: { id: categoriaId } });
    await prisma.usuarioAdmin.deleteMany({ where: { id: usuarioAdminId } });
    await prisma.$disconnect();
  });

  it('no se puede publicar un producto sin al menos una variante activa', async () => {
    const producto = await prisma.producto.create({
      data: { nombre: `Prod sin variante ${SUFIJO}`, slug: `sin-variante-${SUFIJO}`, categoriaId },
    });
    idsProducto.push(producto.id);

    await expect(
      cambiarEstadoProducto(producto.id, { estado: 'publicado', confirmarKitsAfectados: false }),
    ).rejects.toMatchObject({ estadoHttp: 409 });

    const productoSinCambios = await prisma.producto.findUniqueOrThrow({
      where: { id: producto.id },
    });
    expect(productoSinCambios.estado).toBe('borrador');
    expect(productoSinCambios.publicadoEn).toBeNull();
  });

  it('el cambio de precio escribe historial y actualiza la variante en la misma transacción', async () => {
    const producto = await prisma.producto.create({
      data: { nombre: `Prod precio ${SUFIJO}`, slug: `precio-${SUFIJO}`, categoriaId },
    });
    idsProducto.push(producto.id);

    const variante = await prisma.varianteProducto.create({
      data: {
        productoId: producto.id,
        sku: `SKU-PRECIO-${SUFIJO}`,
        precioActual: 100000,
        costoActual: 40000,
      },
    });
    idsVariante.push(variante.id);

    const varianteActualizada = await cambiarPrecioVariante(
      variante.id,
      { precio: 120000, costo: 45000, motivo: 'Ajuste de costo del proveedor' },
      usuarioAdminId,
      null,
    );

    expect(varianteActualizada.precioActual).toBe(120000);
    expect(varianteActualizada.precioAntes).toBe(100000);
    expect(varianteActualizada.costoActual).toBe(45000);

    const historial = await prisma.precioVariante.findMany({ where: { varianteId: variante.id } });
    expect(historial).toHaveLength(1);
    expect(historial[0]?.precio).toBe(120000);
    expect(historial[0]?.precioAntes).toBe(100000);
    expect(historial[0]?.motivo).toBe('Ajuste de costo del proveedor');
    expect(historial[0]?.creadoPorId).toBe(usuarioAdminId);
  });

  it('el SKU duplicado se rechaza al crear una variante', async () => {
    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod sku ${SUFIJO}`,
        slug: `sku-${SUFIJO}`,
        categoriaId,
        codigoModelo: `D${CODIGO}`,
      },
    });
    idsProducto.push(producto.id);

    // Sin largo ni color, el SKU generado es el código de producto: una
    // segunda variante igual choca con la primera.
    const primera = await crearVariante(
      producto.id,
      {
        precio: 90000,
        stockInicial: 5,
        puntoReorden: 2,
        valoresAtributo: [],
      },
      usuarioAdminId,
    );
    idsVariante.push(primera.id);

    await expect(
      crearVariante(
        producto.id,
        {
          precio: 95000,
          stockInicial: 0,
          puntoReorden: 0,
          valoresAtributo: [],
        },
        usuarioAdminId,
      ),
    ).rejects.toMatchObject({ estadoHttp: 409, detalles: { skus: [`IR-C${CODIGO}-D${CODIGO}`] } });

    expect(primera.sku).toBe(`IR-C${CODIGO}-D${CODIGO}`);
    const movimiento = await prisma.movimientoInventario.findFirst({
      where: { varianteId: primera.id },
    });
    expect(movimiento?.tipo).toBe('entrada');
    expect(movimiento?.cantidad).toBe(5);
  });

  it('crear un producto exige un código de modelo válido y único, y arma el código completo', async () => {
    await expect(
      crearProducto(
        { nombre: `Prod codigo malo ${SUFIJO}`, categoriaId, codigoModelo: 'IR-PEL-X' },
        usuarioAdminId,
      ),
    ).rejects.toMatchObject({ estadoHttp: 400 });

    const creado = await crearProducto(
      { nombre: `Prod codigo ${SUFIJO}`, categoriaId, codigoModelo: `n${CODIGO}` },
      usuarioAdminId,
    );
    idsProducto.push(creado.id);
    expect(creado.codigoModelo).toBe(`N${CODIGO}`);
    expect(creado.codigoProducto).toBe(`IR-C${CODIGO}-N${CODIGO}`);

    await expect(
      crearProducto(
        { nombre: `Prod codigo repetido ${SUFIJO}`, categoriaId, codigoModelo: `N${CODIGO}` },
        usuarioAdminId,
      ),
    ).rejects.toMatchObject({ estadoHttp: 409 });
  });
});
