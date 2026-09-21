// Versión mínima, solo para el panel de analítica, del mismo criterio de
// zona horaria que usa el backend (api/src/lib/fechasReporte.ts): Colombia
// es UTC-5 fijo, sin horario de verano. El navegador de quien administra
// puede estar en cualquier huso; "hoy" acá siempre se calcula como el día
// calendario en Bogotá, para que coincida con lo que cuenta la API al
// recibir desde=/hasta=.

const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export type FechaBogota = string; // 'YYYY-MM-DD'

export function fechaBogotaDe(instanteUtc: Date): FechaBogota {
  const bogota = new Date(instanteUtc.getTime() - OFFSET_BOGOTA_MS);
  return `${bogota.getUTCFullYear()}-${pad(bogota.getUTCMonth() + 1)}-${pad(bogota.getUTCDate())}`;
}

export function hoyBogota(): FechaBogota {
  return fechaBogotaDe(new Date());
}

export function sumarDias(fecha: FechaBogota, n: number): FechaBogota {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function primerDiaDelMes(fecha: FechaBogota): FechaBogota {
  return `${fecha.slice(0, 7)}-01`;
}

export type Periodo = '7d' | '30d' | '90d' | 'mes';

export const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: '7d', etiqueta: '7 días' },
  { valor: '30d', etiqueta: '30 días' },
  { valor: '90d', etiqueta: '90 días' },
  { valor: 'mes', etiqueta: 'Este mes' },
];

// Las tres ventanas por cantidad de días son móviles (terminan hoy); "este
// mes" es la única de calendario (desde el día 1 del mes en curso).
export function rangoDePeriodo(
  periodo: Periodo,
  hoy: FechaBogota = hoyBogota(),
): {
  desde: FechaBogota;
  hasta: FechaBogota;
} {
  switch (periodo) {
    case '7d':
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case '30d':
      return { desde: sumarDias(hoy, -29), hasta: hoy };
    case '90d':
      return { desde: sumarDias(hoy, -89), hasta: hoy };
    case 'mes':
      return { desde: primerDiaDelMes(hoy), hasta: hoy };
  }
}
