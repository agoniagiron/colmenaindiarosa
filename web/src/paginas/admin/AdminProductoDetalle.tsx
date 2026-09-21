import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Boton } from '../../componentes/Boton.tsx';
import { CampoTexto } from '../../componentes/CampoTexto.tsx';
import { EsqueletoCarga } from '../../componentes/EsqueletoCarga.tsx';
import { Modal } from '../../componentes/Modal.tsx';
import * as api from '../../contexto/apiProductosAdmin.ts';
import type {
  AtributoConValores,
  DatosPreciosProducto,
  EstadoPublicacion,
  KitAfectado,
  ProductoDetalle,
  VarianteDetalle,
} from '../../contexto/apiProductosAdmin.ts';
import { useConfiguracion } from '../../contexto/ContextoConfiguracion.tsx';
import { useSesionAdmin } from '../../contexto/ContextoSesionAdmin.tsx';
import { repositorio } from '../../datos/index.ts';
import type { Categoria } from '../../tipos/index.ts';
import { formatearFechaHora } from '../../utilidades/formatearFechaHora.ts';
import { formatearPesos } from '../../utilidades/formatearPesos.ts';
import { PestanaImagenes } from './PestanaImagenes.tsx';

const ETIQUETAS_ESTADO: Record<EstadoPublicacion, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  archivado: 'Archivado',
};

const PESTANAS = ['general', 'variantes', 'precios', 'imagenes', 'seo'] as const;
type Pestana = (typeof PESTANAS)[number];

const ETIQUETAS_PESTANA: Record<Pestana, string> = {
  general: 'General',
  variantes: 'Variantes',
  precios: 'Precios',
  imagenes: 'Imágenes',
  seo: 'SEO',
};

function Seccion({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-linea bg-arena p-5">
      {titulo ? <h2 className="mb-3 font-serif text-lg text-tinta">{titulo}</h2> : null}
      {children}
    </section>
  );
}

export function AdminProductoDetalle() {
  const { id } = useParams<{ id: string }>();
  const { usuarioAdmin, accessToken } = useSesionAdmin();

  const [producto, setProducto] = useState<ProductoDetalle | null>(null);
  const [atributos, setAtributos] = useState<AtributoConValores[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>('general');

  function recargar() {
    if (!accessToken || !id) return;
    api
      .obtenerDetalleProducto(accessToken, id)
      .then((r) => {
        setProducto(r);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(
          e instanceof api.ErrorProductosAdmin ? e.message : 'No se pudo cargar el producto',
        );
      });
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id]);

  useEffect(() => {
    if (!accessToken) return;
    api
      .listarAtributos(accessToken)
      .then(setAtributos)
      .catch(() => setAtributos([]));
  }, [accessToken]);

  useEffect(() => {
    repositorio
      .listarCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, []);

  if (!usuarioAdmin || !accessToken) return null;
  if (!usuarioAdmin.permisos.includes('productos.ver')) {
    return <Navigate to="/admin" replace />;
  }

  const permisos = {
    editar: usuarioAdmin.permisos.includes('productos.editar'),
    crear: usuarioAdmin.permisos.includes('productos.crear'),
    archivar: usuarioAdmin.permisos.includes('productos.archivar'),
    precios: usuarioAdmin.permisos.includes('productos.precios'),
    imagenes: usuarioAdmin.permisos.includes('productos.imagenes'),
  };

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <Link to="/admin/productos" className="text-sm text-rosa hover:underline">
          ← Volver a productos
        </Link>
        <p className="text-sm text-texto-secundario">{error}</p>
      </div>
    );
  }

  if (!producto) {
    return (
      <div className="flex flex-col gap-3">
        <EsqueletoCarga alto="h-8" ancho="w-1/3" />
        <EsqueletoCarga alto="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/productos" className="text-sm text-rosa hover:underline">
          ← Volver a productos
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-serif text-[28px] text-tinta">{producto.nombre}</h1>
          <span className="rounded-full bg-hueso px-2.5 py-0.5 text-[12px] text-texto-secundario">
            {ETIQUETAS_ESTADO[producto.estado]}
          </span>
        </div>
      </div>

      <nav
        aria-label="Secciones del producto"
        className="flex gap-1.5 rounded-full border border-linea bg-arena p-1"
      >
        {PESTANAS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === pestana}
            onClick={() => setPestana(p)}
            className={`rounded-full px-4 py-1.5 text-[13px] transition-colors ${
              p === pestana ? 'bg-negro text-hueso' : 'text-texto-secundario hover:text-tinta'
            }`}
          >
            {ETIQUETAS_PESTANA[p]}
          </button>
        ))}
      </nav>

      {pestana === 'general' ? (
        <PestanaGeneral
          producto={producto}
          categorias={categorias}
          accessToken={accessToken}
          puedeEditar={permisos.editar}
          puedeArchivar={permisos.archivar}
          onCambiado={recargar}
        />
      ) : null}

      {pestana === 'variantes' ? (
        <PestanaVariantes
          producto={producto}
          atributos={atributos}
          accessToken={accessToken}
          puedeCrear={permisos.crear}
          puedeEditar={permisos.editar}
          puedePrecios={permisos.precios}
          onCambiado={recargar}
        />
      ) : null}

      {pestana === 'precios' ? (
        <PestanaPrecios
          producto={producto}
          accessToken={accessToken}
          puedePrecios={permisos.precios}
          onCambiado={recargar}
        />
      ) : null}

      {pestana === 'imagenes' ? (
        <PestanaImagenes
          producto={producto}
          accessToken={accessToken}
          puedeGestionar={permisos.imagenes}
          onCambiado={recargar}
        />
      ) : null}

      {pestana === 'seo' ? (
        <PestanaSeo
          producto={producto}
          accessToken={accessToken}
          puedeEditar={permisos.editar}
          onCambiado={recargar}
        />
      ) : null}
    </div>
  );
}

