import { beforeEach, describe, expect, it, vi } from 'vitest';

const findManyMock = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    productoDestacado: { findMany: findManyMock },
    promocion: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const { obtenerHeroePortada } = await import('../modulos/portada/servicio.js');

let contadorVariantes = 0;

// Una variante con un color. Prisma ya filtra los valores a los de color
// (ver el select del servicio), así que el mock trae solo ese.
function variante(
  color: { valor: string; hex?: string; hexSecundario?: string; orden: number },
  { agotada = false, precioActual = 500000 } = {},
) {
  contadorVariantes += 1;
  return {
    id: `var-${contadorVariantes}`,
    sku: `SKU-${contadorVariantes}`,
    precioActual,
    stockActual: agotada ? 3 : 5,
    stockReservado: agotada ? 3 : 1,
    valoresAtributo: [
      {
        valorId: `valor-${color.valor}`,
        valorAtributo: {
          valor: color.valor,
          hex: color.hex ?? null,
          hexSecundario: color.hexSecundario ?? null,
          orden: color.orden,
        },
      },
    ],
  };
}

const foto = (id: string, valor: string | null, orden = 0) => ({
  id: `img-${id}-${valor}-${orden}`,
  url: `https://ejemplo.com/${id}-${valor ?? 'generica'}-${orden}.jpg`,
  altTexto: `${id} ${valor ?? 'genérica'}`,
  valorAtributoId: valor ? `valor-${valor}` : null,
  orden,
});

function filaDestacada(
  id: string,
  variantes: ReturnType<typeof variante>[],
  imagenes: ReturnType<typeof foto>[],
  extra = {},
) {
  return {
    producto: {
      id,
      nombre: `Producto ${id}`,
      slug: `producto-${id}`,
      categoriaId: 'cat-pelucas',
      variantePrincipalId: null,
      imagenes,
      variantes,
      ...extra,
    },
  };
}

const ROSA = { valor: 'Rosa', hex: '#e8a0b4', orden: 1 };
const RUBIO = { valor: 'Rubio', hex: '#eee', orden: 0 };
const NEGRO = { valor: 'Negro', hex: '#111', orden: 2 };

describe('portada: carrusel del héroe por tono', () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it('pide producto_destacado con seccion:"portada", solo publicados, ordenado por orden', async () => {
    findManyMock.mockResolvedValueOnce([]);

    const heroe = await obtenerHeroePortada();

    const llamada = findManyMock.mock.calls[0]![0];
    expect(llamada.where).toEqual({ seccion: 'portada', producto: { estado: 'publicado' } });
    expect(llamada.orderBy).toEqual({ orden: 'asc' });
    expect(heroe).toEqual({ tonos: [] });
  });

  it('bajo cada tono, la foto de ese color: HANNAH en Rosa muestra la rosa y en Rubio la rubia', async () => {
    const rubio = variante(RUBIO);
    const rosa = variante(ROSA);
    findManyMock.mockResolvedValueOnce([
      filaDestacada(
        'hannah',
        [rubio, rosa],
        [foto('hannah', 'Rubio', 0), foto('hannah', 'Rosa', 1), foto('hannah', 'Rosa', 2)],
        // La principal es la rosa: no puede decidir la foto del rubio.
        { variantePrincipalId: rosa.id },
      ),
    ]);

    const { tonos } = await obtenerHeroePortada();

    expect(tonos.map((t) => t.nombre)).toEqual(['Rubio', 'Rosa']);
    expect(tonos[0]!.productos).toEqual([
      {
        id: 'hannah',
        slug: 'producto-hannah',
        nombre: 'Producto hannah',
        sku: rubio.sku,
        imagen: { url: 'https://ejemplo.com/hannah-Rubio-0.jpg', altTexto: 'hannah Rubio' },
      },
    ]);
    // La primera foto del color por orden.
    expect(tonos[1]!.productos[0]!.imagen.url).toBe('https://ejemplo.com/hannah-Rosa-1.jpg');
    expect(tonos[1]!.productos[0]!.sku).toBe(rosa.sku);
  });

  it('un producto sin foto en un tono no aparece bajo ese tono: ni genérica ni de otro color', async () => {
    findManyMock.mockResolvedValueOnce([
      // Tiene variante negra pero solo fotos rosa y genérica.
      filaDestacada(
        'p1',
        [variante(ROSA), variante(NEGRO)],
        [foto('p1', null), foto('p1', 'Rosa')],
      ),
      filaDestacada('p2', [variante(NEGRO)], [foto('p2', 'Negro')]),
    ]);

    const { tonos } = await obtenerHeroePortada();

    const negro = tonos.find((t) => t.nombre === 'Negro')!;
    expect(negro.productos.map((p) => p.id)).toEqual(['p2']);
    for (const tono of tonos) {
      for (const p of tono.productos) {
        expect(p.imagen.url).toContain(`-${tono.nombre}-`);
      }
    }
  });

  it('un tono sin ningún producto con foto propia no sale; sin fotos por color no hay tonos', async () => {
    findManyMock.mockResolvedValueOnce([
      filaDestacada('p1', [variante(ROSA), variante(RUBIO)], [foto('p1', null)]),
    ]);

    expect(await obtenerHeroePortada()).toEqual({ tonos: [] });
  });

  it('un color agotado en ese producto no lo muestra bajo ese tono, aunque tenga foto', async () => {
    findManyMock.mockResolvedValueOnce([
      filaDestacada(
        'p1',
        [variante(ROSA, { agotada: true }), variante(RUBIO)],
        [foto('p1', 'Rosa'), foto('p1', 'Rubio')],
      ),
    ]);

    const { tonos } = await obtenerHeroePortada();

    expect(tonos.map((t) => t.nombre)).toEqual(['Rubio']);
  });

  it('el sku es la variante de ese color que mostraría la tarjeta: la más barata con stock', async () => {
    const cara = variante(ROSA, { precioActual: 900000 });
    const barata = variante(ROSA, { precioActual: 400000 });
    const barataAgotada = variante(ROSA, { precioActual: 100000, agotada: true });
    findManyMock.mockResolvedValueOnce([
      filaDestacada('p1', [cara, barata, barataAgotada], [foto('p1', 'Rosa')]),
    ]);

    const { tonos } = await obtenerHeroePortada();

    expect(tonos[0]!.productos[0]!.sku).toBe(barata.sku);
  });

  it('los productos de un tono siguen el orden de portada y el color combinado trae sus dos tonos', async () => {
    const combinado = { valor: 'Ombré', hex: '#222', hexSecundario: '#ddd', orden: 3 };
    findManyMock.mockResolvedValueOnce([
      filaDestacada('primero', [variante(combinado)], [foto('primero', 'Ombré')]),
      filaDestacada('segundo', [variante(combinado)], [foto('segundo', 'Ombré')]),
    ]);

    const { tonos } = await obtenerHeroePortada();

    expect(tonos).toHaveLength(1);
    expect(tonos[0]).toMatchObject({ nombre: 'Ombré', hex: '#222', hexSecundario: '#ddd' });
    expect(tonos[0]!.productos.map((p) => p.id)).toEqual(['primero', 'segundo']);
  });
});
