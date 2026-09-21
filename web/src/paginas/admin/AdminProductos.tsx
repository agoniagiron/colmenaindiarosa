import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Boton } from '../../componentes/Boton.tsx';
import { CampoTexto } from '../../componentes/CampoTexto.tsx';
import { EsqueletoCarga } from '../../componentes/EsqueletoCarga.tsx';
import { Modal } from '../../componentes/Modal.tsx';
import * as api from '../../contexto/apiProductosAdmin.ts';
import type {
  EstadoPublicacion,
  FilaProductoAdmin,
  ListadoProductos,
} from '../../contexto/apiProductosAdmin.ts';
import { useSesionAdmin } from '../../contexto/ContextoSesionAdmin.tsx';
import { repositorio } from '../../datos/index.ts';
import type { Categoria } from '../../tipos/index.ts';
import { useDebounce } from '../../utilidades/useDebounce.ts';
import { formatearPesos } from '../../utilidades/formatearPesos.ts';

const ETIQUETAS_ESTADO: Record<EstadoPublicacion, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  archivado: 'Archivado',
};

const CLASES_ESTADO: Record<EstadoPublicacion, string> = {
  borrador: 'bg-arena text-texto-secundario',
  publicado: 'bg-verde-luz text-verde',
  archivado: 'border border-linea bg-transparent text-texto-secundario/60',
};

