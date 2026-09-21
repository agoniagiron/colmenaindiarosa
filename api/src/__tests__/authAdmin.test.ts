import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';

const prismaMock = {
  usuarioAdmin: { findUnique: vi.fn(), update: vi.fn() },
  sesionAdmin: { create: vi.fn() },
  auditoriaAdmin: { findMany: vi.fn(), create: vi.fn() },
  usuarioAdminRol: { findMany: vi.fn() },
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { loginAdmin } = await import('../modulos/authAdmin/servicio.js');

const CLAVE_VALIDA = 'Password123';
const HASH_CLAVE_VALIDA = bcrypt.hashSync(CLAVE_VALIDA, 12);

function usuarioAdminDeBaseDeDatos(id = 'admin-1') {
  return {
    id,
    nombre: 'Admin',
    correo: 'admin@example.com',
    claveHash: HASH_CLAVE_VALIDA,
    telefono: null,
    activo: true,
    debeCambiarClave: false,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    creadoPorId: null,
    ultimoAccesoEn: null,
  };
}

describe('loginAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.usuarioAdminRol.findMany.mockResolvedValue([]);
    prismaMock.sesionAdmin.create.mockResolvedValue({ id: 'sesion-1' });
    prismaMock.usuarioAdmin.update.mockResolvedValue({});
    prismaMock.auditoriaAdmin.create.mockResolvedValue({});
  });

  it('con credenciales correctas y sin fallos previos, entra y registra el éxito en auditoria_admin', async () => {
    prismaMock.usuarioAdmin.findUnique.mockResolvedValueOnce(usuarioAdminDeBaseDeDatos('admin-ok'));
    prismaMock.auditoriaAdmin.findMany.mockResolvedValueOnce([]);

    const resultado = await loginAdmin(
      { correo: 'admin@example.com', clave: CLAVE_VALIDA },
      'ip-hash-1',
    );

    expect(typeof resultado.accessToken).toBe('string');
    expect(prismaMock.auditoriaAdmin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accion: 'admin.login.exito',
        usuarioAdminId: 'admin-ok',
        entidad: 'usuario_admin',
        ipHash: 'ip-hash-1',
      }),
    });
  });

  it('con contraseña incorrecta, responde el mensaje genérico y registra el fallo', async () => {
    prismaMock.usuarioAdmin.findUnique.mockResolvedValueOnce(
      usuarioAdminDeBaseDeDatos('admin-mal'),
    );
    prismaMock.auditoriaAdmin.findMany.mockResolvedValueOnce([]);

    await expect(
      loginAdmin({ correo: 'admin@example.com', clave: 'otraClave123' }, 'ip-hash-1'),
    ).rejects.toThrow('Correo o contraseña incorrectos');

    expect(prismaMock.auditoriaAdmin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accion: 'admin.login.fallido', usuarioAdminId: 'admin-mal' }),
    });
    expect(prismaMock.sesionAdmin.create).not.toHaveBeenCalled();
  });

  it('con correo inexistente, responde el mismo mensaje genérico y registra el fallo sin usuarioAdminId', async () => {
    prismaMock.usuarioAdmin.findUnique.mockResolvedValueOnce(null);

    await expect(
      loginAdmin({ correo: 'no-existe@example.com', clave: CLAVE_VALIDA }, 'ip-hash-1'),
    ).rejects.toThrow('Correo o contraseña incorrectos');

    expect(prismaMock.auditoriaAdmin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accion: 'admin.login.fallido', usuarioAdminId: null }),
    });
    // Sin usuario, ni siquiera se consulta el historial de intentos.
    expect(prismaMock.auditoriaAdmin.findMany).not.toHaveBeenCalled();
  });

  it('bloquea tras 5 fallos consecutivos: la contraseña correcta también falla, sin mensaje distinto', async () => {
    prismaMock.usuarioAdmin.findUnique.mockResolvedValueOnce(
      usuarioAdminDeBaseDeDatos('admin-bloqueado'),
    );
    // Los últimos 5 intentos (del más reciente al más viejo) son fallidos.
    prismaMock.auditoriaAdmin.findMany.mockResolvedValueOnce([
      { accion: 'admin.login.fallido' },
      { accion: 'admin.login.fallido' },
      { accion: 'admin.login.fallido' },
      { accion: 'admin.login.fallido' },
      { accion: 'admin.login.fallido' },
    ]);

    await expect(
      loginAdmin({ correo: 'admin@example.com', clave: CLAVE_VALIDA }, 'ip-hash-1'),
    ).rejects.toThrow('Correo o contraseña incorrectos');

    expect(prismaMock.sesionAdmin.create).not.toHaveBeenCalled();
    expect(prismaMock.auditoriaAdmin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accion: 'admin.login.fallido',
        usuarioAdminId: 'admin-bloqueado',
      }),
    });
  });

  it('un éxito reciente corta la racha: fallos antes de ese éxito no cuentan para el bloqueo', async () => {
    prismaMock.usuarioAdmin.findUnique.mockResolvedValueOnce(
      usuarioAdminDeBaseDeDatos('admin-racha-cortada'),
    );
    // Del más reciente al más viejo: 1 fallo, después un éxito (corta la
    // racha), después más fallos que ya no importan.
    prismaMock.auditoriaAdmin.findMany.mockResolvedValueOnce([
      { accion: 'admin.login.fallido' },
      { accion: 'admin.login.exito' },
      { accion: 'admin.login.fallido' },
      { accion: 'admin.login.fallido' },
      { accion: 'admin.login.fallido' },
    ]);

    const resultado = await loginAdmin(
      { correo: 'admin@example.com', clave: CLAVE_VALIDA },
      'ip-hash-1',
    );

    expect(typeof resultado.accessToken).toBe('string');
    expect(prismaMock.sesionAdmin.create).toHaveBeenCalledOnce();
  });
});
