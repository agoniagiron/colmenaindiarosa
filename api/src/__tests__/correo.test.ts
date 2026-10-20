import { afterEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  usuario: { findUnique: vi.fn() },
  tokenUsuario: { create: vi.fn() },
};
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const enviarMock = vi.fn();
vi.mock('../lib/correo.js', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../lib/correo.js')>();
  return { ...original, servicioCorreo: { enviar: enviarMock } };
});

const { ServicioCorreoResend, ErrorEnvioCorreo } = await import('../lib/correo.js');
const { solicitarRecuperacion, solicitarVerificacionCorreo } =
  await import('../modulos/auth/servicio.js');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function respuestaJson(estado: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status: estado });
}

describe('ServicioCorreoResend', () => {
  const servicio = new ServicioCorreoResend(
    're_clave',
    'India Rosa <pedidos@ejemplo.com>',
    'hola@ejemplo.com',
  );

  it('manda el correo a Resend con remitente, reply_to, texto, html y la clave de idempotencia', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, { id: 'email-1' }));
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await servicio.enviar({
      para: 'ana@example.com',
      asunto: 'Asunto',
      texto: 'Texto',
      html: '<p>Texto</p>',
      claveIdempotencia: 'clave-1',
    });

    expect(resultado).toEqual({ idExterno: 'email-1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer re_clave',
      'Idempotency-Key': 'clave-1',
    });
    expect(JSON.parse(init.body)).toEqual({
      from: 'India Rosa <pedidos@ejemplo.com>',
      to: ['ana@example.com'],
      reply_to: 'hola@ejemplo.com',
      subject: 'Asunto',
      text: 'Texto',
      html: '<p>Texto</p>',
    });
  });

  it('una respuesta de error de Resend lanza ErrorEnvioCorreo con el estado y el motivo', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          respuestaJson(422, { name: 'validation_error', message: 'Invalid `to` field' }),
        ),
    );
    const error = await servicio
      .enviar({ para: 'x', asunto: 'a', texto: 't' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorEnvioCorreo);
    expect(error).toMatchObject({ estadoHttp: 422 });
    expect((error as Error).message).toMatch(/422.*validation_error.*Invalid/);
  });

  it('sin respuesta (red caída o tiempo agotado) también lanza ErrorEnvioCorreo', async () => {
    const tiempo = new Error('The operation was aborted due to timeout');
    tiempo.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(tiempo));
    await expect(servicio.enviar({ para: 'x', asunto: 'a', texto: 't' })).rejects.toThrow(
      /no respondió/,
    );
  });
});

describe('correos de cuenta', () => {
  it('recuperación: el correo trae el enlace con el código', async () => {
    prismaMock.usuario.findUnique.mockResolvedValueOnce({ id: 'u-1', correo: 'ana@example.com' });
    prismaMock.tokenUsuario.create.mockResolvedValueOnce({});
    enviarMock.mockResolvedValueOnce({ idExterno: 'email-1' });

    await solicitarRecuperacion('ana@example.com');

    const correo = enviarMock.mock.calls[0]![0];
    expect(correo.para).toBe('ana@example.com');
    expect(correo.texto).toMatch(/\/cuenta\/recuperar\?token=[^\s]+/);
  });

  it('recuperación: si Resend falla no se le avisa a la clienta (no revela que la cuenta existe)', async () => {
    prismaMock.usuario.findUnique.mockResolvedValueOnce({ id: 'u-1', correo: 'ana@example.com' });
    prismaMock.tokenUsuario.create.mockResolvedValueOnce({});
    enviarMock.mockRejectedValueOnce(new ErrorEnvioCorreo('Resend respondió 500', 500));
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(solicitarRecuperacion('ana@example.com')).resolves.toBeUndefined();
    expect(consola).toHaveBeenCalled();
  });

  it('verificación: si Resend falla, la clienta (con sesión) recibe un error claro', async () => {
    prismaMock.usuario.findUnique.mockResolvedValueOnce({
      correo: 'ana@example.com',
      correoVerificado: false,
    });
    prismaMock.tokenUsuario.create.mockResolvedValueOnce({});
    enviarMock.mockRejectedValueOnce(new ErrorEnvioCorreo('Resend respondió 500', 500));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(solicitarVerificacionCorreo('u-1')).rejects.toMatchObject({
      estadoHttp: 500,
      codigo: 'correo_no_enviado',
    });
  });
});
