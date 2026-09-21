import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mismos valores reales que trae la tabla configuracion (ver
// lib/configuracion.ts): iniciarCheckout ahora pasa por ahí para armar
// ConfigTotales y para la tasa de USD.
const FILAS_CONFIGURACION = [
  { clave: 'envio.costo', valor: '15000', tipo: 'entero', grupo: 'envio', etiqueta: '' },
  { clave: 'descuento.umbral', valor: '400000', tipo: 'entero', grupo: 'descuento', etiqueta: '' },
  { clave: 'descuento.porcentaje', valor: '10', tipo: 'entero', grupo: 'descuento', etiqueta: '' },
  { clave: 'descuento.activo', valor: 'true', tipo: 'booleano', grupo: 'descuento', etiqueta: '' },
  { clave: 'moneda.tasa_usd', valor: '4100', tipo: 'entero', grupo: 'moneda', etiqueta: '' },
];

const prismaMock = {
  carrito: { findFirst: vi.fn() },
  pedido: { count: vi.fn(), create: vi.fn() },
  pedidoItem: { create: vi.fn() },
  pedidoItemComboDetalle: { create: vi.fn() },
  reservaStock: { create: vi.fn() },
  varianteProducto: { update: vi.fn() },
  pago: { count: vi.fn(), create: vi.fn() },
  configuracion: { findMany: vi.fn().mockResolvedValue(FILAS_CONFIGURACION) },
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === 'function') return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { iniciarCheckout } = await import('../modulos/pedidos/servicio.js');
const { aPesosACentavos } = await import('../lib/wompi/montos.js');

function varianteFalsa(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'var-1',
    sku: 'SKU-1',
    precioActual: 100000,
    stockActual: 10,
    stockReservado: 0,
    activa: true,
    productoId: 'prod-1',
    producto: { nombre: 'Producto Uno' },
    valoresAtributo: [],
    ...overrides,
  };
}

function carritoFalso(cantidad: number, overridesVariante: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'carrito-1',
    cuponId: null,
    cupon: null,
    items: [{ id: 'item-1', cantidad, varianteProducto: varianteFalsa(overridesVariante) }],
  };
}

const datosCheckout = {
  nombreContacto: 'Ana',
  telefonoContacto: '3001234567',
  envioNombre: 'Ana',
  envioTelefono: '3001234567',
  envioDepartamento: 'Antioquia',
  envioCiudad: 'Medellín',
  envioDireccion: 'Calle 1 # 2-3',
  metodoPago: 'tarjeta' as const,
  monedaMostrada: 'COP' as const,
};

describe('POST /api/checkout/iniciar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  it('checkout correcto: crea pedido, reserva stock y devuelve los datos firmados de Wompi', async () => {
    prismaMock.carrito.findFirst.mockResolvedValueOnce(carritoFalso(2));
    prismaMock.pedido.count.mockResolvedValueOnce(0);
    prismaMock.pedido.create.mockResolvedValueOnce({ id: 'pedido-1', numero: 'INR-000001' });
    prismaMock.pedidoItem.create.mockResolvedValueOnce({});
    prismaMock.reservaStock.create.mockResolvedValueOnce({});
    prismaMock.varianteProducto.update.mockResolvedValueOnce({});
    prismaMock.pago.count.mockResolvedValueOnce(0);
    prismaMock.pago.create.mockResolvedValueOnce({});

    const resultado = await iniciarCheckout('usuario-1', datosCheckout);

    expect(resultado.numeroPedido).toBe('INR-000001');
    expect(resultado.referencia).toBe('INR-000001-1');
    // subtotal 100000*2=200000, sin cupón, sin llegar al umbral: +15000 de envío.
    expect(resultado.montoEnCentavos).toBe(aPesosACentavos(215000));
    expect(resultado.moneda).toBe('COP');
    expect(typeof resultado.firma).toBe('string');
    expect(resultado.firma).toHaveLength(64); // hex de SHA-256
    expect(resultado.urlRedireccion).toContain('numero=INR-000001');

    // Reserva 30 minutos y aumenta stock_reservado, nunca toca stock_actual.
    expect(prismaMock.reservaStock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ varianteId: 'var-1', cantidad: 2 }),
      }),
    );
    expect(prismaMock.varianteProducto.update).toHaveBeenCalledWith({
      where: { id: 'var-1' },
      data: { stockReservado: { increment: 2 } },
    });
  });

  it('rechaza con 409 y el detalle de la línea cuando falta disponibilidad', async () => {
    // Piden 5, solo hay 3 disponibles (stock 3, nada reservado).
    prismaMock.carrito.findFirst.mockResolvedValueOnce(
      carritoFalso(5, { stockActual: 3, stockReservado: 0 }),
    );

    await expect(iniciarCheckout('usuario-1', datosCheckout)).rejects.toMatchObject({
      estadoHttp: 409,
      codigo: 'sin_disponibilidad',
      detalles: {
        lineas: [expect.objectContaining({ varianteId: 'var-1', disponible: 3 })],
      },
    });

    expect(prismaMock.pedido.create).not.toHaveBeenCalled();
  });
});
