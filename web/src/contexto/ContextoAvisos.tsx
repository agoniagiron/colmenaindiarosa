import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type TipoAviso = 'exito' | 'error';

interface Aviso {
  id: number;
  tipo: TipoAviso;
  mensaje: string;
}

interface ContextoAvisosValor {
  avisarExito: (mensaje: string) => void;
  avisarError: (mensaje: string) => void;
}

const DURACION_MS = 4000;

const ContextoAvisos = createContext<ContextoAvisosValor | null>(null);

// Avisos breves (verde éxito, rosa error) que se muestran una vez y se
// borran solos. No reemplazan mensajes de error que necesitan quedarse en
// pantalla con una acción propia (p. ej. el banner de cupón inválido del
// checkout): son para confirmaciones y errores puntuales de una acción.
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const contador = useRef(0);

  const quitar = useCallback((id: number) => {
    setAvisos((actuales) => actuales.filter((aviso) => aviso.id !== id));
  }, []);

  const agregar = useCallback(
    (tipo: TipoAviso, mensaje: string) => {
      const id = ++contador.current;
      setAvisos((actuales) => [...actuales, { id, tipo, mensaje }]);
      setTimeout(() => quitar(id), DURACION_MS);
    },
    [quitar],
  );

  const valor = useMemo<ContextoAvisosValor>(
    () => ({
      avisarExito: (mensaje: string) => agregar('exito', mensaje),
      avisarError: (mensaje: string) => agregar('error', mensaje),
    }),
    [agregar],
  );

  return (
    <ContextoAvisos.Provider value={valor}>
      {children}
      <ListaAvisos avisos={avisos} onCerrar={quitar} />
    </ContextoAvisos.Provider>
  );
}

export function useAvisos(): ContextoAvisosValor {
  const contexto = useContext(ContextoAvisos);
  if (!contexto) {
    throw new Error('useAvisos debe usarse dentro de ProveedorAvisos');
  }
  return contexto;
}

function ListaAvisos({ avisos, onCerrar }: { avisos: Aviso[]; onCerrar: (id: number) => void }) {
  if (avisos.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-md ${
            aviso.tipo === 'exito' ? 'bg-whatsapp text-hueso' : 'bg-rosa text-hueso'
          }`}
        >
          {aviso.mensaje}
          <button
            type="button"
            onClick={() => onCerrar(aviso.id)}
            aria-label="Cerrar aviso"
            className="rounded-full text-hueso/80 hover:text-hueso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hueso"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
