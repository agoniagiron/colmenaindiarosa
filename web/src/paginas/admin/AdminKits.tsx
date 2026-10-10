import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Boton } from '../../componentes/Boton.tsx';
import { EsqueletoCarga } from '../../componentes/EsqueletoCarga.tsx';
import * as api from '../../contexto/apiCombosAdmin.ts';
import { PestanaImagenesCombo } from './PestanaImagenesCombo.tsx';
import type {
  DatosItemKit,
  FilaKitAdmin,
  KitDetalle,
  ResumenKit,
  VarianteBuscada,
} from '../../contexto/apiCombosAdmin.ts';
import { useSesionAdmin } from '../../contexto/ContextoSesionAdmin.tsx';
import { useDebounce } from '../../utilidades/useDebounce.ts';
import { formatearPesos } from '../../utilidades/formatearPesos.ts';

function fechaISO(valor: string | Date): string {
  return (valor instanceof Date ? valor : new Date(valor)).toISOString().slice(0, 10);
}

function PillPorcentaje({ valor, bajo }: { valor: number; bajo: boolean }) {
  const clase = bajo ? 'bg-ambar-luz text-ambar' : 'bg-verde-luz text-verde';
  return <span className={`rounded-full px-2.5 py-0.5 text-[12px] ${clase}`}>{valor}%</span>;
}

function PillDisponibilidad({ kit }: { kit: Pick<ResumenKit, 'disponible' | 'piezaSinStock'> }) {
  if (kit.disponible) {
    return (
      <span className="rounded-full bg-verde-luz px-2.5 py-0.5 text-[12px] text-verde">
        Disponible
      </span>
    );
  }
  return (
    <span className="rounded-full bg-ambar-luz px-2.5 py-0.5 text-[12px] text-ambar">
      Sin stock: {kit.piezaSinStock}
    </span>
  );
}

// Piezas en el formulario: la pieza completa (precio, costo, nombre) se
// guarda al agregarla, no solo el id — así el resumen vivo no tiene que
// re-pedir cada variante para mostrar el detalle de la tabla de piezas.
interface PiezaFormulario {
  varianteId: string;
  sku: string;
  nombreProducto: string;
  colorNombre: string | null;
  colorHex: string | null;
  cantidad: number;
  precioUnitario: number;
}

function piezaDesdeBusqueda(v: VarianteBuscada): PiezaFormulario {
  return {
    varianteId: v.id,
    sku: v.sku,
    nombreProducto: v.nombreProducto,
    colorNombre: v.color?.nombre ?? null,
    colorHex: v.color?.hex ?? null,
    cantidad: 1,
    precioUnitario: v.precioActual,
  };
}

function piezaDesdeDetalle(item: KitDetalle['items'][number]): PiezaFormulario {
  return {
    varianteId: item.varianteId,
    sku: item.sku,
    nombreProducto: item.nombreProducto,
    colorNombre: item.color?.nombre ?? null,
    colorHex: item.color?.hex ?? null,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario,
  };
}

