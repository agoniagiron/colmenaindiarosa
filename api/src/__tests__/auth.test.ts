import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

const usuarioFindUniqueMock = vi.fn();
const usuarioCreateMock = vi.fn();
const sesionAuthCreateMock = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    usuario: { findUnique: usuarioFindUniqueMock, create: usuarioCreateMock },
    sesionAuth: { create: sesionAuthCreateMock },
  },
}));

const { app } = await import('../app.js');

const CLAVE_VALIDA = 'Password123';
const HASH_CLAVE_VALIDA = bcrypt.hashSync(CLAVE_VALIDA, 12);

function usuarioDeBaseDeDatos() {
  return {
    id: 'usuario-1',
    nombre: 'Ana',
    apellido: null,
    correo: 'ana@example.com',
    claveHash: HASH_CLAVE_VALIDA,
    telefono: null,
    activo: true,
    correoVerificado: false,
    creadoEn: new Date(),
  };
}

describe('POST /api/auth/registro', () => {
  beforeEach(() => {
    usuarioFindUniqueMock.mockReset();
    usuarioCreateMock.mockReset();
  });

  it('crea el usuario (siempre cliente, no hay otro rol en esta tabla), correo en minúsculas y sin devolver la clave', async () => {
    usuarioFindUniqueMock.mockResolvedValueOnce(null);
    usuarioCreateMock.mockResolvedValueOnce({
      id: 'usuario-1',
      nombre: 'Ana',
      apellido: null,
      correo: 'ana@example.com',
      telefono: null,
      correoVerificado: false,
      creadoEn: new Date(),
    });

    const respuesta = await request(app).post('/api/auth/registro').send({
      nombre: 'Ana',
      correo: 'Ana@Example.com',
      clave: CLAVE_VALIDA,
      aceptoTerminos: true,
      aceptoTratamiento: true,
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.correo).toBe('ana@example.com');
    expect(respuesta.body.claveHash).toBeUndefined();

    const datosCreados = usuarioCreateMock.mock.calls[0]![0].data;
    expect(datosCreados.correo).toBe('ana@example.com');
    expect(datosCreados.claveHash).not.toBe(CLAVE_VALIDA);
    expect(datosCreados.aceptoEn).toBeInstanceOf(Date);
  });

  it('devuelve 409 si el correo ya está registrado', async () => {
    usuarioFindUniqueMock.mockResolvedValueOnce({ id: 'existente' });

    const respuesta = await request(app).post('/api/auth/registro').send({
      nombre: 'Ana',
      correo: 'ana@example.com',
      clave: CLAVE_VALIDA,
      aceptoTerminos: true,
      aceptoTratamiento: true,
    });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('conflicto');
    expect(usuarioCreateMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    usuarioFindUniqueMock.mockReset();
    sesionAuthCreateMock.mockReset();
  });

  it('con credenciales correctas responde el access token y setea la cookie de refresh', async () => {
    usuarioFindUniqueMock.mockResolvedValueOnce(usuarioDeBaseDeDatos());
    sesionAuthCreateMock.mockResolvedValueOnce({ id: 'sesion-1' });

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'ana@example.com', clave: CLAVE_VALIDA });

    expect(respuesta.status).toBe(200);
    expect(typeof respuesta.body.accessToken).toBe('string');
    expect(respuesta.body.usuario.correo).toBe('ana@example.com');
    expect(respuesta.body.usuario.claveHash).toBeUndefined();

    const cookies = respuesta.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookies?.some((cookie) => cookie.startsWith('refresh_token='))).toBe(true);
  });

  it('con contraseña incorrecta responde 401 con mensaje genérico', async () => {
    usuarioFindUniqueMock.mockResolvedValueOnce(usuarioDeBaseDeDatos());

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'ana@example.com', clave: 'otraClave123' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.mensaje).toBe('Correo o contraseña incorrectos');
  });

  it('con correo inexistente responde el mismo mensaje genérico (no revela cuál falló)', async () => {
    usuarioFindUniqueMock.mockResolvedValueOnce(null);

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'no-existe@example.com', clave: CLAVE_VALIDA });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.mensaje).toBe('Correo o contraseña incorrectos');
  });
});

describe('GET /api/auth/yo (ruta protegida)', () => {
  it('responde 401 sin token', async () => {
    const respuesta = await request(app).get('/api/auth/yo');
    expect(respuesta.status).toBe(401);
  });
});
