import type { Prisma } from '@prisma/client';
import {
  atributosDeColumnas,
  describirLinea,
  ordenarAtributos,
} from '../dominio/describirLinea.js';
import type { AtributoDeLinea } from '../dominio/describirLinea.js';

// pedido_item guarda una copia de lo que se vendió, congelada al crear el
// pedido: nombre, precio, la URL de la foto (imagen_url) y todos los
// atributos elegidos (atributos, jsonb). Si mañana se renombra un color, se
// desactiva una variante o se cambian las fotos, el pedido sigue mostrando
// lo que se vendió. Las cinco columnas fijas (tipo_base, longitud,
// color_nombre, color_hex, talla, densidad) se siguen escribiendo para no
// tocar lo que ya las lee; el jsonb es el registro completo.

export interface AtributoCongelado extends AtributoDeLinea {
  nombre: string;
  hex?: string;
  // Segundo tono de un color combinado, congelado igual que el primero.
  hexSecundario?: string;
}

// Lo que se guarda en pedido_item.atributos: todos los atributos de la
// variante, con el nombre del atributo y el tono, en el orden del texto.
export function congelarAtributos(
  valoresAtributo: {
    valorAtributo: {
      valor: string;
      hex: string | null;
      hexSecundario: string | null;
      atributo: { slug: string; nombre: string };
    };
  }[],
): AtributoCongelado[] {
  return ordenarAtributos(
    valoresAtributo.map(({ valorAtributo }) => ({
      slug: valorAtributo.atributo.slug,
      nombre: valorAtributo.atributo.nombre,
      valor: valorAtributo.valor,
      ...(valorAtributo.hex ? { hex: valorAtributo.hex } : {}),
      ...(valorAtributo.hex && valorAtributo.hexSecundario
        ? { hexSecundario: valorAtributo.hexSecundario }
        : {}),
    })),
  );
}

function esAtributoCongelado(valor: unknown): valor is AtributoCongelado {
  if (typeof valor !== 'object' || valor === null) return false;
  const candidato = valor as Record<string, unknown>;
  return typeof candidato.slug === 'string' && typeof candidato.valor === 'string';
}

export interface ItemPedidoParaDescribir {
  nombreProducto: string;
  atributos: Prisma.JsonValue | null;
  tipoBase: string | null;
  longitud: string | null;
  colorNombre: string | null;
  talla: string | null;
  densidad: string | null;
}

// Los atributos de una línea de pedido: el jsonb si está; en los pedidos
// anteriores a esa columna (NULL), las cinco columnas fijas, que ya eran
// copia de lo vendido.
export function atributosDeItemPedido(item: ItemPedidoParaDescribir): AtributoDeLinea[] {
  if (Array.isArray(item.atributos)) {
    return item.atributos.flatMap((valor: unknown) =>
      esAtributoCongelado(valor) ? [{ slug: valor.slug, valor: valor.valor }] : [],
    );
  }
  return atributosDeColumnas(item);
}

// "HANNAH — Rosa / 14 / …" para una línea de pedido. Mismo texto que el
// carrito y el checkout (dominio/describirLinea.ts).
export function describirItemPedido(item: ItemPedidoParaDescribir): string {
  return describirLinea(item.nombreProducto, atributosDeItemPedido(item));
}

// Lo que hay que leer de pedido_item para describir la línea y mostrar su
// foto congelada.
export const SELECT_DESCRIPCION_ITEM = {
  nombreProducto: true,
  atributos: true,
  tipoBase: true,
  longitud: true,
  colorNombre: true,
  talla: true,
  densidad: true,
  imagenUrl: true,
} satisfies Prisma.PedidoItemSelect;

// Lo que viaja a las pantallas de pedido (clienta, panel, resultado del
// pago): el texto ya armado en lugar del jsonb crudo, para que ninguna
// pantalla lo arme por su cuenta. imagenUrl es la foto congelada; null en
// los pedidos anteriores a la copia.
export function conDescripcion<T extends ItemPedidoParaDescribir>(
  item: T,
): Omit<T, 'atributos'> & { descripcion: string } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { atributos: _atributos, ...resto } = item;
  return { ...resto, descripcion: describirItemPedido(item) };
}

// "HANNAH" o "HANNAH y 2 más", con la foto del primer ítem: la fila de
// "Mis pedidos". El primer ítem es el de mayor subtotal (pedido_item no
// guarda orden de inserción).
export function resumenItemsPedido(
  items: { nombreProducto: string; imagenUrl: string | null; subtotal: number }[],
): { texto: string; imagenUrl: string | null } {
  const ordenados = [...items].sort((a, b) => b.subtotal - a.subtotal);
  const primero = ordenados[0];
  if (!primero) return { texto: '', imagenUrl: null };
  const resto = ordenados.length - 1;
  return {
    texto: resto > 0 ? `${primero.nombreProducto} y ${resto} más` : primero.nombreProducto,
    imagenUrl: primero.imagenUrl,
  };
}