export function AdminKits() {
  const { usuarioAdmin, accessToken } = useSesionAdmin();
  const [searchParams, setSearchParams] = useSearchParams();

  const [listado, setListado] = useState<api.ListadoKits | null>(null);
  const buscarListado = searchParams.get('buscar') ?? '';
  const pagina = Math.max(1, Number(searchParams.get('pagina')) || 1);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precioCop, setPrecioCop] = useState('');
  const [precioUsd, setPrecioUsd] = useState('');
  const [vigenteDesde, setVigenteDesde] = useState(fechaISO(new Date()));
  const [vigenteHasta, setVigenteHasta] = useState('');
  const [piezas, setPiezas] = useState<PiezaFormulario[]>([]);

  const [buscarPieza, setBuscarPieza] = useState('');
  const buscarPiezaDiferido = useDebounce(buscarPieza, 400);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<VarianteBuscada[]>([]);

  const [resumen, setResumen] = useState<ResumenKit | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detalle completo solo para la sección de fotos (necesita el id del
  // kit y su arreglo de imágenes, que el resto del formulario no usa).
  // null mientras se crea un kit nuevo (todavía sin id) o mientras se
  // carga el detalle al editar uno existente.
  const [kitParaImagenes, setKitParaImagenes] = useState<KitDetalle | null>(null);

  function recargarListado() {
    if (!accessToken) return;
    setListado(null);
    api
      .listarKits(accessToken, { buscar: buscarListado || undefined, pagina })
      .then(setListado)
      .catch(() => {
        setListado({
          datos: [],
          paginacion: { pagina: 1, porPagina: 20, total: 0, totalPaginas: 0 },
        });
      });
  }

  useEffect(recargarListado, [accessToken, buscarListado, pagina]);

  // Buscador de variantes: igual patrón que el buscar de AdminProductos,
  // debounced, y vacío si no se escribió nada.
  useEffect(() => {
    if (!accessToken || !buscarPiezaDiferido) {
      setResultadosBusqueda([]);
      return;
    }
    let vigente = true;
    api
      .buscarVariantes(accessToken, buscarPiezaDiferido)
      .then((r) => {
        if (vigente) setResultadosBusqueda(r);
      })
      .catch(() => {
        if (vigente) setResultadosBusqueda([]);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, buscarPiezaDiferido]);

  // Resumen vivo (punto 12): se lo pide al backend cada vez que cambian
  // las piezas o el precio — nunca se recalcula el margen acá (ver
  // calcularResumenKit en servicio.ts, la única fuente).
  useEffect(() => {
    const precio = Number(precioCop);
    if (!accessToken || piezas.length === 0 || !precio || precio <= 0) {
      setResumen(null);
      return;
    }
    let vigente = true;
    api
      .previsualizarKit(accessToken, {
        precioCop: precio,
        items: piezas.map((p) => ({ varianteId: p.varianteId, cantidad: p.cantidad })),
      })
      .then((r) => {
        if (vigente) setResumen(r);
      })
      .catch(() => {
        if (vigente) setResumen(null);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, precioCop, piezas]);

  if (!usuarioAdmin || !accessToken) return null;
  if (!usuarioAdmin.permisos.includes('combos.ver')) {
    return <Navigate to="/admin" replace />;
  }
  // Las funciones de abajo son declaraciones (quedan izadas), así que
  // TypeScript no arrastra el angostamiento de la guarda de arriba hacia
  // adentro — de ahí esta constante aparte en vez de seguir usando
  // accessToken directo.
  const token = accessToken;
  const puedeGestionar = usuarioAdmin.permisos.includes('combos.gestionar');

  function limpiarFormulario() {
    setEditandoId(null);
    setNombre('');
    setDescripcion('');
    setPrecioCop('');
    setPrecioUsd('');
    setVigenteDesde(fechaISO(new Date()));
    setVigenteHasta('');
    setPiezas([]);
    setBuscarPieza('');
    setResultadosBusqueda([]);
    setError(null);
    setKitParaImagenes(null);
  }

  async function editar(id: string) {
    setError(null);
    try {
      const kit = await api.obtenerDetalleKit(token, id);
      setEditandoId(kit.id);
      setNombre(kit.nombre);
      setDescripcion(kit.descripcion ?? '');
      setPrecioCop(String(kit.precioCop));
      setPrecioUsd(kit.precioUsd ? String(kit.precioUsd) : '');
      setVigenteDesde(fechaISO(kit.vigenteDesde));
      setVigenteHasta(kit.vigenteHasta ? fechaISO(kit.vigenteHasta) : '');
      setPiezas(kit.items.map(piezaDesdeDetalle));
      setKitParaImagenes(kit);
    } catch (e) {
      setError(e instanceof api.ErrorKitsAdmin ? e.message : 'No se pudo cargar el kit');
    }
  }

  // Vuelve a pedir el detalle del kit después de subir, reordenar o
  // eliminar una foto: PestanaImagenesCombo no trae su propio estado de
  // "imágenes guardadas", depende de que el padre se lo pase actualizado
  // (mismo patrón que AdminKitDetalle.tsx).
  async function recargarImagenesKit() {
    if (!editandoId) return;
    try {
      const kit = await api.obtenerDetalleKit(token, editandoId);
      setKitParaImagenes(kit);
    } catch {
      // Falla silenciosa: la próxima acción sobre una imagen vuelve a
      // intentar recargar. No hay un lugar natural en esta sección para
      // mostrar un error aparte del de cada operación.
    }
  }

  function agregarPieza(variante: VarianteBuscada) {
    if (piezas.some((p) => p.varianteId === variante.id)) return;
    setPiezas((actual) => [...actual, piezaDesdeBusqueda(variante)]);
    setBuscarPieza('');
    setResultadosBusqueda([]);
  }

  function quitarPieza(varianteId: string) {
    setPiezas((actual) => actual.filter((p) => p.varianteId !== varianteId));
  }

  function cambiarCantidad(varianteId: string, cantidad: number) {
    setPiezas((actual) =>
      actual.map((p) =>
        p.varianteId === varianteId ? { ...p, cantidad: Math.max(1, cantidad) } : p,
      ),
    );
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    if (piezas.length < 2) {
      setError('Un kit necesita al menos dos piezas');
      return;
    }
    setGuardando(true);
    try {
      const datos = {
        nombre,
        descripcion: descripcion || null,
        precioCop: Number(precioCop),
        precioUsd: precioUsd ? Number(precioUsd) : null,
        items: piezas.map<DatosItemKit>((p) => ({
          varianteId: p.varianteId,
          cantidad: p.cantidad,
        })),
        vigenteDesde,
        vigenteHasta: vigenteHasta || null,
      };
      if (editandoId) {
        await api.editarKit(token, editandoId, datos);
        limpiarFormulario();
      } else {
        // No se limpia el formulario ni se vuelve a la lista: el kit
        // recién creado necesita su id para la sección de fotos de abajo,
        // así que el formulario queda abierto, ya en modo edición, para
        // poder seguir de corrido sin buscar el kit otra vez.
        const creado = await api.crearKit(token, datos);
        setEditandoId(creado.id);
        setKitParaImagenes(creado);
      }
      recargarListado();
    } catch (e) {
      setError(e instanceof api.ErrorKitsAdmin ? e.message : 'No se pudo guardar el kit');
    } finally {
      setGuardando(false);
    }
  }

  const precioSueltoDeLasPiezas = piezas.reduce(
    (suma, p) => suma + p.precioUnitario * p.cantidad,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[28px] text-tinta">Kits</h1>
          <p className="mt-1.5 text-sm text-texto-secundario">
            {listado ? `${listado.paginacion.total} kits` : 'Cargando…'}
          </p>
        </div>
      </div>

      <label className="flex max-w-xs flex-col gap-1 text-[12.5px] text-texto-secundario">
        Buscar
        <input
          type="search"
          value={buscarListado}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams);
            if (e.target.value) params.set('buscar', e.target.value);
            else params.delete('buscar');
            params.delete('pagina');
            setSearchParams(params, { replace: true });
          }}
          placeholder="Nombre del kit"
          className="rounded-lg border border-linea bg-hueso px-3 py-1.5 text-sm text-tinta"
        />
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
            Todavía no hay ningún kit.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11.5px] tracking-wide text-texto-secundario uppercase">
                <th className="px-4 py-3">Kit</th>
                <th className="px-4 py-3 text-right">Piezas</th>
                <th className="px-4 py-3 text-right">Precio suelto</th>
                <th className="px-4 py-3 text-right">Precio del kit</th>
                <th className="px-4 py-3 text-right">Ahorro</th>
                <th className="px-4 py-3 text-right">Margen</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3">Disponibilidad</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {listado.datos.map((kit: FilaKitAdmin) => (
                <tr key={kit.id} className="border-t border-linea bg-hueso hover:bg-arena">
                  <td className="px-4 py-3 font-medium text-tinta">{kit.nombre}</td>
                  <td className="px-4 py-3 text-right">{kit.piezas}</td>
                  <td className="px-4 py-3 text-right">{formatearPesos(kit.precioSueltoCop)}</td>
                  <td className="px-4 py-3 text-right">{formatearPesos(kit.precioCop)}</td>
                  <td className="px-4 py-3 text-right">
                    <PillPorcentaje valor={kit.ahorroPorcentaje} bajo={false} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {kit.margenPorcentaje === null ? (
                      <span className="text-texto-secundario">no disponible</span>
                    ) : (
                      <PillPorcentaje valor={kit.margenPorcentaje} bajo={kit.margenBajo === true} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-texto-secundario">
                    desde {new Date(kit.vigenteDesde).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-4 py-3">
                    <PillDisponibilidad kit={kit} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link to={`/admin/kits/${kit.id}`} className="text-sm text-rosa hover:underline">
                      Ver
                    </Link>
                    {puedeGestionar ? (
                      <Boton
                        type="button"
                        variante="fantasma"
                        className="ml-2"
                        onClick={() => void editar(kit.id)}
                      >
                        Editar
                      </Boton>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {puedeGestionar ? (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <section className="rounded-lg border border-linea bg-arena p-5">
            <h2 className="font-serif text-lg text-tinta">
              {editandoId ? 'Editar kit' : 'Armar kit'}
            </h2>
            <form onSubmit={guardar} className="mt-3 flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm text-tinta">
                Nombre
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-tinta">
                Descripción
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={2}
                  className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-tinta">
                Agregar pieza
                <input
                  value={buscarPieza}
                  onChange={(e) => setBuscarPieza(e.target.value)}
                  placeholder="Buscar variante por nombre o SKU"
                  className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                />
              </label>
              {resultadosBusqueda.length > 0 ? (
                <ul className="flex flex-col gap-1 rounded-xl border border-linea bg-white p-2">
                  {resultadosBusqueda.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => agregarPieza(v)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-arena"
                      >
                        <span className="flex items-center gap-2">
                          {v.color ? (
                            <span
                              aria-hidden="true"
                              className="h-4 w-4 shrink-0 rounded-sm"
                              style={{ backgroundColor: v.color.hex ?? undefined }}
                            />
                          ) : null}
                          {v.nombreProducto} · {v.sku}
                        </span>
                        <span className="text-texto-secundario">
                          {formatearPesos(v.precioActual)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {piezas.length > 0 ? (
                <table className="text-sm">
                  <tbody>
                    {piezas.map((p) => (
                      <tr key={p.varianteId} className="border-t border-linea first:border-t-0">
                        <td className="py-2">
                          <span className="flex items-center gap-2">
                            {p.colorHex ? (
                              <span
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 rounded-sm"
                                style={{ backgroundColor: p.colorHex }}
                              />
                            ) : null}
                            {p.nombreProducto}
                            {p.colorNombre ? ` · ${p.colorNombre}` : ''}
                          </span>
                        </td>
                        <td className="w-20 py-2 text-right">
                          <input
                            type="number"
                            min={1}
                            value={p.cantidad}
                            onChange={(e) => cambiarCantidad(p.varianteId, Number(e.target.value))}
                            className="w-16 rounded-lg border border-linea bg-white px-2 py-1 text-right text-sm"
                          />
                        </td>
                        <td className="py-2 text-right">{formatearPesos(p.precioUnitario)}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => quitarPieza(p.varianteId)}
                            className="text-sm text-rosa hover:underline"
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-texto-secundario">Todavía no agregaste ninguna pieza.</p>
              )}

              <div className="border-t border-linea pt-4">
                <h3 className="mb-2 text-sm font-medium text-tinta">Fotos del kit</h3>
                {!editandoId ? (
                  <p className="text-sm text-texto-secundario">
                    Guardá el kit para agregar fotos.
                  </p>
                ) : kitParaImagenes ? (
                  <PestanaImagenesCombo
                    kit={kitParaImagenes}
                    accessToken={token}
                    puedeGestionar={puedeGestionar}
                    onCambiado={() => void recargarImagenesKit()}
                  />
                ) : (
                  <EsqueletoCarga alto="h-32" />
                )}
              </div>

              {error ? <p className="text-sm text-rosa">{error}</p> : null}
              <div className="flex gap-2">
                <Boton type="submit" disabled={guardando}>
                  {editandoId ? 'Guardar cambios' : 'Crear kit'}
                </Boton>
                {editandoId ? (
                  <Boton type="button" variante="fantasma" onClick={limpiarFormulario}>
                    Cancelar
                  </Boton>
                ) : null}
              </div>
            </form>
          </section>

          <section className="rounded-lg border border-linea bg-arena p-5">
            <h2 className="font-serif text-lg text-tinta">Resumen</h2>
            <p className="text-sm text-texto-secundario">Se actualiza mientras armas</p>
            <div className="mt-3 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm text-tinta">
                Precio del kit
                <input
                  type="number"
                  min={1}
                  value={precioCop}
                  onChange={(e) => setPrecioCop(e.target.value)}
                  required
                  className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-tinta">
                Precio en dólares (opcional)
                <input
                  type="number"
                  min={0}
                  value={precioUsd}
                  onChange={(e) => setPrecioUsd(e.target.value)}
                  placeholder="Se calcula con la tasa vigente si se deja vacío"
                  className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                />
              </label>

              <div className="rounded-xl border border-linea bg-white p-4">
                <div className="flex justify-between py-1 text-sm">
                  <span>Suelto</span>
                  <span>{formatearPesos(resumen?.precioSueltoCop ?? precioSueltoDeLasPiezas)}</span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span>Kit</span>
                  <span>{precioCop ? formatearPesos(Number(precioCop)) : '—'}</span>
                </div>
                <div className="flex justify-between py-1 text-sm text-verde">
                  <span>Ahorro</span>
                  <span>{resumen ? formatearPesos(resumen.ahorroCop) : '—'}</span>
                </div>
                <div className="flex justify-between border-t border-linea pt-2 pb-1 text-base font-medium">
                  <span>Descuento</span>
                  <span className="text-verde">
                    {resumen ? `${resumen.ahorroPorcentaje}%` : '—'}
                  </span>
                </div>
                <div className="mt-2 flex justify-between py-1 text-sm">
                  <span>Costo de las piezas</span>
                  <span>
                    {resumen?.costoCop !== null && resumen?.costoCop !== undefined
                      ? formatearPesos(resumen.costoCop)
                      : 'no disponible'}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span>Margen</span>
                  <span>
                    {resumen?.margenCop !== null && resumen?.margenCop !== undefined
                      ? `${formatearPesos(resumen.margenCop)} (${resumen.margenPorcentaje}%)`
                      : 'no disponible'}
                  </span>
                </div>
              </div>

              {resumen?.margenBajo ? (
                <p className="rounded-lg border-l-3 border-ambar bg-ambar-luz p-3 text-[13px] text-ambar">
                  El margen de este kit queda por debajo del 15% (o es negativo). No se bloquea el
                  guardado, pero revisa el precio antes de publicarlo.
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm text-tinta">
                  Desde
                  <input
                    type="date"
                    value={vigenteDesde}
                    onChange={(e) => setVigenteDesde(e.target.value)}
                    required
                    className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-tinta">
                  Hasta
                  <input
                    type="date"
                    value={vigenteHasta}
                    onChange={(e) => setVigenteHasta(e.target.value)}
                    className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <p className="text-[12.5px] text-texto-secundario">
                Un kit necesita al menos dos piezas. Si el precio del kit es igual o mayor al
                suelto, no se puede guardar: no sería un kit.
              </p>
            </div>
          </section>
        </div>
      ) : null}

      {listado && listado.paginacion.totalPaginas > 1 ? (
        <nav aria-label="Paginación" className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              if (pagina - 1 > 1) params.set('pagina', String(pagina - 1));
              else params.delete('pagina');
              setSearchParams(params, { replace: true });
            }}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-tinta hover:bg-arena disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-texto-secundario">
            Página {listado.paginacion.pagina} de {listado.paginacion.totalPaginas}
          </span>
          <button
            type="button"
            disabled={pagina >= listado.paginacion.totalPaginas}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set('pagina', String(pagina + 1));
              setSearchParams(params, { replace: true });
            }}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-tinta hover:bg-arena disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
          </button>
        </nav>
      ) : null}
    </div>
  );
}
