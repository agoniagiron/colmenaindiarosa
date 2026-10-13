import type { ZodError } from 'zod';

// Traduce un ZodError a una lista de campos con su problema, en castellano.
// La respuesta de la API nunca expone la estructura interna de Zod (códigos,
// `expected`, `origin`…): solo qué campo falló y por qué, para que el panel
// pueda mostrarlo sin adivinar.

export interface CampoInvalido {
  // Ruta del campo tal como viaja en el cuerpo: "precio",
  // "combinaciones.3.stock". Vacío si el problema es del cuerpo entero.
  campo: string;
  problema: string;
}

type Issue = ZodError['issues'][number];

// Error de validación con la entrada que lo provocó. Lo lanza el middleware
// validar: con la entrada a mano se puede distinguir un campo que FALTA de
// uno que llegó con otro tipo. Con z.coerce.number() los dos casos
// terminan en el mismo issue ("received NaN"), así que el issue solo no
// alcanza.
export class ErrorValidacion extends Error {
  constructor(
    readonly errorZod: ZodError,
    readonly entrada: unknown,
  ) {
    super('Datos no válidos');
    this.name = 'ErrorValidacion';
  }
}

const SIN_ENTRADA = Symbol('sin entrada');

function valorEnRuta(entrada: unknown, ruta: PropertyKey[]): unknown {
  let actual: unknown = entrada;
  for (const clave of ruta) {
    if (actual === null || typeof actual !== 'object') return undefined;
    actual = (actual as Record<PropertyKey, unknown>)[clave];
  }
  return actual;
}

// Los mensajes por defecto de Zod vienen en inglés. Los que se escribieron a
// mano en los esquemas ("El correo no es válido") ya están pensados para
// mostrarse, así que esos pasan tal cual.
const MENSAJE_POR_DEFECTO = /^(Invalid|Too (small|big)|Unrecognized|Expected)/;

function describirLimite(issue: Issue & { origin?: string }, minimo: boolean): string {
  const limite = minimo
    ? (issue as { minimum?: unknown }).minimum
    : (issue as { maximum?: unknown }).maximum;
  const inclusivo = (issue as { inclusive?: boolean }).inclusive !== false;
  switch (issue.origin) {
    case 'number':
    case 'int':
    case 'bigint':
      return minimo
        ? `tiene que ser ${inclusivo ? 'mayor o igual a' : 'mayor a'} ${String(limite)}`
        : `tiene que ser ${inclusivo ? 'menor o igual a' : 'menor a'} ${String(limite)}`;
    case 'string':
      return minimo
        ? Number(limite) === 1
          ? 'no puede estar vacío'
          : `tiene que tener al menos ${String(limite)} caracteres`
        : `tiene que tener como máximo ${String(limite)} caracteres`;
    case 'array':
    case 'set':
      return minimo
        ? `tiene que tener al menos ${String(limite)} ${Number(limite) === 1 ? 'elemento' : 'elementos'}`
        : `tiene que tener como máximo ${String(limite)} elementos`;
    default:
      return minimo ? 'es demasiado chico' : 'es demasiado grande';
  }
}

function describirTipo(issue: Issue, entrada: unknown): string {
  const falta =
    entrada === SIN_ENTRADA
      ? /received undefined$/.test(issue.message)
      : valorEnRuta(entrada, issue.path) === undefined;
  if (falta) return 'es obligatorio';
  return (issue as { expected?: string }).expected === 'number'
    ? 'tiene que ser un número'
    : 'no tiene el tipo esperado';
}

function describirProblema(issue: Issue, entrada: unknown): string {
  if (!MENSAJE_POR_DEFECTO.test(issue.message)) {
    return issue.message;
  }
  switch (issue.code) {
    case 'invalid_type':
      return describirTipo(issue, entrada);
    case 'too_small':
      return describirLimite(issue, true);
    case 'too_big':
      return describirLimite(issue, false);
    case 'invalid_format':
      return (issue as { format?: string }).format === 'email'
        ? 'no es un correo válido'
        : 'no tiene un formato válido';
    case 'invalid_value':
      return 'no es una opción válida';
    case 'unrecognized_keys':
      return `no se esperaba: ${issue.keys.join(', ')}`;
    default:
      return 'no es válido';
  }
}

// `entrada` es lo que se validó (el cuerpo, la query…). Si no se pasa, un
// campo faltante solo se reconoce cuando Zod reporta "received undefined".
export function camposInvalidos(error: ZodError, entrada: unknown = SIN_ENTRADA): CampoInvalido[] {
  return error.issues.map((issue) => ({
    campo: issue.path.map(String).join('.'),
    problema: describirProblema(issue, entrada),
  }));
}

export function mensajeCamposInvalidos(campos: CampoInvalido[]): string {
  if (campos.length === 0) return 'Los datos enviados no son válidos';
  const partes = campos.map((c) => (c.campo ? `${c.campo} (${c.problema})` : c.problema));
  return `Revisá estos campos: ${partes.join(', ')}`;
}
