// Único lugar que sabe de zona horaria en todo el backend. El resto del
// código trata las fechas en UTC implícito (ver Date nativo); acá se
// traduce explícitamente a "día calendario en Bogotá" para que un reporte
// de "hoy" o "ayer" coincida con lo que ve la tienda, no con el día UTC.
//
// Colombia usa UTC-5 todo el año (sin horario de verano), así que el
// offset es una constante fija, nunca calculada con Intl/tz-database.

const OFFSET_BOGOTA_HORAS = 5;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// 'YYYY-MM-DD', el mismo formato que se espera en desde=/hasta= de los
// endpoints y el que se usa como clave interna en todo este módulo.
export type FechaBogota = string;

function validarFormato(fecha: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error(`Fecha inválida (se espera YYYY-MM-DD): "${fecha}"`);
  }
}

// El valor que se guarda en metrica_diaria.fecha / producto_metrica_diaria.fecha
// (columnas @db.Date): una etiqueta de día calendario, no un instante. Postgres
// DATE no tiene hora ni huso, así que esto es solo el día tal cual, a
// medianoche UTC — nunca se usa para calcular rangos de eventos reales.
export function claveDia(fecha: FechaBogota): Date {
  validarFormato(fecha);
  return new Date(`${fecha}T00:00:00.000Z`);
}

// Rango de INSTANTES reales (UTC) que cubre ese día calendario en Bogotá:
// medianoche a medianoche hora Colombia. Esto es lo que se usa para
// filtrar creado_en/inicio_en/etc. de las tablas crudas.
export function limitesDia(fecha: FechaBogota): { inicio: Date; fin: Date } {
  validarFormato(fecha);
  const inicio = new Date(`${fecha}T00:00:00.000Z`);
  inicio.setUTCHours(inicio.getUTCHours() + OFFSET_BOGOTA_HORAS);
  const fin = new Date(inicio.getTime() + MS_POR_DIA);
  return { inicio, fin };
}

// Rango de instantes que cubre desde el inicio de `desde` hasta el final
// de `hasta`, ambos inclusive (días calendario en Bogotá).
export function limitesRango(desde: FechaBogota, hasta: FechaBogota): { inicio: Date; fin: Date } {
  const { inicio } = limitesDia(desde);
  const { fin } = limitesDia(hasta);
  return { inicio, fin };
}

export function fechaBogotaDe(instanteUtc: Date): FechaBogota {
  const bogota = new Date(instanteUtc.getTime() - OFFSET_BOGOTA_HORAS * 60 * 60 * 1000);
  return `${bogota.getUTCFullYear()}-${pad(bogota.getUTCMonth() + 1)}-${pad(bogota.getUTCDate())}`;
}

export function hoyBogota(): FechaBogota {
  return fechaBogotaDe(new Date());
}

// Suma (o resta, con n negativo) días calendario a una fecha Bogotá.
export function sumarDias(fecha: FechaBogota, n: number): FechaBogota {
  const d = claveDia(fecha);
  d.setUTCDate(d.getUTCDate() + n);
  return fechaBogotaDe(new Date(d.getTime() + OFFSET_BOGOTA_HORAS * 60 * 60 * 1000));
}

export function diaAnteriorBogota(referencia: FechaBogota = hoyBogota()): FechaBogota {
  return sumarDias(referencia, -1);
}

// Cantidad de días calendario entre dos fechas Bogotá, ambas inclusive
// (2026-01-01 a 2026-01-01 = 1 día; a 2026-01-02 = 2 días).
export function cantidadDias(desde: FechaBogota, hasta: FechaBogota): number {
  const dias = Math.round((claveDia(hasta).getTime() - claveDia(desde).getTime()) / MS_POR_DIA) + 1;
  if (dias <= 0) {
    throw new Error(`Rango inválido: "${hasta}" es anterior a "${desde}"`);
  }
  return dias;
}

// Arreglo de todas las fechas Bogotá entre desde y hasta, inclusive.
export function listaDeDias(desde: FechaBogota, hasta: FechaBogota): FechaBogota[] {
  const total = cantidadDias(desde, hasta);
  return Array.from({ length: total }, (_, i) => sumarDias(desde, i));
}

// El período inmediatamente anterior, de la misma duración que
// [desde, hasta] — para las comparaciones de GET /resumen.
export function rangoAnteriorEquivalente(
  desde: FechaBogota,
  hasta: FechaBogota,
): { desde: FechaBogota; hasta: FechaBogota } {
  const dias = cantidadDias(desde, hasta);
  const hastaAnterior = sumarDias(desde, -1);
  const desdeAnterior = sumarDias(hastaAnterior, -(dias - 1));
  return { desde: desdeAnterior, hasta: hastaAnterior };
}

// 'YYYY-MM' del mes calendario (Bogotá) de una fecha.
export function mesDe(fecha: FechaBogota): string {
  return fecha.slice(0, 7);
}

// Primer día calendario (Bogotá) del mes que resulta de restarle `n`
// meses al mes de `fecha` (n=0 devuelve el primer día del propio mes).
export function restarMeses(fecha: FechaBogota, n: number): FechaBogota {
  const [anio, mes] = fecha.split('-').map(Number) as [number, number];
  const total = anio * 12 + (mes - 1) - n;
  const anioResultado = Math.floor(total / 12);
  const mesResultado = (((total % 12) + 12) % 12) + 1;
  return `${anioResultado}-${pad(mesResultado)}-01`;
}

// Primer y último día calendario (Bogotá) del mes que contiene `fecha`.
export function limitesDelMes(fecha: FechaBogota): { desde: FechaBogota; hasta: FechaBogota } {
  const [anio, mes] = fecha.split('-').map(Number) as [number, number];
  const desde = `${anio}-${pad(mes)}-01`;
  // Día 0 del mes siguiente = último día de este mes.
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const hasta = `${anio}-${pad(mes)}-${pad(ultimoDia)}`;
  return { desde, hasta };
}

// Milisegundos hasta el próximo 3:00 a.m. hora Bogotá (08:00 UTC), para
// programar la tarea diaria de agregación sin que se desplace con cada
// reinicio del proceso (a diferencia de un setInterval de 24h a secas,
// que arranca a contar desde el momento en que el proceso levantó).
export function msHastaProxima3amBogota(ahora: Date = new Date()): number {
  const HORA_UTC_3AM_BOGOTA = OFFSET_BOGOTA_HORAS + 3; // 03:00 -05:00 = 08:00 UTC
  const proximo = new Date(
    Date.UTC(
      ahora.getUTCFullYear(),
      ahora.getUTCMonth(),
      ahora.getUTCDate(),
      HORA_UTC_3AM_BOGOTA,
      0,
      0,
      0,
    ),
  );
  if (proximo.getTime() <= ahora.getTime()) {
    proximo.setUTCDate(proximo.getUTCDate() + 1);
  }
  return proximo.getTime() - ahora.getTime();
}
