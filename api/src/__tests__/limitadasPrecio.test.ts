import { beforeEach, describe, expect, it, vi } from 'vitest';

// La edición limitada no tiene precio propio: muestra el de su producto con
// la misma función que la tarjeta del catálogo (precioDeTarjeta). Estas
// pruebas fijan que una limitada y la tarjeta muestren el mismo número.

const edicionFindManyMock = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    edicionLimitada: { findMany: edicionFindManyMock },
    pedidoItem: { aggregate: vi.fn().mockResolvedValue({ _sum: { cantidad: 0 } }) },
    pedidoItemComboDetalle: { aggregate: vi.fn().mockResolvedValue({ _sum: { cantidad: 0 } }) },
    promocion: { findMany: vi.fn().mockResolvedValue([]) },
    configuracion: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          {
            clave: 'moneda.tasa_usd',
            valor: '4100',
            tipo: 'entero',
            grupo: 'moneda',
            etiqueta: '',
          },
        ]),
    },
  },
}));

const { listarEdicionesLimitadasVigentes } = await import('../modulos/limitadas/servicio.js');

function variante(id: string, precioActual: number, stock = 5) {
  return {
    id,
    precioActual,
    precioUsd: null,
    stockActual: stock,
    stockReservado: 0,
    valoresAtributo: [{ valorId: `valor-${id}` }],
  };
}

// La peluca del reporte: 26" a 990.000 y 28" a 1.050.000.
type Foto = { url: string; altTexto: string; valorAtributoId: string | null; orden: number };

function edicion(principal: string, variantes: ReturnType<typeof variante>[], imagenes: Foto[] = []) {
  return {
    id: 'ed-1',
    nombre: 'Lote de otoño',
    descripcion: null,
    unidadesLote: null,
    mostrarRestantes: true,
    desde: new Date('2026-10-01'),
    hasta: null,
    producto: {
      id: 'p-1',
      nombre: 'Peluca',
      slug: 'peluca',
      categoriaId: 'cat-1',
      variantePrincipalId: principal,
      imagenes,
      variantes,
    },
  };
}

describe('ediciones limitadas: precio de la variante principal', () => {
  beforeEach(() => edicionFindManyMock.mockReset());

  it('muestra la principal aunque haya una más barata, sin "desde"', async () => {
    edicionFindManyMock.mockResolvedValueOnce([
      edicion('v28', [variante('v26', 990000), variante('v28', 1050000)]),
    ]);
    const [limitada] = await listarEdicionesLimitadasVigentes();
    expect(limitada).toMatchObject({ precio: { cop: 1050000 }, precioDesde: false });
  });

  it('con la principal en la más barata, "desde"', async () => {
    edicionFindManyMock.mockResolvedValueOnce([
      edicion('v26', [variante('v26', 990000), variante('v28', 1050000)]),
    ]);
    const [limitada] = await listarEdicionesLimitadasVigentes();
    expect(limitada).toMatchObject({ precio: { cop: 990000 }, precioDesde: true });
  });

  it('si la principal está agotada, la más barata con stock (como la tarjeta)', async () => {
    edicionFindManyMock.mockResolvedValueOnce([
      edicion('v26', [variante('v26', 990000, 0), variante('v28', 1050000)]),
    ]);
    const [limitada] = await listarEdicionesLimitadasVigentes();
    expect(limitada).toMatchObject({ precio: { cop: 1050000 } });
  });

  it('la foto sale de la misma variante que el precio', async () => {
    const foto = (nombre: string, valorAtributoId: string | null, orden: number) => ({
      url: `https://ejemplo.com/${nombre}.webp`,
      altTexto: nombre,
      valorAtributoId,
      orden,
    });
    edicionFindManyMock.mockResolvedValueOnce([
      edicion(
        'v28',
        [variante('v26', 990000), variante('v28', 1050000)],
        [foto('26', 'valor-v26', 0), foto('28', 'valor-v28', 1), foto('gen', null, 2)],
      ),
    ]);
    const [limitada] = await listarEdicionesLimitadasVigentes();
    expect(limitada!.producto.imagen).toEqual({ url: 'https://ejemplo.com/28.webp', altTexto: '28' });
    // La del 28 + la genérica; la del 26 no es de esta variante.
    expect(limitada!.producto.cantidadImagenes).toBe(2);
  });
});
