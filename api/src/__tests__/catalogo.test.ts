import { beforeEach, describe, expect, it, vi } from 'vitest';

const findManyMock = vi.fn();
const busquedaRegistroCreateMock = vi.fn();

// Config mínima para que obtenerTasaUsdVigente (lib/moneda.js) resuelva;
// listarProductos ahora también pega contra promocion y configuracion.
const FILAS_CONFIGURACION = [
  { clave: 'moneda.tasa_usd', valor: '4100', tipo: 'entero', grupo: 'moneda', etiqueta: '' },
];

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    producto: { findMany: findManyMock, findFirst: vi.fn() },
    categoria: { findMany: vi.fn() },
    atributo: { findMany: vi.fn() },
    promocion: { findMany: vi.fn().mockResolvedValue([]) },
    configuracion: { findMany: vi.fn().mockResolvedValue(FILAS_CONFIGURACION) },
    busquedaRegistro: { create: busquedaRegistroCreateMock },
    eventoAnalitica: { create: vi.fn() },
  },
}));

const { listarProductos } = await import('../modulos/catalogo/servicio.js');
const { esquemaQueryProductos } = await import('../modulos/catalogo/esquemas.js');

function productoDetalleVacio(id: string, extra: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    nombre: `Producto ${id}`,
    slug: `producto-${id}`,
    descripcion: '',
    categoriaId: 'cat-1',
    imagenes: [],
    variantes: [],
    resumen: null,
    destacados: [],
    ...extra,
  };
}