// --- General ------------------------------------------------------------------

function PestanaGeneral({
  producto,
  categorias,
  accessToken,
  puedeEditar,
  puedeArchivar,
  onCambiado,
}: {
  producto: ProductoDetalle;
  categorias: Categoria[];
  accessToken: string;
  puedeEditar: boolean;
  puedeArchivar: boolean;
  onCambiado: () => void;
}) {
  const [nombre, setNombre] = useState(producto.nombre);
  const [slug, setSlug] = useState(producto.slug);
  const [categoriaId, setCategoriaId] = useState(producto.categoriaId);
  const [descripcionCorta, setDescripcionCorta] = useState(producto.descripcionCorta ?? '');
  const [descripcion, setDescripcion] = useState(producto.descripcion);
  const [cuidados, setCuidados] = useState(producto.cuidados ?? '');
  const [envioNotas, setEnvioNotas] = useState(producto.envioNotas ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nuevoEstado, setNuevoEstado] = useState<EstadoPublicacion | ''>('');
  const [kitsAfectados, setKitsAfectados] = useState<KitAfectado[] | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);

  useEffect(() => {
    setNombre(producto.nombre);
    setSlug(producto.slug);
    setCategoriaId(producto.categoriaId);
    setDescripcionCorta(producto.descripcionCorta ?? '');
    setDescripcion(producto.descripcion);
    setCuidados(producto.cuidados ?? '');
    setEnvioNotas(producto.envioNotas ?? '');
  }, [producto]);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await api.editarProducto(accessToken, producto.id, {
        nombre,
        slug,
        categoriaId,
        descripcionCorta: descripcionCorta || null,
        descripcion,
        cuidados: cuidados || null,
        envioNotas: envioNotas || null,
      });
      onCambiado();
    } catch (e) {
      setError(e instanceof api.ErrorProductosAdmin ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function aplicarEstado(confirmarKitsAfectados: boolean) {
    if (!nuevoEstado) return;
    setCambiandoEstado(true);
    setErrorEstado(null);
    try {
      await api.cambiarEstadoProducto(
        accessToken,
        producto.id,
        nuevoEstado,
        confirmarKitsAfectados,
      );
      setNuevoEstado('');
      setKitsAfectados(null);
      onCambiado();
    } catch (e) {
      if (e instanceof api.ErrorProductosAdmin && e.estadoHttp === 409) {
        const detalles = e.detalles as { kits?: KitAfectado[] } | undefined;
        if (detalles?.kits && detalles.kits.length > 0) {
          setKitsAfectados(detalles.kits);
          setCambiandoEstado(false);
          return;
        }
      }
      setErrorEstado(
        e instanceof api.ErrorProductosAdmin ? e.message : 'No se pudo cambiar el estado',
      );
    } finally {
      setCambiandoEstado(false);
    }
  }

  function alEnviarEstado(evento: FormEvent) {
    evento.preventDefault();
    void aplicarEstado(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <Seccion titulo="Datos generales">
        <form onSubmit={guardar} className="grid gap-4 md:grid-cols-2">
          <CampoTexto
            etiqueta="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={!puedeEditar}
            required
          />
          <CampoTexto
            etiqueta="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={!puedeEditar}
            required
          />
          <label className="flex flex-col gap-1 text-sm text-tinta md:col-span-2">
            Descripción corta
            <input
              value={descripcionCorta}
              onChange={(e) => setDescripcionCorta(e.target.value)}
              disabled={!puedeEditar}
              maxLength={280}
              className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-tinta md:col-span-2">
            Descripción
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={!puedeEditar}
              rows={5}
              className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-tinta md:col-span-2">
            Cuidados
            <textarea
              value={cuidados}
              onChange={(e) => setCuidados(e.target.value)}
              disabled={!puedeEditar}
              rows={3}
              className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-tinta md:col-span-2">
            Notas de envío
            <textarea
              value={envioNotas}
              onChange={(e) => setEnvioNotas(e.target.value)}
              disabled={!puedeEditar}
              rows={2}
              className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-tinta">
            Categoría
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              disabled={!puedeEditar}
              className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
            >
              {categorias.length === 0 ? (
                <option value={producto.categoriaId}>{producto.categoria.nombre}</option>
              ) : (
                categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))
              )}
            </select>
          </label>
          {error ? <p className="text-sm text-rosa md:col-span-2">{error}</p> : null}
          {puedeEditar ? (
            <div className="md:col-span-2">
              <Boton type="submit" disabled={guardando}>
                Guardar
              </Boton>
            </div>
          ) : null}
        </form>
      </Seccion>

      {puedeEditar || puedeArchivar ? (
        <Seccion titulo="Estado">
          <form onSubmit={alEnviarEstado} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-tinta">
              Nuevo estado
              <select
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value as EstadoPublicacion)}
                className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
              >
                <option value="">Seleccionar…</option>
                {(['borrador', 'publicado', 'archivado'] as const)
                  .filter((e) => e !== producto.estado)
                  .map((e) => (
                    <option key={e} value={e}>
                      {ETIQUETAS_ESTADO[e]}
                    </option>
                  ))}
              </select>
            </label>
            <Boton type="submit" disabled={!nuevoEstado || cambiandoEstado}>
              Cambiar estado
            </Boton>
          </form>
          {errorEstado ? <p className="mt-2 text-sm text-rosa">{errorEstado}</p> : null}
        </Seccion>
      ) : null}

      <Modal
        abierto={kitsAfectados !== null}
        titulo="Este producto está en kits vigentes"
        onCerrar={() => setKitsAfectados(null)}
      >
        <p className="text-sm text-tinta">
          Al cambiar el estado de "{producto.nombre}" a "
          {nuevoEstado ? ETIQUETAS_ESTADO[nuevoEstado] : ''}", estos kits quedan apuntando a una
          variante que ya no se vende:
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm text-tinta">
          {kitsAfectados?.map((k) => (
            <li key={k.id}>{k.nombre}</li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={() => setKitsAfectados(null)}>
            Cancelar
          </Boton>
          <Boton type="button" onClick={() => void aplicarEstado(true)} disabled={cambiandoEstado}>
            Cambiar igual
          </Boton>
        </div>
      </Modal>
    </div>
  );
}

// --- SEO -------------------------------------------------------------------

function PestanaSeo({
  producto,
  accessToken,
  puedeEditar,
  onCambiado,
}: {
  producto: ProductoDetalle;
  accessToken: string;
  puedeEditar: boolean;
  onCambiado: () => void;
}) {
  const [seoTitulo, setSeoTitulo] = useState(producto.seoTitulo ?? '');
  const [seoDescripcion, setSeoDescripcion] = useState(producto.seoDescripcion ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSeoTitulo(producto.seoTitulo ?? '');
    setSeoDescripcion(producto.seoDescripcion ?? '');
  }, [producto]);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await api.editarProducto(accessToken, producto.id, {
        seoTitulo: seoTitulo || null,
        seoDescripcion: seoDescripcion || null,
      });
      onCambiado();
    } catch (e) {
      setError(e instanceof api.ErrorProductosAdmin ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Seccion titulo="SEO">
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <CampoTexto
          etiqueta="Título SEO"
          value={seoTitulo}
          onChange={(e) => setSeoTitulo(e.target.value)}
          disabled={!puedeEditar}
        />
        <label className="flex flex-col gap-1 text-sm text-tinta">
          Descripción SEO
          <textarea
            value={seoDescripcion}
            onChange={(e) => setSeoDescripcion(e.target.value)}
            disabled={!puedeEditar}
            rows={3}
            className="rounded-xl border border-linea bg-white px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-rosa">{error}</p> : null}
        {puedeEditar ? (
          <div>
            <Boton type="submit" disabled={guardando}>
              Guardar
            </Boton>
          </div>
        ) : null}
      </form>
    </Seccion>
  );
}

