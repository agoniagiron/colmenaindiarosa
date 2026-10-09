import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Boton } from '../../componentes/Boton.tsx';
import { EsqueletoCarga } from '../../componentes/EsqueletoCarga.tsx';
import * as apiCombos from '../../contexto/apiCombosAdmin.ts';
import type { VarianteBuscada } from '../../contexto/apiCombosAdmin.ts';
import * as api from '../../contexto/apiPromocionesAdmin.ts';
import type {
  AlcancePromocion,
  EstadoPromocion,
  FilaPromocionAdmin,
  TipoPromocion,
  VistaPreviaPromocion,
} from '../../contexto/apiPromocionesAdmin.ts';
import * as apiProductos from '../../contexto/apiProductosAdmin.ts';
import { useSesionAdmin } from '../../contexto/ContextoSesionAdmin.tsx';
import { repositorio } from '../../datos/index.ts';
import type { Categoria } from '../../tipos/index.ts';
import { useDebounce } from '../../utilidades/useDebounce.ts';
import { formatearPesos } from '../../utilidades/formatearPesos.ts';

const ETIQUETAS_TIPO: Record<TipoPromocion, string> = {
  descuentoPorcentaje: 'Descuento porcentaje',
  descuentoMonto: 'Descuento monto',
  precioFijo: 'Precio fijo',
  envioGratis: 'Envío gratis',
  anuncio: 'Anuncio sin descuento',
};

const ETIQUETAS_ALCANCE: Record<AlcancePromocion, string> = {
  global: 'Global',
  categoria: 'Categoría',
  producto: 'Producto',
  variante: 'Variante',
};

const ETIQUETAS_ESTADO: Record<EstadoPromocion, string> = {
  programada: 'Programada',
  vigente: 'Vigente',
  vencida: 'Vencida',
  inactiva: 'Inactiva',
};

const CLASES_ESTADO: Record<EstadoPromocion, string> = {
  vigente: 'bg-verde-luz text-verde',
  programada: 'bg-azul-luz text-azul',
  vencida: 'border border-linea bg-transparent text-texto-secundario/60',
  inactiva: 'border border-linea bg-transparent text-texto-secundario/60',
};

