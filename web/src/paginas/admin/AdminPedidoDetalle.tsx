import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Boton } from '../../componentes/Boton.tsx';
import { CampoTexto } from '../../componentes/CampoTexto.tsx';
import { EsqueletoCarga } from '../../componentes/EsqueletoCarga.tsx';
import { EstadoPedidoBadge } from '../../componentes/EstadoPedidoBadge.tsx';
import { Modal } from '../../componentes/Modal.tsx';
import * as api from '../../contexto/apiPedidosAdmin.ts';
import type {
  DetallePago,
  DetallePedido,
  EstadoPedido,
  TipoReembolso,
} from '../../contexto/apiPedidosAdmin.ts';
import { useSesionAdmin } from '../../contexto/ContextoSesionAdmin.tsx';
import {
  ETIQUETAS_ESTADO_PEDIDO,
  ETIQUETAS_METODO_PAGO,
  ETIQUETAS_TIPO_REEMBOLSO,
  TODOS_LOS_ESTADOS,
} from '../../dominio/etiquetasPedido.ts';
import { formatearFechaHora } from '../../utilidades/formatearFechaHora.ts';
import { formatearPesos } from '../../utilidades/formatearPesos.ts';

// Solo para el mensaje de confirmación (copia, no la validación real: esa
// vive del lado del servidor en maquinaEstados.ts, que es la única fuente
// de verdad). Si esto queda desactualizado, lo peor que pasa es un texto
// impreciso en el modal, nunca un movimiento de inventario equivocado —
// eso lo decide siempre el backend.
function mensajeConsecuenciaInventario(actual: EstadoPedido, nuevo: EstadoPedido): string | null {
  if (nuevo !== 'cancelado') return null;
  if (actual === 'esperandoPago') {
    return 'Se liberará la reserva de stock de este pedido.';
  }
  if (['pagado', 'enPreparacion', 'despachado', 'entregado'].includes(actual)) {
    return 'Se devolverá al inventario el stock de las piezas de este pedido.';
  }
  return null;
}

function construirEnlaceWhatsApp(telefono: string, numeroPedido: string): string {
  const digitos = telefono.replace(/\D/g, '');
  // Números guardados como locales colombianos (10 dígitos, sin +57): wa.me
  // necesita el código de país. Si ya viene con 57 al inicio (13 dígitos),
  // se respeta tal cual.
  const conCodigoPais = digitos.startsWith('57') && digitos.length > 10 ? digitos : `57${digitos}`;
  const mensaje = encodeURIComponent(
    `Hola, te escribo por tu pedido ${numeroPedido} de India Rosa.`,
  );
  return `https://wa.me/${conCodigoPais}?text=${mensaje}`;
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-linea bg-arena p-5">
      <h2 className="font-serif text-lg text-tinta">{titulo}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-linea py-1.5 text-sm last:border-0">
      <span className="text-texto-secundario">{etiqueta}</span>
      <span className="text-right text-tinta">{valor}</span>
    </div>
  );
}

