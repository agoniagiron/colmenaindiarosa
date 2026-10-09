// Cliente HTTP para api/src/modulos/admin/promociones. Mismo patrón que
// apiProductosAdmin.ts: token del panel admin, GET simples y mutaciones
// POST/PATCH con cuerpo JSON.

import { BASE_URL_API } from '../datos/urlApi.ts';

const BASE_PROMOCIONES = `${BASE_URL_API}/api/admin/promociones`;

export class ErrorPromocionesAdmin extends Error {
  readonly estadoHttp: number;
  readonly detalles?: unknown;

  constructor(estadoHttp: number, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.name = 'ErrorPromocionesAdmin';
    this.estadoHttp = estadoHttp;
    this.detalles = detalles;
  }
}

async function solicitar<T>(
  ruta: string,
  accessToken: string,
  opciones: RequestInit = {},
): Promise<T> {
  const respuesta = await fetch(`${BASE_PROMOCIONES}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...opciones.headers,
    },
  });

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: { mensaje?: string; detalles?: unknown };
    } | null;
    throw new ErrorPromocionesAdmin(
      respuesta.status,
      cuerpo?.error?.mensaje ?? 'Error al comunicarse con el servidor',
      cuerpo?.error?.detalles,
    );
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export type TipoPromocion =
  'descuentoPorcentaje' | 'descuentoMonto' | 'precioFijo' | 'envioGratis' | 'anuncio';
export type AlcancePromocion = 'global' | 'categoria' | 'producto' | 'variante';
export type EstadoPromocion = 'programada' | 'vigente' | 'vencida' | 'inactiva';

export interface FilaPromocionAdmin {
  id: string;
  nombre: string;
  tipo: TipoPromocion;
  valor: number;
  alcance: AlcancePromocion;
  vigenteDesde: string;
  vigenteHasta: string | null;
  estado: EstadoPromocion;
  // null cuando tipo es 'anuncio' (no toca precios): el panel lo muestra
  // como "—", no como "0 productos".
  productosAfectados: number | null;
}

export interface ListadoPromociones {
  datos: FilaPromocionAdmin[];
  paginacion: { pagina: number; porPagina: number; total: number; totalPaginas: number };
}

export interface ObjetivoPromocion {
  categoriaId?: string;
  productoId?: string;
  varianteId?: string;
  etiqueta?: string;
}

export interface PromocionDetalle {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoPromocion;
  valor: number;
  alcance: AlcancePromocion;
  prioridad: number;
  acumulable: boolean;
  bannerTitulo: string | null;
  bannerTexto: string | null;
  bannerImagenUrl: string | null;
  bannerColorFondo: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activa: boolean;
  estado: EstadoPromocion;
  objetivos: ObjetivoPromocion[];
}

export function listarPromociones(
  accessToken: string,
  pagina: number,
): Promise<ListadoPromociones> {
  return solicitar(`?pagina=${pagina}`, accessToken);
}

export function obtenerDetallePromocion(
  accessToken: string,
  id: string,
): Promise<PromocionDetalle> {
  return solicitar(`/${encodeURIComponent(id)}`, accessToken);
}

export interface DatosPromocion {
  nombre: string;
  descripcion?: string | null;
  tipo: TipoPromocion;
  valor: number;
  alcance: AlcancePromocion;
  objetivos: { categoriaId?: string; productoId?: string; varianteId?: string }[];
  prioridad?: number;
  acumulable?: boolean;
  bannerTitulo?: string | null;
  bannerTexto?: string | null;
  bannerImagenUrl?: string | null;
  bannerColorFondo?: string | null;
  vigenteDesde: string;
  vigenteHasta?: string | null;
  activa?: boolean;
}

export function crearPromocion(
  accessToken: string,
  datos: DatosPromocion,
): Promise<PromocionDetalle> {
  return solicitar('', accessToken, { method: 'POST', body: JSON.stringify(datos) });
}

export function editarPromocion(
  accessToken: string,
  id: string,
  datos: Partial<DatosPromocion>,
): Promise<PromocionDetalle> {
  return solicitar(`/${encodeURIComponent(id)}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export interface ProductoAfectado {
  productoId: string;
  nombre: string;
  precioOriginalCop: number;
  precioResultanteCop: number;
}

export interface VistaPreviaPromocion {
  productos: ProductoAfectado[];
  avisoMontoSuperaPrecio: boolean;
}

// No pide permiso de gestionar (solo estar autenticado como admin): es
// de solo lectura, no crea ni modifica ninguna promoción.
export function previsualizarPromocion(
  accessToken: string,
  datos: {
    tipo: TipoPromocion;
    valor: number;
    alcance: AlcancePromocion;
    objetivos: DatosPromocion['objetivos'];
  },
): Promise<VistaPreviaPromocion> {
  return solicitar('/previsualizar', accessToken, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}
