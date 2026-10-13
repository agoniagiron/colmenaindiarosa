// Prueba de integración real del asistente de variantes en lote y de la
// creación individual, que comparten insertarVariantes: SKU generado desde
// las columnas codigo, historial de precios, movimiento de inventario y
// transacción de todo o nada. Mismo criterio que productosAdmin.test.ts.
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
const { cambiarVariantePrincipal, crearVariante, editarVariante, obtenerDetalleProducto } =
  await import('../../modulos/admin/productos/servicio.js');
const { crearLote, previsualizarLote } = await import('../../modulos/admin/productos/variantes.js');

const SUFIJO = `lote-${Date.now()}`;
// Códigos solo con letras y números (sku.ts), únicos por corrida.
const C = Date.now().toString(36).toUpperCase();

describeConDbReal('Admin/Productos: variantes en lote contra PostgreSQL real', () => {
  let categoriaId: string;
  let usuarioAdminId: string;
  let largo24: string;
  let largo30: string;
  let largoSinCodigo: string;
  let negro: string;
  let miel: string;
  let densidad: string;
  const idsProducto: string[] = [];
  const idsValor: string[] = [];

  const codigoProducto = (modelo: string) => `IR-K${C}-${modelo}`;

  async function productoNuevo(modelo: string | null) {
    const producto = await prisma.producto.create({
      data: {
        nombre: `Peluca ${SUFIJO} ${modelo ?? 'sin codigo'}`,
        slug: `peluca-${SUFIJO}-${idsProducto.length}`,
        categoriaId,
        codigoModelo: modelo,
      },
    });
    idsProducto.push(producto.id);
    return producto.id;
  }

  beforeAll(async () => {
    categoriaId = (
      await prisma.categoria.create({
        data: { nombre: `Cat ${SUFIJO}`, slug: `cat-${SUFIJO}`, codigo: `K${C}` },
      })
    ).id;
    usuarioAdminId = (
      await prisma.usuarioAdmin.create({
        data: { nombre: 'Admin lote', correo: `${SUFIJO}@example.com`, claveHash: 'no-usado' },
      })
    ).id;

    // Los atributos se comparten con otras pruebas (slug único): upsert y
    // nunca se borran. Los valores son propios de esta corrida.
    const atributo = (slug: string, nombre: string) =>
      prisma.atributo.upsert({ where: { slug }, update: {}, create: { slug, nombre } });
    const longitud = await atributo('longitud', 'Longitud');
    const color = await atributo('color', 'Color');
    const atributoDensidad = await atributo('densidad', 'Densidad');

    const valor = async (
      atributoId: string,
      texto: string,
      codigo: string | null,
      orden: number,
    ) => {
      const fila = await prisma.valorAtributo.create({
        data: { atributoId, valor: `${texto} ${SUFIJO}`, codigo, orden, hex: null },
      });
      idsValor.push(fila.id);
      return fila.id;
    };
    // Orden a propósito invertido respecto de la creación: la vista previa
    // tiene que respetar `orden`, no el orden en que llegan los ids.
    largo30 = await valor(longitud.id, '30', `30${C}`, 2);
    largo24 = await valor(longitud.id, '24', `24${C}`, 1);
    largoSinCodigo = await valor(longitud.id, '99', null, 3);
    negro = await valor(color.id, 'Negro', `NEG${C}`, 1);
    miel = await valor(color.id, 'Miel', `MIE${C}`, 2);
    densidad = await valor(atributoDensidad.id, '180', null, 1);
  });

  afterAll(async () => {
    const variantes = await prisma.varianteProducto.findMany({
      where: { productoId: { in: idsProducto } },
      select: { id: true },
    });
    const ids = variantes.map((v) => v.id);
    await prisma.movimientoInventario.deleteMany({ where: { varianteId: { in: ids } } });
    await prisma.precioVariante.deleteMany({ where: { varianteId: { in: ids } } });
    await prisma.varianteValorAtributo.deleteMany({ where: { varianteId: { in: ids } } });
    await prisma.varianteProducto.deleteMany({ where: { id: { in: ids } } });
    await prisma.producto.deleteMany({ where: { id: { in: idsProducto } } });
    await prisma.valorAtributo.deleteMany({ where: { id: { in: idsValor } } });
    await prisma.categoria.deleteMany({ where: { id: categoriaId } });
    await prisma.usuarioAdmin.deleteMany({ where: { id: usuarioAdminId } });
    await prisma.$disconnect();
  });

  it('la vista previa arma largo × color con SKU y precio por longitud, en el orden de los valores', async () => {
    const productoId = await productoNuevo(`VAL${C}`);

    const { codigoProducto: codigo, combinaciones } = await previsualizarLote(productoId, {
      longitudes: [
        { valorId: largo30, precio: 900000 },
        { valorId: largo24, precio: 700000 },
      ],
      colores: [miel, negro],
      fijos: [densidad],
    });

    expect(codigo).toBe(codigoProducto(`VAL${C}`));
    expect(combinaciones.map((c) => [c.sku, c.precio])).toEqual([
      [`${codigo}-24${C}-NEG${C}`, 700000],
      [`${codigo}-24${C}-MIE${C}`, 700000],
      [`${codigo}-30${C}-NEG${C}`, 900000],
      [`${codigo}-30${C}-MIE${C}`, 900000],
    ]);
    expect(combinaciones.every((c) => !c.yaExiste && !c.skuOcupado)).toBe(true);
    // Previsualizar no guarda nada.
    expect(await prisma.varianteProducto.count({ where: { productoId } })).toBe(0);
  });

  it('crea las combinaciones marcadas con su stock, precio corregido, historial y movimiento', async () => {
    const productoId = await productoNuevo(`CAM${C}`);
    const codigo = codigoProducto(`CAM${C}`);

    const resultado = await crearLote(
      productoId,
      {
        longitudes: [
          { valorId: largo24, precio: 700000, costo: 300000 },
          { valorId: largo30, precio: 900000 },
        ],
        colores: [negro, miel],
        fijos: [densidad],
        // 30-MIE desmarcada; 24-MIE con precio corregido a mano.
        combinaciones: [
          { longitudId: largo24, colorId: negro, stock: 3 },
          { longitudId: largo24, colorId: miel, stock: 0, precio: 720000 },
          { longitudId: largo30, colorId: negro, stock: 5 },
        ],
      },
      usuarioAdminId,
    );

    expect(resultado.creadas).toEqual([
      `${codigo}-24${C}-NEG${C}`,
      `${codigo}-24${C}-MIE${C}`,
      `${codigo}-30${C}-NEG${C}`,
    ]);
    expect(resultado.saltadas).toEqual([]);

    const variantes = await prisma.varianteProducto.findMany({
      where: { productoId },
      select: {
        sku: true,
        precioActual: true,
        costoActual: true,
        stockActual: true,
        valoresAtributo: { select: { valorId: true } },
        historialPrecios: { select: { precio: true, motivo: true, creadoPorId: true } },
        movimientosInventario: { select: { tipo: true, cantidad: true, stockResultante: true } },
      },
      orderBy: { sku: 'asc' },
    });
    const porSku = new Map(variantes.map((v) => [v.sku, v]));

    const negra24 = porSku.get(`${codigo}-24${C}-NEG${C}`)!;
    expect(negra24.precioActual).toBe(700000);
    expect(negra24.costoActual).toBe(300000);
    expect(negra24.stockActual).toBe(3);
    expect(negra24.valoresAtributo.map((r) => r.valorId).sort()).toEqual(
      [largo24, negro, densidad].sort(),
    );
    expect(negra24.historialPrecios).toEqual([
      { precio: 700000, motivo: 'Precio inicial', creadoPorId: usuarioAdminId },
    ]);
    expect(negra24.movimientosInventario).toEqual([
      { tipo: 'entrada', cantidad: 3, stockResultante: 3 },
    ]);

    expect(porSku.get(`${codigo}-24${C}-MIE${C}`)!.precioActual).toBe(720000);
    expect(porSku.get(`${codigo}-30${C}-NEG${C}`)!.stockActual).toBe(5);
    expect(porSku.has(`${codigo}-30${C}-MIE${C}`)).toBe(false);
  });

  it('las combinaciones que ya existen se saltan y no se duplican', async () => {
    const productoId = await productoNuevo(`REP${C}`);
    const codigo = codigoProducto(`REP${C}`);
    const base = {
      longitudes: [{ valorId: largo24, precio: 700000 }],
      colores: [negro],
      fijos: [],
    };
    await crearLote(
      productoId,
      { ...base, combinaciones: [{ longitudId: largo24, colorId: negro, stock: 1 }] },
      usuarioAdminId,
    );

    const vista = await previsualizarLote(productoId, {
      ...base,
      colores: [negro, miel],
    });
    expect(vista.combinaciones.map((c) => [c.sku, c.yaExiste])).toEqual([
      [`${codigo}-24${C}-NEG${C}`, true],
      [`${codigo}-24${C}-MIE${C}`, false],
    ]);

    const resultado = await crearLote(
      productoId,
      {
        ...base,
        colores: [negro, miel],
        combinaciones: [
          { longitudId: largo24, colorId: negro, stock: 9 },
          { longitudId: largo24, colorId: miel, stock: 2 },
        ],
      },
      usuarioAdminId,
    );
    expect(resultado).toEqual({
      creadas: [`${codigo}-24${C}-MIE${C}`],
      saltadas: [`${codigo}-24${C}-NEG${C}`],
    });

    const negra = await prisma.varianteProducto.findUniqueOrThrow({
      where: { sku: `${codigo}-24${C}-NEG${C}` },
    });
    // La saltada conserva su stock: el 9 no se aplicó.
    expect(negra.stockActual).toBe(1);
    expect(await prisma.varianteProducto.count({ where: { productoId } })).toBe(2);
  });

  it('si un SKU choca con uno existente responde 409 con la lista y no crea ninguna', async () => {
    const productoId = await productoNuevo(`CHO${C}`);
    const codigo = codigoProducto(`CHO${C}`);
    const otroProducto = await productoNuevo(null);
    // Una variante vieja de otro producto que ya usa uno de los SKU.
    await prisma.varianteProducto.create({
      data: { productoId: otroProducto, sku: `${codigo}-30${C}-NEG${C}`, precioActual: 1 },
    });

    const datos = {
      longitudes: [
        { valorId: largo24, precio: 700000 },
        { valorId: largo30, precio: 900000 },
      ],
      colores: [negro],
      fijos: [],
    };
    const vista = await previsualizarLote(productoId, datos);
    expect(vista.combinaciones.map((c) => c.skuOcupado)).toEqual([false, true]);

    await expect(
      crearLote(
        productoId,
        {
          ...datos,
          combinaciones: [
            { longitudId: largo24, colorId: negro, stock: 1 },
            { longitudId: largo30, colorId: negro, stock: 1 },
          ],
        },
        usuarioAdminId,
      ),
    ).rejects.toMatchObject({
      estadoHttp: 409,
      detalles: { skus: [`${codigo}-30${C}-NEG${C}`] },
    });
    // Todo o nada: la 24-NEG, que no chocaba, tampoco quedó creada.
    expect(await prisma.varianteProducto.count({ where: { productoId } })).toBe(0);
  });

  it('sin código de modelo no se puede generar ninguna variante', async () => {
    const productoId = await productoNuevo(null);
    await expect(
      previsualizarLote(productoId, {
        longitudes: [{ valorId: largo24, precio: 1 }],
        colores: [],
        fijos: [],
      }),
    ).rejects.toMatchObject({ estadoHttp: 409 });
  });

  it('una longitud sin código se rechaza con 400 en vez de armar un SKU incompleto', async () => {
    const productoId = await productoNuevo(`SIN${C}`);
    await expect(
      previsualizarLote(productoId, {
        longitudes: [{ valorId: largoSinCodigo, precio: 1 }],
        colores: [negro],
        fijos: [],
      }),
    ).rejects.toMatchObject({ estadoHttp: 400 });
  });

  it('la creación individual arma el SKU igual que el lote y escribe historial de precios', async () => {
    const productoId = await productoNuevo(`IND${C}`);

    const variante = await crearVariante(
      productoId,
      {
        precio: 650000,
        stockInicial: 4,
        puntoReorden: 1,
        valoresAtributo: [largo30, miel, densidad],
      },
      usuarioAdminId,
    );

    expect(variante.sku).toBe(`${codigoProducto(`IND${C}`)}-30${C}-MIE${C}`);
    const historial = await prisma.precioVariante.findMany({ where: { varianteId: variante.id } });
    expect(historial.map((h) => [h.precio, h.motivo])).toEqual([[650000, 'Precio inicial']]);
  });

  it('la creación individual rechaza dos valores del mismo atributo', async () => {
    const productoId = await productoNuevo(`DOS${C}`);
    await expect(
      crearVariante(
        productoId,
        { precio: 1, stockInicial: 0, puntoReorden: 0, valoresAtributo: [negro, miel] },
        usuarioAdminId,
      ),
    ).rejects.toMatchObject({ estadoHttp: 400 });
  });

  describe('variante principal', () => {
    const principalDe = async (productoId: string) =>
      (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).variantePrincipalId;

    it('la primera variante de un producto nuevo queda como principal (lote y suelta)', async () => {
      const conLote = await productoNuevo(`PL${C}`);
      await crearLote(
        conLote,
        {
          longitudes: [
            { valorId: largo24, precio: 990000 },
            { valorId: largo30, precio: 1050000 },
          ],
          colores: [negro],
          fijos: [],
          combinaciones: [
            { longitudId: largo24, colorId: negro, stock: 1 },
            { longitudId: largo30, colorId: negro, stock: 1 },
          ],
        },
        usuarioAdminId,
      );
      const primera = await prisma.varianteProducto.findUniqueOrThrow({
        where: { sku: `${codigoProducto(`PL${C}`)}-24${C}-NEG${C}` },
      });
      expect(await principalDe(conLote)).toBe(primera.id);

      const suelta = await productoNuevo(`PS${C}`);
      const unica = await crearVariante(
        suelta,
        { precio: 1, stockInicial: 0, puntoReorden: 0, valoresAtributo: [largo24] },
        usuarioAdminId,
      );
      expect(await principalDe(suelta)).toBe(unica.id);
    });

    it('a un producto que ya tenía variantes sin principal no se le asigna una sola', async () => {
      const productoId = await productoNuevo(`PV${C}`);
      await prisma.varianteProducto.create({
        data: { productoId, sku: `VIEJA-${C}`, precioActual: 1 },
      });
      await crearVariante(
        productoId,
        { precio: 1, stockInicial: 0, puntoReorden: 0, valoresAtributo: [largo30] },
        usuarioAdminId,
      );
      expect(await principalDe(productoId)).toBeNull();
      expect((await obtenerDetalleProducto(productoId)).principal.estado).toBe('sin_definir');
    });

    it('se cambia desde el panel, avisa si no es la más barata y si queda inactiva', async () => {
      const productoId = await productoNuevo(`PC${C}`);
      const barata = await crearVariante(
        productoId,
        { precio: 990000, stockInicial: 2, puntoReorden: 0, valoresAtributo: [largo24] },
        usuarioAdminId,
      );
      const cara = await crearVariante(
        productoId,
        { precio: 1050000, stockInicial: 2, puntoReorden: 0, valoresAtributo: [largo30] },
        usuarioAdminId,
      );
      expect(await principalDe(productoId)).toBe(barata.id);

      const detalle = await cambiarVariantePrincipal(productoId, cara.id);
      expect(detalle.variantePrincipalId).toBe(cara.id);
      expect(detalle.principal).toMatchObject({
        estado: 'definida',
        noEsLaMasBarata: { precioPrincipal: 1050000, precioMinimo: 990000 },
      });

      // Agotada y más cara: el aviso de "se va a ver a $X" sería falso (la
      // tienda muestra la más barata con stock), así que solo avisa el stock.
      const agotada = await crearVariante(
        productoId,
        { precio: 1100000, stockInicial: 0, puntoReorden: 0, valoresAtributo: [largo24, negro] },
        usuarioAdminId,
      );
      const conAgotada = await cambiarVariantePrincipal(productoId, agotada.id);
      expect(conAgotada.principal).toMatchObject({ sinStock: true, noEsLaMasBarata: null });
      await cambiarVariantePrincipal(productoId, cara.id);

      await editarVariante(cara.id, { activa: false });
      expect((await obtenerDetalleProducto(productoId)).principal.estado).toBe('inactiva');
      await expect(cambiarVariantePrincipal(productoId, cara.id)).rejects.toMatchObject({
        estadoHttp: 409,
      });
    });

    it('no acepta una variante de otro producto', async () => {
      const uno = await productoNuevo(`PO${C}`);
      const otro = await productoNuevo(`PP${C}`);
      const ajena = await crearVariante(
        otro,
        { precio: 1, stockInicial: 0, puntoReorden: 0, valoresAtributo: [] },
        usuarioAdminId,
      );
      await expect(cambiarVariantePrincipal(uno, ajena.id)).rejects.toMatchObject({
        estadoHttp: 400,
      });
    });
  });
});
