// Pantalla de atributos contra PostgreSQL real: crear un valor habilitándolo
// en categorías en el mismo paso, y reemplazar la configuración de una
// categoría (atributos, orden, obligatorios, valores permitidos). Las claves
// foráneas compuestas de las tablas nuevas solo se prueban de verdad acá.
//
// Color es universal: la universalidad vive en la escritura (todas las
// categorías que usan color tienen todas sus filas, activos y desactivados)
// y la lectura solo filtra activo. Estas pruebas cuentan filas de
// categoria_valor_atributo directamente: es como se diagnostica en la base.
//
// Otras pruebas comparten el atributo color y crean sus propios valores en
// paralelo, así que acá se afirma sobre los valores de ESTA corrida, nunca
// sobre totales. Requiere DATABASE_URL_TEST; si no está, se salta.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (DATABASE_URL_TEST) {
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.DIRECT_URL = DATABASE_URL_TEST;
}

const describeConDbReal = DATABASE_URL_TEST ? describe : describe.skip;

const { prisma } = await import('../../lib/prisma.js');
const { atributosDeCategoria, validarValoresParaCategoria } =
  await import('../../lib/atributosCategoria.js');
const {
  cambiarActivoValor,
  crearValorAtributo,
  editarValorAtributo,
  guardarConfiguracionCategoria,
  obtenerConfiguracionAtributos,
} = await import('../../modulos/admin/productos/servicioAtributos.js');

const SUFIJO = `atributos-${Date.now()}`;
const C = Date.now().toString(36).toUpperCase();

