import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { Boton } from '../componentes/Boton.tsx';
import { CampoTexto } from '../componentes/CampoTexto.tsx';
import { EstadoVacio } from '../componentes/EstadoVacio.tsx';
import { ImagenProducto } from '../componentes/ImagenProducto.tsx';
import { Modal } from '../componentes/Modal.tsx';
import { useCarrito } from '../contexto/ContextoCarrito.tsx';
import { useSesion } from '../contexto/ContextoSesion.tsx';
import { construirMensajeWhatsapp } from '../dominio/construirMensajeWhatsapp.ts';
import { formatearEspecificacionesVariante } from '../dominio/formatearEspecificacionesVariante.ts';
import { formatearPesos } from '../utilidades/formatearPesos.ts';
import type { LineaCarrito } from '../tipos/index.ts';

const NUMERO_WHATSAPP = import.meta.env.VITE_NUMERO_WHATSAPP as string | undefined;

// Contador en memoria: alcanza para esta fase sin backend. Vive a nivel de
// módulo para sobrevivir a que el componente se desmonte y remonte.
let contadorPedidos = 0;

function generarNumeroPedido(): string {
  contadorPedidos += 1;
  return `INR-${String(contadorPedidos).padStart(6, '0')}`;
}

export function CarritoPagina() {
  const navigate = useNavigate();
  const {
    lineas,
    cupon,
    totales,
    cargandoCupon,
    errorCupon,
    cambiarCantidad,
    quitar,
    aplicarCupon,
    quitarCupon,
  } = useCarrito();
  const { usuario } = useSesion();

  const [mensaje, setMensaje] = useState<string | null>(null);
  const [numeroPedido, setNumeroPedido] = useState<string | null>(null);

  const totalUnidades = lineas.reduce((acumulado, linea) => acumulado + linea.cantidad, 0);

  function alEnviarPorWhatsapp() {
    const numero = generarNumeroPedido();
    const texto = construirMensajeWhatsapp({
      numeroPedido: numero,
      nombreCliente: usuario?.nombre,
      lineas,
      cupon,
      totales,
    });
    setNumeroPedido(numero);
    setMensaje(texto);
  }

  if (lineas.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <EstadoVacio
          icono={<IconoCarritoVacio />}
          titulo="Tu carrito está vacío"
          descripcion="Todavía no has agregado productos. Explora el catálogo para encontrar tu próxima peluca o extensión."
          accion={
            <Boton type="button" variante="rosa" onClick={() => navigate('/catalogo')}>
              Ver catálogo
            </Boton>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-2xl text-tinta">
        Carrito ({totalUnidades} {totalUnidades === 1 ? 'artículo' : 'artículos'})
      </h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col divide-y divide-linea border-y border-linea">
            {lineas.map((linea) => (
              <FilaCarrito
                key={linea.varianteId}
                linea={linea}
                onCambiarCantidad={(cantidad) => cambiarCantidad(linea.varianteId, cantidad)}
                onQuitar={() => quitar(linea.varianteId)}
              />
            ))}
          </ul>

          <CampoCupon
            cupon={cupon}
            cargando={cargandoCupon}
            error={errorCupon}
            onAplicar={aplicarCupon}
            onQuitar={quitarCupon}
          />
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="flex flex-col gap-4 rounded-2xl border border-linea bg-white p-6">
            <h2 className="font-serif text-lg text-tinta">Resumen</h2>

            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between text-tinta">
                <dt className="text-texto-secundario">Subtotal</dt>
                <dd>{formatearPesos(totales.subtotal)}</dd>
              </div>
              {totales.descuento > 0 ? (
                <div className="flex justify-between text-whatsapp">
                  <dt>Descuento{cupon ? ` (${cupon.codigo})` : ''}</dt>
                  <dd>-{formatearPesos(totales.descuento)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between text-tinta">
                <dt className="text-texto-secundario">Envío</dt>
                <dd>{totales.envio === 0 ? 'Gratis' : formatearPesos(totales.envio)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-linea pt-2 text-base font-semibold text-tinta">
                <dt>Total</dt>
                <dd>{formatearPesos(totales.total)}</dd>
              </div>
            </dl>

            <Boton
              type="button"
              variante="whatsapp"
              className="w-full"
              onClick={alEnviarPorWhatsapp}
            >
              Enviar pedido por WhatsApp
            </Boton>
            <p className="text-xs text-texto-secundario">
              Confirmamos disponibilidad y forma de pago por chat antes de despachar.
            </p>
          </div>
        </div>
      </div>

      <ModalMensajeWhatsapp
        numeroPedido={numeroPedido}
        mensaje={mensaje}
        onCerrar={() => setMensaje(null)}
      />
    </div>
  );
}

// --- Fila de carrito ---------------------------------------------------------

function FilaCarrito({
  linea,
  onCambiarCantidad,
  onQuitar,
}: {
  linea: LineaCarrito;
  onCambiarCantidad: (cantidad: number) => void;
  onQuitar: () => void;
}) {
  const subtotalLinea = linea.precioUnitario * linea.cantidad;
  const especificaciones = formatearEspecificacionesVariante(linea);

  return (
    <li className="flex gap-4 py-5">
      <div className="w-20 shrink-0 sm:w-24">
        <ImagenProducto nombre={linea.nombreProducto} colorHex={linea.color?.hex} />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <p className="font-serif text-base text-tinta">{linea.nombreProducto}</p>
        {especificaciones ? (
          <p className="text-sm text-texto-secundario">{especificaciones}</p>
        ) : null}
        <p className="text-sm text-texto-secundario">{formatearPesos(linea.precioUnitario)}</p>

        <div className="mt-2 flex flex-wrap items-center gap-4">
          <ControlCantidad cantidad={linea.cantidad} onCambiar={onCambiarCantidad} />
          <span className="text-sm font-semibold text-tinta">{formatearPesos(subtotalLinea)}</span>
          <button
            type="button"
            onClick={onQuitar}
            className="rounded-md text-sm text-texto-secundario underline-offset-2 hover:text-rosa hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            Quitar
          </button>
        </div>
      </div>
    </li>
  );
}

function ControlCantidad({
  cantidad,
  onCambiar,
}: {
  cantidad: number;
  onCambiar: (cantidad: number) => void;
}) {
  return (
    <div className="flex items-center rounded-full border border-linea">
      <button
        type="button"
        onClick={() => onCambiar(Math.max(1, cantidad - 1))}
        disabled={cantidad <= 1}
        aria-label="Restar una unidad"
        className="px-3 py-1 text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      <span className="w-6 text-center text-sm text-tinta">{cantidad}</span>
      <button
        type="button"
        onClick={() => onCambiar(cantidad + 1)}
        aria-label="Sumar una unidad"
        className="px-3 py-1 text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
      >
        +
      </button>
    </div>
  );
}

// --- Código promocional ------------------------------------------------------

function CampoCupon({
  cupon,
  cargando,
  error,
  onAplicar,
  onQuitar,
}: {
  cupon: { codigo: string } | null;
  cargando: boolean;
  error: string | null;
  onAplicar: (codigo: string) => Promise<void>;
  onQuitar: () => void;
}) {
  const [codigo, setCodigo] = useState('');

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!codigo.trim() || cargando) return;
    void onAplicar(codigo.trim());
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={alEnviar} className="flex items-end gap-2">
        <div className="flex-1">
          <CampoTexto
            etiqueta="Código promocional"
            placeholder="Código promocional"
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value)}
          />
        </div>
        <Boton type="submit" variante="fantasma" disabled={cargando || !codigo.trim()}>
          Aplicar
        </Boton>
      </form>

      {cupon ? (
        <p className="text-sm text-whatsapp">
          Cupón {cupon.codigo} aplicado.{' '}
          <button
            type="button"
            onClick={onQuitar}
            className="rounded-md underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            Quitar
          </button>
        </p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}

// --- Modal de vista previa del mensaje ---------------------------------------

function ModalMensajeWhatsapp({
  numeroPedido,
  mensaje,
  onCerrar,
}: {
  numeroPedido: string | null;
  mensaje: string | null;
  onCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiarMensaje() {
    if (!mensaje) return;
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin acceso al portapapeles: el texto sigue visible para copiarlo a mano.
    }
  }

  function abrirWhatsapp() {
    if (!mensaje || !NUMERO_WHATSAPP) return;
    const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <Modal abierto={mensaje !== null} titulo={`Pedido ${numeroPedido ?? ''}`} onCerrar={onCerrar}>
      <div className="flex flex-col gap-4">
        <pre className="max-h-80 overflow-y-auto rounded-xl bg-arena p-4 text-sm whitespace-pre-wrap text-tinta">
          {mensaje}
        </pre>
        {!NUMERO_WHATSAPP ? (
          <p className="text-xs text-texto-secundario">
            Falta configurar el número de WhatsApp de la tienda para poder abrir el chat
            directamente; por ahora puedes copiar el mensaje.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Boton type="button" variante="fantasma" onClick={() => void copiarMensaje()}>
            {copiado ? '¡Copiado!' : 'Copiar'}
          </Boton>
          <Boton
            type="button"
            variante="whatsapp"
            disabled={!NUMERO_WHATSAPP}
            onClick={abrirWhatsapp}
          >
            Abrir WhatsApp
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

// --- Estado vacío -------------------------------------------------------------

function IconoCarritoVacio() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-10 w-10"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6"
      />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </svg>
  );
}
