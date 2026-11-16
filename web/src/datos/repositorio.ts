// Contrato de acceso a datos. Los componentes solo deben importar `datos/index.ts`
// (que expone la instancia activa), nunca esta interfaz junto a una
// implementación concreta ni datos/muestra.ts directamente.

import type {
  Categoria,
  Combo,
  ComboDetalle,
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

// Una peluca del carrusel del héroe bajo un tono: con la foto de ESE color
// y el SKU de la variante de ese color a la que lleva (la ficha la abre ya
// elegida). Lo arma el backend (api/src/modulos/portada/servicio.ts).
export interface ProductoHeroe {
  id: string;
  slug: string;
  nombre: string;
  sku: string;
  imagen: { url: string; altTexto: string };
}

export interface TonoPortada extends ValorAtributo {
  // Nunca vacío: un tono sin productos con foto propia no llega.
  productos: ProductoHeroe[];
}

export interface HeroePortada {
  // En el orden del valor de atributo. Vacío: la sección no se muestra.
  tonos: TonoPortada[];
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
  obtenerCombo(slug: string): Promise<ComboDetalle | null>;
}
