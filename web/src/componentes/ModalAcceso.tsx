import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as apiAuth from '../contexto/apiAuth.ts';
import { ErrorAuth } from '../contexto/apiAuth.ts';
import { useAvisos } from '../contexto/ContextoAvisos.tsx';
import { useSesion } from '../contexto/ContextoSesion.tsx';
import { Boton } from './Boton.tsx';
import { CampoTexto } from './CampoTexto.tsx';
import { Modal } from './Modal.tsx';

type Modo = 'login' | 'registro';

const REGEX_CLAVE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

interface ModalAccesoProps {
  abierto: boolean;
  onCerrar: () => void;
}

// Solo para clientes, contra /api/auth/. El acceso administrativo vive en
// una ruta aparte (ver paginas/AdminAcceso.tsx) que no se enlaza desde
// ningún lugar del sitio público, ni siquiera desde este modal.
export function ModalAcceso({ abierto, onCerrar }: ModalAccesoProps) {
  const { entrar } = useSesion();
  const navigate = useNavigate();
  const { avisarExito, avisarError } = useAvisos();

  const [modo, setModo] = useState<Modo>('login');

  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [telefono, setTelefono] = useState('');
  const [aceptoTerminos, setAceptoTerminos] = useState(false);
  const [aceptoTratamiento, setAceptoTratamiento] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reiniciar() {
    setNombre('');
    setCorreo('');
    setClave('');
    setTelefono('');
    setAceptoTerminos(false);
    setAceptoTratamiento(false);
    setError(null);
    setEnviando(false);
    setModo('login');
  }

  function cerrar() {
    reiniciar();
    onCerrar();
  }

  async function iniciarSesionYRedirigir() {
    const { accessToken, usuario } = await apiAuth.iniciarSesion(correo, clave);
    entrar(usuario, accessToken);
    cerrar();
    navigate('/cuenta');
  }

  async function registrarYEntrar() {
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
    await iniciarSesionYRedirigir();
  }

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      if (modo === 'login') {
        await iniciarSesionYRedirigir();
        avisarExito('Sesión iniciada');
      } else {
        await registrarYEntrar();
        avisarExito('Cuenta creada');
      }
    } catch (excepcion) {
      const mensaje =
        excepcion instanceof ErrorAuth || excepcion instanceof Error
          ? excepcion.message
          : 'No pudimos completar la operación';
      setError(mensaje);
      avisarError(mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Acceder a mi cuenta" onCerrar={cerrar}>
      <form onSubmit={alEnviar} className="mt-4 flex flex-col gap-3">
        {modo === 'registro' ? (
          <CampoTexto
            etiqueta="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        ) : null}

        <CampoTexto
          etiqueta="Correo"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
        />

        <CampoTexto
          etiqueta="Contraseña"
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          required
          minLength={8}
        />

        {modo === 'registro' ? (
          <>
            <CampoTexto
              etiqueta="Teléfono (opcional)"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />

            <label className="flex items-start gap-2 text-sm text-texto-secundario">
              <input
                type="checkbox"
                checked={aceptoTerminos}
                onChange={(e) => setAceptoTerminos(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 rounded border-linea text-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
              />
              Acepto los términos y condiciones
            </label>

            <label className="flex items-start gap-2 text-sm text-texto-secundario">
              <input
                type="checkbox"
                checked={aceptoTratamiento}
                onChange={(e) => setAceptoTratamiento(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 rounded border-linea text-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
              />
              Acepto el{' '}
              <Link
                to="/politica-privacidad"
                target="_blank"
                className="underline underline-offset-2 hover:text-rosa"
              >
                tratamiento de mis datos personales
              </Link>
            </label>
          </>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Boton type="submit" variante="rosa" cargando={enviando} className="mt-2">
          {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </Boton>

        {modo === 'login' ? (
          <Link
            to="/cuenta/recuperar"
            onClick={cerrar}
            className="text-center text-sm text-texto-secundario underline-offset-2 hover:text-rosa hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setModo(modo === 'login' ? 'registro' : 'login');
            setError(null);
          }}
          className="text-sm text-rosa underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
        >
          {modo === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>
      </form>
    </Modal>
  );
}
