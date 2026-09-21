import 'dotenv/config';
import { listaDeDias } from '../src/lib/fechasReporte.js';
import { recalcularDia } from '../src/modulos/analitica/agregacion.js';

// Reconstruye metrica_diaria y producto_metrica_diaria para un rango de
// días (Bogotá). Hace falta cuando cambie una definición y haya que
// recalcular historia, o para rellenar días que nunca se agregaron.
//
// Uso: npx tsx scripts/recalcularAnalitica.ts --desde=2026-01-01 --hasta=2026-01-31
// Con un solo día: --desde=2026-01-01 --hasta=2026-01-01

function leerArgumento(nombre: string): string {
  const prefijo = `--${nombre}=`;
  const arg = process.argv.find((a) => a.startsWith(prefijo));
  if (!arg) {
    throw new Error(`Falta el argumento --${nombre}=YYYY-MM-DD`);
  }
  return arg.slice(prefijo.length);
}

async function main(): Promise<void> {
  const desde = leerArgumento('desde');
  const hasta = leerArgumento('hasta');
  const dias = listaDeDias(desde, hasta);

  console.log(`Recalculando ${dias.length} día(s), de ${desde} a ${hasta}...`);

  for (const dia of dias) {
    await recalcularDia(dia);
    console.log(`  OK ${dia}`);
  }

  console.log('Listo.');
}

main().catch((error: unknown) => {
  console.error('Error recalculando analítica:', error);
  process.exitCode = 1;
});
