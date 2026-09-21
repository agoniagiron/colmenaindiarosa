// Redimensiona a un máximo de 1600px de lado mayor y convierte a WebP,
// todo en el navegador antes de subir: una foto de celular de ~4MB queda
// en ~200KB. `imageOrientation: 'from-image'` es la parte que evita el
// bug más común de subir desde el celular — sin esto, createImageBitmap
// ignora la rotación EXIF y una foto vertical se decodifica acostada.
const LADO_MAXIMO = 1600;
const CALIDAD_WEBP = 0.85;

export interface ImagenRedimensionada {
  blob: Blob;
  ancho: number;
  alto: number;
}

export async function redimensionarAWebp(archivo: File): Promise<ImagenRedimensionada> {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const contexto = canvas.getContext('2d');
  if (!contexto) {
    throw new Error('El navegador no soporta canvas 2D');
  }
  contexto.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (resultado) =>
        resultado ? resolve(resultado) : reject(new Error('No se pudo convertir a WebP')),
      'image/webp',
      CALIDAD_WEBP,
    );
  });

  return { blob, ancho, alto };
}
