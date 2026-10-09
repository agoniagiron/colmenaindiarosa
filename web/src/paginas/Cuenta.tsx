import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Boton } from '../componentes/Boton.tsx';
import { CampoTexto } from '../componentes/CampoTexto.tsx';
import { Contenedor } from '../componentes/Contenedor.tsx';
import * as apiAuth from '../contexto/apiAuth.ts';
import * as apiCuenta from '../contexto/apiCuenta.ts';
import type { DatosDireccion, DireccionApi } from '../contexto/apiCuenta.ts';
import { useAvisos } from '../contexto/ContextoAvisos.tsx';
import { useSesion } from '../contexto/ContextoSesion.tsx';
import type { Usuario } from '../tipos/index.ts';
import { useAccionAsincrona } from '../utilidades/useAccionAsincrona.ts';

export function Cuenta() {
  const { usuario, accessToken, restaurando, actualizarUsuario, salir } = useSesion();
  const { avisarExito } = useAvisos();
  const [cerrando, setCerrando] = useState(false);

  if (restaurando) {
    return (
      <Contenedor ancho="normal" className="py-10">
        <h1 className="font-serif text-2xl text-tinta">Cuenta</h1>
        <p className="mt-4 text-sm text-texto-secundario">Cargando…</p>
      </Contenedor>
    );
  }

  // Sin sesión, /cuenta no se muestra: manda directo a crear cuenta (no al
  // login — ver el pedido), con `replace` para que "atrás" no vuelva acá y
  // rebote de nuevo. El ?regresar= le dice a /registro adónde volver
  // cuando termine; si la clienta ya tiene cuenta, el propio /registro
  // tiene el link a /ingresar y conserva ese mismo parámetro.
  if (!usuario || !accessToken) {
    return <Navigate to="/registro?regresar=/cuenta" replace />;
  }

  function alCerrarSesion() {
    setCerrando(true);
    salir();
    avisarExito('Sesión cerrada');
  }

  return (
    <Contenedor ancho="normal" className="py-10">
      <h1 className="font-serif text-2xl text-tinta">Cuenta</h1>

      <div className="mt-6 max-w-md rounded-2xl border border-linea bg-white p-6">
        <h2 className="font-serif text-lg text-tinta">Tus datos</h2>
        <SeccionPerfil
          usuario={usuario}
          accessToken={accessToken}
          onActualizado={actualizarUsuario}
        />

        <Boton
          type="button"
          variante="fantasma"
          className="mt-6"
          cargando={cerrando}
          onClick={alCerrarSesion}
        >
          Cerrar sesión
        </Boton>
      </div>

      <SeccionDirecciones accessToken={accessToken} />
    </Contenedor>
  );
}

// --- Perfil ---------------------------------------------------------------

function SeccionPerfil({
  usuario,
  accessToken,
  onActualizado,
}: {
  usuario: Usuario;
  accessToken: string;
  onActualizado: (usuario: Usuario) => void;
}) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [telefono, setTelefono] = useState(usuario.telefono ?? '');

  const { cargando, ejecutar } = useAccionAsincrona(
    (datos: apiAuth.DatosActualizarPerfil) => apiAuth.actualizarPerfil(accessToken, datos),
    { mensajeExito: 'Perfil actualizado' },
  );

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    try {
      const actualizado = await ejecutar({ nombre, telefono: telefono || undefined });
      onActualizado(actualizado);
    } catch {
      // El hook ya mostró el aviso de error.
    }
  }

  return (
    <form onSubmit={alEnviar} className="mt-4 flex flex-col gap-3">
      <CampoTexto
        etiqueta="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        required
      />
      <p className="text-sm text-texto-secundario">Correo: {usuario.correo}</p>
      <CampoTexto
        etiqueta="Teléfono"
        type="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
      />
      <Boton type="submit" variante="rosa" cargando={cargando} className="self-start">
        Guardar cambios
      </Boton>
    </form>
  );
}

// --- Direcciones ------------------------------------------------------------

function SeccionDirecciones({ accessToken }: { accessToken: string }) {
  const [direcciones, setDirecciones] = useState<DireccionApi[] | null>(null);
  const [mostrarFormularioNuevo, setMostrarFormularioNuevo] = useState(false);
  const [idEditando, setIdEditando] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    apiCuenta.listarDirecciones(accessToken).then((lista) => {
      if (vigente) setDirecciones(lista);
    });
    return () => {
      vigente = false;
    };
  }, [accessToken]);

  function alGuardar(direccion: DireccionApi) {
    setDirecciones((actuales) => {
      const base = actuales ?? [];
      const existe = base.some((d) => d.id === direccion.id);
      return existe
        ? base.map((d) => (d.id === direccion.id ? direccion : d))
        : [...base, direccion];
    });
    setMostrarFormularioNuevo(false);
    setIdEditando(null);
  }

  function alEliminar(id: string) {
    setDirecciones((actuales) => actuales?.filter((d) => d.id !== id) ?? actuales);
    setIdEditando((actual) => (actual === id ? null : actual));
  }

  return (
    <section className="mt-8 max-w-md rounded-2xl border border-linea bg-white p-6">
      <h2 className="font-serif text-lg text-tinta">Direcciones guardadas</h2>

      {direcciones === null ? (
        <p className="mt-3 text-sm text-texto-secundario">Cargando…</p>
      ) : direcciones.length === 0 && !mostrarFormularioNuevo ? (
        <p className="mt-3 text-sm text-texto-secundario">
          Todavía no guardaste ninguna dirección.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {(direcciones ?? []).map((direccion) =>
            idEditando === direccion.id ? (
              <li key={direccion.id}>
                <FormularioDireccion
                  accessToken={accessToken}
                  direccion={direccion}
                  onGuardado={alGuardar}
                  onCancelar={() => setIdEditando(null)}
                />
              </li>
            ) : (
              <FilaDireccion
                key={direccion.id}
                direccion={direccion}
                accessToken={accessToken}
                onEditar={() => setIdEditando(direccion.id)}
                onEliminada={() => alEliminar(direccion.id)}
              />
            ),
          )}
        </ul>
      )}

      {mostrarFormularioNuevo ? (
        <div className="mt-4">
          <FormularioDireccion
            accessToken={accessToken}
            onGuardado={alGuardar}
            onCancelar={() => setMostrarFormularioNuevo(false)}
          />
        </div>
      ) : (
        <Boton
          type="button"
          variante="fantasma"
          className="mt-4"
          onClick={() => setMostrarFormularioNuevo(true)}
        >
          Agregar dirección
        </Boton>
      )}
    </section>
  );
}

