import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Boton } from '../../componentes/Boton.tsx';
import { EsqueletoCarga } from '../../componentes/EsqueletoCarga.tsx';
import { Modal } from '../../componentes/Modal.tsx';
import * as api from '../../contexto/apiLimitadasAdmin.ts';
import type {
  EdicionLimitadaAdmin,
  EstadoEdicionLimitada,
} from '../../contexto/apiLimitadasAdmin.ts';
import * as apiProductos from '../../contexto/apiProductosAdmin.ts';
import { useSesionAdmin } from '../../contexto/ContextoSesionAdmin.tsx';
import { useDebounce } from '../../utilidades/useDebounce.ts';

// Umbral de "pocas unidades restantes" (punto 10): el mismo que muestra
// el mockup — la fila de ejemplo al 25% está marcada en ámbar, la del
// 50% no.
const UMBRAL_POCAS_UNIDADES = 0.25;

const ETIQUETAS_ESTADO: Record<EstadoEdicionLimitada, string> = {
  vigente: 'Vigente',
  programada: 'Programada',
  vencida: 'Vencida',
  agotada: 'Agotada',
  inactiva: 'Inactiva',
};

const CLASES_ESTADO: Record<EstadoEdicionLimitada, string> = {
  vigente: 'bg-verde-luz text-verde',
  programada: 'bg-azul-luz text-azul',
  vencida: 'border border-linea bg-transparent text-texto-secundario/60',
  agotada: 'border border-linea bg-transparent text-texto-secundario/60',
  inactiva: 'border border-linea bg-transparent text-texto-secundario/60',
};