function EstadoBadge({ estado }: { estado: EstadoPromocion }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[12px] ${CLASES_ESTADO[estado]}`}>
      {ETIQUETAS_ESTADO[estado]}
    </span>
  );
}

function fechaISO(valor: string | Date): string {
  return (valor instanceof Date ? valor : new Date(valor)).toISOString().slice(0, 10);
}

function formatearValor(tipo: TipoPromocion, valor: number): string {
  if (tipo === 'descuentoPorcentaje') return `${valor}%`;
  if (tipo === 'descuentoMonto' || tipo === 'precioFijo') return formatearPesos(valor);
  return '—';
}

export function AdminPromociones() {
  const { usuarioAdmin, accessToken } = useSesionAdmin();

  const [listado, setListado] = useState<api.ListadoPromociones | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<TipoPromocion>('descuentoPorcentaje');
  const [valor, setValor] = useState('');
  const [prioridad, setPrioridad] = useState('0');
  const [alcance, setAlcance] = useState<AlcancePromocion>('global');
  const [categoriaObjetivoId, setCategoriaObjetivoId] = useState('');
  const [buscarProducto, setBuscarProducto] = useState('');
  const [productoObjetivo, setProductoObjetivo] = useState<{ id: string; nombre: string } | null>(
    null,
  );
  const [resultadosProducto, setResultadosProducto] = useState<{ id: string; nombre: string }[]>(
    [],
  );
  const [buscarVariante, setBuscarVariante] = useState('');
  const [varianteObjetivo, setVarianteObjetivo] = useState<VarianteBuscada | null>(null);
  const [resultadosVariante, setResultadosVariante] = useState<VarianteBuscada[]>([]);

  const [mostrarBanner, setMostrarBanner] = useState(false);
  const [bannerTitulo, setBannerTitulo] = useState('');
  const [bannerTexto, setBannerTexto] = useState('');
  const [bannerImagenUrl, setBannerImagenUrl] = useState('');
  const [bannerColorFondo, setBannerColorFondo] = useState('');

  const [vigenteDesde, setVigenteDesde] = useState(fechaISO(new Date()));
  const [vigenteHasta, setVigenteHasta] = useState('');

  const [vistaPrevia, setVistaPrevia] = useState<VistaPreviaPromocion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarProductoDiferido = useDebounce(buscarProducto, 400);
  const buscarVarianteDiferido = useDebounce(buscarVariante, 400);

  function recargarListado() {
    if (!accessToken) return;
    setListado(null);
    api
      .listarPromociones(accessToken, 1)
      .then(setListado)
      .catch(() => {
        setListado({
          datos: [],
          paginacion: { pagina: 1, porPagina: 20, total: 0, totalPaginas: 0 },
        });
      });
  }

  useEffect(recargarListado, [accessToken]);

  useEffect(() => {
    repositorio
      .listarCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, []);

  useEffect(() => {
    if (!accessToken || !buscarProductoDiferido || alcance !== 'producto') {
      setResultadosProducto([]);
      return;
    }
    let vigente = true;
    apiProductos
      .listarProductos(accessToken, { buscar: buscarProductoDiferido, porPagina: 10 })
      .then((r) => {
        if (vigente) setResultadosProducto(r.datos.map((p) => ({ id: p.id, nombre: p.nombre })));
      })
      .catch(() => {
        if (vigente) setResultadosProducto([]);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, buscarProductoDiferido, alcance]);

  useEffect(() => {
    if (!accessToken || !buscarVarianteDiferido || alcance !== 'variante') {
      setResultadosVariante([]);
      return;
    }
    let vigente = true;
    apiCombos
      .buscarVariantes(accessToken, buscarVarianteDiferido)
      .then((r) => {
        if (vigente) setResultadosVariante(r);
      })
      .catch(() => {
        if (vigente) setResultadosVariante([]);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, buscarVarianteDiferido, alcance]);

  function objetivosActuales(): {
    categoriaId?: string;
    productoId?: string;
    varianteId?: string;
  }[] {
    if (alcance === 'global') return [];
    if (alcance === 'categoria')
      return categoriaObjetivoId ? [{ categoriaId: categoriaObjetivoId }] : [];
    if (alcance === 'producto')
      return productoObjetivo ? [{ productoId: productoObjetivo.id }] : [];
    return varianteObjetivo ? [{ varianteId: varianteObjetivo.id }] : [];
  }

  // Vista previa (punto 10): se pide al backend cada vez que cambian
  // tipo/valor/alcance/objetivo — nunca se recalcula el precio resultante
  // acá (ver previsualizar en servicio.ts, la única fuente).
  useEffect(() => {
    const objetivos = objetivosActuales();
    const valorNumerico = Number(valor) || 0;
    if (!accessToken || tipo === 'anuncio' || (alcance !== 'global' && objetivos.length === 0)) {
      setVistaPrevia(null);
      return;
    }
    let vigente = true;
    api
      .previsualizarPromocion(accessToken, { tipo, valor: valorNumerico, alcance, objetivos })
      .then((r) => {
        if (vigente) setVistaPrevia(r);
      })
      .catch(() => {
        if (vigente) setVistaPrevia(null);
      });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tipo, valor, alcance, categoriaObjetivoId, productoObjetivo, varianteObjetivo]);

  if (!usuarioAdmin || !accessToken) return null;
  if (!usuarioAdmin.permisos.includes('promociones.ver')) {
    return <Navigate to="/admin" replace />;
  }
  const token = accessToken;
  const puedeGestionar = usuarioAdmin.permisos.includes('promociones.gestionar');

  function limpiarFormulario() {
    setEditandoId(null);
    setNombre('');
    setDescripcion('');
    setTipo('descuentoPorcentaje');
    setValor('');
    setPrioridad('0');
    setAlcance('global');
    setCategoriaObjetivoId('');
    setProductoObjetivo(null);
    setVarianteObjetivo(null);
    setBuscarProducto('');
    setBuscarVariante('');
    setMostrarBanner(false);
    setBannerTitulo('');
    setBannerTexto('');
    setBannerImagenUrl('');
    setBannerColorFondo('');
    setVigenteDesde(fechaISO(new Date()));
    setVigenteHasta('');
    setError(null);
  }

  async function editar(id: string) {
    setError(null);
    try {
      const promo = await api.obtenerDetallePromocion(token, id);
      setEditandoId(promo.id);
      setNombre(promo.nombre);
      setDescripcion(promo.descripcion ?? '');
      setTipo(promo.tipo);
      setValor(String(promo.valor));
      setPrioridad(String(promo.prioridad));
      setAlcance(promo.alcance);
      setCategoriaObjetivoId(promo.objetivos[0]?.categoriaId ?? '');
      const objetivoProducto = promo.objetivos[0];
      setProductoObjetivo(
        objetivoProducto?.productoId
          ? { id: objetivoProducto.productoId, nombre: objetivoProducto.etiqueta ?? '' }
          : null,
      );
      setVarianteObjetivo(
        objetivoProducto?.varianteId
          ? ({
              id: objetivoProducto.varianteId,
              sku: '',
              nombreProducto: objetivoProducto.etiqueta ?? '',
              precioActual: 0,
              costoActual: null,
              color: null,
            } satisfies VarianteBuscada)
          : null,
      );
      setMostrarBanner(promo.tipo === 'anuncio' || Boolean(promo.bannerTitulo));
      setBannerTitulo(promo.bannerTitulo ?? '');
      setBannerTexto(promo.bannerTexto ?? '');
      setBannerImagenUrl(promo.bannerImagenUrl ?? '');
      setBannerColorFondo(promo.bannerColorFondo ?? '');
      setVigenteDesde(fechaISO(promo.vigenteDesde));
      setVigenteHasta(promo.vigenteHasta ? fechaISO(promo.vigenteHasta) : '');
    } catch (e) {
      setError(
        e instanceof api.ErrorPromocionesAdmin ? e.message : 'No se pudo cargar la promoción',
      );
    }
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const datos: api.DatosPromocion = {
        nombre,
        descripcion: descripcion || null,
        tipo,
        valor: Number(valor) || 0,
        alcance,
        objetivos: objetivosActuales(),
        prioridad: Number(prioridad) || 0,
        bannerTitulo: mostrarBanner ? bannerTitulo || null : null,
        bannerTexto: mostrarBanner ? bannerTexto || null : null,
        bannerImagenUrl: mostrarBanner ? bannerImagenUrl || null : null,
        bannerColorFondo: mostrarBanner ? bannerColorFondo || null : null,
        vigenteDesde,
        vigenteHasta: vigenteHasta || null,
      };
      if (editandoId) {
        await api.editarPromocion(token, editandoId, datos);
      } else {
        await api.crearPromocion(token, datos);
      }
      limpiarFormulario();
      recargarListado();
    } catch (e) {
      setError(
        e instanceof api.ErrorPromocionesAdmin ? e.message : 'No se pudo guardar la promoción',
      );
    } finally {
      setGuardando(false);
    }
  }

  const mostrarCamposBanner = tipo === 'anuncio' || mostrarBanner;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-[28px] text-tinta">Promociones</h1>
        <p className="mt-1.5 text-sm text-texto-secundario">
          {listado ? `${listado.paginacion.total} promociones` : 'Cargando…'}
        </p>
      </div>

      <section className="overflow-x-auto rounded-lg border border-linea bg-arena">
        {listado === null ? (
          <div className="flex flex-col gap-2.5 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <EsqueletoCarga key={i} alto="h-10" />
            ))}
          </div>
        ) : listado.datos.length === 0 ? (
          <p className="p-8 text-center text-sm text-texto-secundario">
            Todavía no hay ninguna promoción.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11.5px] tracking-wide text-texto-secundario uppercase">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Alcance</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3 text-right">Afecta</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {listado.datos.map((promo: FilaPromocionAdmin) => (
                <tr key={promo.id} className="border-t border-linea bg-hueso hover:bg-arena">
                  <td className="px-4 py-3 font-medium text-tinta">{promo.nombre}</td>
                  <td className="px-4 py-3 text-texto-secundario">{ETIQUETAS_TIPO[promo.tipo]}</td>
                  <td className="px-4 py-3 text-right">
                    {formatearValor(promo.tipo, promo.valor)}
                  </td>
                  <td className="px-4 py-3 text-texto-secundario">
                    {ETIQUETAS_ALCANCE[promo.alcance]}
                  </td>
                  <td className="px-4 py-3 text-texto-secundario">
                    {new Date(promo.vigenteDesde).toLocaleDateString('es-CO')}
                    {promo.vigenteHasta
                      ? ` – ${new Date(promo.vigenteHasta).toLocaleDateString('es-CO')}`
                      : ' – indefinida'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {promo.productosAfectados === null
                      ? '—'
                      : `${promo.productosAfectados} productos`}
                  </td>
                  <td className="px-4 py-3">
                    <EstadoBadge estado={promo.estado} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {puedeGestionar ? (
                      <Boton
                        type="button"
                        variante="fantasma"
                        onClick={() => void editar(promo.id)}
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
              {editandoId ? 'Editar promoción' : 'Nueva promoción'}
            </h2>
            <form onSubmit={guardar} className="mt-3 grid gap-4 md:grid-cols-2">
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
                Tipo
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoPromocion)}
                  className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
                >
                  {Object.entries(ETIQUETAS_TIPO).map(([valorTipo, etiqueta]) => (
                    <option key={valorTipo} value={valorTipo}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-tinta">
                Valor
                <input
                  type="number"
                  min={0}
                  max={tipo === 'descuentoPorcentaje' ? 90 : undefined}
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  disabled={tipo === 'anuncio' || tipo === 'envioGratis'}
                  className="rounded-xl border border-linea bg-white px-3 py-2 text-sm disabled:opacity-50"
                />
                <span className="text-[11.5px] text-texto-secundario">
                  {tipo === 'descuentoPorcentaje' ? 'Porcentaje, máximo 90' : 'Monto en pesos'}
                </span>
              </label>
              <label className="flex flex-col gap-1 text-sm text-tinta">
                Prioridad
                <input
                  type="number"
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value)}
                  className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                />
                <span className="text-[11.5px] text-texto-secundario">
                  Si dos promociones cubren el mismo producto, gana la mayor
                </span>
              </label>

              <label className="flex flex-col gap-1 text-sm text-tinta">
                Alcance
                <select
                  value={alcance}
                  onChange={(e) => setAlcance(e.target.value as AlcancePromocion)}
                  className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
                >
                  {Object.entries(ETIQUETAS_ALCANCE).map(([valorAlcance, etiqueta]) => (
                    <option key={valorAlcance} value={valorAlcance}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
              </label>

              {alcance === 'categoria' ? (
                <label className="flex flex-col gap-1 text-sm text-tinta">
                  Categoría
                  <select
                    value={categoriaObjetivoId}
                    onChange={(e) => setCategoriaObjetivoId(e.target.value)}
                    required
                    className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
                  >
                    <option value="">Seleccionar…</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {alcance === 'producto' ? (
                <div className="flex flex-col gap-1 text-sm text-tinta">
                  Producto
                  {productoObjetivo ? (
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
                        placeholder="Buscar producto por nombre"
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
                    </>
                  )}
                </div>
              ) : null}

              {alcance === 'variante' ? (
                <div className="flex flex-col gap-1 text-sm text-tinta">
                  Variante
                  {varianteObjetivo ? (
                    <div className="flex items-center justify-between rounded-xl border border-linea bg-white px-3 py-2">
                      <span>
                        {varianteObjetivo.nombreProducto}
                        {varianteObjetivo.sku ? ` · ${varianteObjetivo.sku}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setVarianteObjetivo(null)}
                        className="text-rosa hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={buscarVariante}
                        onChange={(e) => setBuscarVariante(e.target.value)}
                        placeholder="Buscar variante por nombre o SKU"
                        className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                      />
                      {resultadosVariante.length > 0 ? (
                        <ul className="flex flex-col gap-1 rounded-xl border border-linea bg-white p-2">
                          {resultadosVariante.map((v) => (
                            <li key={v.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setVarianteObjetivo(v);
                                  setBuscarVariante('');
                                  setResultadosVariante([]);
                                }}
                                className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-arena"
                              >
                                {v.nombreProducto} · {v.sku}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

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
                <span className="text-[11.5px] text-texto-secundario">Vacío = indefinida</span>
              </label>

              {/* Punto 10: los campos de banner solo se ven si el tipo es
                  Anuncio o si se marca "mostrar en portada" a mano —
                  mostrarEnPortada no es una columna propia, solo decide
                  si estos campos (que sí son columnas reales) se llenan. */}
              {tipo !== 'anuncio' ? (
                <label className="col-span-2 flex items-center gap-2 text-sm text-tinta">
                  <input
                    type="checkbox"
                    checked={mostrarBanner}
                    onChange={(e) => setMostrarBanner(e.target.checked)}
                    className="h-4 w-4 rounded border-linea"
                  />
                  Mostrar también como banner en la portada
                </label>
              ) : null}

              {mostrarCamposBanner ? (
                <>
                  <label className="flex flex-col gap-1 text-sm text-tinta">
                    Título del banner
                    <input
                      value={bannerTitulo}
                      onChange={(e) => setBannerTitulo(e.target.value)}
                      className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-tinta">
                    Color de fondo
                    <input
                      value={bannerColorFondo}
                      onChange={(e) => setBannerColorFondo(e.target.value)}
                      placeholder="#B02E58"
                      className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1 text-sm text-tinta">
                    Texto del banner
                    <textarea
                      value={bannerTexto}
                      onChange={(e) => setBannerTexto(e.target.value)}
                      rows={2}
                      className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1 text-sm text-tinta">
                    Imagen del banner (URL)
                    <input
                      value={bannerImagenUrl}
                      onChange={(e) => setBannerImagenUrl(e.target.value)}
                      className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
                    />
                  </label>
                </>
              ) : null}

              {error ? <p className="col-span-2 text-sm text-rosa">{error}</p> : null}
              <div className="col-span-2 flex gap-2">
                <Boton type="submit" disabled={guardando}>
                  {editandoId ? 'Guardar cambios' : 'Crear promoción'}
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
            <h2 className="font-serif text-lg text-tinta">Vista previa</h2>
            <p className="text-sm text-texto-secundario">Productos que quedarían afectados</p>

            {tipo === 'anuncio' ? (
              <p className="mt-3 text-sm text-texto-secundario">
                Un anuncio no cambia precios: no hay nada que previsualizar acá.
              </p>
            ) : !vistaPrevia || vistaPrevia.productos.length === 0 ? (
              <p className="mt-3 text-sm text-texto-secundario">
                Elegí el alcance y el objetivo para ver qué productos quedan afectados.
              </p>
            ) : (
              <>
                <table className="mt-3 w-full text-sm">
                  <tbody>
                    {vistaPrevia.productos.map((p) => (
                      <tr key={p.productoId} className="border-t border-linea first:border-t-0">
                        <td className="py-2">{p.nombre}</td>
                        <td className="py-2 text-right">
                          <span className="text-texto-secundario line-through">
                            {formatearPesos(p.precioOriginalCop)}
                          </span>
                          <br />
                          <span className="font-medium text-tinta">
                            {formatearPesos(p.precioResultanteCop)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 rounded-lg border-l-3 border-ambar bg-ambar-luz p-3 text-[12.5px] text-texto-secundario">
                  Revisa esta lista antes de guardar. Un alcance de categoría puede cubrir productos
                  que no tenías en mente.
                </p>
              </>
            )}

            {vistaPrevia?.avisoMontoSuperaPrecio ? (
              <p className="mt-3 rounded-lg border-l-3 border-ambar bg-ambar-luz p-3 text-[13px] text-ambar">
                El monto del descuento supera el precio del producto más barato afectado: esa pieza
                quedaría en $0. No se bloquea el guardado, pero revisa el valor.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
