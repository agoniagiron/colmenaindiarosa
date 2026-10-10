import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Contenedor } from '../componentes/Contenedor.tsx';
import { EsqueletoCarga } from '../componentes/EsqueletoCarga.tsx';
import * as apiPedidos from '../contexto/apiPedidos.ts';
import { ErrorPedidos } from '../contexto/apiPedidos.ts';
import type { PedidoDetalle } from '../contexto/apiPedidos.ts';
import { useSesion } from '../contexto/ContextoSesion.tsx';
import {
  ESTADOS_FUERA_DE_CAMINO,
  ETIQUETAS_ESTADO_PEDIDO_CLIENTA,
  PASOS_CAMINO_FELIZ,
} from '../dominio/etiquetasPedidoClienta.ts';
import { formatearFechaHora } from '../utilidades/formatearFechaHora.ts';
import { formatearPesos } from '../utilidades/formatearPesos.ts';

export function DetallePedidoPagina() {
  const { numero } = useParams<{ numero: string }>();
  const { usuario, accessToken, restaurando } = useSesion();

  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (restaurando || !accessToken || !numero) return;
    let vigente = true;
    apiPedidos
      .obtenerPedido(accessToken, numero)
      .then((r) => {
        if (vigente) setPedido(r);
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        setError(e instanceof ErrorPedidos ? e.message : 'No se pudo cargar el pedido');
      });
    return () => {
      vigente = false;
    };
  }, [restaurando, accessToken, numero]);

  if (restaurando) {
    return (
      <Contenedor ancho="normal" className="py-10">
        <p className="text-sm text-texto-secundario">Cargando…</p>
      </Contenedor>
    );
  }

  if (!usuario || !accessToken) {
    return <Navigate to={`/ingresar?regresar=/cuenta/pedidos/${encodeURIComponent(numero ?? '')}`} replace />;
  }

  return (
    <Contenedor ancho="normal" className="py-10">
      <Link to="/cuenta" className="text-sm text-rosa hover:underline">
        ← Volver a tus pedidos
      </Link>

      {error ? (
        <p className="mt-4 text-sm text-texto-secundario">{error}</p>
      ) : !pedido ? (
        <div className="mt-6 flex flex-col gap-3">
          <EsqueletoCarga alto="h-8" ancho="w-1/3" />
          <EsqueletoCarga alto="h-32" />
          <EsqueletoCarga alto="h-40" />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          <div>
            <h1 className="font-serif text-2xl text-tinta">{pedido.numero}</h1>
            <p className="mt-1 text-sm text-texto-secundario">
              {formatearFechaHora(pedido.creadoEn)} · {formatearPesos(pedido.total)}
            </p>
          </div>

          <SeguimientoPedido pedido={pedido} />

          <section className="rounded-2xl border border-linea bg-white p-6">
            <h2 className="font-serif text-lg text-tinta">Tus artículos</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {pedido.items.map((item) => (
                <li key={item.id} className="rounded-lg border border-linea p-3.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium text-tinta">{item.nombreCombo ?? item.nombreProducto}</p>
                      <p className="text-[12.5px] text-texto-secundario">
                        {item.colorNombre ? item.colorNombre : null}
                        {item.talla ? ` · Talla ${item.talla}` : ''}
                        {item.densidad ? ` · ${item.densidad}` : ''}
                        {item.longitud ? ` · ${item.longitud}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div>
                        {item.cantidad} × {formatearPesos(item.precioUnitario)}
                      </div>
                      <div className="font-medium text-tinta">{formatearPesos(item.subtotal)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-linea bg-white p-6">
            <h2 className="font-serif text-lg text-tinta">Envío</h2>
            <div className="mt-3 text-sm text-texto-secundario">
              <p className="text-tinta">{pedido.envioNombre}</p>
              <p>{pedido.envioTelefono}</p>
              <p>
                {pedido.envioDireccion}
                {pedido.envioComplemento ? `, ${pedido.envioComplemento}` : ''}
              </p>
              <p>
                {pedido.envioCiudad}, {pedido.envioDepartamento}
              </p>
            </div>
          </section>
        </div>
      )}
    </Contenedor>
  );
}

function SeguimientoPedido({ pedido }: { pedido: PedidoDetalle }) {
  if (ESTADOS_FUERA_DE_CAMINO.includes(pedido.estado)) {
    const ultimoCambio = pedido.historial.at(-1);
    return (
      <section className="rounded-2xl border border-linea bg-arena p-6">
        <p className="font-medium text-tinta">{ETIQUETAS_ESTADO_PEDIDO_CLIENTA[pedido.estado]}</p>
        <p className="mt-1 text-sm text-texto-secundario">
          {formatearFechaHora(ultimoCambio?.creadoEn ?? pedido.creadoEn)}
        </p>
      </section>
    );
  }

  const indiceActual = PASOS_CAMINO_FELIZ.indexOf(pedido.estado);

  return (
    <section className="rounded-2xl border border-linea bg-white p-6">
      <h2 className="font-serif text-lg text-tinta">Seguimiento</h2>
      <ol className="mt-4 flex flex-col gap-4">
        {PASOS_CAMINO_FELIZ.map((paso, indice) => {
          const entradaHistorial = pedido.historial.find((h) => h.estadoNuevo === paso);
          const fecha = entradaHistorial?.creadoEn ?? (paso === 'esperandoPago' ? pedido.creadoEn : null);
          const completado = indice < indiceActual;
          const actual = indice === indiceActual;
          return (
            <li key={paso} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  completado || actual ? 'bg-rosa' : 'bg-linea'
                }`}
              />
              <div className="flex-1">
                <p className={actual ? 'font-medium text-tinta' : 'text-texto-secundario'}>
                  {ETIQUETAS_ESTADO_PEDIDO_CLIENTA[paso]}
                </p>
                {fecha ? (
                  <p className="text-[12px] text-texto-secundario">{formatearFechaHora(fecha)}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
