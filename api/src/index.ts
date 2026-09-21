import { env } from './config/env.js';
import { app } from './app.js';
import { precargarConfiguracion } from './lib/configuracion.js';
import {
  diaAnteriorBogota,
  hoyBogota,
  msHastaProxima3amBogota,
  sumarDias,
} from './lib/fechasReporte.js';
import { liberarReservasYPagosVencidos } from './lib/tareaReservas.js';
import { recalcularDia } from './modulos/analitica/agregacion.js';

const CINCO_MINUTOS_MS = 5 * 60 * 1000;
const VEINTICUATRO_HORAS_MS = 24 * 60 * 60 * 1000;
// Si el servidor estuvo caído un par de días, "solo ayer" los dejaría sin
// agregar para siempre (nadie vuelve a pedir ese día). Recalcular es
// idempotente, así que repetir días ya agregados no cuesta nada.
const DIAS_BACKFILL_AL_ARRANCAR = 7;

precargarConfiguracion().catch((error: unknown) => {
  console.error('No se pudo precargar configuracion al arrancar:', error);
});

app.listen(env.PORT, () => {
  console.log(`API escuchando en el puerto ${env.PORT}`);
});

setInterval(() => {
  liberarReservasYPagosVencidos().catch((error) => {
    console.error('Error liberando reservas/pagos vencidos:', error);
  });
}, CINCO_MINUTOS_MS);

// Agregación diaria de analítica: al arrancar, recalcula los últimos 7
// días (idempotente — cubre el caso de que el proceso haya estado caído).
// Después, se programa para las 3:00 a.m. hora Bogotá, siempre a esa hora
// exacta sin importar cuándo reinició el proceso — un setInterval(24h) a
// secas se desplazaría con cada reinicio (si reinicia a las 4pm, corre
// todos los días a las 4pm).
async function correrBackfillAlArrancar(): Promise<void> {
  const hoy = hoyBogota();
  for (let i = 1; i <= DIAS_BACKFILL_AL_ARRANCAR; i += 1) {
    const fecha = sumarDias(hoy, -i);
    try {
      await recalcularDia(fecha);
    } catch (error) {
      console.error(`No se pudo recalcular analítica del ${fecha}:`, error);
    }
  }
}

function programarAgregacionDiaria(): void {
  setTimeout(() => {
    recalcularDia(diaAnteriorBogota()).catch((error) => {
      console.error('Error en la agregación diaria programada:', error);
    });
    setInterval(() => {
      recalcularDia(diaAnteriorBogota()).catch((error) => {
        console.error('Error en la agregación diaria programada:', error);
      });
    }, VEINTICUATRO_HORAS_MS);
  }, msHastaProxima3amBogota());
}

correrBackfillAlArrancar()
  .catch((error: unknown) => {
    console.error('Error en el backfill de analítica al arrancar:', error);
  })
  .finally(() => {
    programarAgregacionDiaria();
  });
