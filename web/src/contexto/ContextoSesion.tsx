import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as apiAuth from './apiAuth.ts';
import type { Usuario } from '../tipos/index.ts';

interface ContextoSesionValor {
  usuario: Usuario | null;
  accessToken: string | null;
  // true mientras se intenta restaurar la sesión desde el refresh token al
  // cargar la app; las páginas lo usan para no mostrar "no hay sesión" antes
  // de tiempo.
  restaurando: boolean;
  entrar: (usuario: Usuario, accessToken: string) => void;
  // Actualiza los datos del usuario en la sesión ya activa (p. ej. después
  // de editar el perfil), sin tocar el access token.
  actualizarUsuario: (usuario: Usuario) => void;
  salir: () => void;
}

const ContextoSesion = createContext<ContextoSesionValor | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [restaurando, setRestaurando] = useState(true);

  useEffect(() => {
    let vigente = true;

    (async () => {
      try {
        const { accessToken: token } = await apiAuth.refrescarSesion();
        const usuarioRestaurado = await apiAuth.obtenerYo(token);
        if (!vigente) return;
        setAccessToken(token);
        setUsuario(usuarioRestaurado);
      } catch {
        // No había sesión activa (o expiró): se queda deslogueado, sin error visible.
      } finally {
        if (vigente) setRestaurando(false);
      }
    })();

    return () => {
      vigente = false;
    };
  }, []);

  const entrar = useCallback((usuarioNuevo: Usuario, token: string) => {
    setUsuario(usuarioNuevo);
    setAccessToken(token);
  }, []);

  const actualizarUsuario = useCallback((usuarioNuevo: Usuario) => {
    setUsuario(usuarioNuevo);
  }, []);

  const salir = useCallback(() => {
    apiAuth.cerrarSesion().catch(() => {});
    setUsuario(null);
    setAccessToken(null);
  }, []);

  const valor = useMemo<ContextoSesionValor>(
    () => ({ usuario, accessToken, restaurando, entrar, actualizarUsuario, salir }),
    [usuario, accessToken, restaurando, entrar, actualizarUsuario, salir],
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
