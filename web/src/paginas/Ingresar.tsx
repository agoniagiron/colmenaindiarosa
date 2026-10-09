import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CampoAcceso } from '../componentes/CampoAcceso.tsx';
import { LayoutAcceso } from '../componentes/LayoutAcceso.tsx';
import * as apiAuth from '../contexto/apiAuth.ts';
import { ErrorAuth } from '../contexto/apiAuth.ts';
import { useAvisos } from '../contexto/ContextoAvisos.tsx';
import { useSesion } from '../contexto/ContextoSesion.tsx';

// Misma lógica que tenía ModalAcceso.tsx en modo 'login' — nada nuevo acá,
// solo una pantalla propia en vez de un modal. ModalAcceso.tsx sigue
// existiendo tal cual (no se tocó), solo que Cuenta.tsx ya no lo abre.
export function Ingresar() {
  const { entrar } = useSesion();
  const navigate = useNavigate();
  const { avisarExito, avisarError } = useAvisos();

  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { accessToken, usuario } = await apiAuth.iniciarSesion(correo, clave);
      entrar(usuario, accessToken);
      avisarExito('Sesión iniciada');
      navigate('/cuenta');
    } catch (excepcion) {
      const mensaje =
        excepcion instanceof ErrorAuth || excepcion instanceof Error
          ? excepcion.message
          : 'No pudimos iniciar sesión';
      setError(mensaje);
      avisarError(mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LayoutAcceso ladoImagen="izquierda">
      <h1 className="font-serif text-3xl text-tinta">Bienvenida de nuevo</h1>
      <p className="mt-2 text-sm text-texto-secundario">
        Inicia sesión para acceder a tu cuenta y pedidos.
      </p>

      <form onSubmit={alEnviar} className="mt-8 flex flex-col gap-4">
        <CampoAcceso
          etiqueta="Correo electrónico"
          type="email"
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
        />

        <CampoAcceso
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          required
          accionEtiqueta={
            <Link
              to="/cuenta/recuperar"
              className="text-sm text-texto-secundario underline-offset-2 hover:text-rosa hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          }
        />

        {error ? (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={enviando}
          className="flex h-12 w-full items-center justify-center rounded-md bg-rosa text-sm font-medium text-white transition-colors hover:bg-rosa/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </button>

        <p className="text-center text-sm text-texto-secundario">
          ¿No tienes una cuenta?{' '}
          <Link to="/registro" className="text-rosa underline-offset-2 hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </form>
    </LayoutAcceso>
  );
}
