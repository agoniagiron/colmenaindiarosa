import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const queryRawMock = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: { $queryRaw: queryRawMock },
}));

const { app } = await import('../app.js');

describe('GET /health', () => {
  beforeEach(() => {
    queryRawMock.mockReset();
  });

  it('responde ok y baseDatos conectada cuando Prisma responde', async () => {
    queryRawMock.mockResolvedValueOnce([{ '?column?': 1 }]);

    const respuesta = await request(app).get('/health');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ ok: true, baseDatos: 'conectada' });
  });

  it('responde 503 y baseDatos error cuando Prisma falla', async () => {
    queryRawMock.mockRejectedValueOnce(new Error('conexión rechazada'));

    const respuesta = await request(app).get('/health');

    expect(respuesta.status).toBe(503);
    expect(respuesta.body).toEqual({ ok: false, baseDatos: 'error' });
  });
});
