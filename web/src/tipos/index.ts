// Tipos compartidos de la capa de datos. Mientras dure la fase de datos
// simulados (ver CLAUDE.md) son también los tipos que devuelve `Repositorio`;
// cuando exista la API deben coincidir con la forma de sus respuestas.

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
}

export interface ImagenProducto {
  id: string;
  url: string;
  altTexto: string;
}

// Representa el valor de un atributo con swatch (hoy solo lo usa el color).
export interface ValorAtributo {
  nombre: string;
  hex?: string;
}

export interface VarianteProducto {
  id: string;
  sku: string;
  precio: number;
  stockActual: number;
  stockReservado: number;
  tipoBase?: string;
  longitud?: string;
  color?: ValorAtributo;
  talla?: string;
  densidad?: string;
}

export interface Producto {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string;
  categoriaId: string;
  // Precio de referencia para el catálogo: el precio que se cobra es
  // siempre el de la variante elegida (ver VarianteProducto.precio).
  precioBase: number;
  precioAntes?: number;
  calificacion: number;
  cantidadResenas: number;
  destacado: boolean;
  imagenes: ImagenProducto[];
  variantes: VarianteProducto[];
}

export interface LineaCarrito {
  varianteId: string;
  productoId: string;
  nombreProducto: string;
  // Atributos de la variante por separado, no una cadena ya armada: el
  // formato de presentación se decide en un único lugar
  // (dominio/formatearEspecificacionesVariante.ts).
  tipoBase?: string;
  longitud?: string;
  color?: ValorAtributo;
  talla?: string;
  densidad?: string;
  precioUnitario: number;
  cantidad: number;
  imagenUrl?: string;
}

export interface Carrito {
  lineas: LineaCarrito[];
  cuponCodigo?: string;
}

export type TipoCupon = 'porcentaje' | 'monto' | 'envio';

export interface Cupon {
  codigo: string;
  tipo: TipoCupon;
  valor: number;
  montoMinimo: number;
}

export interface TotalesCarrito {
  subtotal: number;
  descuento: number;
  envio: number;
  total: number;
}

export type EstadoPedido = 'pendiente' | 'confirmado' | 'despachado' | 'entregado' | 'cancelado';

export interface Pedido {
  id: string;
  numero: string;
  estado: EstadoPedido;
  usuarioId?: string;
  lineas: LineaCarrito[];
  totales: TotalesCarrito;
  telefonoContacto: string;
  mensajeWhatsapp: string;
  creadoEn: string;
}

export type RolUsuario = 'cliente' | 'admin';

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: RolUsuario;
  telefono?: string;
}
