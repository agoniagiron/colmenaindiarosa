import { describe, expect, it, vi } from 'vitest';

// TANDA 3, punto 2: los números de pedido son correlativos (INR-000001,
// INR-000002...) y GET /api/pedidos/:numero recibe el número por URL, no
// algo que dependa de la sesión. Si el servicio no filtrara también por
// usuarioId, cualquier clienta logueada podría leer nombre, dirección y
// teléfono de otra cambiando un dígito. Estas pruebas fijan ese contrato:
// 404 siempre, nunca 403 ni contenido, tanto si el pedido no existe como
// si existe pero es de otra persona — así nunca se confirma por el código
// de estado que el número de pedido existe.
const prismaMock = {
  pedido: { findMany: vi.fn(), findUnique: vi.fn() },
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { obtenerPedidoDelUsuario, obtenerEstadoPedido } = await import('../modulos/pedidos/servicio.js');

function pedidoFalso(usuarioId: string) {
  return {
    numero: 'INR-000042',
    estado: 'pagado',
    subtotal: 100000,
    descuento: 0,
    envio: 15000,
    total: 115000,
    creadoEn: new Date(),
    usuarioId,
    nombreContacto: 'Clienta Dueña',
    telefonoContacto: '3000000000',
    correoContacto: null,
    envioNombre: 'Clienta Dueña',
    envioTelefono: '3000000000',
    envioDepartamento: 'Cundinamarca',
    envioCiudad: 'Bogotá',
    envioDireccion: 'Calle 1 # 2-3',
    envioComplemento: null,
    envioNotas: null,
    cuponCodigo: null,
    monedaMostrada: 'COP',
    tasaUsdUsada: null,
    items: [],
    historial: [],
  };
}

describe('obtenerPedidoDelUsuario', () => {
  it('con un pedido de otra usuaria, rechaza con 404 y no devuelve el contenido', async () => {
    prismaMock.pedido.findUnique.mockResolvedValueOnce(pedidoFalso('usuaria-dueña'));

    await expect(obtenerPedidoDelUsuario('usuaria-atacante', 'INR-000042')).rejects.toMatchObject(
      { estadoHttp: 404, codigo: 'no_encontrado' },
    );
  });

  it('con un número de pedido que no existe, rechaza con el mismo 404', async () => {
    prismaMock.pedido.findUnique.mockResolvedValueOnce(null);

    await expect(obtenerPedidoDelUsuario('usuaria-cualquiera', 'INR-999999')).rejects.toMatchObject(
      { estadoHttp: 404, codigo: 'no_encontrado' },
    );
  });

  it('con el pedido de la propia usuaria, lo devuelve sin el usuarioId', async () => {
    prismaMock.pedido.findUnique.mockResolvedValueOnce(pedidoFalso('usuaria-dueña'));

    const pedido = await obtenerPedidoDelUsuario('usuaria-dueña', 'INR-000042');

    expect(pedido.numero).toBe('INR-000042');
    expect(pedido).not.toHaveProperty('usuarioId');
  });
});

describe('obtenerEstadoPedido', () => {
  it('con un pedido de otra usuaria, rechaza con 404 y no devuelve el estado', async () => {
    prismaMock.pedido.findUnique.mockResolvedValueOnce({
      usuarioId: 'usuaria-dueña',
      numero: 'INR-000042',
      estado: 'pagado',
      total: 115000,
    });

    await expect(obtenerEstadoPedido('usuaria-atacante', 'INR-000042')).rejects.toMatchObject({
      estadoHttp: 404,
      codigo: 'no_encontrado',
    });
  });

  it('con un número de pedido que no existe, rechaza con el mismo 404', async () => {
    prismaMock.pedido.findUnique.mockResolvedValueOnce(null);

    await expect(obtenerEstadoPedido('usuaria-cualquiera', 'INR-999999')).rejects.toMatchObject({
      estadoHttp: 404,
      codigo: 'no_encontrado',
    });
  });
});
