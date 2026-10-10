import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { CampoAcceso } from '../componentes/CampoAcceso.tsx';
import { LayoutAcceso } from '../componentes/LayoutAcceso.tsx';
import * as apiAuth from '../contexto/apiAuth.ts';
import { ErrorAuth } from '../contexto/apiAuth.ts';
import { useAvisos } from '../contexto/ContextoAvisos.tsx';
import { useSesion } from '../contexto/ContextoSesion.tsx';
import { destinoSeguro } from '../utilidades/destinoAcceso.ts';

// Misma lógica que tenía el viejo modal de acceso (ya no existe) en modo
// 'login' — nada nuevo acá, solo una pantalla propia en vez de un modal.
export function Ingresar() {
  const { usuario, entrar } = useSesion();
  const navigate = useNavigate();
  const { avisarExito, avisarError } = useAvisos();
  const [searchParams] = useSearchParams();
  const destino = destinoSeguro(searchParams.get('regresar'));

  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ya con sesión activa, /ingresar no tiene nada que mostrar — evita el
  // caso de entrar acá por un link viejo estando logueada. Con `destino`
  // (no un "/cuenta" fijo) a propósito: el mismo re-render dispara justo
  // después de un login recién hecho acá mismo (entrar() actualiza
  // `usuario` antes de que navigate(destino) alcance a tomar efecto), así
  // que si este guard ignorara el regresar, pisaría ese navigate y la
  // visitante volvería siempre a /cuenta sin importar de dónde vino.
  if (usuario) {
    return <Navigate to={destino} replace />;
  }

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { accessToken, usuario: usuarioNuevo } = await apiAuth.iniciarSesion(correo, clave);
      entrar(usuarioNuevo, accessToken);
      avisarExito('Sesión iniciada');
      navigate(destino);
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
    <LayoutAcceso ladoImagen="izquierda" mostrarMarcaMovil={false}>
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
          <Link
            to={`/registro?regresar=${encodeURIComponent(destino)}`}
            className="text-rosa underline-offset-2 hover:underline"
          >
            Regístrate aquí
          </Link>
        </p>
      </form>
    </LayoutAcceso>
  );
}
