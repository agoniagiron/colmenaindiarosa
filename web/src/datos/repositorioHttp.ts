// Implementación de Repositorio contra la API real (api/src/modulos/*).
// Las rutas son relativas a /api, con BASE_URL_API (urlApi.ts) adelante:
// - Si VITE_API_URL está definida (producción, donde la API vive en un
//   dominio distinto), las peticiones van directo a ese dominio.
// - Si no está definida (desarrollo), la base queda vacía y las rutas
//   siguen siendo relativas: ahí es donde entra el proxy de /api en
//   vite.config.ts, que las redirige a localhost:3001.

import { BASE_URL_API } from './urlApi.ts';
import type {
  Facetas,
  FiltrosProducto,
  HeroePortada,
  OrdenProducto,
  Pagina,
  Repositorio,
  ResultadoPaginado,
} from './repositorio.ts';
import type {
  Categoria,
  Combo,
  Cupon,
  EdicionLimitada,
  EntradaConfiguracion,
  Producto,
  ValorAtributo,
} from '../tipos/index.ts';

const BASE_URL = `${BASE_URL_API}/api`;

const ORDEN_A_API: Record<OrdenProducto, string> = {
  relevancia: 'relevancia',
  precio_asc: 'precio_asc',
  precio_desc: 'precio_desc',
  calificacion_desc: 'calificacion',
  novedad: 'recientes',
};

class ErrorRepositorioHttp extends Error {
  readonly estadoHttp: number;

  constructor(estadoHttp: number, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorRepositorioHttp';
    this.estadoHttp = estadoHttp;
  }
}

async function solicitarJson<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(`${BASE_URL}${ruta}`);

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: { mensaje?: string };
    } | null;
    throw new ErrorRepositorioHttp(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
    );
  }

  return (await respuesta.json()) as T;
}

// El backend solo admite una categoría por consulta (query param `categoria`
// singular); si hay varias seleccionadas en el filtro multi-select del
// catálogo, se usa la primera.
function construirQuery(
  filtros: FiltrosProducto,
  extra: Record<string, string | number | undefined> = {},
): string {
  const params = new URLSearchParams();

  if (filtros.categoriaSlug?.[0]) params.set('categoria', filtros.categoriaSlug[0]);
  for (const valor of filtros.tipoBase ?? []) params.append('tipo', valor);
  for (const valor of filtros.longitud ?? []) params.append('longitud', valor);
  for (const valor of filtros.color ?? []) params.append('color', valor);
  for (const valor of filtros.talla ?? []) params.append('talla', valor);
  for (const valor of filtros.densidad ?? []) params.append('densidad', valor);
  if (filtros.precioMin !== undefined) params.set('precioMin', String(filtros.precioMin));
  if (filtros.precioMax !== undefined) params.set('precioMax', String(filtros.precioMax));
  if (filtros.destacado !== undefined) params.set('destacado', String(filtros.destacado));
  if (filtros.texto) params.set('busqueda', filtros.texto);

  for (const [clave, valor] of Object.entries(extra)) {
    if (valor !== undefined) params.set(clave, String(valor));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

async function listarCategorias(): Promise<Categoria[]> {
  const categorias =
    await solicitarJson<Array<{ id: string; nombre: string; slug: string }>>('/categorias');
  return categorias.map((categoria) => ({
    id: categoria.id,
    nombre: categoria.nombre,
    slug: categoria.slug,
  }));
}

async function listarProductos(
  filtros: FiltrosProducto = {},
  orden: OrdenProducto = 'relevancia',
  pagina: Pagina = { pagina: 1, porPagina: 12 },
): Promise<ResultadoPaginado<Producto>> {
  const query = construirQuery(filtros, {
    orden: ORDEN_A_API[orden],
    pagina: pagina.pagina,
    porPagina: pagina.porPagina,
  });
  return solicitarJson<ResultadoPaginado<Producto>>(`/productos${query}`);
}

interface ValorFaceta {
  valor: string;
  hex?: string;
  conteo: number;
}

async function listarFacetas(filtros: FiltrosProducto = {}): Promise<Facetas> {
  const query = construirQuery(filtros);
  const facetas = await solicitarJson<{
    tipo: ValorFaceta[];
    longitud: ValorFaceta[];
    color: ValorFaceta[];
    talla: ValorFaceta[];
    densidad: ValorFaceta[];
  }>(`/productos/facetas${query}`);

  return {
    tiposBase: facetas.tipo.map((valor) => valor.valor),
    longitudes: facetas.longitud.map((valor) => valor.valor),
    tallas: facetas.talla.map((valor) => valor.valor),
    densidades: facetas.densidad.map((valor) => valor.valor),
    colores: facetas.color.map((valor) => ({
      nombre: valor.valor,
      conteo: valor.conteo,
      ...(valor.hex ? { hex: valor.hex } : {}),
    })),
  };
}

interface ProductoHeroeApi {
  id: string;
  slug: string;
  nombre: string;
  imagenPrincipal: { url: string; altTexto: string } | null;
  colores: ValorAtributo[];
}

async function obtenerHeroePortada(): Promise<HeroePortada> {
  const heroe = await solicitarJson<{ destacadas: ProductoHeroeApi[]; colores: ValorAtributo[] }>(
    '/portada',
  );

  return {
    colores: heroe.colores,
    destacadas: heroe.destacadas.map((producto) => ({
      id: producto.id,
      slug: producto.slug,
      nombre: producto.nombre,
      colores: producto.colores,
      ...(producto.imagenPrincipal ? { imagenPrincipal: producto.imagenPrincipal } : {}),
    })),
  };
}

async function obtenerProducto(slug: string): Promise<Producto | null> {
  try {
    return await solicitarJson<Producto>(`/productos/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ErrorRepositorioHttp && error.estadoHttp === 404) return null;
    throw error;
  }
}

async function listarRelacionados(slug: string): Promise<Producto[]> {
  return solicitarJson<Producto[]>(`/productos/${encodeURIComponent(slug)}/relacionados`);
}

// Fuera de alcance: todavía no existe un módulo de cupones propio (los
// cupones se validan al aplicarlos contra el carrito, no se listan acá).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function buscarCupon(_codigo: string): Promise<Cupon | null> {
  return null;
}

async function obtenerConfiguracionPublica(): Promise<EntradaConfiguracion[]> {
  return solicitarJson<EntradaConfiguracion[]>('/configuracion');
}

async function listarLimitadas(): Promise<EdicionLimitada[]> {
  return solicitarJson<EdicionLimitada[]>('/limitadas');
}

async function listarCombos(): Promise<Combo[]> {
  return solicitarJson<Combo[]>('/combos');
}

export const repositorioHttp: Repositorio = {
  listarCategorias,
  listarProductos,
  listarFacetas,
  obtenerHeroePortada,
  obtenerProducto,
  listarRelacionados,
  buscarCupon,
  obtenerConfiguracionPublica,
  listarLimitadas,
  listarCombos,
};
