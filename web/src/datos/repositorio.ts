// Contrato de acceso a datos. Los componentes solo deben importar `datos/index.ts`
// (que expone la instancia activa), nunca esta interfaz junto a una
// implementación concreta ni datos/muestra.ts directamente.

import type { Categoria, Cupon, Producto } from '../tipos/index.ts';

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

export interface Repositorio {
  listarCategorias(): Promise<Categoria[]>;
  listarProductos(
    filtros?: FiltrosProducto,
    orden?: OrdenProducto,
    pagina?: Pagina,
  ): Promise<ResultadoPaginado<Producto>>;
  obtenerProducto(slug: string): Promise<Producto | null>;
  listarRelacionados(slug: string): Promise<Producto[]>;
  buscarCupon(codigo: string): Promise<Cupon | null>;
}
