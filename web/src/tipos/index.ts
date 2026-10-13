// Tipos compartidos de la capa de datos. Deben coincidir con la forma real
// de las respuestas de la API (ver api/src/modulos/*).

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

// Precio en las dos monedas que maneja la tienda: cop es el valor
// autoritativo (lo que se cobra), usd es un equivalente de referencia. El
// backend ya hace la conversión; acá nunca se recalcula, solo se muestra.
export interface PrecioDual {
  cop: number;
  usd: number;
}

export interface VarianteProducto {
  id: string;
  sku: string;
  precioOriginal: PrecioDual;
  precioConDescuento: PrecioDual;
  precioAntes?: PrecioDual;
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
  // Precio de la tarjeta: el de la variante que muestra la tienda (la
  // principal, o la más barata con stock si la principal está agotada o
  // no hay), con la promoción ya aplicada. Lo decide el backend
  // (catalogo/variantePrincipal.ts); acá nunca se recalcula.
  precioBase: PrecioDual;
  // true si hay más de un precio y precioBase es el mínimo: la tarjeta
  // antepone "desde". Si la principal es más cara, el número va solo.
  desde: boolean;
  // La variante de precioBase. La ficha abre en esta y el botón de la
  // tarjeta agrega esta. null si el producto no tiene variantes activas.
  varianteMostradaId: string | null;
  calificacion: number;
  cantidadResenas: number;
  destacado: boolean;
  imagenes: ImagenProducto[];
  variantes: VarianteProducto[];
}

export interface LineaCarrito {
  // Id de la línea en el backend (carrito_item), para cambiar cantidad o
  // quitar por id. Ausente antes de que la API haya respondido una vez.
  id?: string;
  tipo: 'variante' | 'combo';
  varianteId?: string;
  comboId?: string;
  productoId?: string;
  nombreProducto: string;
  // Atributos de la variante por separado, no una cadena ya armada: el
  // formato de presentación se decide en un único lugar
  // (dominio/formatearEspecificacionesVariante.ts). Nunca presentes en una
  // línea de combo.
  tipoBase?: string;
  longitud?: string;
  color?: ValorAtributo;
  talla?: string;
  densidad?: string;
  // Siempre en COP: es el valor autoritativo de la línea. El equivalente en
  // USD, cuando hace falta mostrarlo, se deriva con la tasa vigente (ver
  // ContextoConfiguracion).
  precioUnitario: number;
  cantidad: number;
  imagenUrl?: string;
  // Stock disponible (variante) o combos armables con el stock de sus
  // piezas (combo), calculado por el backend al momento de la consulta.
  disponible?: number;
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

export type OrigenDescuento = 'automatico' | 'cupon' | 'ninguno';

export interface TotalesCarrito {
  subtotal: number;
  descuento: number;
  envio: number;
  total: number;
  descuentoAplicado: OrigenDescuento;
  descuentoDescartado: { origen: OrigenDescuento; monto: number } | null;
  usd: {
    subtotal: number;
    descuento: number;
    envio: number;
    total: number;
  };
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

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  telefono?: string;
}

// --- Configuración pública, ediciones limitadas y kits (combos) -----------

export interface EntradaConfiguracion {
  clave: string;
  valor: number | string | boolean;
  grupo: string;
  etiqueta: string;
}

export interface EdicionLimitada {
  id: string;
  nombre: string;
  descripcion: string | null;
  unidadesLote: number | null;
  unidadesRestantes: number | null;
  desde: string;
  hasta: string | null;
  producto: {
    id: string;
    nombre: string;
    slug: string;
    imagen: { url: string; altTexto: string } | null;
    // Total de fotos del producto (sin contar las de variante), para el
    // indicador "1/N" en táctil sin traer la galería completa.
    cantidadImagenes: number;
  };
  precio: PrecioDual;
}

export interface ItemCombo {
  varianteId: string;
  sku: string;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: PrecioDual;
}

export interface Combo {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagenUrl: string | null;
  // Foto propia del kit (no de los productos que lo componen). null si
  // todavía no le subieron ninguna — ahí el front cae al SVG de respaldo.
  imagenPrincipal: { url: string; altTexto: string } | null;
  cantidadImagenes: number;
  precio: PrecioDual;
  precioPiezasPorSeparado: PrecioDual;
  disponible: boolean;
  items: ItemCombo[];
}

// Pantalla pública /kit/:slug (GET /api/combos/:slug). Distinta de Combo
// (la tarjeta del listado): acá cada pieza trae su propia foto y, si tiene
// ficha pública, su slug para enlazar — el listado no necesita ninguna de
// las dos cosas.
export interface PiezaKit {
  varianteId: string;
  sku: string;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: PrecioDual;
  imagen: { url: string; altTexto: string } | null;
  // null cuando la pieza no tiene ficha pública propia: porque es
  // solo_kits (nunca se vende suelta) o porque está archivada/inactiva.
  productoSlug: string | null;
}

export interface ComboDetalle {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagenes: { url: string; altTexto: string }[];
  precio: PrecioDual;
  precioPiezasPorSeparado: PrecioDual;
  // Solo stock (mismo cálculo que Combo.disponible). comprable de abajo es
  // lo que de verdad gobierna el botón: también exige que ninguna pieza
  // esté bloqueada. El motivo concreto no viene acá a propósito: es del
  // panel (/admin/kits/:id), no de la tienda.
  disponible: boolean;
  comprable: boolean;
  piezas: PiezaKit[];
}