describeConDbReal('Admin/Atributos: configuración por categoría contra PostgreSQL real', () => {
  let pelucasId: string;
  let frontalesId: string;
  let accesoriosId: string;
  let colorId: string;
  let longitudId: string;
  let negro: string;
  let rubio: string;
  let gris: string; // desactivado desde el principio
  let largo24: string;
  let largo30: string;
  const idsValor: string[] = [];

  const configPelucas = () => [
    { atributoId: longitudId, obligatorio: true, valorIds: [largo24, largo30] },
    // Los valorIds de color se ignoran: el editor ya no los manda.
    { atributoId: colorId, obligatorio: true, valorIds: [] },
  ];

  beforeAll(async () => {
    const categoria = async (nombre: string) =>
      (
        await prisma.categoria.create({
          data: { nombre: `${nombre} ${SUFIJO}`, slug: `${nombre}-${SUFIJO}`.toLowerCase() },
        })
      ).id;
    pelucasId = await categoria('Pelucas');
    frontalesId = await categoria('Frontales');
    accesoriosId = await categoria('Accesorios');

    // Atributos compartidos con otras pruebas (slug único): upsert, nunca se
    // borran. Los valores son propios de esta corrida.
    const atributo = (slug: string, nombre: string) =>
      prisma.atributo.upsert({ where: { slug }, update: {}, create: { slug, nombre } });
    colorId = (await atributo('color', 'Color')).id;
    longitudId = (await atributo('longitud', 'Longitud')).id;

    const valor = async (atributoId: string, texto: string, codigo: string, activo = true) => {
      const fila = await prisma.valorAtributo.create({
        data: { atributoId, valor: `${texto} ${SUFIJO}`, codigo, orden: 900, activo },
      });
      idsValor.push(fila.id);
      return fila.id;
    };
    negro = await valor(colorId, 'Negro', `N${C}`);
    rubio = await valor(colorId, 'Rubio', `R${C}`);
    gris = await valor(colorId, 'Gris', `G${C}`, false);
    largo24 = await valor(longitudId, '24', `24${C}`);
    largo30 = await valor(longitudId, '30', `30${C}`);

    // Pelucas usa longitud y color; Frontales, solo color; Accesorios, nada.
    await guardarConfiguracionCategoria(pelucasId, { atributos: configPelucas() });
    await guardarConfiguracionCategoria(frontalesId, {
      atributos: [{ atributoId: colorId, obligatorio: false, valorIds: [] }],
    });
  });

  afterAll(async () => {
    const creados = await prisma.valorAtributo.findMany({
      where: { valor: { endsWith: SUFIJO } },
      select: { id: true },
    });
    await prisma.categoria.deleteMany({
      where: { id: { in: [pelucasId, frontalesId, accesoriosId] } },
    });
    await prisma.valorAtributo.deleteMany({
      where: { id: { in: [...idsValor, ...creados.map((v) => v.id)] } },
    });
    await prisma.$disconnect();
  });

  const configDe = async (categoriaId: string) =>
    (await obtenerConfiguracionAtributos()).categorias.find((c) => c.id === categoriaId)!;

  // Filas de color de una categoría, directo de la tabla.
  const coloresEnTabla = async (categoriaId: string) =>
    (
      await prisma.categoriaValorAtributo.findMany({
        where: { categoriaId, atributoId: colorId },
        select: { valorId: true },
      })
    ).map((f) => f.valorId);

  it('la configuración guarda el orden de la lista, obligatorios y valores', async () => {
    expect((await configDe(pelucasId)).atributos).toEqual([
      {
        atributoId: longitudId,
        obligatorio: true,
        valorIds: expect.arrayContaining([largo24, largo30]),
      },
      {
        atributoId: colorId,
        obligatorio: true,
        valorIds: expect.arrayContaining([negro, rubio, gris]),
      },
    ]);
  });

  it('guardar una categoría sin mandar colores no le borra los colores', async () => {
    expect(await coloresEnTabla(pelucasId)).toEqual(expect.arrayContaining([negro, rubio, gris]));
    await guardarConfiguracionCategoria(pelucasId, { atributos: configPelucas() });
    expect(await coloresEnTabla(pelucasId)).toEqual(expect.arrayContaining([negro, rubio, gris]));
  });

  it('guardar completa los colores que le falten a la categoría', async () => {
    // Datos viejos: la categoría quedó con un subconjunto de colores.
    await prisma.categoriaValorAtributo.deleteMany({
      where: { categoriaId: pelucasId, valorId: { in: [rubio, gris] } },
    });
    expect(await coloresEnTabla(pelucasId)).not.toContain(rubio);

    await guardarConfiguracionCategoria(pelucasId, { atributos: configPelucas() });
    expect(await coloresEnTabla(pelucasId)).toEqual(expect.arrayContaining([negro, rubio, gris]));
  });

  it('una categoría que empieza a usar color recibe todos, desactivados incluidos', async () => {
    expect(await coloresEnTabla(accesoriosId)).toEqual([]);
    await guardarConfiguracionCategoria(accesoriosId, {
      atributos: [{ atributoId: colorId, obligatorio: false, valorIds: [] }],
    });
    // Gris está desactivado pero tiene su fila: reactivarlo lo devuelve acá.
    expect(await coloresEnTabla(accesoriosId)).toEqual(
      expect.arrayContaining([negro, rubio, gris]),
    );
  });

  it('una categoría que deja de usar color pierde sus filas de color', async () => {
    await guardarConfiguracionCategoria(accesoriosId, { atributos: [] });
    expect(await coloresEnTabla(accesoriosId)).toEqual([]);
  });

  it('valorIds de color en el pedido se ignoran, no se rechazan (panel viejo en deploy)', async () => {
    await guardarConfiguracionCategoria(pelucasId, {
      atributos: [
        { atributoId: longitudId, obligatorio: true, valorIds: [largo24, largo30] },
        { atributoId: colorId, obligatorio: true, valorIds: [negro] },
      ],
    });
    expect(await coloresEnTabla(pelucasId)).toEqual(expect.arrayContaining([negro, rubio, gris]));
  });

  it('reordenar, sacar un valor y quitar un atributo reemplaza todo de una vez', async () => {
    await guardarConfiguracionCategoria(pelucasId, {
      atributos: [
        { atributoId: colorId, obligatorio: false, valorIds: [] },
        { atributoId: longitudId, obligatorio: true, valorIds: [largo30] },
      ],
    });
    const atributos = (await configDe(pelucasId)).atributos;
    expect(atributos.map((a) => a.atributoId)).toEqual([colorId, longitudId]);
    expect(atributos[1]!.valorIds).toEqual([largo30]);

    await guardarConfiguracionCategoria(pelucasId, {
      atributos: [{ atributoId: colorId, obligatorio: false, valorIds: [] }],
    });
    expect((await configDe(pelucasId)).atributos.map((a) => a.atributoId)).toEqual([colorId]);

    // Vuelve a como estaba, para las pruebas siguientes.
    await guardarConfiguracionCategoria(pelucasId, { atributos: configPelucas() });
  });

  it('obligatorio sin ningún valor permitido se rechaza', async () => {
    await expect(
      guardarConfiguracionCategoria(pelucasId, {
        atributos: [{ atributoId: longitudId, obligatorio: true, valorIds: [] }],
      }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
  });

  it('un valor de otro atributo se rechaza', async () => {
    await expect(
      guardarConfiguracionCategoria(pelucasId, {
        atributos: [{ atributoId: longitudId, obligatorio: true, valorIds: [negro] }],
      }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
  });

  it('un color nuevo queda en todas las categorías que usan color, sin elegirlas', async () => {
    const valor = await crearValorAtributo({
      atributoId: colorId,
      valor: `Borgoña ${SUFIJO}`,
      hex: '#5b1a2a',
      codigo: `b${C}`,
    });
    expect(valor).toMatchObject({ codigo: `B${C}`, activo: true });
    expect(await coloresEnTabla(pelucasId)).toContain(valor.id);
    expect(await coloresEnTabla(frontalesId)).toContain(valor.id);
    // Accesorios no usa color: no tiene dónde aparecer.
    expect(await coloresEnTabla(accesoriosId)).not.toContain(valor.id);
  });

  it('un color sin código se rechaza: va en el SKU', async () => {
    await expect(
      crearValorAtributo({ atributoId: colorId, valor: `Sin código ${SUFIJO}` }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
  });

  it('un largo nuevo pide categoría y no se habilita en una que no usa longitud', async () => {
    await expect(
      crearValorAtributo({ atributoId: longitudId, valor: `32 ${SUFIJO}`, codigo: `32${C}` }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
    await expect(
      crearValorAtributo({
        atributoId: longitudId,
        valor: `34 ${SUFIJO}`,
        codigo: `34${C}`,
        categoriaIds: [frontalesId],
      }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
    expect(await prisma.valorAtributo.count({ where: { valor: `34 ${SUFIJO}` } })).toBe(0);
  });

  it('nombre repetido de un color activo: 409 con activo true (sin distinguir mayúsculas)', async () => {
    await expect(
      crearValorAtributo({
        atributoId: colorId,
        valor: `NEGRO ${SUFIJO}`.toUpperCase(),
        codigo: `X${C}`,
      }),
    ).rejects.toMatchObject({
      estadoHttp: 409,
      detalles: { valorId: negro, activo: true, campo: 'valor' },
    });
  });

  it('nombre de un color desactivado: 409 que dice que está desactivado', async () => {
    await expect(
      crearValorAtributo({ atributoId: colorId, valor: `Gris ${SUFIJO}`, codigo: `Y${C}` }),
    ).rejects.toMatchObject({
      estadoHttp: 409,
      detalles: { valorId: gris, activo: false, campo: 'valor' },
    });
  });

  it('código repetido en el mismo atributo: 409 con campo código', async () => {
    await expect(
      crearValorAtributo({ atributoId: colorId, valor: `Otro negro ${SUFIJO}`, codigo: `N${C}` }),
    ).rejects.toMatchObject({
      estadoHttp: 409,
      detalles: { valorId: negro, campo: 'codigo' },
    });
  });

  it('un color desactivado no se ofrece y se rechaza al crear variantes; reactivarlo lo devuelve', async () => {
    const coloresOfrecidos = async () =>
      (await atributosDeCategoria(prisma, pelucasId))
        .find((a) => a.id === colorId)!
        .valores.map((v) => v.id);

    expect(await coloresOfrecidos()).not.toContain(gris);
    const atributos = await atributosDeCategoria(prisma, pelucasId);
    expect(() =>
      validarValoresParaCategoria(atributos, [largo24, gris], (id) =>
        id === gris ? { valor: 'Gris', activo: false } : { valor: '24', activo: true },
      ),
    ).toThrow(/Gris está desactivado/);

    const reactivado = await cambiarActivoValor(gris, true);
    expect(reactivado.activo).toBe(true);
    expect(await coloresOfrecidos()).toContain(gris);

    // Desactivar no toca sus filas: sigue en la tabla de todas las categorías.
    await cambiarActivoValor(gris, false);
    expect(await coloresOfrecidos()).not.toContain(gris);
    expect(await coloresEnTabla(pelucasId)).toContain(gris);
    expect(await coloresEnTabla(frontalesId)).toContain(gris);
  });

  it('cambiar activo de un valor que no existe: 404', async () => {
    await expect(
      cambiarActivoValor('00000000-0000-4000-8000-000000000000', true),
    ).rejects.toMatchObject({ estadoHttp: 404 });
  });

  it('un color combinado guarda los dos tonos; igual al primario queda sólido', async () => {
    const combinado = await crearValorAtributo({
      atributoId: colorId,
      valor: `Rubio raíz oscura ${SUFIJO}`,
      hex: '#d9b98a',
      hexSecundario: '#3b2620',
      codigo: `RO${C}`,
    });
    expect(combinado).toMatchObject({ hex: '#d9b98a', hexSecundario: '#3b2620' });

    const mismoTono = await crearValorAtributo({
      atributoId: colorId,
      valor: `Miel ${SUFIJO}`,
      hex: '#a97e4c',
      hexSecundario: '#A97E4C',
      codigo: `MI${C}`,
    });
    expect(mismoTono.hexSecundario).toBeNull();
  });

  it('secundario sin primario, o en un atributo que no es color: 400', async () => {
    await expect(
      crearValorAtributo({
        atributoId: colorId,
        valor: `Sin primario ${SUFIJO}`,
        hexSecundario: '#3b2620',
        codigo: `SP${C}`,
      }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
    await expect(
      crearValorAtributo({
        atributoId: longitudId,
        valor: `36 ${SUFIJO}`,
        hex: '#000000',
        hexSecundario: '#ffffff',
        codigo: `36${C}`,
        categoriaIds: [pelucasId],
      }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
  });

  it('el caso "Caramelo rubio": creado sólido, se edita a dos tonos sin recrearlo', async () => {
    const caramelo = await crearValorAtributo({
      atributoId: colorId,
      valor: `Caramelo rubio ${SUFIJO}`,
      hex: '#8a5a34',
      codigo: `CR${C}`,
    });
    // Recrearlo choca con el nombre: la salida es editarlo.
    await expect(
      crearValorAtributo({
        atributoId: colorId,
        valor: `Caramelo rubio ${SUFIJO}`,
        hex: '#8a5a34',
        hexSecundario: '#d9b98a',
        codigo: `Q${C}`,
      }),
    ).rejects.toMatchObject({ estadoHttp: 409 });

    const editado = await editarValorAtributo(caramelo.id, { hexSecundario: '#d9b98a' });
    expect(editado).toMatchObject({
      valor: `Caramelo rubio ${SUFIJO}`,
      hex: '#8a5a34',
      hexSecundario: '#d9b98a',
      codigo: `CR${C}`,
    });

    // Volver a sólido.
    expect((await editarValorAtributo(caramelo.id, { hexSecundario: null })).hexSecundario).toBe(
      null,
    );
  });

  it('el nombre se edita; no puede chocar con otro valor del mismo atributo', async () => {
    const editado = await editarValorAtributo(rubio, { valor: `Rubio miel ${SUFIJO}` });
    expect(editado.valor).toBe(`Rubio miel ${SUFIJO}`);
    await expect(editarValorAtributo(rubio, { valor: `negro ${SUFIJO}` })).rejects.toMatchObject({
      estadoHttp: 409,
      detalles: { valorId: negro, campo: 'valor' },
    });
  });

  it('el código se edita mientras ninguna variante lo usa; con variantes, 409 y no cambia', async () => {
    const libre = await editarValorAtributo(negro, { codigo: `ng${C}` });
    expect(libre.codigo).toBe(`NG${C}`);

    // Una variante con este color: el código ya está dentro de su SKU.
    const producto = await prisma.producto.create({
      data: { nombre: `Peluca ${SUFIJO}`, slug: `peluca-${SUFIJO}`, categoriaId: pelucasId },
    });
    const variante = await prisma.varianteProducto.create({
      data: { productoId: producto.id, sku: `SKU-NG${C}`, precioActual: 1 },
    });
    await prisma.varianteValorAtributo.create({
      data: { varianteId: variante.id, valorId: negro },
    });
    try {
      await expect(editarValorAtributo(negro, { codigo: `NN${C}` })).rejects.toMatchObject({
        estadoHttp: 409,
      });
      // Mandar el mismo código no es un cambio: no se rechaza.
      await expect(editarValorAtributo(negro, { codigo: `NG${C}` })).resolves.toMatchObject({
        codigo: `NG${C}`,
      });
      // Nombre y tonos sí, aunque tenga variantes.
      await expect(
        editarValorAtributo(negro, { valor: `Negro azabache ${SUFIJO}`, hex: '#111111' }),
      ).resolves.toMatchObject({ valor: `Negro azabache ${SUFIJO}`, hex: '#111111' });

      const config = await obtenerConfiguracionAtributos();
      const fila = config.atributos
        .find((a) => a.id === colorId)!
        .valores.find((v) => v.id === negro)!;
      expect(fila.variantesQueLoUsan).toBe(1);
    } finally {
      await prisma.varianteValorAtributo.deleteMany({ where: { varianteId: variante.id } });
      await prisma.varianteProducto.delete({ where: { id: variante.id } });
      await prisma.producto.delete({ where: { id: producto.id } });
    }
  });

  it('editar un valor que no existe: 404', async () => {
    await expect(
      editarValorAtributo('00000000-0000-4000-8000-000000000000', { valor: 'X' }),
    ).rejects.toMatchObject({ estadoHttp: 404 });
  });
});
