import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { firmarAccessToken } from '../lib/jwt.js';
import { firmarAccessTokenAdmin } from '../lib/jwtAdmin.js';
import { requiereAuth } from '../middleware/requiereAuth.js';

function requestFalso(encabezados: Record<string, string> = {}): Request {
  return { headers: encabezados } as unknown as Request;
}

describe('requiereAuth', () => {
  it('rechaza sin encabezado Authorization', () => {
    const next = vi.fn();
    expect(() => requiereAuth(requestFalso(), {} as Response, next)).toThrow(/no autenticado/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza con un token inválido', () => {
    const req = requestFalso({ authorization: 'Bearer token-invalido' });
    const next = vi.fn();
    expect(() => requiereAuth(req, {} as Response, next)).toThrow(/inválido/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar y expone req.usuario con un token válido', () => {
    const token = firmarAccessToken('usuario-1');
    const req = requestFalso({ authorization: `Bearer ${token}` });
    const next = vi.fn();

    requiereAuth(req, {} as Response, next);

    expect(req.usuario).toEqual({ id: 'usuario-1' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('rechaza un token firmado con JWT_SECRET_ADMIN (el de admin), no con JWT_SECRET', () => {
    const tokenDeAdmin = firmarAccessTokenAdmin('admin-1');
    const req = requestFalso({ authorization: `Bearer ${tokenDeAdmin}` });
    const next = vi.fn();

    expect(() => requiereAuth(req, {} as Response, next)).toThrow(/inválido/i);
    expect(next).not.toHaveBeenCalled();
  });
});
