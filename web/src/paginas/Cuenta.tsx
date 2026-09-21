import { useState } from 'react';
import { Boton } from '../componentes/Boton.tsx';
import { ModalAcceso } from '../componentes/ModalAcceso.tsx';
import { useSesion } from '../contexto/ContextoSesion.tsx';

export function Cuenta() {
  const { usuario, restaurando, salir } = useSesion();
  const [modalAbierto, setModalAbierto] = useState(false);

  if (restaurando) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-serif text-2xl text-tinta">Cuenta</h1>
        <p className="mt-4 text-sm text-texto-secundario">Cargando…</p>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-serif text-2xl text-tinta">Cuenta</h1>
        <p className="mt-4 text-sm text-texto-secundario">
          Iniciá sesión para ver los datos de tu cuenta.
        </p>
        <Boton type="button" variante="rosa" className="mt-4" onClick={() => setModalAbierto(true)}>
          Iniciar sesión
        </Boton>
        <ModalAcceso abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-2xl text-tinta">Cuenta</h1>

      <div className="mt-6 max-w-md rounded-2xl border border-linea bg-white p-6">
        <dl className="flex flex-col gap-3 text-sm">
          <div>
            <dt className="text-texto-secundario">Nombre</dt>
            <dd className="text-tinta">{usuario.nombre}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Correo</dt>
            <dd className="text-tinta">{usuario.correo}</dd>
          </div>
          {usuario.telefono ? (
            <div>
              <dt className="text-texto-secundario">Teléfono</dt>
              <dd className="text-tinta">{usuario.telefono}</dd>
            </div>
          ) : null}
        </dl>

        <Boton type="button" variante="fantasma" className="mt-6" onClick={salir}>
          Cerrar sesión
        </Boton>
      </div>
    </div>
  );
}
