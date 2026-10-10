import 'dotenv/config';
import { z } from 'zod';

const esquemaEnv = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL de conexión postgresql:// válida'),
  DIRECT_URL: z.string().url('DIRECT_URL debe ser una URL de conexión postgresql:// válida'),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  // Secreto propio del panel: un token de cliente no debe ni siquiera
  // verificar contra este secreto, y viceversa. La primera barrera entre
  // auth/ y authAdmin/ es la firma, no solo el campo `tipo` del payload.
  JWT_SECRET_ADMIN: z.string().min(32, 'JWT_SECRET_ADMIN debe tener al menos 32 caracteres'),
  NUMERO_WHATSAPP: z.string().min(1, 'NUMERO_WHATSAPP es obligatorio'),
  // Origen exacto del frontend en producción (ej: https://indiarosa.co).
  // Nunca un comodín: cors() lo usa para Access-Control-Allow-Origin y las
  // cookies de sesión viajan con credentials: true.
  ORIGEN_WEB: z
    .string()
    .url('ORIGEN_WEB debe ser la URL del frontend, por ejemplo https://indiarosa.co'),
  // Credenciales de Wompi: todas obligatorias, el servidor no arranca sin
  // ellas. La llave privada y los dos secretos NUNCA deben llegar a web/
  // (ver la verificación con grep antes de cada release).
  WOMPI_AMBIENTE: z.enum(['sandbox', 'produccion']).default('sandbox'),
  WOMPI_URL_BASE: z.string().url('WOMPI_URL_BASE debe ser una URL válida'),
  WOMPI_LLAVE_PUBLICA: z.string().min(1, 'WOMPI_LLAVE_PUBLICA es obligatoria'),
  WOMPI_LLAVE_PRIVADA: z.string().min(1, 'WOMPI_LLAVE_PRIVADA es obligatoria'),
  WOMPI_SECRETO_INTEGRIDAD: z.string().min(1, 'WOMPI_SECRETO_INTEGRIDAD es obligatorio'),
  WOMPI_SECRETO_EVENTOS: z.string().min(1, 'WOMPI_SECRETO_EVENTOS es obligatorio'),
  // A dónde redirige Wompi después del pago (pantalla de resultado del
  // frontend).
  WOMPI_URL_REDIRECCION: z.string().url('WOMPI_URL_REDIRECCION debe ser una URL válida'),
  // Storage de imágenes de producto (bucket 'productos', ya creado a mano
  // en el panel de Supabase). La llave de servicio NUNCA debe llegar a
  // web/: con ella se firman las URLs de subida desde acá.
  SUPABASE_URL: z.string().url('SUPABASE_URL debe ser una URL válida'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY es obligatoria'),
})
  // Coherencia entre WOMPI_AMBIENTE y las credenciales: Wompi prefija sus
  // llaves y secretos según el ambiente (pub_test_/prv_test_/test_... en
  // sandbox, pub_prod_/prv_prod_/prod_... en producción). Si no coinciden,
  // mejor que el servidor ni arranque a que alguien cobre plata real
  // creyendo que está probando (o al revés, que un comercio real quede
  // corriendo contra sandbox).
  .superRefine((datos, ctx) => {
    const PREFIJOS_PRODUCCION = ['pub_prod_', 'prv_prod_', 'prod_'];
    const PREFIJOS_SANDBOX = ['pub_test_', 'prv_test_', 'test_'];
    const credenciales = [
      ['WOMPI_LLAVE_PUBLICA', datos.WOMPI_LLAVE_PUBLICA],
      ['WOMPI_LLAVE_PRIVADA', datos.WOMPI_LLAVE_PRIVADA],
      ['WOMPI_SECRETO_INTEGRIDAD', datos.WOMPI_SECRETO_INTEGRIDAD],
      ['WOMPI_SECRETO_EVENTOS', datos.WOMPI_SECRETO_EVENTOS],
    ] as const;

    for (const [campo, valor] of credenciales) {
      const pareceDeProduccion = PREFIJOS_PRODUCCION.some((prefijo) => valor.startsWith(prefijo));
      const pareceDeSandbox = PREFIJOS_SANDBOX.some((prefijo) => valor.startsWith(prefijo));

      if (datos.WOMPI_AMBIENTE === 'sandbox' && pareceDeProduccion) {
        ctx.addIssue({
          code: 'custom',
          path: [campo],
          message: `${campo} parece una credencial de PRODUCCIÓN (empieza con un prefijo _prod_), pero WOMPI_AMBIENTE es 'sandbox'. Esto cobraría plata real creyendo que es una prueba.`,
        });
      }
      if (datos.WOMPI_AMBIENTE === 'produccion' && pareceDeSandbox) {
        ctx.addIssue({
          code: 'custom',
          path: [campo],
          message: `${campo} parece una credencial de SANDBOX (empieza con un prefijo _test_), pero WOMPI_AMBIENTE es 'produccion'.`,
        });
      }
    }
  });

const resultado = esquemaEnv.safeParse(process.env);

if (!resultado.success) {
  console.error('No se pudo arrancar: faltan variables de entorno o son inválidas.');
  for (const problema of resultado.error.issues) {
    console.error(`  - ${problema.path.join('.')}: ${problema.message}`);
  }
  process.exit(1);
}

export const env = resultado.data;
