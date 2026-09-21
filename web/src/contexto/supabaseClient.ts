// Cliente de Supabase Storage para el panel admin: solo la llave anónima
// (segura de exponer). Se usa nada más para subir el archivo a la URL
// firmada que devuelve la API — la llave de servicio nunca sale de api/.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export async function subirArchivoFirmado(
  bucket: string,
  ruta: string,
  token: string,
  archivo: Blob,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(ruta, token, archivo);
  if (error) {
    throw new Error(`No se pudo subir el archivo: ${error.message}`);
  }
}