describe('catálogo: filtros y paginación', () => {
  beforeEach(() => {
    findManyMock.mockReset();
    busquedaRegistroCreateMock.mockReset();
  });

  it('combina atributos distintos con AND y valores del mismo atributo con OR, exigiendo la misma variante', async () => {
    findManyMock.mockResolvedValueOnce([]); // única consulta: detalle completo ya filtrado

    const query = esquemaQueryProductos.parse({
      color: ['rojo', 'negro'],
      talla: ['M'],
      precioMin: '50000',
    });

    await listarProductos(query, undefined);

    const wherePrimeraLlamada = findManyMock.mock.calls[0]![0].where;
    const condicionesVariante = wherePrimeraLlamada.variantes.some.AND;

    // Cada atributo distinto aporta su propia condición (AND entre ellas),
    // todas dentro del mismo `variantes.some`: deben cumplirse en la misma
    // variante. El precio no va acá: se filtra por el precio mostrado.
    expect(condicionesVariante).toHaveLength(2);

    const condicionColor = condicionesVariante.find(
      (c: { valoresAtributo?: { some: { valorAtributo: { atributo: { slug: string } } } } }) =>
        c.valoresAtributo?.some.valorAtributo.atributo.slug === 'color',
    );
    expect(condicionColor.valoresAtributo.some.valorAtributo.valor).toEqual({
      in: ['rojo', 'negro'],
    });

    const condicionTalla = condicionesVariante.find(
      (c: { valoresAtributo?: { some: { valorAtributo: { atributo: { slug: string } } } } }) =>
        c.valoresAtributo?.some.valorAtributo.atributo.slug === 'talla',
    );
    expect(condicionTalla.valoresAtributo.some.valorAtributo.valor).toEqual({ in: ['M'] });

    expect(
      condicionesVariante.some((c: { precioActual?: unknown }) => c.precioActual !== undefined),
    ).toBe(false);

    expect(wherePrimeraLlamada.variantes.some.activa).toBe(true);
    expect(wherePrimeraLlamada.estado).toBe('publicado');
  });

  it('pagina correctamente sobre los resultados ya ordenados', async () => {
    // Una sola consulta ahora: ya trae el detalle completo de todo lo que
    // matchea el filtro. Ordenar/paginar pasa a ser trabajo en memoria.
    const productos = Array.from({ length: 5 }, (_, i) =>
      productoDetalleVacio(`p${i + 1}`, {
        creadoEn: new Date(2024, 0, i + 1), // p1 es el más viejo, p5 el más nuevo
        variantes: [
          {
            id: `v${i + 1}`,
            sku: `SKU-${i + 1}`,
            precioActual: 10000,
            precioAntes: null,
            precioUsd: null,
            stockActual: 5,
            stockReservado: 0,
            valoresAtributo: [],
          },
        ],
      }),
    );

    findManyMock.mockResolvedValueOnce(productos);

    const query = esquemaQueryProductos.parse({ orden: 'recientes', pagina: '2', porPagina: '2' });
    const resultado = await listarProductos(query, undefined);

    expect(resultado.paginacion).toEqual({ pagina: 2, porPagina: 2, total: 5, totalPaginas: 3 });
    // Orden "recientes" = creadoEn desc: p5, p4, p3, p2, p1. Página 2 (2 por página) = p3, p2.
    expect(resultado.datos.map((p) => p.id)).toEqual(['p3', 'p2']);
  });

  it('devuelve cero resultados sin romper y registra la búsqueda con resultados: 0', async () => {
    findManyMock.mockResolvedValueOnce([]); // sin candidatos

    const query = esquemaQueryProductos.parse({ busqueda: 'algo-que-no-existe' });
    const resultado = await listarProductos(query, undefined);

    expect(resultado.datos).toEqual([]);
    expect(resultado.paginacion.total).toBe(0);
    expect(resultado.paginacion.totalPaginas).toBe(0);

    expect(busquedaRegistroCreateMock).toHaveBeenCalledWith({
      data: { termino: 'algo-que-no-existe', resultados: 0, sesionId: null },
    });
  });

  // producto_destacado también guarda seccion:'portada' (carrusel del
  // héroe, ver modulos/portada/), aparte de seccion:'inicio' (el
  // "Destacado" de catálogo que se prueba acá). Un mock no puede probar
  // que Postgres de verdad filtra por seccion, pero sí puede probar que
  // la consulta que armamos para pedírselo está acotada — que es
  // justamente lo que se rompería si alguien borra ese filtro sin querer.
  it('el filtro ?destacado y el booleano Producto.destacado solo miran seccion:"inicio", nunca "portada"', async () => {
    findManyMock.mockResolvedValueOnce([]);

    const query = esquemaQueryProductos.parse({ destacado: 'true' });
    await listarProductos(query, undefined);

    const llamada = findManyMock.mock.calls[0]![0];
    expect(llamada.where.destacados.some.seccion).toBe('inicio');
    expect(llamada.select.destacados.where.seccion).toBe('inicio');
  });

  describe('precio de la tarjeta, orden y filtro: la variante principal manda', () => {
    function variante(id: string, precioActual: number, stock = 5) {
      return {
        id,
        sku: `SKU-${id}`,
        precioActual,
        precioAntes: null,
        precioUsd: null,
        stockActual: stock,
        stockReservado: 0,
        imagenes: [],
        valoresAtributo: [],
      };
    }

    // La peluca del reporte: 26" a 990.000 y 28" a 1.050.000.
    function peluca(id: string, principal: string | null, extra: Record<string, unknown> = {}) {
      return productoDetalleVacio(id, {
        creadoEn: new Date(2024, 0, 1),
        variantePrincipalId: principal,
        variantes: [variante(`${id}-28`, 1050000), variante(`${id}-26`, 990000)],
        ...extra,
      });
    }

    it('la tarjeta muestra la principal y abre en ella; "desde" solo si es la más barata', async () => {
      findManyMock.mockResolvedValueOnce([peluca('barata', 'barata-26'), peluca('cara', 'cara-28')]);

      const { datos } = await listarProductos(esquemaQueryProductos.parse({}), undefined);
      const porId = new Map(datos.map((p) => [p.id, p]));

      expect(porId.get('barata')).toMatchObject({
        precioBase: { cop: 990000 },
        desde: true,
        varianteMostradaId: 'barata-26',
      });
      expect(porId.get('cara')).toMatchObject({
        precioBase: { cop: 1050000 },
        desde: false,
        varianteMostradaId: 'cara-28',
      });
    });

    it('si la principal está agotada, la tarjeta usa la más barata con stock', async () => {
      const producto = peluca('p', 'p-26');
      producto.variantes = [variante('p-26', 990000, 0), variante('p-28', 1050000)];
      findManyMock.mockResolvedValueOnce([producto]);

      const { datos } = await listarProductos(esquemaQueryProductos.parse({}), undefined);
      expect(datos[0]).toMatchObject({ precioBase: { cop: 1050000 }, varianteMostradaId: 'p-28' });
    });

    it('el orden y el filtro por precio usan el precio de la tarjeta, no el mínimo de cualquier variante', async () => {
      // "cara" tiene una variante de 990.000, pero su tarjeta muestra 1.050.000.
      findManyMock.mockResolvedValue([peluca('barata', 'barata-26'), peluca('cara', 'cara-28')]);

      const ordenado = await listarProductos(
        esquemaQueryProductos.parse({ orden: 'precio_desc' }),
        undefined,
      );
      expect(ordenado.datos.map((p) => p.id)).toEqual(['cara', 'barata']);

      const filtrado = await listarProductos(
        esquemaQueryProductos.parse({ precioMax: '1000000' }),
        undefined,
      );
      expect(filtrado.datos.map((p) => p.id)).toEqual(['barata']);
      expect(filtrado.paginacion.total).toBe(1);
    });
  });
});
