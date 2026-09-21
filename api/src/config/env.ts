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
  WOMPI_ENTORNO: z.enum(['sandbox', 'produccion']).default('sandbox'),
  WOMPI_LLAVE_PUBLICA: z.string().min(1, 'WOMPI_LLAVE_PUBLICA es obligatoria'),
  WOMPI_LLAVE_PRIVADA: z.string().min(1, 'WOMPI_LLAVE_PRIVADA es obligatoria'),
  WOMPI_SECRETO_INTEGRIDAD: z.string().min(1, 'WOMPI_SECRETO_INTEGRIDAD es obligatorio'),
  WOMPI_SECRETO_EVENTOS: z.string().min(1, 'WOMPI_SECRETO_EVENTOS es obligatorio'),
  WOMPI_URL_REDIRECCION: z.string().url('WOMPI_URL_REDIRECCION debe ser una URL válida'),
  // Storage de imágenes de producto (bucket 'productos', ya creado a mano
  // en el panel de Supabase). La llave de servicio NUNCA debe llegar a
  // web/: con ella se firman las URLs de subida desde acá.
  SUPABASE_URL: z.string().url('SUPABASE_URL debe ser una URL válida'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY es obligatoria'),
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
