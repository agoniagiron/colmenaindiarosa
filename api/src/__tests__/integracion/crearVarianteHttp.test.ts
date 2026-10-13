// POST /api/admin/productos/:id/variantes de punta a punta (auth, permiso,
// validación Zod, servicio, base real) con el payload EXACTO que arma el
// formulario del panel: contratos/nuevaVariante.json, el mismo que verifica
// web/src/__tests__/datosNuevaVariante.test.ts. Si el esquema y el
// formulario se desincronizan, falla uno de los dos.
// Requiere DATABASE_URL_TEST; si no está, se salta.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (DATABASE_URL_TEST) {
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.DIRECT_URL = DATABASE_URL_TEST;
}

const describeConDbReal = DATABASE_URL_TEST ? describe : describe.skip;

const { app } = await import('../../app.js');
const { prisma } = await import('../../lib/prisma.js');
const { firmarAccessTokenAdmin } = await import('../../lib/jwtAdmin.js');

interface Contrato {
  payload: { valoresAtributo: string[] } & Record<string, unknown>;
}
const contrato = JSON.parse(
  readFileSync(new URL('../contratos/nuevaVariante.json', import.meta.url), 'utf8'),
) as Contrato;

const SUFIJO = `variante-http-${Date.now()}`;
const C = Date.now().toString(36).toUpperCase();
const PERMISOS = ['productos.ver', 'productos.crear'];

describeConDbReal('POST /api/admin/productos/:id/variantes con el payload del formulario', () => {
  let token: string;
  let usuarioAdminId: string;
  let rolId: string;
  let categoriaId: string;
  let productoId: string;
  const idsValor: string[] = [];

  beforeAll(async () => {
    // Los permisos son catálogo compartido (clave única): upsert, nunca se
    // borran. Rol, admin y datos de catálogo son propios de esta corrida.
    const permisos = await Promise.all(
      PERMISOS.map((clave) =>
        prisma.permiso.upsert({
          where: { clave },
          update: {},
          create: { clave, modulo: 'productos', descripcion: clave },
        }),
      ),
    );
    rolId = (
      await prisma.rol.create({
        data: {
          nombre: `Rol ${SUFIJO}`,
          slug: `rol-${SUFIJO}`,
          permisos: { create: permisos.map((p) => ({ permisoId: p.id })) },
        },
      })
    ).id;
    usuarioAdminId = (
      await prisma.usuarioAdmin.create({
        data: { nombre: 'Admin HTTP', correo: `${SUFIJO}@example.com`, claveHash: 'no-usado' },
      })
    ).id;
    await prisma.usuarioAdminRol.create({ data: { usuarioAdminId, rolId } });
    token = firmarAccessTokenAdmin(usuarioAdminId);

    categoriaId = (
      await prisma.categoria.create({
        data: { nombre: `Cat ${SUFIJO}`, slug: `cat-${SUFIJO}`, codigo: `H${C}` },
      })
    ).id;
    productoId = (
      await prisma.producto.create({
        data: {
          nombre: `Peluca ${SUFIJO}`,
          slug: `peluca-${SUFIJO}`,
          categoriaId,
          codigoModelo: `M${C}`,
        },
      })
    ).id;

    // Cinco atributos, uno por cada VALOR_n del contrato, como en el panel.
    const definiciones: [string, string, string | null][] = [
      ['tipo_base', 'Tipo de base', null],
      ['longitud', 'Longitud', `26${C}`],
      ['color', 'Color', `NEG${C}`],
      ['talla', 'Talla de gorro', null],
      ['densidad', 'Densidad', null],
    ];
    for (const [slug, nombre, codigo] of definiciones) {
      const atributo = await prisma.atributo.upsert({
        where: { slug },
        update: {},
        create: { slug, nombre },
      });
      const valor = await prisma.valorAtributo.create({
        data: { atributoId: atributo.id, valor: `${slug} ${SUFIJO}`, codigo },
      });
      idsValor.push(valor.id);
    }
  });

  afterAll(async () => {
    const variantes = await prisma.varianteProducto.findMany({
      where: { productoId },
      select: { id: true },
    });
    const ids = variantes.map((v) => v.id);
    await prisma.movimientoInventario.deleteMany({ where: { varianteId: { in: ids } } });
    await prisma.precioVariante.deleteMany({ where: { varianteId: { in: ids } } });
    await prisma.varianteValorAtributo.deleteMany({ where: { varianteId: { in: ids } } });
    await prisma.varianteProducto.deleteMany({ where: { id: { in: ids } } });
    await prisma.producto.deleteMany({ where: { id: productoId } });
    await prisma.valorAtributo.deleteMany({ where: { id: { in: idsValor } } });
    await prisma.categoria.deleteMany({ where: { id: categoriaId } });
    await prisma.usuarioAdminRol.deleteMany({ where: { usuarioAdminId } });
    await prisma.usuarioAdmin.deleteMany({ where: { id: usuarioAdminId } });
    await prisma.rol.deleteMany({ where: { id: rolId } });
    await prisma.$disconnect();
  });

  it('el payload exacto del formulario crea la variante (201) con SKU generado', async () => {
    const payload = {
      ...contrato.payload,
      valoresAtributo: contrato.payload.valoresAtributo.map((marcador) => {
        const indice = Number(marcador.replace('VALOR_', ''));
        return idsValor[indice]!;
      }),
    };

    const respuesta = await request(app)
      .post(`/api/admin/productos/${productoId}/variantes`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.sku).toBe(`IR-H${C}-M${C}-26${C}-NEG${C}`);
    expect(respuesta.body.precioActual).toBe(990000);
    expect(respuesta.body.costoActual).toBe(350000);
    expect(respuesta.body.stockActual).toBe(3);
  });

  it('un 400 de validación dice qué campos fallaron, sin los issues crudos de Zod', async () => {
    const respuesta = await request(app)
      .post(`/api/admin/productos/${productoId}/variantes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ costo: 1, stockInicial: 'tres', valoresAtributo: ['no-es-uuid'] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('peticion_invalida');
    expect(respuesta.body.error.detalles).toEqual({
      campos: expect.arrayContaining([
        { campo: 'precio', problema: 'es obligatorio' },
        { campo: 'stockInicial', problema: 'tiene que ser un número' },
        { campo: 'valoresAtributo.0', problema: 'no tiene un formato válido' },
      ]),
    });
    expect(respuesta.body.error.mensaje).toMatch(
      /^Revisá estos campos: .*precio \(es obligatorio\)/,
    );
    expect(JSON.stringify(respuesta.body)).not.toMatch(/"code"|"expected"|"path"/);
  });
});
