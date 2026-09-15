import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Usuario } from '../tipos/index.ts';

interface ContextoSesionValor {
  usuario: Usuario | null;
  entrar: (usuario: Usuario) => void;
  salir: () => void;
}

const ContextoSesion = createContext<ContextoSesionValor | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const entrar = useCallback((usuarioNuevo: Usuario) => {
    setUsuario(usuarioNuevo);
  }, []);

  const salir = useCallback(() => {
    setUsuario(null);
  }, []);

  const valor = useMemo<ContextoSesionValor>(
    () => ({ usuario, entrar, salir }),
    [usuario, entrar, salir],
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): ContextoSesionValor {
  const contexto = useContext(ContextoSesion);
  if (!contexto) {
    throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  }
  return contexto;
}
