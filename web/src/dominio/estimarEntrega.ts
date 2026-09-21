// Módulo puro: estima el día de entrega según la ciudad, contando días
// hábiles (sin sábados ni domingos) desde hoy. Los números de días y la
// lista de ciudades principales salen siempre de configuracion (grupo
// envio): este archivo nunca los tiene escritos a mano.

export interface ReglasEntrega {
  diasCali: number;
  diasPrincipales: number;
  diasResto: number;
  ciudadesPrincipales: string[];
}

const DIAS_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

function normalizar(texto: string): string {
  return texto.trim().toLowerCase();
}

export function diasHabilesPara(ciudad: string, reglas: ReglasEntrega): number {
  if (normalizar(ciudad) === normalizar('Cali')) return reglas.diasCali;
  const esPrincipal = reglas.ciudadesPrincipales.some(
    (candidata) => normalizar(candidata) === normalizar(ciudad),
  );
  return esPrincipal ? reglas.diasPrincipales : reglas.diasResto;
}

// Suma días HÁBILES (sin contar sábados ni domingos) a partir de `desde`.
function sumarDiasHabiles(desde: Date, diasHabiles: number): Date {
  const resultado = new Date(desde);
  let restantes = diasHabiles;
  while (restantes > 0) {
    resultado.setDate(resultado.getDate() + 1);
    const diaSemana = resultado.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) restantes -= 1;
  }
  return resultado;
}

export interface EstimacionEntrega {
  diasHabiles: number;
  fecha: Date;
  // "mañana" cuando cae al día siguiente, si no el nombre del día
  // ("el martes"), igual que se lee una fecha coordinada por WhatsApp.
  texto: string;
}

export function estimarEntrega(
  ciudad: string,
  reglas: ReglasEntrega,
  ahora: Date = new Date(),
): EstimacionEntrega {
  const diasHabiles = diasHabilesPara(ciudad, reglas);
  const fecha = sumarDiasHabiles(ahora, diasHabiles);

  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  const esManana =
    fecha.getDate() === manana.getDate() &&
    fecha.getMonth() === manana.getMonth() &&
    fecha.getFullYear() === manana.getFullYear();

  return {
    diasHabiles,
    fecha,
    texto: esManana ? 'mañana' : `el ${DIAS_SEMANA[fecha.getDay()]}`,
  };
}
