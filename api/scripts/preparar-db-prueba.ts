import 'dotenv/config';
import { execFileSync } from 'node:child_process';

// Crea (o recrea desde cero) la base de PostgreSQL LOCAL que usan las
// pruebas de integración reales bajo src/__tests__/integracion/.
//
// Nunca escribe en Supabase: DIRECT_URL solo se usa para leer el esquema
// con `pg_dump --schema-only` (RLS, checks e índices incluidos). El único
// "cambio de esquema" ocurre en la base local y descartable de
// DATABASE_URL_TEST — nunca con `prisma db push`/`migrate`, según la
// regla de CLAUDE.md.
//
// Requiere psql y pg_dump en el PATH (vienen con cualquier instalación de
// PostgreSQL 16+). Uso: npx tsx scripts/preparar-db-prueba.ts

function conPathname(url: string, pathname: string): string {
  const destino = new URL(url);
  destino.pathname = pathname;
  return destino.toString();
}

const origen = process.env.DIRECT_URL;
const destino = process.env.DATABASE_URL_TEST;

if (!origen) {
  throw new Error('Falta DIRECT_URL en el entorno (origen del esquema, Supabase).');
}
if (!destino) {
  throw new Error('Falta DATABASE_URL_TEST en el entorno (base local de pruebas).');
}

const nombreBase = new URL(destino).pathname.replace(/^\//, '');
const urlMantenimiento = conPathname(destino, '/postgres');

console.log(`Recreando la base local "${nombreBase}"...`);
execFileSync(
  'psql',
  [urlMantenimiento, '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS "${nombreBase}"`],
  { stdio: 'inherit' },
);
execFileSync(
  'psql',
  [urlMantenimiento, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE "${nombreBase}"`],
  { stdio: 'inherit' },
);
// Una base nueva ya trae un esquema `public` vacío; el dump trae su propio
// CREATE SCHEMA public, así que hay que sacar el que viene por defecto
// antes de cargarlo o choca.
execFileSync('psql', [destino, '-v', 'ON_ERROR_STOP=1', '-c', 'DROP SCHEMA public CASCADE'], {
  stdio: 'inherit',
});

console.log('Volcando el esquema desde Supabase (solo lectura, --schema-only)...');
// Solo el esquema `public`: ahí viven las 45 tablas de la app. Los demás
// esquemas de Supabase (auth, storage, vault, extensions...) traen
// extensiones que no existen en un PostgreSQL local corriente.
const volcado = execFileSync('pg_dump', [
  '--schema-only',
  '--no-owner',
  '--no-privileges',
  '--schema=public',
  origen,
]);

console.log('Cargando el esquema en la base local...');
execFileSync('psql', [destino, '-v', 'ON_ERROR_STOP=1'], {
  input: volcado,
  stdio: ['pipe', 'inherit', 'inherit'],
});

console.log('Listo: la base local de pruebas quedó con el esquema real de Supabase.');
