import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boton } from '../componentes/Boton.tsx';
import { CampoTexto } from '../componentes/CampoTexto.tsx';
import * as apiAuth from '../contexto/apiAuth.ts';
import { useAvisos } from '../contexto/ContextoAvisos.tsx';

const REGEX_CLAVE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const MENSAJE_CLAVE_INVALIDA =
  'La contraseña debe tener al menos 8 caracteres, con al menos una letra y un número';

export function RecuperarClavePagina() {
  const navigate = useNavigate();
  const { avisarExito, avisarError } = useAvisos();

  const [correo, setCorreo] = useState('');
  const [solicitado, setSolicitado] = useState(false);
  const [cargandoSolicitud, setCargandoSolicitud] = useState(false);
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null);

  const [token, setToken] = useState('');
  const [claveNueva, setClaveNueva] = useState('');
  const [cargandoConfirmacion, setCargandoConfirmacion] = useState(false);
  const [errorConfirmacion, setErrorConfirmacion] = useState<string | null>(null);

  async function alSolicitar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCargandoSolicitud(true);
    setErrorSolicitud(null);
    try {
      await apiAuth.solicitarRecuperacion(correo);
      setSolicitado(true);
      avisarExito('Si el correo existe, te enviamos instrucciones');
    } catch (excepcion) {
      const mensaje =
        excepcion instanceof Error ? excepcion.message : 'No pudimos procesar la solicitud';
      setErrorSolicitud(mensaje);
      avisarError(mensaje);
    } finally {
      setCargandoSolicitud(false);
    }
  }

  async function alConfirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!REGEX_CLAVE.test(claveNueva)) {
      setErrorConfirmacion(MENSAJE_CLAVE_INVALIDA);
      return;
    }
    setCargandoConfirmacion(true);
    setErrorConfirmacion(null);
    try {
      await apiAuth.confirmarRecuperacion(token, claveNueva);
      avisarExito('Contraseña actualizada');
      navigate('/cuenta');
    } catch (excepcion) {
      const mensaje =
        excepcion instanceof Error ? excepcion.message : 'No pudimos actualizar la contraseña';
      setErrorConfirmacion(mensaje);
      avisarError(mensaje);
    } finally {
      setCargandoConfirmacion(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <h1 className="font-serif text-2xl text-tinta">Recuperar contraseña</h1>

      <form onSubmit={alSolicitar} className="mt-6 flex flex-col gap-4">
        <p className="text-sm text-texto-secundario">
          Ingresá tu correo y te enviamos instrucciones para restablecer tu contraseña.
        </p>
        <CampoTexto
          etiqueta="Correo"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
        />
        {errorSolicitud ? <p className="text-sm text-red-600">{errorSolicitud}</p> : null}
        <Boton type="submit" variante="rosa" cargando={cargandoSolicitud} className="self-start">
          Enviar instrucciones
        </Boton>
      </form>

      {solicitado ? (
        <form
          onSubmit={alConfirmar}
          className="mt-8 flex flex-col gap-4 border-t border-linea pt-6"
        >
          <h2 className="font-serif text-lg text-tinta">Ya tenés el código</h2>
          <p className="text-sm text-texto-secundario">
            Revisá el mensaje que te enviamos y pegá el código junto con tu contraseña nueva.
          </p>
          <CampoTexto
            etiqueta="Código"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
          <CampoTexto
            etiqueta="Contraseña nueva"
            type="password"
            value={claveNueva}
            onChange={(e) => setClaveNueva(e.target.value)}
            required
            minLength={8}
          />
          {errorConfirmacion ? <p className="text-sm text-red-600">{errorConfirmacion}</p> : null}
          <Boton
            type="submit"
            variante="rosa"
            cargando={cargandoConfirmacion}
            className="self-start"
          >
            Guardar contraseña nueva
          </Boton>
        </form>
      ) : null}
    </div>
  );
}
