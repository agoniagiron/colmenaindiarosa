import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as apiAuthAdmin from './apiAuthAdmin.ts';
import type { UsuarioAdmin } from './apiAuthAdmin.ts';

// Independiente de ContextoSesion (cliente) a propósito: una persona puede
// tener sesión de clienta y de administradora al mismo tiempo, sin que se
// pisen. Ni el estado ni el almacenamiento (cookie refresh_token_admin,
// distinta de refresh_token) se comparten.
interface ContextoSesionAdminValor {
  usuarioAdmin: UsuarioAdmin | null;
  accessToken: string | null;
  restaurando: boolean;
  entrar: (usuarioAdmin: UsuarioAdmin, accessToken: string) => void;
  salir: () => void;
}

const ContextoSesionAdmin = createContext<ContextoSesionAdminValor | null>(null);

export function ProveedorSesionAdmin({ children }: { children: ReactNode }) {
  const [usuarioAdmin, setUsuarioAdmin] = useState<UsuarioAdmin | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [restaurando, setRestaurando] = useState(true);

  useEffect(() => {
    let vigente = true;

    (async () => {
      try {
        const { accessToken: token } = await apiAuthAdmin.refrescarSesion();
        const perfil = await apiAuthAdmin.obtenerYo(token);
        if (!vigente) return;
        setAccessToken(token);
        setUsuarioAdmin(perfil);
      } catch {
        // Sin sesión administrativa activa: se queda sin sesión, sin error visible.
      } finally {
        if (vigente) setRestaurando(false);
      }
    })();

    return () => {
      vigente = false;
    };
  }, []);

  const entrar = useCallback((nuevo: UsuarioAdmin, token: string) => {
    setUsuarioAdmin(nuevo);
    setAccessToken(token);
  }, []);

  const salir = useCallback(() => {
    apiAuthAdmin.cerrarSesion().catch(() => {});
    setUsuarioAdmin(null);
    setAccessToken(null);
  }, []);

  const valor = useMemo<ContextoSesionAdminValor>(
    () => ({ usuarioAdmin, accessToken, restaurando, entrar, salir }),
    [usuarioAdmin, accessToken, restaurando, entrar, salir],
  );

  return <ContextoSesionAdmin.Provider value={valor}>{children}</ContextoSesionAdmin.Provider>;
}

export function useSesionAdmin(): ContextoSesionAdminValor {
  const contexto = useContext(ContextoSesionAdmin);
  if (!contexto) {
    throw new Error('useSesionAdmin debe usarse dentro de ProveedorSesionAdmin');
  }
  return contexto;
}
