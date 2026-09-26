import { useCallback, useState } from 'react';
import { useAvisos } from '../contexto/ContextoAvisos.tsx';

interface OpcionesAccionAsincrona {
  // Si viene, se muestra como aviso verde cuando la acción termina bien.
  mensajeExito?: string;
  // Por defecto, un error muestra un aviso rosa con error.message. Se puede
  // apagar cuando el propio componente ya va a mostrar el error de otra
  // forma (p. ej. un banner persistente con una acción propia).
  avisarErrores?: boolean;
}

interface UseAccionAsincrona<Args extends unknown[], T> {
  cargando: boolean;
  // Último mensaje de error de esta acción (se limpia en cada ejecución
  // nueva). No hace falta usarlo si ya alcanza con el aviso.
  error: string | null;
  // Relanza el error después de manejarlo, para que el que llama pueda
  // hacer su propio try/catch cuando necesite inspeccionar el error
  // original (p. ej. un código de error específico).
  ejecutar: (...args: Args) => Promise<T>;
}

const MENSAJE_GENERICO = 'Algo salió mal. Intentá de nuevo.';

// Hook propio (el proyecto no tiene TanStack Query instalado todavía): un
// solo lugar donde se manejan cargando, éxito y error para cualquier
// acción asíncrona de la tienda del cliente.
export function useAccionAsincrona<Args extends unknown[], T>(
  accion: (...args: Args) => Promise<T>,
  opciones: OpcionesAccionAsincrona = {},
): UseAccionAsincrona<Args, T> {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { avisarExito, avisarError } = useAvisos();
  const { mensajeExito, avisarErrores = true } = opciones;

  const ejecutar = useCallback(
    async (...args: Args): Promise<T> => {
      setCargando(true);
      setError(null);
      try {
        const resultado = await accion(...args);
        if (mensajeExito) avisarExito(mensajeExito);
        return resultado;
      } catch (excepcion) {
        const mensaje = excepcion instanceof Error ? excepcion.message : MENSAJE_GENERICO;
        setError(mensaje);
        if (avisarErrores) avisarError(mensaje);
        throw excepcion;
      } finally {
        setCargando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accion, mensajeExito, avisarErrores],
  );

  return { cargando, error, ejecutar };
}
