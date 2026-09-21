import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Cliente con la service_role key: salta RLS a propósito (es el backend
// quien decide qué se puede subir/borrar, no una política de storage).
// Nunca se importa desde web/ — esa llave no sale de acá.
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BUCKET = 'productos';

const EXTENSION_POR_TIPO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const TIPOS_IMAGEN_PERMITIDOS = Object.keys(EXTENSION_POR_TIPO);

export function extensionParaTipo(tipoMime: string): string | null {
  return EXTENSION_POR_TIPO[tipoMime] ?? null;
}

// productos/{productoId}/{uuid}.{ext} — nunca el nombre original del
// archivo (evita colisiones y no filtra nombres de archivo del cliente).
export function generarRutaImagen(productoId: string, tipoMime: string): string {
  const extension = extensionParaTipo(tipoMime);
  if (!extension) {
    throw new Error(`Tipo de imagen no soportado: ${tipoMime}`);
  }
  return `productos/${productoId}/${randomUUID()}.${extension}`;
}

export function urlPublica(ruta: string): string {
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(ruta);
  return data.publicUrl;
}

export interface SubidaFirmada {
  urlFirmada: string;
  ruta: string;
  token: string;
  urlPublica: string;
}

export async function crearUrlFirmada(ruta: string): Promise<SubidaFirmada> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(ruta);
  if (error || !data) {
    throw new Error(`No se pudo firmar la subida: ${error?.message ?? 'sin detalle'}`);
  }
  return {
    urlFirmada: data.signedUrl,
    ruta: data.path,
    token: data.token,
    urlPublica: urlPublica(ruta),
  };
}

// Ruta dentro del bucket a partir de la URL pública guardada en
// imagen_producto.url — es el inverso de urlPublica().
export function rutaDesdeUrlPublica(url: string): string | null {
  const marcador = `/storage/v1/object/public/${BUCKET}/`;
  const indice = url.indexOf(marcador);
  if (indice === -1) return null;
  return url.slice(indice + marcador.length);
}

// No lanza: quien llama decide qué hacer si falla (ver DELETE /imagenes/:id,
// que borra la fila igual y solo registra el huérfano).
export async function eliminarArchivo(ruta: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([ruta]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Existe de verdad en el bucket: usado por el script de limpieza, no en
// el flujo normal de la API (ahí el 404 en el <img> ya lo resuelve el
// propio ImagenProducto.tsx).
export async function archivoExiste(ruta: string): Promise<boolean> {
  const carpeta = ruta.split('/').slice(0, -1).join('/');
  const archivo = ruta.split('/').at(-1) ?? '';
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(carpeta, { search: archivo });
  if (error) return false;
  return (data ?? []).some((f) => f.name === archivo);
}
