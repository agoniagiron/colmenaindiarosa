// Borra las filas de imagen_producto cuya url no corresponde a un
// archivo real en el bucket 'productos' de Supabase Storage — ya sea
// porque nunca fue una URL del bucket (rutas de marcador como
// /img/productos/... o /productos/slug-N.jpg, ambas del seed) o porque
// apuntaba a un archivo que ya no está.
//
// Uso: npx tsx scripts/limpiarImagenesMarcador.ts
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { archivoExiste, rutaDesdeUrlPublica } from '../src/lib/supabaseStorage.js';

async function main() {
  const imagenes = await prisma.imagenProducto.findMany({
    select: { id: true, url: true },
  });

  const idsABorrar: string[] = [];
  let sinRutaDeBucket = 0;
  let noEncontradasEnBucket = 0;

  for (const imagen of imagenes) {
    const ruta = rutaDesdeUrlPublica(imagen.url);
    if (!ruta) {
      idsABorrar.push(imagen.id);
      sinRutaDeBucket++;
      continue;
    }
    const existe = await archivoExiste(ruta);
    if (!existe) {
      idsABorrar.push(imagen.id);
      noEncontradasEnBucket++;
    }
  }

  if (idsABorrar.length > 0) {
    await prisma.imagenProducto.deleteMany({ where: { id: { in: idsABorrar } } });
  }

  console.log(
    `Revisadas ${imagenes.length} filas. Borradas ${idsABorrar.length} ` +
      `(${sinRutaDeBucket} con url que nunca fue del bucket, ${noEncontradasEnBucket} ` +
      `apuntando a un archivo que ya no existe). Quedan ${imagenes.length - idsABorrar.length}.`,
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
