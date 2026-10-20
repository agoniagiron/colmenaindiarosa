// Prueba de integración real: fotos asociadas a un valor de atributo
// (imagen_producto.valor_atributo_id) de punta a punta — la asignación
// masiva del panel, el aviso de colores sin fotos, la galería por variante
// de la ficha, la portada de la tarjeta y la foto de la línea del carrito.
// Mismo criterio que portada.test.ts: requiere DATABASE_URL_TEST y la base
// preparada con `npx tsx scripts/preparar-db-prueba.ts`; si no está
// configurada, se salta.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (!DATABASE_URL_TEST) {
  console.warn(
    'DATABASE_URL_TEST no está configurada: se salta la prueba de integración de fotos por color. ' +
      'Corré npx tsx scripts/preparar-db-prueba.ts y configurá la variable en api/.env para incluirla.',
  );
} else {
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.DIRECT_URL = DATABASE_URL_TEST;
}

const describeConDbReal = DATABASE_URL_TEST ? describe : describe.skip;

const { prisma } = await import('../../lib/prisma.js');
const { asignarValorImagenes, crearImagen } =
  await import('../../modulos/admin/productos/servicioImagenes.js');
const { obtenerDetalleProducto } = await import('../../modulos/admin/productos/servicio.js');
const { obtenerProductoPorSlug } = await import('../../modulos/catalogo/servicio.js');
const { agregarItem, obtenerCarrito } = await import('../../modulos/carrito/servicio.js');

const SUFIJO = `fotos-color-${Date.now()}`;

