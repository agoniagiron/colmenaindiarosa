// Prueba de integración real: sin mockear Prisma, contra un PostgreSQL
// local de verdad (nunca Supabase). Existe porque un `vi.mock('../lib/
// prisma.js', ...)` había ocultado que el registro estaba roto — ese tipo
// de falla solo se ve pegándole a una base real.
//
// Requiere DATABASE_URL_TEST configurada y la base preparada con
// `npx tsx scripts/preparar-db-prueba.ts`. Si no está configurada, esta
// suite se salta en vez de romper `npm test` en un entorno sin Postgres
// local (por ejemplo, CI sin ese setup).
import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (!DATABASE_URL_TEST) {
  console.warn(
    'DATABASE_URL_TEST no está configurada: se salta la prueba de integración de registro/login. ' +
      'Corré npx tsx scripts/preparar-db-prueba.ts y configurá la variable en api/.env para incluirla.',
  );
} else {
  // Debe pasar ANTES de importar app.js: el singleton de lib/prisma.js
  // lee DATABASE_URL/DIRECT_URL en el momento en que se instancia
  // PrismaClient. dotenv no pisa variables ya presentes en process.env,
  // así que esto gana sobre lo que cargue api/.env.
  process.env.DATABASE_URL = DATABASE_URL_TEST;
  process.env.DIRECT_URL = DATABASE_URL_TEST;
}

const describeConDbReal = DATABASE_URL_TEST ? describe : describe.skip;

const { app } = await import('../../app.js');
const { prisma } = await import('../../lib/prisma.js');

describeConDbReal('Registro y login contra PostgreSQL real (sin mocks)', () => {
  const correo = `integracion-${Date.now()}@example.com`;
  const clave = 'Password123';

  afterAll(async () => {
    // sesion_auth se borra en cascada (onDelete: Cascade) al borrar el
    // usuario.
    await prisma.usuario.deleteMany({ where: { correo } });
    await prisma.$disconnect();
  });

  it('registra un usuario real, lo guarda con la clave hasheada y permite loguearse con sesión real', async () => {
    const registro = await request(app).post('/api/auth/registro').send({
      nombre: 'Integración',
      correo,
      clave,
      aceptoTerminos: true,
      aceptoTratamiento: true,
    });

    expect(registro.status).toBe(201);
    expect(registro.body.correo).toBe(correo);
    expect(registro.body.claveHash).toBeUndefined();

    const enBaseDeDatos = await prisma.usuario.findUnique({ where: { correo } });
    expect(enBaseDeDatos).not.toBeNull();
    expect(enBaseDeDatos?.claveHash).not.toBe(clave);

    const login = await request(app).post('/api/auth/login').send({ correo, clave });

    expect(login.status).toBe(200);
    expect(typeof login.body.accessToken).toBe('string');

    const cookies = login.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookies?.some((cookie) => cookie.startsWith('refresh_token='))).toBe(true);

    const sesion = await prisma.sesionAuth.findFirst({ where: { usuarioId: enBaseDeDatos!.id } });
    expect(sesion).not.toBeNull();
  });

  it('respeta el índice único real de correo: un segundo registro con el mismo correo da 409', async () => {
    const respuesta = await request(app).post('/api/auth/registro').send({
      nombre: 'Integración Otra Vez',
      correo,
      clave,
      aceptoTerminos: true,
      aceptoTratamiento: true,
    });

    expect(respuesta.status).toBe(409);
  });

  it('con contraseña incorrecta contra el hash real responde 401', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ correo, clave: 'OtraClave123' });

    expect(respuesta.status).toBe(401);
  });
});
