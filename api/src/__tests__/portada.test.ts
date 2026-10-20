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

function variante(
  colores: { valor: string; hex?: string; orden: number }[],
  agotada = false,
  precioActual = 500000,
) {
  contadorVariantes += 1;
  return {
    id: `var-${contadorVariantes}`,
    precioActual,
    stockActual: agotada ? 3 : 5,
    stockReservado: agotada ? 3 : 1,
    valoresAtributo: colores.map((c) => ({
      valorId: `valor-${c.valor}`,
      valorAtributo: {
        valor: c.valor,
        hex: c.hex ?? null,
        orden: c.orden,
        atributo: { slug: 'color' },
      },
    })),
  };
}

function filaDestacada(id: string, variantes: ReturnType<typeof variante>[], extra = {}) {
  return {
    producto: {
      id,
      nombre: `Producto ${id}`,
      slug: `producto-${id}`,
      categoriaId: 'cat-pelucas',
      variantePrincipalId: null,
      imagenes: [
        {
          url: `https://ejemplo.com/${id}.jpg`,
          altTexto: `Foto ${id}`,
          valorAtributoId: null,
          orden: 0,
        },
      ],
      variantes,
      ...extra,
    },
  };
}

describe('portada: carrusel del héroe', () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it('pide producto_destacado con seccion:"portada", solo productos publicados, ordenado por orden', async () => {
    findManyMock.mockResolvedValueOnce([]);

    await obtenerHeroePortada();

    const llamada = findManyMock.mock.calls[0]![0];
    expect(llamada.where).toEqual({ seccion: 'portada', producto: { estado: 'publicado' } });
    expect(llamada.orderBy).toEqual({ orden: 'asc' });
  });

  it('excluye una peluca cuyas variantes activas están todas agotadas (stock - reservado <= 0)', async () => {
    findManyMock.mockResolvedValueOnce([
      filaDestacada('agotada', [variante([{ valor: 'Negro', orden: 0 }], true)]),
      filaDestacada('disponible', [variante([{ valor: 'Rubio', orden: 1 }])]),
    ]);

    const heroe = await obtenerHeroePortada();

    expect(heroe.destacadas.map((d) => d.id)).toEqual(['disponible']);
    // El color de la agotada tampoco debe colarse en la hilera de tonos.
    expect(heroe.colores.map((c) => c.nombre)).toEqual(['Rubio']);
  });

  it('arma la unión de colores deduplicada y ordenada por el orden del valor de atributo', async () => {
    findManyMock.mockResolvedValueOnce([
      filaDestacada('p1', [
        variante([
          { valor: 'Negro', hex: '#111', orden: 2 },
          { valor: 'Rubio', hex: '#eee', orden: 0 },
        ]),
      ]),
      filaDestacada('p2', [variante([{ valor: 'Rubio', hex: '#eee', orden: 0 }])]),
      filaDestacada('p3', [variante([{ valor: 'Castaño', hex: '#842', orden: 1 }])]),
    ]);

    const heroe = await obtenerHeroePortada();

    // "Rubio" (orden 0) aparece en p1 y p2 pero una sola vez en la unión.
    expect(heroe.colores).toEqual([
      { nombre: 'Rubio', hex: '#eee' },
      { nombre: 'Castaño', hex: '#842' },
      { nombre: 'Negro', hex: '#111' },
    ]);
    expect(heroe.destacadas.find((d) => d.id === 'p1')!.colores).toEqual([
      { nombre: 'Rubio', hex: '#eee' },
      { nombre: 'Negro', hex: '#111' },
    ]);
  });

  it('usa null en imagenPrincipal cuando el producto no tiene foto', async () => {
    findManyMock.mockResolvedValueOnce([
      filaDestacada('sin-foto', [variante([{ valor: 'Negro', orden: 0 }])], { imagenes: [] }),
    ]);

    const heroe = await obtenerHeroePortada();

    expect(heroe.destacadas[0]!.imagenPrincipal).toBeNull();
  });

  it('la foto sale del color de la variante principal, no de la primera foto del producto', async () => {
    const rubio = variante([{ valor: 'Rubio', orden: 0 }]);
    const rosa = variante([{ valor: 'Rosa', orden: 1 }]);
    findManyMock.mockResolvedValueOnce([
      filaDestacada('hannah', [rubio, rosa], {
        variantePrincipalId: rosa.id,
        imagenes: [
          {
            url: 'https://ejemplo.com/rubio.jpg',
            altTexto: 'Rubio',
            valorAtributoId: 'valor-Rubio',
            orden: 0,
          },
          {
            url: 'https://ejemplo.com/rosa.jpg',
            altTexto: 'Rosa',
            valorAtributoId: 'valor-Rosa',
            orden: 1,
          },
        ],
      }),
    ]);

    const heroe = await obtenerHeroePortada();

    expect(heroe.destacadas[0]!.imagenPrincipal).toEqual({
      url: 'https://ejemplo.com/rosa.jpg',
      altTexto: 'Rosa',
    });
  });
});