function EstadoBadge({ estado }: { estado: EstadoPublicacion }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[12px] ${CLASES_ESTADO[estado]}`}>
      {ETIQUETAS_ESTADO[estado]}
    </span>
  );
}

function formatearRango(rango: FilaProductoAdmin['rangoPrecios']): string {
  if (!rango) return '—';
  if (rango.min === rango.max) return formatearPesos(rango.min);
  return `${formatearPesos(rango.min)} – ${formatearPesos(rango.max)}`;
}

export function AdminProductos() {
  const { usuarioAdmin, accessToken } = useSesionAdmin();
  const [searchParams, setSearchParams] = useSearchParams();

  const [listado, setListado] = useState<ListadoProductos | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);

  const categoriaId = searchParams.get('categoria') ?? '';
  const estadoParam = searchParams.get('estado');
  const estado: EstadoPublicacion | '' =
    estadoParam === 'borrador' || estadoParam === 'publicado' || estadoParam === 'archivado'
      ? estadoParam
      : '';
  const buscarUrl = searchParams.get('buscar') ?? '';
  const pagina = Math.max(1, Number(searchParams.get('pagina')) || 1);

  const [buscarInput, setBuscarInput] = useState(buscarUrl);
  const buscarDiferido = useDebounce(buscarInput, 400);

  useEffect(() => {
    setBuscarInput(buscarUrl);
  }, [buscarUrl]);

  useEffect(() => {
    if (buscarDiferido === buscarUrl) return;
    const params = new URLSearchParams(searchParams);
    if (buscarDiferido) params.set('buscar', buscarDiferido);
    else params.delete('buscar');
    params.delete('pagina');
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscarDiferido]);

  useEffect(() => {
    repositorio
      .listarCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    let vigente = true;
    setListado(null);
    api
      .listarProductos(accessToken, {
        categoriaId: categoriaId || undefined,
        estado: estado || undefined,
        buscar: buscarUrl || undefined,
        pagina,
      })
      .then((r) => {
        if (vigente) setListado(r);
      })
      .catch(() => {
        if (vigente) {
          setListado({
            datos: [],
            paginacion: { pagina: 1, porPagina: 20, total: 0, totalPaginas: 0 },
          });
        }
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, categoriaId, estado, buscarUrl, pagina]);

  if (!usuarioAdmin || !accessToken) return null;
  if (!usuarioAdmin.permisos.includes('productos.ver')) {
    return <Navigate to="/admin" replace />;
  }
  const puedeCrear = usuarioAdmin.permisos.includes('productos.crear');

  function actualizarParametro(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams);
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    params.delete('pagina');
    setSearchParams(params, { replace: true });
  }

  function irAPagina(nuevaPagina: number) {
    const params = new URLSearchParams(searchParams);
    if (nuevaPagina > 1) params.set('pagina', String(nuevaPagina));
    else params.delete('pagina');
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[28px] text-tinta">Productos</h1>
          <p className="mt-1.5 text-sm text-texto-secundario">Catálogo, variantes y precios.</p>
        </div>
        {puedeCrear ? (
          <Boton type="button" onClick={() => setModalNuevoAbierto(true)}>
            Nuevo producto
          </Boton>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12.5px] text-texto-secundario">
          Categoría
          <select
            value={categoriaId}
            onChange={(e) => actualizarParametro('categoria', e.target.value)}
            className="rounded-lg border border-linea bg-hueso px-3 py-1.5 text-sm text-tinta"
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] text-texto-secundario">
          Estado
          <select
            value={estado}
            onChange={(e) => actualizarParametro('estado', e.target.value)}
            className="rounded-lg border border-linea bg-hueso px-3 py-1.5 text-sm text-tinta"
          >
            <option value="">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="publicado">Publicado</option>
            <option value="archivado">Archivado</option>
          </select>
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[12.5px] text-texto-secundario">
          Buscar
          <input
            type="search"
            value={buscarInput}
            onChange={(e) => setBuscarInput(e.target.value)}
            placeholder="Nombre del producto"
            className="rounded-lg border border-linea bg-hueso px-3 py-1.5 text-sm text-tinta"
          />
        </label>
      </div>

      <section className="overflow-x-auto rounded-lg border border-linea bg-arena">
        {listado === null ? (
          <div className="flex flex-col gap-2.5 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <EsqueletoCarga key={i} alto="h-10" />
            ))}
          </div>
        ) : listado.datos.length === 0 ? (
          <p className="p-8 text-center text-sm text-texto-secundario">
            No hay productos que coincidan con estos filtros.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11.5px] tracking-wide text-texto-secundario uppercase">
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3 text-right">Variantes</th>
                <th className="px-4 py-3 text-right">Precios</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Calificación</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {listado.datos.map((producto) => (
                <tr key={producto.id} className="border-t border-linea bg-hueso hover:bg-arena">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/productos/${encodeURIComponent(producto.id)}`}
                      className="font-medium text-rosa hover:underline"
                    >
                      {producto.nombre}
                    </Link>
                    {producto.agotado ? (
                      <p className="mt-0.5 text-[11px] text-ambar">
                        Publicado y agotado en todas sus variantes
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-texto-secundario">{producto.categoria.nombre}</td>
                  <td className="px-4 py-3 text-right">{producto.cantidadVariantes}</td>
                  <td className="px-4 py-3 text-right">{formatearRango(producto.rangoPrecios)}</td>
                  <td className="px-4 py-3 text-right">{producto.stockTotal}</td>
                  <td className="px-4 py-3 text-right">
                    {producto.calificacionPromedio !== null
                      ? producto.calificacionPromedio.toFixed(1).replace('.', ',')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <EstadoBadge estado={producto.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {listado && listado.paginacion.totalPaginas > 1 ? (
        <nav aria-label="Paginación" className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => irAPagina(pagina - 1)}
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
            onClick={() => irAPagina(pagina + 1)}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-tinta hover:bg-arena disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
          </button>
        </nav>
      ) : null}

      <ModalNuevoProducto
        abierto={modalNuevoAbierto}
        onCerrar={() => setModalNuevoAbierto(false)}
        categorias={categorias}
        accessToken={accessToken}
      />
    </div>
  );
}

function ModalNuevoProducto({
  abierto,
  onCerrar,
  categorias,
  accessToken,
}: {
  abierto: boolean;
  onCerrar: () => void;
  categorias: Categoria[];
  accessToken: string;
}) {
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      setNombre('');
      setCategoriaId('');
      setError(null);
    }
  }, [abierto]);

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    if (!categoriaId) return;
    setEnviando(true);
    setError(null);
    try {
      const producto = await api.crearProducto(accessToken, { nombre, categoriaId });
      window.location.assign(`/admin/productos/${producto.id}`);
    } catch (e) {
      setError(e instanceof api.ErrorProductosAdmin ? e.message : 'No se pudo crear el producto');
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Nuevo producto" onCerrar={onCerrar}>
      <form onSubmit={crear} className="flex flex-col gap-3">
        <p className="text-[13px] text-texto-secundario">
          Se crea en borrador con lo mínimo; el resto (descripciones, variantes, precios) se
          completa en el detalle.
        </p>
        <CampoTexto
          etiqueta="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <label className="flex flex-col gap-1 text-sm text-tinta">
          Categoría
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
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
        {error ? <p className="text-sm text-rosa">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={!nombre || !categoriaId || enviando}>
            Crear
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