function EstadoBadge({ estado }: { estado: EstadoEdicionLimitada }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[12px] ${CLASES_ESTADO[estado]}`}>
      {ETIQUETAS_ESTADO[estado]}
    </span>
  );
}

function fechaISO(valor: string | Date): string {
  return (valor instanceof Date ? valor : new Date(valor)).toISOString().slice(0, 10);
}

function formatearVigencia(desde: string, hasta: string | null): string {
  const inicio = new Date(desde).toLocaleDateString('es-CO');
  if (!hasta) return `desde ${inicio}`;
  return `${inicio} – ${new Date(hasta).toLocaleDateString('es-CO')}`;
}

// Fila ámbar (pocas unidades) o neutra (agotada/vencida/inactiva), según
// el estado calculado — "vigente"/"programada" se dejan tal cual, sin
// resaltar.
function filaPocasUnidades(edicion: EdicionLimitadaAdmin): boolean {
  if (
    edicion.estado !== 'vigente' ||
    edicion.unidadesLote === null ||
    edicion.unidadesRestantes === null
  ) {
    return false;
  }
  return edicion.unidadesRestantes / edicion.unidadesLote <= UMBRAL_POCAS_UNIDADES;
}

export function AdminLimitadas() {
  const { usuarioAdmin, accessToken } = useSesionAdmin();

  const [listado, setListado] = useState<api.ListadoEdicionesLimitadas | null>(null);
  const [mostrarInactivas, setMostrarInactivas] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [productoObjetivo, setProductoObjetivo] = useState<{ id: string; nombre: string } | null>(
    null,
  );
  const [buscarProducto, setBuscarProducto] = useState('');
  const buscarProductoDiferido = useDebounce(buscarProducto, 400);
  const [resultadosProducto, setResultadosProducto] = useState<{ id: string; nombre: string }[]>(
    [],
  );

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [sinTope, setSinTope] = useState(false);
  const [unidadesLote, setUnidadesLote] = useState('');
  const [mostrarRestantes, setMostrarRestantes] = useState(true);
  const [desde, setDesde] = useState(fechaISO(new Date()));
  const [hasta, setHasta] = useState('');
  const [unidadesVendidasActual, setUnidadesVendidasActual] = useState<number | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [edicionADesactivar, setEdicionADesactivar] = useState<EdicionLimitadaAdmin | null>(null);

  function recargarListado() {
    if (!accessToken) return;
    setListado(null);
    api
      .listarEdiciones(accessToken, { incluirInactivas: mostrarInactivas })
      .then(setListado)
      .catch(() => {
        setListado({
          datos: [],
          paginacion: { pagina: 1, porPagina: 50, total: 0, totalPaginas: 0 },
        });
      });
  }

  useEffect(recargarListado, [accessToken, mostrarInactivas]);

  useEffect(() => {
    if (!accessToken || !buscarProductoDiferido) {
      setResultadosProducto([]);
      return;
    }
    let vigente = true;
    apiProductos
      .listarProductos(accessToken, {
        buscar: buscarProductoDiferido,
        estado: 'publicado',
        porPagina: 10,
      })
      .then((r) => {
        if (vigente) setResultadosProducto(r.datos.map((p) => ({ id: p.id, nombre: p.nombre })));
      })
      .catch(() => {
        if (vigente) setResultadosProducto([]);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, buscarProductoDiferido]);

  if (!usuarioAdmin || !accessToken) return null;
  if (!usuarioAdmin.permisos.includes('limitadas.gestionar')) {
    return <Navigate to="/admin" replace />;
  }
  const token = accessToken;

  function limpiarFormulario() {
    setEditandoId(null);
    setProductoObjetivo(null);
    setBuscarProducto('');
    setResultadosProducto([]);
    setNombre('');
    setDescripcion('');
    setSinTope(false);
    setUnidadesLote('');
    setMostrarRestantes(true);
    setDesde(fechaISO(new Date()));
    setHasta('');
    setUnidadesVendidasActual(null);
    setError(null);
  }

  async function editar(id: string) {
    setError(null);
    try {
      const edicion = await api.obtenerDetalleEdicion(token, id);
      setEditandoId(edicion.id);
      setProductoObjetivo({ id: edicion.producto.id, nombre: edicion.producto.nombre });
      setNombre(edicion.nombre);
      setDescripcion(edicion.descripcion ?? '');
      setSinTope(edicion.unidadesLote === null);
      setUnidadesLote(edicion.unidadesLote !== null ? String(edicion.unidadesLote) : '');
      setMostrarRestantes(edicion.mostrarRestantes);
      setDesde(fechaISO(edicion.desde));
      setHasta(edicion.hasta ? fechaISO(edicion.hasta) : '');
      setUnidadesVendidasActual(edicion.unidadesVendidas);
    } catch (e) {
      setError(e instanceof api.ErrorLimitadasAdmin ? e.message : 'No se pudo cargar la edición');
    }
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    if (!editandoId && !productoObjetivo) {
      setError('Elegí un producto');
      return;
    }
    setGuardando(true);
    try {
      const datosComunes = {
        nombre,
        descripcion: descripcion || null,
        unidadesLote: sinTope ? null : Number(unidadesLote) || null,
        mostrarRestantes,
        desde,
        hasta: hasta || null,
      };
      if (editandoId) {
        await api.editarEdicion(token, editandoId, datosComunes);
      } else {
        await api.crearEdicion(token, { productoId: productoObjetivo!.id, ...datosComunes });
      }
      limpiarFormulario();
      recargarListado();
    } catch (e) {
      setError(e instanceof api.ErrorLimitadasAdmin ? e.message : 'No se pudo guardar la edición');
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarDesactivar() {
    if (!edicionADesactivar) return;
    setError(null);
    try {
      await api.editarEdicion(token, edicionADesactivar.id, { activa: false });
      setEdicionADesactivar(null);
      recargarListado();
    } catch (e) {
      setError(
        e instanceof api.ErrorLimitadasAdmin ? e.message : 'No se pudo desactivar la edición',
      );
      setEdicionADesactivar(null);
    }
  }

  async function reactivar(id: string) {
    setError(null);
    try {
      await api.editarEdicion(token, id, { activa: true });
      recargarListado();
    } catch (e) {
      setError(
        e instanceof api.ErrorLimitadasAdmin ? e.message : 'No se pudo reactivar la edición',
      );
    }
  }

  // Punto 12 + AJUSTE 3: la consecuencia completa, no solo "es menor".
  const nuevoLoteNumerico = sinTope ? null : Number(unidadesLote) || null;
  const avisoLoteBajoVendidas =
    editandoId !== null &&
    unidadesVendidasActual !== null &&
    nuevoLoteNumerico !== null &&
    nuevoLoteNumerico < unidadesVendidasActual;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[28px] text-tinta">Ediciones limitadas</h1>
          <p className="mt-1.5 text-sm text-texto-secundario">
            {listado ? `${listado.paginacion.total} ediciones` : 'Cargando…'}
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-tinta">
        <input
          type="checkbox"
          checked={mostrarInactivas}
          onChange={(e) => setMostrarInactivas(e.target.checked)}
          className="h-4 w-4 rounded border-linea"
        />
        Mostrar también las inactivas
      </label>

      <section className="overflow-x-auto rounded-lg border border-linea bg-arena">
        {listado === null ? (
          <div className="flex flex-col gap-2.5 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <EsqueletoCarga key={i} alto="h-10" />
            ))}
          </div>
        ) : listado.datos.length === 0 ? (
          <p className="p-8 text-center text-sm text-texto-secundario">
            Todavía no hay ninguna edición limitada.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11.5px] tracking-wide text-texto-secundario uppercase">
                <th className="px-4 py-3" colSpan={2}>
                  Producto
                </th>
                <th className="px-4 py-3">Colección</th>
                <th className="px-4 py-3 text-right">Lote</th>
                <th className="px-4 py-3 text-right">Vendidas</th>
                <th className="px-4 py-3 text-right">Restantes</th>
                <th className="px-4 py-3">Avance</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {listado.datos.map((edicion) => {
                const pocasUnidades = filaPocasUnidades(edicion);
                const avance =
                  edicion.unidadesLote !== null && edicion.unidadesLote > 0
                    ? Math.min(
                        100,
                        Math.round(((edicion.unidadesRestantes ?? 0) / edicion.unidadesLote) * 100),
                      )
                    : null;
                return (
                  <tr
                    key={edicion.id}
                    className={`border-t border-linea bg-hueso hover:bg-arena ${
                      pocasUnidades ? 'bg-ambar-luz' : ''
                    } ${!edicion.activa ? 'opacity-60' : ''}`}
                  >
                    <td className="w-12 px-4 py-3">
                      {edicion.producto.imagen ? (
                        <img
                          src={edicion.producto.imagen.url}
                          alt=""
                          className="h-11 w-9 rounded object-cover"
                        />
                      ) : (
                        <span aria-hidden="true" className="block h-11 w-9 rounded bg-arena" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-tinta">{edicion.producto.nombre}</td>
                    <td className="px-4 py-3 text-texto-secundario">{edicion.nombre}</td>
                    <td className="px-4 py-3 text-right">{edicion.unidadesLote ?? 'sin tope'}</td>
                    <td className="px-4 py-3 text-right">{edicion.unidadesVendidas}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {edicion.unidadesRestantes ?? 'sin tope'}
                    </td>
                    <td className="px-4 py-3">
                      {avance !== null ? (
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-linea">
                          <div
                            className={`h-full rounded-full ${pocasUnidades ? 'bg-ambar' : 'bg-rosa'}`}
                            style={{ width: `${avance}%` }}
                          />
                        </div>
                      ) : (
                        <span className="text-texto-secundario">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-texto-secundario">
                      {formatearVigencia(edicion.desde, edicion.hasta)}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={edicion.estado} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Boton
                        type="button"
                        variante="fantasma"
                        onClick={() => void editar(edicion.id)}
                      >
                        Editar
                      </Boton>
                      {edicion.activa ? (
                        <Boton
                          type="button"
                          variante="fantasma"
                          className="ml-2"
                          onClick={() => setEdicionADesactivar(edicion)}
                        >
                          Desactivar
                        </Boton>
                      ) : (
                        <Boton
                          type="button"
                          variante="fantasma"
                          className="ml-2"
                          onClick={() => void reactivar(edicion.id)}
                        >
                          Reactivar
                        </Boton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-linea bg-arena p-5">
        <h2 className="font-serif text-lg text-tinta">
          {editandoId ? 'Editar edición limitada' : 'Nueva edición limitada'}
        </h2>
        <form onSubmit={guardar} className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1 text-sm text-tinta md:col-span-2">
            Producto
            {editandoId ? (
              <p className="rounded-xl border border-linea bg-white px-3 py-2 text-texto-secundario">
                {productoObjetivo?.nombre} (no se puede cambiar una vez creada)
              </p>
            ) : productoObjetivo ? (
              <div className="flex items-center justify-between rounded-xl border border-linea bg-white px-3 py-2">
                <span>{productoObjetivo.nombre}</span>
                <button
                  type="button"
                  onClick={() => setProductoObjetivo(null)}
                  className="text-rosa hover:underline"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <>
                <input
                  value={buscarProducto}
                  onChange={(e) => setBuscarProducto(e.target.value)}
                  placeholder="Buscar producto publicado por nombre"
                  className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                />
                {resultadosProducto.length > 0 ? (
                  <ul className="flex flex-col gap-1 rounded-xl border border-linea bg-white p-2">
                    {resultadosProducto.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setProductoObjetivo(p);
                            setBuscarProducto('');
                            setResultadosProducto([]);
                          }}
                          className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-arena"
                        >
                          {p.nombre}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <span className="text-[11.5px] text-texto-secundario">
                  Solo aparecen productos publicados: uno archivado o solo en kits no puede anunciar
                  un lote.
                </span>
              </>
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm text-tinta">
            Nombre de la colección
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-tinta">
            Descripción
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
            />
          </label>

          <div className="flex flex-col gap-1 text-sm text-tinta">
            Tamaño del lote
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={unidadesLote}
                onChange={(e) => setUnidadesLote(e.target.value)}
                disabled={sinTope}
                className="w-28 rounded-xl border border-linea bg-white px-3 py-2 text-sm disabled:opacity-50"
              />
              <label className="flex items-center gap-1.5 text-[13px] text-texto-secundario">
                <input
                  type="checkbox"
                  checked={sinTope}
                  onChange={(e) => setSinTope(e.target.checked)}
                  className="h-4 w-4 rounded border-linea"
                />
                Sin tope (solo por fecha)
              </label>
            </div>
            {unidadesVendidasActual !== null ? (
              <span className="text-[11.5px] text-texto-secundario">
                Lleva {unidadesVendidasActual}{' '}
                {unidadesVendidasActual === 1 ? 'unidad' : 'unidades'} vendidas.
              </span>
            ) : null}
            {avisoLoteBajoVendidas ? (
              <p className="rounded-lg border-l-3 border-ambar bg-ambar-luz p-2.5 text-[12.5px] text-ambar">
                Si el lote nuevo queda por debajo de las unidades ya vendidas, la edición pasa a
                agotada y desaparece de la tienda de inmediato.
              </p>
            ) : null}
          </div>

          <label className="flex items-center gap-2 pt-6 text-sm text-tinta">
            <input
              type="checkbox"
              checked={mostrarRestantes}
              onChange={(e) => setMostrarRestantes(e.target.checked)}
              className="h-4 w-4 rounded border-linea"
            />
            Mostrar las unidades restantes en la tienda
          </label>

          <label className="flex flex-col gap-1 text-sm text-tinta">
            Desde
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              required
              className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-tinta">
            Hasta
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
            />
            <span className="text-[11.5px] text-texto-secundario">Vacío = indefinida</span>
          </label>

          {error ? <p className="text-sm text-rosa md:col-span-2">{error}</p> : null}
          <div className="flex gap-2 md:col-span-2">
            <Boton type="submit" disabled={guardando}>
              {editandoId ? 'Guardar cambios' : 'Crear edición'}
            </Boton>
            {editandoId ? (
              <Boton type="button" variante="fantasma" onClick={limpiarFormulario}>
                Cancelar
              </Boton>
            ) : null}
          </div>
        </form>
      </section>

      <Modal
        abierto={edicionADesactivar !== null}
        titulo="Desactivar edición limitada"
        onCerrar={() => setEdicionADesactivar(null)}
      >
        <p className="text-sm text-tinta">
          "{edicionADesactivar?.nombre}" deja de aparecer en la tienda, pero el registro del lote y
          de lo vendido se conserva — podés reactivarla después si hace falta.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={() => setEdicionADesactivar(null)}>
            Cancelar
          </Boton>
          <Boton type="button" onClick={() => void confirmarDesactivar()}>
            Desactivar
          </Boton>
        </div>
      </Modal>
    </div>
  );
}