function FilaDireccion({
  direccion,
  accessToken,
  onEditar,
  onEliminada,
}: {
  direccion: DireccionApi;
  accessToken: string;
  onEditar: () => void;
  onEliminada: () => void;
}) {
  const { cargando: eliminando, ejecutar: ejecutarEliminar } = useAccionAsincrona(
    () => apiCuenta.eliminarDireccion(accessToken, direccion.id),
    { mensajeExito: 'Dirección eliminada' },
  );

  async function alEliminar() {
    try {
      await ejecutarEliminar();
      onEliminada();
    } catch {
      // El hook ya mostró el aviso de error.
    }
  }

  return (
    <li className="rounded-lg border border-linea p-4 text-sm">
      {direccion.etiqueta ? <p className="font-medium text-tinta">{direccion.etiqueta}</p> : null}
      <p className="text-tinta">
        {direccion.nombreRecibe} · {direccion.telefono}
      </p>
      <p className="text-texto-secundario">
        {direccion.direccion}
        {direccion.complemento ? `, ${direccion.complemento}` : ''}
      </p>
      <p className="text-texto-secundario">
        {direccion.ciudad}, {direccion.departamento}
      </p>
      {direccion.esPrincipal ? <p className="mt-1 text-xs text-rosa">Principal</p> : null}

      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={onEditar}
          disabled={eliminando}
          className="rounded-md text-sm text-rosa underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-50"
        >
          Editar
        </button>
        <Boton
          type="button"
          variante="fantasma"
          cargando={eliminando}
          onClick={alEliminar}
          className="px-3 py-1 text-xs"
        >
          Eliminar
        </Boton>
      </div>
    </li>
  );
}

function FormularioDireccion({
  accessToken,
  direccion,
  onGuardado,
  onCancelar,
}: {
  accessToken: string;
  direccion?: DireccionApi;
  onGuardado: (direccion: DireccionApi) => void;
  onCancelar: () => void;
}) {
  const [etiqueta, setEtiqueta] = useState(direccion?.etiqueta ?? '');
  const [nombreRecibe, setNombreRecibe] = useState(direccion?.nombreRecibe ?? '');
  const [telefono, setTelefono] = useState(direccion?.telefono ?? '');
  const [departamento, setDepartamento] = useState(direccion?.departamento ?? '');
  const [ciudad, setCiudad] = useState(direccion?.ciudad ?? '');
  const [direccionTexto, setDireccionTexto] = useState(direccion?.direccion ?? '');
  const [complemento, setComplemento] = useState(direccion?.complemento ?? '');
  const [esPrincipal, setEsPrincipal] = useState(direccion?.esPrincipal ?? false);

  const guardar = direccion
    ? (datos: DatosDireccion) => apiCuenta.actualizarDireccion(accessToken, direccion.id, datos)
    : (datos: DatosDireccion) => apiCuenta.crearDireccion(accessToken, datos);

  const { cargando, ejecutar } = useAccionAsincrona(guardar, {
    mensajeExito: direccion ? 'Dirección actualizada' : 'Dirección guardada',
  });

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    try {
      const guardada = await ejecutar({
        etiqueta: etiqueta || undefined,
        nombreRecibe,
        telefono,
        departamento,
        ciudad,
        direccion: direccionTexto,
        complemento: complemento || undefined,
        esPrincipal,
      });
      onGuardado(guardada);
    } catch {
      // El hook ya mostró el aviso de error.
    }
  }

  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-3 rounded-lg border border-linea p-4">
      <CampoTexto
        etiqueta="Etiqueta (opcional)"
        value={etiqueta}
        onChange={(e) => setEtiqueta(e.target.value)}
      />
      <CampoTexto
        etiqueta="Nombre de quien recibe"
        value={nombreRecibe}
        onChange={(e) => setNombreRecibe(e.target.value)}
        required
      />
      <CampoTexto
        etiqueta="Teléfono"
        type="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        required
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto
          etiqueta="Departamento"
          value={departamento}
          onChange={(e) => setDepartamento(e.target.value)}
          required
        />
        <CampoTexto
          etiqueta="Ciudad"
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value)}
          required
        />
      </div>
      <CampoTexto
        etiqueta="Dirección"
        value={direccionTexto}
        onChange={(e) => setDireccionTexto(e.target.value)}
        required
      />
      <CampoTexto
        etiqueta="Complemento (opcional)"
        value={complemento}
        onChange={(e) => setComplemento(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm text-texto-secundario">
        <input
          type="checkbox"
          checked={esPrincipal}
          onChange={(e) => setEsPrincipal(e.target.checked)}
          className="h-4 w-4 rounded border-linea text-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
        />
        Usar como dirección principal
      </label>
      <div className="mt-1 flex gap-3">
        <Boton type="submit" variante="rosa" cargando={cargando}>
          Guardar
        </Boton>
        <Boton type="button" variante="fantasma" disabled={cargando} onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
