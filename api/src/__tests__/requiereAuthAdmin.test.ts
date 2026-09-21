import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const prismaMock = {
  usuarioAdmin: { findUnique: vi.fn() },
  usuarioAdminRol: { findMany: vi.fn() },
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { firmarAccessTokenAdmin } = await import('../lib/jwtAdmin.js');
const { firmarAccessToken } = await import('../lib/jwt.js');
const { requiereAuthAdmin, requierePermiso } = await import('../middleware/requiereAuthAdmin.js');

function requestFalso(encabezados: Record<string, string> = {}): Request {
  return { headers: encabezados } as unknown as Request;
}

// asignaciones tal como las devuelve el include usuarioAdminRol -> rol ->
// permisos -> permiso: dos roles, con permisos que se solapan a propósito
// para probar que el set final está deduplicado.
function asignaciones(...clavesPorRol: string[][]) {
  return clavesPorRol.map((claves) => ({
    rol: { permisos: claves.map((clave) => ({ permiso: { clave } })) },
  }));
}

describe('requiereAuthAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza sin encabezado Authorization', async () => {
    const next = vi.fn();
    await expect(requiereAuthAdmin(requestFalso(), {} as Response, next)).rejects.toThrow(
      /no autenticado/i,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza un token firmado con JWT_SECRET (el de cliente), no con JWT_SECRET_ADMIN', async () => {
    const tokenDeCliente = firmarAccessToken('usuario-1');
    const req = requestFalso({ authorization: `Bearer ${tokenDeCliente}` });
    const next = vi.fn();

    await expect(requiereAuthAdmin(req, {} as Response, next)).rejects.toThrow(/inválido/i);
    expect(next).not.toHaveBeenCalled();
    expect(prismaMock.usuarioAdmin.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza si el usuario_admin no existe o está inactivo', async () => {
    prismaMock.usuarioAdmin.findUnique.mockResolvedValueOnce(null);
    const token = firmarAccessTokenAdmin('admin-1');
    const req = requestFalso({ authorization: `Bearer ${token}` });
    const next = vi.fn();

    await expect(requiereAuthAdmin(req, {} as Response, next)).rejects.toThrow(/no autenticado/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar y expone req.usuarioAdmin con los permisos efectivos (deduplicados)', async () => {
    prismaMock.usuarioAdmin.findUnique.mockResolvedValueOnce({ id: 'admin-1', activo: true });
    prismaMock.usuarioAdminRol.findMany.mockResolvedValueOnce(
      asignaciones(['pedidos.ver', 'pedidos.cambiar_estado'], ['pedidos.ver', 'inventario.ver']),
    );
    const token = firmarAccessTokenAdmin('admin-1');
    const req = requestFalso({ authorization: `Bearer ${token}` });
    const next = vi.fn();

    await requiereAuthAdmin(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.usuarioAdmin?.id).toBe('admin-1');
    expect([...req.usuarioAdmin!.permisos].sort()).toEqual([
      'inventario.ver',
      'pedidos.cambiar_estado',
      'pedidos.ver',
    ]);
  });
});

describe('requierePermiso', () => {
  it('responde con 403 si el permiso no está en el set efectivo', () => {
    const req = { usuarioAdmin: { id: 'admin-1', permisos: new Set(['pedidos.ver']) } } as Request;
    const next = vi.fn();

    expect(() => requierePermiso('pedidos.cambiar_estado')(req, {} as Response, next)).toThrow(
      /permiso/i,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar si el permiso está en el set efectivo', () => {
    const req = { usuarioAdmin: { id: 'admin-1', permisos: new Set(['pedidos.ver']) } } as Request;
    const next = vi.fn();

    requierePermiso('pedidos.ver')(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('rechaza si no hay req.usuarioAdmin (requiereAuthAdmin no se montó antes)', () => {
    const req = {} as Request;
    const next = vi.fn();

    expect(() => requierePermiso('pedidos.ver')(req, {} as Response, next)).toThrow(
      /no autenticado/i,
    );
    expect(next).not.toHaveBeenCalled();
  });
});
