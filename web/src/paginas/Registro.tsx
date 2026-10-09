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

const REGEX_CLAVE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

// Misma lógica que tenía ModalAcceso.tsx en modo 'registro' (misma regex
// de clave, mismos dos checkboxes obligatorios, mismas llamadas a
// apiAuth) — ModalAcceso.tsx ya no existe, esta es la única pantalla de
// registro ahora.
export function Registro() {
  const { usuario: usuarioActivo, entrar } = useSesion();
  const navigate = useNavigate();
  const { avisarExito, avisarError } = useAvisos();
  const [searchParams] = useSearchParams();
  const destino = destinoSeguro(searchParams.get('regresar'));

  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [telefono, setTelefono] = useState('');
  const [aceptoTerminos, setAceptoTerminos] = useState(false);
  const [aceptoTratamiento, setAceptoTratamiento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ya con sesión activa (p. ej. /cuenta mandó para acá pero la sesión se
  // restauró justo después), /registro no tiene nada que mostrar.
  if (usuarioActivo) {
    return <Navigate to="/cuenta" replace />;
  }

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      if (!REGEX_CLAVE.test(clave)) {
        throw new Error(
          'La contraseña debe tener al menos 8 caracteres, con al menos una letra y un número',
        );
      }
      if (!aceptoTerminos || !aceptoTratamiento) {
        throw new Error(
          'Tenés que aceptar los términos y el tratamiento de datos para crear la cuenta',
        );
      }

      await apiAuth.registrar({
        nombre,
        correo,
        clave,
        telefono: telefono || undefined,
        aceptoTerminos,
        aceptoTratamiento,
      });
      const { accessToken, usuario } = await apiAuth.iniciarSesion(correo, clave);
      entrar(usuario, accessToken);
      avisarExito('Cuenta creada');
      navigate(destino);
    } catch (excepcion) {
      const mensaje =
        excepcion instanceof ErrorAuth || excepcion instanceof Error
          ? excepcion.message
          : 'No pudimos crear la cuenta';
      setError(mensaje);
      avisarError(mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LayoutAcceso ladoImagen="derecha" mostrarMarcaMovil={false}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-tinta">Unirte a India Rosa</h1>
          <p className="mt-2 text-sm text-texto-secundario">
            Crea tu cuenta para guardar tus favoritos y agilizar tus compras.
          </p>
        </div>
        {/* Solo en celular: el formulario completo (4 campos + 2 casillas)
            tapa el link de abajo bajo el pliegue a 390px — quien ya tiene
            cuenta no puede quedar atrapada sin verlo. Desde lg no hace
            falta duplicarlo, el de abajo ya es visible sin scroll. */}
        <Link
          to={`/ingresar?regresar=${encodeURIComponent(destino)}`}
          className="shrink-0 text-xs whitespace-nowrap text-rosa underline-offset-2 hover:underline lg:hidden"
        >
          Iniciá sesión
        </Link>
      </div>

      <form onSubmit={alEnviar} className="mt-8 flex flex-col gap-4">
        <CampoAcceso
          etiqueta="Nombre"
          type="text"
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />

        <CampoAcceso
          etiqueta="Correo"
          type="email"
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
        />

        <CampoAcceso
          etiqueta="Contraseña"
          type="password"
          autoComplete="new-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          required
          minLength={8}
        />

        <CampoAcceso
          etiqueta="Teléfono (opcional)"
          type="tel"
          autoComplete="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />

        <div className="flex flex-col gap-2.5">
          <label className="flex items-start gap-2.5 text-sm text-texto-secundario">
            <input
              type="checkbox"
              checked={aceptoTerminos}
              onChange={(e) => setAceptoTerminos(e.target.checked)}
              required
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-linea text-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
            />
            Acepto los{' '}
            <Link
              to="/terminos-y-condiciones"
              target="_blank"
              className="text-tinta underline underline-offset-2 hover:text-rosa"
            >
              términos y condiciones
            </Link>
          </label>

          <label className="flex items-start gap-2.5 text-sm text-texto-secundario">
            <input
              type="checkbox"
              checked={aceptoTratamiento}
              onChange={(e) => setAceptoTratamiento(e.target.checked)}
              required
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-linea text-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
            />
            Acepto el{' '}
            <Link
              to="/politica-privacidad"
              target="_blank"
              className="text-tinta underline underline-offset-2 hover:text-rosa"
            >
              tratamiento de mis datos personales
            </Link>
          </label>
        </div>

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
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>

        <p className="text-center text-sm text-texto-secundario">
          ¿Ya tenés cuenta?{' '}
          <Link
            to={`/ingresar?regresar=${encodeURIComponent(destino)}`}
            className="text-rosa underline-offset-2 hover:underline"
          >
            Iniciá sesión
          </Link>
        </p>
      </form>
    </LayoutAcceso>
  );
}
