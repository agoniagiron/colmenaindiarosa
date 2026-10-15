// Pantalla de atributos contra PostgreSQL real: crear un valor habilitándolo
// en categorías en el mismo paso, y reemplazar la configuración de una
// categoría (atributos, orden, obligatorios, valores permitidos). Las claves
// foráneas compuestas de las tablas nuevas solo se prueban de verdad acá.
// Requiere DATABASE_URL_TEST; si no está, se salta.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (DATABASE_URL_TEST) {
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.DIRECT_URL = DATABASE_URL_TEST;
}

const describeConDbReal = DATABASE_URL_TEST ? describe : describe.skip;

const { prisma } = await import('../../lib/prisma.js');
const { crearValorAtributo, guardarConfiguracionCategoria, obtenerConfiguracionAtributos } =
  await import('../../modulos/admin/productos/servicioAtributos.js');

const SUFIJO = `atributos-${Date.now()}`;
const C = Date.now().toString(36).toUpperCase();

describeConDbReal('Admin/Atributos: configuración por categoría contra PostgreSQL real', () => {
  let pelucasId: string;
  let accesoriosId: string;
  let colorId: string;
  let longitudId: string;
  let negro: string;
  let largo24: string;
  let largo30: string;
  const idsValor: string[] = [];

  beforeAll(async () => {
    const categoria = async (nombre: string) =>
      (
        await prisma.categoria.create({
          data: { nombre: `${nombre} ${SUFIJO}`, slug: `${nombre}-${SUFIJO}`.toLowerCase() },
        })
      ).id;
    pelucasId = await categoria('Pelucas');
    accesoriosId = await categoria('Accesorios');

    // Atributos compartidos con otras pruebas (slug único): upsert, nunca se
    // borran. Los valores son propios de esta corrida.
    const atributo = (slug: string, nombre: string) =>
      prisma.atributo.upsert({ where: { slug }, update: {}, create: { slug, nombre } });
    colorId = (await atributo('color', 'Color')).id;
    longitudId = (await atributo('longitud', 'Longitud')).id;

    const valor = async (atributoId: string, texto: string, codigo: string) => {
      const fila = await prisma.valorAtributo.create({
        data: { atributoId, valor: `${texto} ${SUFIJO}`, codigo, orden: 900 },
      });
      idsValor.push(fila.id);
      return fila.id;
    };
    negro = await valor(colorId, 'Negro', `N${C}`);
    largo24 = await valor(longitudId, '24', `24${C}`);
    largo30 = await valor(longitudId, '30', `30${C}`);

    // Pelucas usa longitud y color; Accesorios no usa nada.
    await guardarConfiguracionCategoria(pelucasId, {
      atributos: [
        { atributoId: longitudId, obligatorio: true, valorIds: [largo24, largo30] },
        { atributoId: colorId, obligatorio: true, valorIds: [negro] },
      ],
    });
  });

  afterAll(async () => {
    const creados = await prisma.valorAtributo.findMany({
      where: { valor: { endsWith: SUFIJO } },
      select: { id: true },
    });
    await prisma.categoria.deleteMany({ where: { id: { in: [pelucasId, accesoriosId] } } });
    await prisma.valorAtributo.deleteMany({
      where: { id: { in: [...idsValor, ...creados.map((v) => v.id)] } },
    });
    await prisma.$disconnect();
  });

  const configDe = async (categoriaId: string) =>
    (await obtenerConfiguracionAtributos()).categorias.find((c) => c.id === categoriaId)!;

  it('la configuración guarda el orden de la lista, obligatorios y valores', async () => {
    expect((await configDe(pelucasId)).atributos).toEqual([
      {
        atributoId: longitudId,
        obligatorio: true,
        valorIds: expect.arrayContaining([largo24, largo30]),
      },
      { atributoId: colorId, obligatorio: true, valorIds: [negro] },
    ]);
  });

  it('reordenar, sacar un valor y quitar un atributo reemplaza todo de una vez', async () => {
    await guardarConfiguracionCategoria(pelucasId, {
      atributos: [{ atributoId: colorId, obligatorio: false, valorIds: [negro] }],
    });
    expect((await configDe(pelucasId)).atributos).toEqual([
      { atributoId: colorId, obligatorio: false, valorIds: [negro] },
    ]);

    // Vuelve a como estaba, para las pruebas siguientes.
    await guardarConfiguracionCategoria(pelucasId, {
      atributos: [
        { atributoId: longitudId, obligatorio: true, valorIds: [largo24] },
        { atributoId: colorId, obligatorio: true, valorIds: [negro] },
      ],
    });
  });

  it('obligatorio sin ningún valor permitido se rechaza', async () => {
    await expect(
      guardarConfiguracionCategoria(pelucasId, {
        atributos: [{ atributoId: colorId, obligatorio: true, valorIds: [] }],
      }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
  });

  it('un valor de otro atributo se rechaza', async () => {
    await expect(
      guardarConfiguracionCategoria(pelucasId, {
        atributos: [{ atributoId: colorId, obligatorio: true, valorIds: [largo24] }],
      }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
  });

  it('un color nuevo se crea ya habilitado en las categorías elegidas, en el mismo paso', async () => {
    const valor = await crearValorAtributo({
      atributoId: colorId,
      valor: `Borgoña ${SUFIJO}`,
      hex: '#5b1a2a',
      codigo: `b${C}`,
      categoriaIds: [pelucasId],
    });
    expect(valor.codigo).toBe(`B${C}`);
    expect(
      (await configDe(pelucasId)).atributos.find((a) => a.atributoId === colorId)?.valorIds,
    ).toContain(valor.id);
  });

  it('un color sin código se rechaza: va en el SKU', async () => {
    await expect(
      crearValorAtributo({
        atributoId: colorId,
        valor: `Sin código ${SUFIJO}`,
        categoriaIds: [pelucasId],
      }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
  });

  it('no se habilita en una categoría que no usa ese atributo, y no queda nada creado', async () => {
    await expect(
      crearValorAtributo({
        atributoId: colorId,
        valor: `Cobre ${SUFIJO}`,
        codigo: `CO${C}`,
        categoriaIds: [accesoriosId],
      }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
    expect(await prisma.valorAtributo.count({ where: { valor: `Cobre ${SUFIJO}` } })).toBe(0);
  });

  it('un código repetido en el mismo atributo responde 409', async () => {
    await expect(
      crearValorAtributo({
        atributoId: colorId,
        valor: `Otro negro ${SUFIJO}`,
        codigo: `N${C}`,
        categoriaIds: [pelucasId],
      }),
    ).rejects.toMatchObject({ estadoHttp: 409 });
  });
});
