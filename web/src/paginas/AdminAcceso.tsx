import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boton } from '../componentes/Boton.tsx';
import { CampoTexto } from '../componentes/CampoTexto.tsx';
import * as apiAuthAdmin from '../contexto/apiAuthAdmin.ts';
import { useSesionAdmin } from '../contexto/ContextoSesionAdmin.tsx';
import { useNoIndex } from '../utilidades/useNoIndex.ts';

// Mismo contenido que NoEncontrado.tsx a propósito: para quien no tiene
// sesión, esta ruta no debe distinguirse de un 404 real. Debajo se agrega
// un formulario sin título, sin texto que diga "acceso administrativo" y
// sin mensaje de error visible — nada que confirme que hay algo detrás de
// esta URL más allá de dos campos y un botón tan anónimos como el resto
// de la página.
export function AdminAcceso() {
  useNoIndex();
  const navigate = useNavigate();
  const { usuarioAdmin, restaurando, entrar } = useSesionAdmin();

  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!restaurando && usuarioAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [restaurando, usuarioAdmin, navigate]);

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    try {
      const { accessToken, usuarioAdmin: perfil } = await apiAuthAdmin.iniciarSesion(correo, clave);
      entrar(perfil, accessToken);
      navigate('/admin', { replace: true });
    } catch {
      // Sin mensaje visible: ni "correo o contraseña incorrectos" ni
      // ningún otro texto que confirme que el formulario hizo algo.
      setClave('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
      <h1 className="font-serif text-2xl text-tinta">404</h1>
      <p className="text-texto-secundario">Página no encontrada.</p>
      <Boton variante="rosa" onClick={() => navigate('/')}>
        Volver al inicio
      </Boton>

      <form onSubmit={alEnviar} className="mt-10 flex w-full max-w-[14rem] flex-col gap-2">
        <CampoTexto
          etiqueta="Correo"
          ocultarEtiqueta
          type="email"
          autoComplete="off"
          value={correo}
          onChange={(evento) => setCorreo(evento.target.value)}
        />
        <CampoTexto
          etiqueta="Contraseña"
          ocultarEtiqueta
          type="password"
          autoComplete="off"
          value={clave}
          onChange={(evento) => setClave(evento.target.value)}
        />
        <button
          type="submit"
          disabled={enviando}
          className="rounded-xl border border-linea bg-transparent px-3 py-2 text-sm text-texto-secundario transition-colors hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
