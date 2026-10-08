// Contrato de acceso a datos. Los componentes solo deben importar `datos/index.ts`
// (que expone la instancia activa), nunca esta interfaz junto a una
// implementación concreta ni datos/muestra.ts directamente.

import type {
  Categoria,
  Combo,
  Cupon,
  EdicionLimitada,
  EntradaConfiguracion,
  Producto,
  ValorAtributo,
} from '../tipos/index.ts';

export interface FiltrosProducto {
  // Selección múltiple (casillas): un producto coincide si alguna de sus
  // variantes tiene alguno de los valores pedidos en cada campo activo.
  categoriaSlug?: string[];
  tipoBase?: string[];
  longitud?: string[];
  color?: string[];
  talla?: string[];
  densidad?: string[];
  precioMin?: number;
  precioMax?: number;
  destacado?: boolean;
  texto?: string;
}

export type OrdenProducto =
  'relevancia' | 'precio_asc' | 'precio_desc' | 'calificacion_desc' | 'novedad';

export interface Pagina {
  pagina: number;
  porPagina: number;
}

export interface Paginacion {
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
}

export interface ResultadoPaginado<T> {
  datos: T[];
  paginacion: Paginacion;
}

// Valores de atributo disponibles para armar los filtros del catálogo (con
// los mismos criterios de FiltrosProducto ya aplicados), sin tener que
// traer el catálogo completo para derivarlos en el cliente.
// Un color de catálogo con cuántos productos lo tienen (con los mismos
// filtros ya aplicados que el resto de la búsqueda) — lo usa la portada
// para la hilera de tonos, no solo el panel de filtros del catálogo.
export interface TonoConConteo extends ValorAtributo {
  conteo: number;
}

export interface Facetas {
  tiposBase: string[];
  longitudes: string[];
  tallas: string[];
  densidades: string[];
  colores: TonoConConteo[];
}

// Una peluca marcada para el carrusel del héroe (panel: Sección de
// portada). colores son los que tienen sus variantes activas, en el orden
// definido en el valor de atributo — no el conteo del catálogo, eso sigue
// saliendo de Facetas.colores (ver Inicio.tsx).
export interface ProductoHeroe {
  id: string;
  slug: string;
  nombre: string;
  imagenPrincipal?: { url: string; altTexto: string };
  colores: ValorAtributo[];
}

export interface HeroePortada {
  destacadas: ProductoHeroe[];
  // Unión deduplicada de los colores de `destacadas`, en el mismo orden.
  // Vacío cuando no hay ninguna peluca marcada para portada.
  colores: ValorAtributo[];
}

export interface Repositorio {
  listarCategorias(): Promise<Categoria[]>;
  listarProductos(
    filtros?: FiltrosProducto,
    orden?: OrdenProducto,
    pagina?: Pagina,
  ): Promise<ResultadoPaginado<Producto>>;
  listarFacetas(filtros?: FiltrosProducto): Promise<Facetas>;
  obtenerHeroePortada(): Promise<HeroePortada>;
  obtenerProducto(slug: string): Promise<Producto | null>;
  listarRelacionados(slug: string): Promise<Producto[]>;
  buscarCupon(codigo: string): Promise<Cupon | null>;
  obtenerConfiguracionPublica(): Promise<EntradaConfiguracion[]>;
  listarLimitadas(): Promise<EdicionLimitada[]>;
  listarCombos(): Promise<Combo[]>;
}