describeConDbReal('Fotos por color contra PostgreSQL real', () => {
  let productoId: string;
  let slug: string;
  let valorRosaId: string;
  let valorRubioId: string;
  let valorNegroId: string;
  let varianteRosaId: string;
  let varianteRubioId: string;
  const idsImagenRosa: string[] = [];
  let idImagenRubio: string;
  const visitanteId = `visitante-${SUFIJO}`;

  beforeAll(async () => {
    const categoria = await prisma.categoria.upsert({
      where: { slug: 'pelucas' },
      update: {},
      create: { nombre: 'Pelucas', slug: 'pelucas' },
    });
    const atributoColor = await prisma.atributo.upsert({
      where: { slug: 'color' },
      update: {},
      create: { nombre: 'Color', slug: 'color' },
    });
    const crearValor = (valor: string, orden: number) =>
      prisma.valorAtributo.create({
        data: { atributoId: atributoColor.id, valor: `${valor} ${SUFIJO}`, orden },
      });
    valorRosaId = (await crearValor('Rosa', 0)).id;
    valorRubioId = (await crearValor('Rubio arena', 1)).id;
    valorNegroId = (await crearValor('Negro', 2)).id;

    slug = `hannah-${SUFIJO}`;
    const producto = await prisma.producto.create({
      data: { nombre: `HANNAH ${SUFIJO}`, slug, categoriaId: categoria.id, estado: 'publicado' },
    });
    productoId = producto.id;

    const crearVariante = async (sku: string, valorId: string) => {
      const variante = await prisma.varianteProducto.create({
        data: {
          productoId,
          sku: `${sku}-${SUFIJO}`,
          precioActual: 900000,
          stockActual: 5,
          activa: true,
        },
      });
      await prisma.varianteValorAtributo.create({ data: { varianteId: variante.id, valorId } });
      return variante.id;
    };
    varianteRosaId = await crearVariante('ROSA', valorRosaId);
    varianteRubioId = await crearVariante('RUBIO', valorRubioId);
    await crearVariante('NEGRO', valorNegroId);
    // La principal es la rubia: la tarjeta tiene que abrir con su foto.
    await prisma.producto.update({
      where: { id: productoId },
      data: { variantePrincipalId: varianteRubioId },
    });

    // Todo genérico al principio, como está HANNAH hoy.
    const subir = (nombre: string, orden: number) =>
      crearImagen(productoId, {
        url: `https://ejemplo.com/${nombre}.webp`,
        altTexto: nombre,
        tipo: 'galeria',
        orden,
      });
    idsImagenRosa.push((await subir('rosa-1', 0)).id, (await subir('rosa-2', 1)).id);
    idImagenRubio = (await subir('rubio-1', 2)).id;
    await subir('generica', 3);
  });

  afterAll(async () => {
    const carrito = await prisma.carrito.findFirst({
      where: { visitanteId },
      select: { id: true },
    });
    if (carrito) await prisma.carrito.delete({ where: { id: carrito.id } });
    await prisma.producto.update({
      where: { id: productoId },
      data: { variantePrincipalId: null },
    });
    await prisma.imagenProducto.deleteMany({ where: { productoId } });
    await prisma.varianteValorAtributo.deleteMany({
      where: { varianteProducto: { productoId } },
    });
    await prisma.varianteProducto.deleteMany({ where: { productoId } });
    await prisma.producto.delete({ where: { id: productoId } });
    await prisma.valorAtributo.deleteMany({
      where: { id: { in: [valorRosaId, valorRubioId, valorNegroId] } },
    });
    await prisma.$disconnect();
  });

  it('con todo genérico, el panel avisa los tres colores sin fotos', async () => {
    const detalle = await obtenerDetalleProducto(productoId);
    expect(detalle.coloresSinFotos.map((c) => c.id).sort()).toEqual(
      [valorRosaId, valorRubioId, valorNegroId].sort(),
    );
  });

  it('marca varias fotos de una vez y el aviso deja solo el color pendiente', async () => {
    await asignarValorImagenes(productoId, { ids: idsImagenRosa, valorAtributoId: valorRosaId });
    const imagenes = await asignarValorImagenes(productoId, {
      ids: [idImagenRubio],
      valorAtributoId: valorRubioId,
    });

    expect(imagenes.filter((i) => i.valorAtributoId === valorRosaId).map((i) => i.id)).toEqual(
      idsImagenRosa,
    );
    const detalle = await obtenerDetalleProducto(productoId);
    expect(detalle.coloresSinFotos.map((c) => c.id)).toEqual([valorNegroId]);
  });

  it('rechaza un valor que no usa ninguna variante del producto', async () => {
    const ajeno = await prisma.valorAtributo.create({
      data: {
        atributoId: (await prisma.atributo.findUniqueOrThrow({ where: { slug: 'color' } })).id,
        valor: `Ajeno ${SUFIJO}`,
      },
    });
    try {
      await expect(
        asignarValorImagenes(productoId, { ids: [idImagenRubio], valorAtributoId: ajeno.id }),
      ).rejects.toMatchObject({ estadoHttp: 400 });
    } finally {
      await prisma.valorAtributo.delete({ where: { id: ajeno.id } });
    }
  });

  it('la ficha trae la galería de cada variante y la tarjeta la portada de la principal', async () => {
    const producto = await obtenerProductoPorSlug(slug);
    expect(producto).not.toBeNull();
    const galeria = (varianteId: string) =>
      producto!.variantes.find((v) => v.id === varianteId)!.imagenes.map((i) => i.altTexto);

    expect(galeria(varianteRosaId)).toEqual(['rosa-1', 'rosa-2', 'generica']);
    expect(galeria(varianteRubioId)).toEqual(['rubio-1', 'generica']);
    // Negro no tiene fotos: solo las genéricas, nunca las del rosa.
    const negro = producto!.variantes.find((v) => v.color?.nombre.startsWith('Negro'))!;
    expect(negro.imagenes.map((i) => i.altTexto)).toEqual(['generica']);

    expect(producto!.varianteMostradaId).toBe(varianteRubioId);
    expect(producto!.imagenes[0]!.altTexto).toBe('rubio-1');
  });

  it('la línea del carrito muestra la foto del color elegido', async () => {
    await agregarItem({ visitanteId }, { varianteId: varianteRosaId, cantidad: 1 });
    const carrito = await obtenerCarrito({ visitanteId });
    const linea = carrito.lineas.find((l) => l.tipo === 'variante');
    expect(linea?.imagenUrl).toBe('https://ejemplo.com/rosa-1.webp');
  });
});
