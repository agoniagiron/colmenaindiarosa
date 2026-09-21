import type { ConfigTotales } from '../dominio/calcularTotales.js';
import { prisma } from './prisma.js';

// Grupos que puede ver el storefront (GET /api/configuracion). "pedidos"
// (minutos/horas de reserva) es interno a propósito y nunca sale de acá.
export const GRUPOS_PUBLICOS = ['envio', 'descuento', 'moneda', 'tienda', 'catalogo'] as const;

interface FilaConfiguracion {
  clave: string;
  valor: string;
  tipo: 'entero' | 'decimal' | 'texto' | 'booleano';
  grupo: string;
  etiqueta: string;
}

const TTL_CACHE_MS = 60 * 1000;
let cache: { filas: FilaConfiguracion[]; expiraEn: number } | null = null;

async function cargarDesdeBaseDeDatos(): Promise<FilaConfiguracion[]> {
  return prisma.configuracion.findMany({
    select: { clave: true, valor: true, tipo: true, grupo: true, etiqueta: true },
  });
}

async function obtenerFilas(): Promise<FilaConfiguracion[]> {
  if (cache && cache.expiraEn > Date.now()) return cache.filas;
  const filas = await cargarDesdeBaseDeDatos();
  cache = { filas, expiraEn: Date.now() + TTL_CACHE_MS };
  return filas;
}

// Se llama una vez al arrancar (ver index.ts) para que la primera petición
// real no pague el costo de la primera carga.
export async function precargarConfiguracion(): Promise<void> {
  await obtenerFilas();
}

type ValorTipado = number | string | boolean;

function tipar(fila: FilaConfiguracion): ValorTipado {
  switch (fila.tipo) {
    case 'entero':
      return parseInt(fila.valor, 10);
    case 'decimal':
      return parseFloat(fila.valor);
    case 'booleano':
      return fila.valor === 'true';
    case 'texto':
      return fila.valor;
  }
}

async function obtenerFila(clave: string): Promise<FilaConfiguracion> {
  const filas = await obtenerFilas();
  const fila = filas.find((f) => f.clave === clave);
  if (!fila) {
    throw new Error(`No existe la clave de configuración "${clave}"`);
  }
  return fila;
}

export async function obtenerNumero(clave: string): Promise<number> {
  const fila = await obtenerFila(clave);
  const valor = tipar(fila);
  if (typeof valor !== 'number') {
    throw new Error(`La clave de configuración "${clave}" no es numérica (tipo: ${fila.tipo})`);
  }
  return valor;
}

export async function obtenerBooleano(clave: string): Promise<boolean> {
  const fila = await obtenerFila(clave);
  const valor = tipar(fila);
  if (typeof valor !== 'boolean') {
    throw new Error(`La clave de configuración "${clave}" no es booleana (tipo: ${fila.tipo})`);
  }
  return valor;
}

export async function obtenerTexto(clave: string): Promise<string> {
  const fila = await obtenerFila(clave);
  return fila.valor;
}

export interface EntradaConfiguracionPublica {
  clave: string;
  valor: ValorTipado;
  grupo: string;
  etiqueta: string;
}

export async function obtenerConfiguracionPublica(): Promise<EntradaConfiguracionPublica[]> {
  const filas = await obtenerFilas();
  return filas
    .filter((fila): fila is FilaConfiguracion =>
      (GRUPOS_PUBLICOS as readonly string[]).includes(fila.grupo),
    )
    .map((fila) => ({
      clave: fila.clave,
      valor: tipar(fila),
      grupo: fila.grupo,
      etiqueta: fila.etiqueta,
    }));
}

// Compartido entre carrito y pedidos: los dos arman TotalesCarrito con las
// mismas cuatro claves de configuracion.
export async function obtenerConfigTotales(): Promise<ConfigTotales> {
  const [envioCosto, descuentoUmbral, descuentoPorcentaje, descuentoActivo] = await Promise.all([
    obtenerNumero('envio.costo'),
    obtenerNumero('descuento.umbral'),
    obtenerNumero('descuento.porcentaje'),
    obtenerBooleano('descuento.activo'),
  ]);
  return { envioCosto, descuentoUmbral, descuentoPorcentaje, descuentoActivo };
}
