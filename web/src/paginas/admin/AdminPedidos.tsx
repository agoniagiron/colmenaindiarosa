import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { EsqueletoCarga } from '../../componentes/EsqueletoCarga.tsx';
import { EstadoPedidoBadge } from '../../componentes/EstadoPedidoBadge.tsx';
import * as api from '../../contexto/apiPedidosAdmin.ts';
import type {
  EstadoPedido,
  FilaPedidoAdmin,
  ListadoPedidos,
  ResumenEstadosPedidos,
} from '../../contexto/apiPedidosAdmin.ts';
import { useSesionAdmin } from '../../contexto/ContextoSesionAdmin.tsx';
import { ETIQUETAS_METODO_PAGO } from '../../dominio/etiquetasPedido.ts';
import { useDebounce } from '../../utilidades/useDebounce.ts';
import { formatearFechaHora } from '../../utilidades/formatearFechaHora.ts';
import { formatearPesos } from '../../utilidades/formatearPesos.ts';

const HORAS_ALERTA_ESPERANDO_PAGO = 24;
const MS_POR_HORA = 60 * 60 * 1000;

const TABS: { valor: EstadoPedido | 'todos'; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'esperandoPago', etiqueta: 'Esperando pago' },
  { valor: 'pagado', etiqueta: 'Pagados' },
  { valor: 'enPreparacion', etiqueta: 'En preparación' },
  { valor: 'despachado', etiqueta: 'Despachados' },
  { valor: 'entregado', etiqueta: 'Entregados' },
  { valor: 'cancelado', etiqueta: 'Cancelados' },
];

function llevaMasDeUnDiaEsperandoPago(pedido: FilaPedidoAdmin): boolean {
  if (pedido.estado !== 'esperandoPago') return false;
  const horas = (Date.now() - new Date(pedido.creadoEn).getTime()) / MS_POR_HORA;
  return horas > HORAS_ALERTA_ESPERANDO_PAGO;
}

export function AdminPedidos() {
  const { usuarioAdmin, accessToken } = useSesionAdmin();
  const [searchParams, setSearchParams] = useSearchParams();

  const [resumen, setResumen] = useState<ResumenEstadosPedidos | null>(null);
  const [listado, setListado] = useState<ListadoPedidos | null>(null);

  const estadoParam = searchParams.get('estado');
  const estado: EstadoPedido | 'todos' = TABS.some((t) => t.valor === estadoParam)
    ? (estadoParam as EstadoPedido | 'todos')
    : 'todos';
  const desde = searchParams.get('desde') ?? '';
  const hasta = searchParams.get('hasta') ?? '';
  const buscarUrl = searchParams.get('buscar') ?? '';
  const pagina = Math.max(1, Number(searchParams.get('pagina')) || 1);

  const [buscarInput, setBuscarInput] = useState(buscarUrl);
  const buscarDiferido = useDebounce(buscarInput, 400);

  // Si cambia buscarUrl por fuera (p. ej. volver con el botón atrás), el
  // input local se resincroniza.
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

  // Todos los hooks van antes de cualquier return condicional (reglas de
  // hooks): las llamadas a la API simplemente no hacen nada sin token.
  useEffect(() => {
    if (!accessToken) return;
    let vigente = true;
    api
      .obtenerResumenEstados(accessToken)
      .then((r) => {
        if (vigente) setResumen(r);
      })
      .catch(() => {
        if (vigente) setResumen(null);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let vigente = true;
    setListado(null);
    api
      .listarPedidos(accessToken, {
        estado: estado === 'todos' ? undefined : estado,
        desde: desde || undefined,
        hasta: hasta || undefined,
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
  }, [accessToken, estado, desde, hasta, buscarUrl, pagina]);

  if (!usuarioAdmin || !accessToken) return null;
  if (!usuarioAdmin.permisos.includes('pedidos.ver')) {
    return <Navigate to="/admin" replace />;
  }

  function cambiarTab(nuevoEstado: EstadoPedido | 'todos') {
    const params = new URLSearchParams(searchParams);
    if (nuevoEstado === 'todos') params.delete('estado');
    else params.set('estado', nuevoEstado);
    params.delete('pagina');
    setSearchParams(params, { replace: true });
  }

  function cambiarFecha(clave: 'desde' | 'hasta', valor: string) {
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
      <div>
        <h1 className="font-serif text-[28px] text-tinta">Pedidos</h1>
        <p className="mt-1.5 text-sm text-texto-secundario">
          Seguimiento de pedidos, pagos y envíos.
        </p>
      </div>

      <nav
        aria-label="Filtro por estado"
        className="flex flex-wrap gap-1.5 rounded-full border border-linea bg-arena p-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.valor}
            type="button"
            aria-pressed={tab.valor === estado}
            onClick={() => cambiarTab(tab.valor)}
            className={`rounded-full px-4 py-1.5 text-[13px] whitespace-nowrap transition-colors ${
              tab.valor === estado
                ? 'bg-negro text-hueso'
                : 'text-texto-secundario hover:text-tinta'
            }`}
          >
            {tab.etiqueta}
            {resumen ? (
              <span className="ml-1.5 opacity-70">
                (
                {tab.valor === 'todos'
                  ? resumen.todos
                  : (resumen[tab.valor as keyof ResumenEstadosPedidos] ?? 0)}
                )
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12.5px] text-texto-secundario">
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => cambiarFecha('desde', e.target.value)}
            className="rounded-lg border border-linea bg-hueso px-3 py-1.5 text-sm text-tinta"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] text-texto-secundario">
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => cambiarFecha('hasta', e.target.value)}
            className="rounded-lg border border-linea bg-hueso px-3 py-1.5 text-sm text-tinta"
          />
        </label>
        <label className="flex flex-1 min-w-[220px] flex-col gap-1 text-[12.5px] text-texto-secundario">
          Buscar
          <input
            type="search"
            value={buscarInput}
            onChange={(e) => setBuscarInput(e.target.value)}
            placeholder="Número, nombre o teléfono"
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
            No hay pedidos que coincidan con estos filtros.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11.5px] tracking-wide text-texto-secundario uppercase">
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Clienta</th>
                <th className="px-4 py-3 text-right">Artículos</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {listado.datos.map((pedido) => {
                const alerta = llevaMasDeUnDiaEsperandoPago(pedido);
                return (
                  <tr
                    key={pedido.numero}
                    className={`border-t border-linea ${alerta ? 'bg-ambar-luz/60' : 'bg-hueso hover:bg-arena'}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/pedidos/${encodeURIComponent(pedido.numero)}`}
                        className="font-medium text-rosa hover:underline"
                      >
                        {pedido.numero}
                      </Link>
                      {alerta ? (
                        <p className="mt-0.5 text-[11px] text-ambar">
                          Más de {HORAS_ALERTA_ESPERANDO_PAGO}h esperando pago
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-texto-secundario">
                      {formatearFechaHora(pedido.creadoEn)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-tinta">{pedido.nombreContacto}</div>
                      <div className="text-[12px] text-texto-secundario">
                        {pedido.telefonoContacto}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{pedido.articulos}</td>
                    <td className="px-4 py-3 text-right">{formatearPesos(pedido.total)}</td>
                    <td className="px-4 py-3 text-texto-secundario">
                      {pedido.metodoPago ? ETIQUETAS_METODO_PAGO[pedido.metodoPago] : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoPedidoBadge estado={pedido.estado} />
                    </td>
                  </tr>
                );
              })}
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
    </div>
  );
}