// --- Variantes ---------------------------------------------------------------

function resumenAtributos(variante: VarianteDetalle): string {
  if (variante.valoresAtributo.length === 0) return '—';
  return variante.valoresAtributo.map((v) => v.valorAtributo.valor).join(' · ');
}

function PestanaVariantes({
  producto,
  atributos,
  accessToken,
  puedeCrear,
  puedeEditar,
  puedePrecios,
  onCambiado,
}: {
  producto: ProductoDetalle;
  atributos: AtributoConValores[];
  accessToken: string;
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedePrecios: boolean;
  onCambiado: () => void;
}) {
  const [modalNuevaAbierto, setModalNuevaAbierto] = useState(false);
  const [varianteparaPrecio, setVarianteParaPrecio] = useState<VarianteDetalle | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        {puedeCrear ? (
          <Boton type="button" onClick={() => setModalNuevaAbierto(true)}>
            Agregar variante
          </Boton>
        ) : null}
      </div>

      <Seccion>
        {producto.variantes.length === 0 ? (
          <p className="text-sm text-texto-secundario">Este producto todavía no tiene variantes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-wide text-texto-secundario uppercase">
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Atributos</th>
                  <th className="py-2 pr-3 text-right">Precio</th>
                  <th className="py-2 pr-3 text-right">Costo</th>
                  <th className="py-2 pr-3 text-right">Stock</th>
                  <th className="py-2 pr-3 text-right">Reorden</th>
                  <th className="py-2 pr-3">Activa</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {producto.variantes.map((variante) => (
                  <FilaVariante
                    key={variante.id}
                    variante={variante}
                    atributos={atributos}
                    accessToken={accessToken}
                    puedeEditar={puedeEditar}
                    puedePrecios={puedePrecios}
                    onCambiado={onCambiado}
                    onCambiarPrecio={() => setVarianteParaPrecio(variante)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <ModalNuevaVariante
        abierto={modalNuevaAbierto}
        onCerrar={() => setModalNuevaAbierto(false)}
        productoId={producto.id}
        atributos={atributos}
        accessToken={accessToken}
        onCreada={() => {
          setModalNuevaAbierto(false);
          onCambiado();
        }}
      />

      {varianteparaPrecio ? (
        <ModalPrecioVariante
          variante={varianteparaPrecio}
          accessToken={accessToken}
          onCerrar={() => setVarianteParaPrecio(null)}
          onCambiado={() => {
            setVarianteParaPrecio(null);
            onCambiado();
          }}
        />
      ) : null}
    </div>
  );
}

function FilaVariante({
  variante,
  atributos,
  accessToken,
  puedeEditar,
  puedePrecios,
  onCambiado,
  onCambiarPrecio,
}: {
  variante: VarianteDetalle;
  atributos: AtributoConValores[];
  accessToken: string;
  puedeEditar: boolean;
  puedePrecios: boolean;
  onCambiado: () => void;
  onCambiarPrecio: () => void;
}) {
  const seleccionInicial = Object.fromEntries(
    atributos.map((atrib) => {
      const actual = variante.valoresAtributo.find((v) => v.valorAtributo.atributo.id === atrib.id);
      return [atrib.id, actual?.valorAtributo.id ?? ''];
    }),
  );

  const [sku, setSku] = useState(variante.sku);
  const [puntoReorden, setPuntoReorden] = useState(String(variante.puntoReorden));
  const [activa, setActiva] = useState(variante.activa);
  const [seleccion, setSeleccion] = useState<Record<string, string>>(seleccionInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await api.editarVariante(accessToken, variante.id, {
        sku,
        puntoReorden: Number(puntoReorden),
        activa,
        valoresAtributo: Object.values(seleccion).filter(Boolean),
      });
      onCambiado();
    } catch (e) {
      setError(e instanceof api.ErrorProductosAdmin ? e.message : 'No se pudo guardar la variante');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <tr className="border-t border-linea align-top">
      <td className="py-2 pr-3">
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          disabled={!puedeEditar}
          className="w-32 rounded-lg border border-linea bg-hueso px-2 py-1 text-[13px]"
        />
      </td>
      <td className="py-2 pr-3">
        {atributos.length === 0 ? (
          <span className="text-texto-secundario">{resumenAtributos(variante)}</span>
        ) : (
          <div className="flex flex-col gap-1">
            {atributos.map((atrib) => (
              <select
                key={atrib.id}
                value={seleccion[atrib.id] ?? ''}
                onChange={(e) => setSeleccion({ ...seleccion, [atrib.id]: e.target.value })}
                disabled={!puedeEditar}
                className="rounded-lg border border-linea bg-hueso px-2 py-1 text-[12.5px]"
              >
                <option value="">{atrib.nombre}: —</option>
                {atrib.valoresAtributo.map((v) => (
                  <option key={v.id} value={v.id}>
                    {atrib.nombre}: {v.valor}
                  </option>
                ))}
              </select>
            ))}
          </div>
        )}
      </td>
      <td className="py-2 pr-3 text-right">{formatearPesos(variante.precioActual)}</td>
      <td className="py-2 pr-3 text-right text-texto-secundario">
        {variante.costoActual !== null ? formatearPesos(variante.costoActual) : '—'}
      </td>
      <td className="py-2 pr-3 text-right">{variante.stockActual}</td>
      <td className="py-2 pr-3 text-right">
        <input
          type="number"
          min={0}
          value={puntoReorden}
          onChange={(e) => setPuntoReorden(e.target.value)}
          disabled={!puedeEditar}
          className="w-16 rounded-lg border border-linea bg-hueso px-2 py-1 text-right text-[13px]"
        />
      </td>
      <td className="py-2 pr-3">
        <input
          type="checkbox"
          checked={activa}
          onChange={(e) => setActiva(e.target.checked)}
          disabled={!puedeEditar}
        />
      </td>
      <td className="py-2">
        <div className="flex flex-col gap-1">
          {puedeEditar ? (
            <Boton
              type="button"
              variante="fantasma"
              onClick={() => void guardar()}
              disabled={guardando}
            >
              Guardar
            </Boton>
          ) : null}
          {puedePrecios ? (
            <Boton type="button" variante="fantasma" onClick={onCambiarPrecio}>
              Cambiar precio
            </Boton>
          ) : null}
        </div>
        {error ? <p className="mt-1 max-w-[160px] text-[11px] text-rosa">{error}</p> : null}
      </td>
    </tr>
  );
}

function ModalNuevaVariante({
  abierto,
  onCerrar,
  productoId,
  atributos,
  accessToken,
  onCreada,
}: {
  abierto: boolean;
  onCerrar: () => void;
  productoId: string;
  atributos: AtributoConValores[];
  accessToken: string;
  onCreada: () => void;
}) {
  const [sku, setSku] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [stockInicial, setStockInicial] = useState('0');
  const [puntoReorden, setPuntoReorden] = useState('0');
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      setSku('');
      setPrecio('');
      setCosto('');
      setStockInicial('0');
      setPuntoReorden('0');
      setSeleccion({});
      setError(null);
    }
  }, [abierto]);

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.crearVariante(accessToken, productoId, {
        sku,
        precio: Number(precio),
        costo: costo ? Number(costo) : undefined,
        stockInicial: Number(stockInicial),
        puntoReorden: Number(puntoReorden),
        valoresAtributo: Object.values(seleccion).filter(Boolean),
      });
      onCreada();
    } catch (e) {
      setError(e instanceof api.ErrorProductosAdmin ? e.message : 'No se pudo crear la variante');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Agregar variante" onCerrar={onCerrar}>
      <form onSubmit={crear} className="flex flex-col gap-3">
        <CampoTexto etiqueta="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <CampoTexto
            etiqueta="Precio"
            type="number"
            min={1}
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            required
          />
          <CampoTexto
            etiqueta="Costo"
            type="number"
            min={0}
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
          />
          <CampoTexto
            etiqueta="Stock inicial"
            type="number"
            min={0}
            value={stockInicial}
            onChange={(e) => setStockInicial(e.target.value)}
          />
          <CampoTexto
            etiqueta="Punto de reorden"
            type="number"
            min={0}
            value={puntoReorden}
            onChange={(e) => setPuntoReorden(e.target.value)}
          />
        </div>
        {atributos.map((atrib) => (
          <label key={atrib.id} className="flex flex-col gap-1 text-sm text-tinta">
            {atrib.nombre}
            <select
              value={seleccion[atrib.id] ?? ''}
              onChange={(e) => setSeleccion({ ...seleccion, [atrib.id]: e.target.value })}
              className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
            >
              <option value="">Sin valor</option>
              {atrib.valoresAtributo.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.valor}
                </option>
              ))}
            </select>
          </label>
        ))}
        {error ? <p className="text-sm text-rosa">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={!sku || !precio || enviando}>
            Crear
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

// --- Diálogo de cambio de precio (por variante) --------------------------------

function ModalPrecioVariante({
  variante,
  accessToken,
  onCerrar,
  onCambiado,
}: {
  variante: VarianteDetalle;
  accessToken: string;
  onCerrar: () => void;
  onCambiado: () => void;
}) {
  const { obtenerNumero } = useConfiguracion();
  const tasaUsd = obtenerNumero('moneda.tasa_usd');

  const [precio, setPrecio] = useState(String(variante.precioActual));
  const [costo, setCosto] = useState(
    variante.costoActual !== null ? String(variante.costoActual) : '',
  );
  const [precioUsd, setPrecioUsd] = useState('');
  const [motivo, setMotivo] = useState('');
  const [confirmarBajoCosto, setConfirmarBajoCosto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const precioNum = Number(precio) || 0;
  const costoNum = costo ? Number(costo) : null;
  const variacionPct =
    variante.precioActual > 0
      ? ((precioNum - variante.precioActual) / variante.precioActual) * 100
      : 0;
  const margenPct =
    costoNum !== null && precioNum > 0 ? ((precioNum - costoNum) / precioNum) * 100 : null;
  const bajoCosto = costoNum !== null && precioNum < costoNum;
  const usdCalculado = tasaUsd ? Math.round((precioNum / tasaUsd) * 100) / 100 : null;

  async function enviar(datos: {
    precio: number;
    costo?: number;
    precioUsd?: number;
    motivo: string;
  }) {
    setEnviando(true);
    setError(null);
    try {
      await api.cambiarPrecioVariante(accessToken, variante.id, datos);
      onCambiado();
    } catch (e) {
      setError(e instanceof api.ErrorProductosAdmin ? e.message : 'No se pudo cambiar el precio');
    } finally {
      setEnviando(false);
    }
  }

  function alConfirmarFormulario(evento: FormEvent) {
    evento.preventDefault();
    const datos = {
      precio: precioNum,
      costo: costoNum ?? undefined,
      precioUsd: precioUsd ? Number(precioUsd) : undefined,
      motivo,
    };
    if (bajoCosto) {
      setConfirmarBajoCosto(true);
      return;
    }
    void enviar(datos);
  }

  return (
    <Modal abierto titulo={`Cambiar precio — ${variante.sku}`} onCerrar={onCerrar}>
      <form onSubmit={alConfirmarFormulario} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-texto-secundario">Precio anterior</span>
            <p className="text-tinta">{formatearPesos(variante.precioActual)}</p>
          </div>
          <div>
            <span className="text-texto-secundario">Variación</span>
            <p className={variacionPct < 0 ? 'text-rosa' : 'text-verde'}>
              {variacionPct >= 0 ? '+' : ''}
              {variacionPct.toFixed(1)}%
            </p>
          </div>
        </div>
        <CampoTexto
          etiqueta="Precio nuevo"
          type="number"
          min={1}
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          required
        />
        <CampoTexto
          etiqueta="Costo"
          type="number"
          min={0}
          value={costo}
          onChange={(e) => setCosto(e.target.value)}
        />
        <div>
          <CampoTexto
            etiqueta="Precio en USD (opcional)"
            type="number"
            min={0}
            step="0.01"
            value={precioUsd}
            onChange={(e) => setPrecioUsd(e.target.value)}
          />
          {!precioUsd && usdCalculado !== null ? (
            <p className="mt-1 text-[12px] text-texto-secundario">
              Si se deja vacío, queda en US${usdCalculado.toFixed(2)} calculado con la tasa vigente.
            </p>
          ) : null}
        </div>
        {margenPct !== null ? (
          <p className={`text-[13px] ${bajoCosto ? 'text-rosa' : 'text-texto-secundario'}`}>
            Margen resultante: {margenPct.toFixed(1)}%
            {bajoCosto ? ' — el precio queda por debajo del costo' : ''}
          </p>
        ) : null}
        <label className="flex flex-col gap-1 text-sm text-tinta">
          Motivo
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            required
            className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-rosa">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={!precio || !motivo || enviando}>
            Guardar precio
          </Boton>
        </div>

        {variante.historialPrecios.length > 0 ? (
          <div className="mt-2 border-t border-linea pt-3">
            <p className="mb-2 text-[12.5px] font-medium text-tinta">Historial</p>
            <ul className="flex flex-col gap-1.5">
              {variante.historialPrecios.map((h) => (
                <li key={h.id} className="text-[12px] text-texto-secundario">
                  {formatearFechaHora(h.creadoEn)} · {formatearPesos(h.precio)}
                  {h.usuario ? ` · ${h.usuario.nombre}` : ''}
                  {h.motivo ? ` — ${h.motivo}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>

      <Modal
        abierto={confirmarBajoCosto}
        titulo="El precio queda por debajo del costo"
        onCerrar={() => setConfirmarBajoCosto(false)}
      >
        <p className="text-sm text-tinta">
          {formatearPesos(precioNum)} es menor que el costo (
          {costoNum !== null ? formatearPesos(costoNum) : '—'}
          ). ¿Guardar igual?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={() => setConfirmarBajoCosto(false)}>
            Cancelar
          </Boton>
          <Boton
            type="button"
            onClick={() => {
              setConfirmarBajoCosto(false);
              void enviar({
                precio: precioNum,
                costo: costoNum ?? undefined,
                precioUsd: precioUsd ? Number(precioUsd) : undefined,
                motivo,
              });
            }}
            disabled={enviando}
          >
            Guardar igual
          </Boton>
        </div>
      </Modal>
    </Modal>
  );
}

// --- Precios en bloque ---------------------------------------------------------

function PestanaPrecios({
  producto,
  accessToken,
  puedePrecios,
  onCambiado,
}: {
  producto: ProductoDetalle;
  accessToken: string;
  puedePrecios: boolean;
  onCambiado: () => void;
}) {
  const [modo, setModo] = useState<'porcentaje' | 'precioUnico'>('porcentaje');
  const [porcentaje, setPorcentaje] = useState('8');
  const [precioUnico, setPrecioUnico] = useState('');
  const [precioUsdUnico, setPrecioUsdUnico] = useState('');
  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!puedePrecios) {
    return (
      <Seccion titulo="Precios">
        <p className="text-sm text-texto-secundario">
          No tienes permiso para cambiar precios en bloque.
        </p>
      </Seccion>
    );
  }

  if (producto.variantes.length === 0) {
    return (
      <Seccion titulo="Precios">
        <p className="text-sm text-texto-secundario">
          Este producto todavía no tiene variantes para ajustar.
        </p>
      </Seccion>
    );
  }

  const preview = producto.variantes.map((v) => {
    const nuevo =
      modo === 'porcentaje'
        ? Math.max(1, Math.round(v.precioActual * (1 + (Number(porcentaje) || 0) / 100)))
        : Number(precioUnico) || 0;
    return { variante: v, nuevo };
  });

  function alConfirmarFormulario(evento: FormEvent) {
    evento.preventDefault();
    setConfirmando(true);
  }

  async function aplicar() {
    setEnviando(true);
    setError(null);
    try {
      const datos: DatosPreciosProducto =
        modo === 'porcentaje'
          ? { modo: 'porcentaje', porcentaje: Number(porcentaje), motivo }
          : {
              modo: 'precioUnico',
              precio: Number(precioUnico),
              precioUsd: precioUsdUnico ? Number(precioUsdUnico) : undefined,
              motivo,
            };
      await api.cambiarPreciosProducto(accessToken, producto.id, datos);
      setConfirmando(false);
      onCambiado();
    } catch (e) {
      setError(e instanceof api.ErrorProductosAdmin ? e.message : 'No se pudo cambiar los precios');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Seccion titulo="Cambiar precios en bloque">
      <form onSubmit={alConfirmarFormulario} className="flex flex-col gap-4">
        <div role="group" className="flex gap-2">
          <button
            type="button"
            onClick={() => setModo('porcentaje')}
            className={`rounded-full px-4 py-1.5 text-[13px] ${modo === 'porcentaje' ? 'bg-negro text-hueso' : 'border border-linea text-texto-secundario'}`}
          >
            Ajuste porcentual
          </button>
          <button
            type="button"
            onClick={() => setModo('precioUnico')}
            className={`rounded-full px-4 py-1.5 text-[13px] ${modo === 'precioUnico' ? 'bg-negro text-hueso' : 'border border-linea text-texto-secundario'}`}
          >
            Precio único
          </button>
        </div>

        {modo === 'porcentaje' ? (
          <CampoTexto
            etiqueta="Porcentaje (positivo sube, negativo baja)"
            type="number"
            value={porcentaje}
            onChange={(e) => setPorcentaje(e.target.value)}
            required
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <CampoTexto
              etiqueta="Precio único"
              type="number"
              min={1}
              value={precioUnico}
              onChange={(e) => setPrecioUnico(e.target.value)}
              required
            />
            <CampoTexto
              etiqueta="Precio USD (opcional)"
              type="number"
              min={0}
              step="0.01"
              value={precioUsdUnico}
              onChange={(e) => setPrecioUsdUnico(e.target.value)}
            />
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm text-tinta">
          Motivo
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            required
            className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
          />
        </label>

        {error ? <p className="text-sm text-rosa">{error}</p> : null}
        <div>
          <Boton type="submit" disabled={!motivo}>
            Revisar cambio
          </Boton>
        </div>
      </form>

      <Modal
        abierto={confirmando}
        titulo="Confirmar cambio de precios"
        onCerrar={() => setConfirmando(false)}
      >
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-texto-secundario uppercase">
                <th className="py-1">SKU</th>
                <th className="py-1 text-right">Antes</th>
                <th className="py-1 text-right">Después</th>
              </tr>
            </thead>
            <tbody>
              {preview.map(({ variante, nuevo }) => (
                <tr key={variante.id} className="border-t border-linea">
                  <td className="py-1.5">{variante.sku}</td>
                  <td className="py-1.5 text-right text-texto-secundario">
                    {formatearPesos(variante.precioActual)}
                  </td>
                  <td className="py-1.5 text-right font-medium text-tinta">
                    {formatearPesos(nuevo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={() => setConfirmando(false)}>
            Cancelar
          </Boton>
          <Boton type="button" onClick={() => void aplicar()} disabled={enviando}>
            Confirmar
          </Boton>
        </div>
      </Modal>
    </Seccion>
  );
}