export function AdminPedidoDetalle() {
  const { numero } = useParams<{ numero: string }>();
  const { usuarioAdmin, accessToken } = useSesionAdmin();

  const [pedido, setPedido] = useState<DetallePedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  function recargar() {
    if (!accessToken || !numero) return;
    setCargando(true);
    api
      .obtenerDetallePedido(accessToken, numero)
      .then((r) => {
        setPedido(r);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof api.ErrorPedidosAdmin ? e.message : 'No se pudo cargar el pedido');
      })
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, numero]);

  if (!usuarioAdmin || !accessToken) return null;
  if (!usuarioAdmin.permisos.includes('pedidos.ver')) {
    return <Navigate to="/admin" replace />;
  }

  const puedeCambiarEstado = usuarioAdmin.permisos.includes('pedidos.cambiar_estado');
  const puedeReembolsar = usuarioAdmin.permisos.includes('pedidos.reembolsar');

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <Link to="/admin/pedidos" className="text-sm text-rosa hover:underline">
          ← Volver a pedidos
        </Link>
        <p className="text-sm text-texto-secundario">{error}</p>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="flex flex-col gap-3">
        <EsqueletoCarga alto="h-8" ancho="w-1/3" />
        <EsqueletoCarga alto="h-40" />
        <EsqueletoCarga alto="h-40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin/pedidos" className="text-sm text-rosa hover:underline">
            ← Volver a pedidos
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-serif text-[28px] text-tinta">{pedido.numero}</h1>
            <EstadoPedidoBadge estado={pedido.estado} />
          </div>
          <p className="mt-1 text-sm text-texto-secundario">
            {formatearFechaHora(pedido.creadoEn)}
          </p>
        </div>
        <a
          href={construirEnlaceWhatsApp(pedido.telefonoContacto, pedido.numero)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-whatsapp px-5 py-2.5 text-sm font-medium text-hueso transition-colors hover:bg-whatsapp/90"
        >
          Escribir por WhatsApp
        </a>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Seccion titulo="Resumen del pedido">
          <Fila etiqueta="Clienta" valor={pedido.nombreContacto} />
          <Fila etiqueta="Teléfono" valor={pedido.telefonoContacto} />
          <Fila etiqueta="Correo" valor={pedido.correoContacto ?? '—'} />
          <Fila etiqueta="Subtotal" valor={formatearPesos(pedido.subtotal)} />
          <Fila etiqueta="Descuento" valor={formatearPesos(pedido.descuento)} />
          <Fila etiqueta="Envío" valor={formatearPesos(pedido.envio)} />
          <Fila etiqueta="Total" valor={<b>{formatearPesos(pedido.total)}</b>} />
          {pedido.cuponCodigo ? <Fila etiqueta="Cupón" valor={pedido.cuponCodigo} /> : null}
        </Seccion>

        <SeccionCambioEstado
          pedido={pedido}
          puedeCambiar={puedeCambiarEstado}
          accessToken={accessToken}
          onCambiado={recargar}
        />
      </div>

      <Seccion titulo="Líneas del pedido">
        <div className="flex flex-col gap-3">
          {pedido.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-linea bg-hueso p-3.5">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-medium text-tinta">
                    {item.nombreCombo ?? item.nombreProducto}
                  </p>
                  <p className="text-[12.5px] text-texto-secundario">
                    {item.sku}
                    {item.colorNombre ? ` · ${item.colorNombre}` : ''}
                    {item.talla ? ` · Talla ${item.talla}` : ''}
                    {item.densidad ? ` · ${item.densidad}` : ''}
                    {item.longitud ? ` · ${item.longitud}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <div>
                    {item.cantidad} × {formatearPesos(item.precioUnitario)}
                  </div>
                  <div className="font-medium text-tinta">{formatearPesos(item.subtotal)}</div>
                </div>
              </div>
              {item.detallesCombo.length > 0 ? (
                <ul className="mt-2.5 ml-3 flex flex-col gap-1 border-l border-linea pl-3">
                  {item.detallesCombo.map((pieza) => (
                    <li key={pieza.id} className="text-[12.5px] text-texto-secundario">
                      {pieza.cantidad} × {pieza.nombreProducto}
                      {pieza.descripcionVariante ? ` (${pieza.descripcionVariante})` : ''} ·{' '}
                      {pieza.sku}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </Seccion>

      <SeccionEnvio pedido={pedido} accessToken={accessToken} onGuardado={recargar} />

      <Seccion titulo="Pagos">
        <div className="flex flex-col gap-4">
          {pedido.pagos.length === 0 ? (
            <p className="text-sm text-texto-secundario">Este pedido todavía no tiene pagos.</p>
          ) : (
            pedido.pagos.map((pago) => (
              <FilaPago
                key={pago.id}
                pago={pago}
                puedeReembolsar={puedeReembolsar}
                accessToken={accessToken}
                pedidoId={pedido.id}
                onReembolsado={recargar}
              />
            ))
          )}
        </div>
      </Seccion>

      <Seccion titulo="Historial de estados">
        {pedido.historial.length === 0 ? (
          <p className="text-sm text-texto-secundario">Todavía no hay cambios de estado.</p>
        ) : (
          <ol className="flex flex-col gap-3 border-l border-linea pl-4">
            {pedido.historial.map((h) => (
              <li key={h.id} className="relative text-sm">
                <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-rosa" />
                <p className="text-tinta">
                  {h.estadoAnterior ? (
                    <>
                      {ETIQUETAS_ESTADO_PEDIDO[h.estadoAnterior]} →{' '}
                      {ETIQUETAS_ESTADO_PEDIDO[h.estadoNuevo]}
                    </>
                  ) : (
                    ETIQUETAS_ESTADO_PEDIDO[h.estadoNuevo]
                  )}
                </p>
                <p className="text-[12.5px] text-texto-secundario">
                  {formatearFechaHora(h.creadoEn)}
                  {h.usuario ? ` · ${h.usuario.nombre}` : ''}
                </p>
                {h.nota ? <p className="mt-0.5 text-[13px] text-tinta">{h.nota}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Seccion>

      {cargando ? <p className="text-center text-xs text-texto-secundario">Actualizando…</p> : null}
    </div>
  );
}

// --- Cambio de estado --------------------------------------------------------

function SeccionCambioEstado({
  pedido,
  puedeCambiar,
  accessToken,
  onCambiado,
}: {
  pedido: DetallePedido;
  puedeCambiar: boolean;
  accessToken: string;
  onCambiado: () => void;
}) {
  const [nuevoEstado, setNuevoEstado] = useState<EstadoPedido | ''>('');
  const [nota, setNota] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!puedeCambiar) {
    return (
      <Seccion titulo="Estado">
        <p className="text-sm text-texto-secundario">
          No tienes permiso para cambiar el estado de este pedido.
        </p>
      </Seccion>
    );
  }

  const mensajeInventario = nuevoEstado
    ? mensajeConsecuenciaInventario(pedido.estado, nuevoEstado)
    : null;

  async function aplicarCambio() {
    if (!nuevoEstado) return;
    setEnviando(true);
    setError(null);
    try {
      await api.cambiarEstadoPedido(accessToken, pedido.id, nuevoEstado, nota || undefined);
      setNuevoEstado('');
      setNota('');
      setConfirmando(false);
      onCambiado();
    } catch (e) {
      setError(e instanceof api.ErrorPedidosAdmin ? e.message : 'No se pudo cambiar el estado');
    } finally {
      setEnviando(false);
    }
  }

  function alConfirmarFormulario(evento: FormEvent) {
    evento.preventDefault();
    if (!nuevoEstado) return;
    if (mensajeConsecuenciaInventario(pedido.estado, nuevoEstado)) {
      setConfirmando(true);
      return;
    }
    void aplicarCambio();
  }

  return (
    <Seccion titulo="Cambiar estado">
      <form onSubmit={alConfirmarFormulario} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-tinta">
          Nuevo estado
          <select
            value={nuevoEstado}
            onChange={(e) => setNuevoEstado(e.target.value as EstadoPedido)}
            className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
          >
            <option value="">Seleccionar…</option>
            {TODOS_LOS_ESTADOS.filter((e) => e !== pedido.estado).map((e) => (
              <option key={e} value={e}>
                {ETIQUETAS_ESTADO_PEDIDO[e]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-tinta">
          Nota (opcional)
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-rosa">{error}</p> : null}
        <Boton type="submit" disabled={!nuevoEstado || enviando}>
          Guardar estado
        </Boton>
      </form>

      <Modal
        abierto={confirmando}
        titulo="Confirmar cambio de estado"
        onCerrar={() => setConfirmando(false)}
      >
        <p className="text-sm text-tinta">
          ¿Cambiar el pedido {pedido.numero} a "
          {nuevoEstado ? ETIQUETAS_ESTADO_PEDIDO[nuevoEstado] : ''}"?
        </p>
        {mensajeInventario ? (
          <p className="mt-2 rounded-lg bg-ambar-luz px-3 py-2 text-[13px] text-ambar">
            {mensajeInventario}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={() => setConfirmando(false)}>
            Cancelar
          </Boton>
          <Boton type="button" onClick={() => void aplicarCambio()} disabled={enviando}>
            Confirmar
          </Boton>
        </div>
      </Modal>
    </Seccion>
  );
}

// --- Envío ---------------------------------------------------------------------

function SeccionEnvio({
  pedido,
  accessToken,
  onGuardado,
}: {
  pedido: DetallePedido;
  accessToken: string;
  onGuardado: () => void;
}) {
  const [transportadora, setTransportadora] = useState(pedido.transportadora ?? '');
  const [numeroGuia, setNumeroGuia] = useState(pedido.numeroGuia ?? '');
  const [urlSeguimiento, setUrlSeguimiento] = useState(pedido.urlSeguimiento ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTransportadora(pedido.transportadora ?? '');
    setNumeroGuia(pedido.numeroGuia ?? '');
    setUrlSeguimiento(pedido.urlSeguimiento ?? '');
  }, [pedido.transportadora, pedido.numeroGuia, pedido.urlSeguimiento]);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await api.actualizarEnvioPedido(accessToken, pedido.id, {
        transportadora: transportadora || undefined,
        numeroGuia: numeroGuia || undefined,
        urlSeguimiento: urlSeguimiento || undefined,
      });
      onGuardado();
    } catch (e) {
      setError(e instanceof api.ErrorPedidosAdmin ? e.message : 'No se pudo guardar el envío');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Seccion titulo="Dirección de envío">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Fila etiqueta="Destinatario" valor={pedido.envioNombre} />
          <Fila etiqueta="Teléfono" valor={pedido.envioTelefono} />
          <Fila etiqueta="Departamento" valor={pedido.envioDepartamento} />
          <Fila etiqueta="Ciudad" valor={pedido.envioCiudad} />
          <Fila etiqueta="Dirección" valor={pedido.envioDireccion} />
          {pedido.envioComplemento ? (
            <Fila etiqueta="Complemento" valor={pedido.envioComplemento} />
          ) : null}
          {pedido.envioNotas ? <Fila etiqueta="Notas" valor={pedido.envioNotas} /> : null}
        </div>
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <CampoTexto
            etiqueta="Transportadora"
            value={transportadora}
            onChange={(e) => setTransportadora(e.target.value)}
          />
          <CampoTexto
            etiqueta="Número de guía"
            value={numeroGuia}
            onChange={(e) => setNumeroGuia(e.target.value)}
          />
          <CampoTexto
            etiqueta="URL de seguimiento"
            type="url"
            value={urlSeguimiento}
            onChange={(e) => setUrlSeguimiento(e.target.value)}
          />
          {error ? <p className="text-sm text-rosa">{error}</p> : null}
          <Boton type="submit" variante="fantasma" disabled={guardando}>
            Guardar envío
          </Boton>
        </form>
      </div>
    </Seccion>
  );
}

// --- Pagos y reembolso -----------------------------------------------------------

function FilaPago({
  pago,
  puedeReembolsar,
  accessToken,
  pedidoId,
  onReembolsado,
}: {
  pago: DetallePago;
  puedeReembolsar: boolean;
  accessToken: string;
  pedidoId: string;
  onReembolsado: () => void;
}) {
  const [modalAbierto, setModalAbierto] = useState(false);

  const yaReembolsado = pago.reembolsos.reduce((suma, r) => suma + r.monto, 0);
  const disponible = pago.monto - yaReembolsado;
  const puedeAbrirReembolso = puedeReembolsar && pago.estado === 'aprobado' && disponible > 0;

  return (
    <div className="rounded-lg border border-linea bg-hueso p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-tinta">{ETIQUETAS_METODO_PAGO[pago.metodo]}</p>
          <p className="text-[12.5px] text-texto-secundario">
            Ref. interna {pago.referenciaInterna}
            {pago.referenciaExterna ? ` · Wompi ${pago.referenciaExterna}` : ''}
          </p>
          <p className="text-[12.5px] text-texto-secundario">
            {formatearFechaHora(pago.creadoEn)} · {pago.estado}
          </p>
        </div>
        <div className="text-right">
          <div className="font-medium text-tinta">{formatearPesos(pago.monto)}</div>
          {yaReembolsado > 0 ? (
            <div className="text-[12.5px] text-rosa">
              Reembolsado {formatearPesos(yaReembolsado)}
            </div>
          ) : null}
        </div>
      </div>

      {pago.reembolsos.length > 0 ? (
        <ul className="mt-2.5 flex flex-col gap-1 border-t border-linea pt-2.5">
          {pago.reembolsos.map((r) => (
            <li key={r.id} className="text-[12.5px] text-texto-secundario">
              {formatearPesos(r.monto)} · {ETIQUETAS_TIPO_REEMBOLSO[r.tipo] ?? r.tipo} · {r.estado}
              {r.motivo ? ` — ${r.motivo}` : ''}
            </li>
          ))}
        </ul>
      ) : null}

      {puedeAbrirReembolso ? (
        <div className="mt-3">
          <Boton type="button" variante="fantasma" onClick={() => setModalAbierto(true)}>
            Reembolsar
          </Boton>
        </div>
      ) : null}

      <ModalReembolso
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        pago={pago}
        disponible={disponible}
        accessToken={accessToken}
        pedidoId={pedidoId}
        onReembolsado={() => {
          setModalAbierto(false);
          onReembolsado();
        }}
      />
    </div>
  );
}

function ModalReembolso({
  abierto,
  onCerrar,
  pago,
  disponible,
  accessToken,
  pedidoId,
  onReembolsado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  pago: DetallePago;
  disponible: number;
  accessToken: string;
  pedidoId: string;
  onReembolsado: () => void;
}) {
  const [monto, setMonto] = useState(String(disponible));
  const [tipo, setTipo] = useState<TipoReembolso | ''>('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      setMonto(String(disponible));
      setTipo('');
      setMotivo('');
      setError(null);
    }
  }, [abierto, disponible]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!tipo) return;
    setEnviando(true);
    setError(null);
    try {
      await api.crearReembolso(accessToken, pedidoId, {
        pagoId: pago.id,
        monto: Number(monto),
        tipo,
        motivo,
      });
      onReembolsado();
    } catch (e) {
      setError(
        e instanceof api.ErrorPedidosAdmin ? e.message : 'No se pudo registrar el reembolso',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Registrar reembolso" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <p className="text-[13px] text-texto-secundario">
          Disponible para reembolsar: {formatearPesos(disponible)}
        </p>
        <CampoTexto
          etiqueta="Monto"
          type="number"
          min={1}
          max={disponible}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          required
        />
        <label className="flex flex-col gap-1 text-sm text-tinta">
          Motivo (categoría)
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoReembolso)}
            required
            className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
          >
            <option value="">Seleccionar…</option>
            <option value="retracto">Retracto</option>
            <option value="defecto">Producto con defecto</option>
            <option value="no_disponible">Producto no disponible</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-tinta">
          Detalle
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
          <Boton type="submit" disabled={!tipo || enviando}>
            Registrar
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
