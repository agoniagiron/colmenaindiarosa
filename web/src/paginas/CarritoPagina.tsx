import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { Boton } from '../componentes/Boton.tsx';
import { CampoTexto } from '../componentes/CampoTexto.tsx';
import { Contenedor } from '../componentes/Contenedor.tsx';
import { EstadoVacio } from '../componentes/EstadoVacio.tsx';
import { ImagenProducto } from '../componentes/ImagenProducto.tsx';
import { useCarrito } from '../contexto/ContextoCarrito.tsx';
import { useConfiguracion } from '../contexto/ContextoConfiguracion.tsx';
import type { LineaCarrito } from '../tipos/index.ts';
import { useAccionAsincrona } from '../utilidades/useAccionAsincrona.ts';

// Una línea que la clienta quitó y todavía puede recuperar. Ya no existe en
// el servidor (no cuenta para los totales): es solo lo necesario para
// volver a agregarla, y la posición en la que estaba en la lista. Vive en
// el estado de esta página: al salir del carrito, el deshacer se pierde.
interface LineaQuitada {
  linea: LineaCarrito;
  posicion: number;
}

type FilaLista =
  { tipo: 'linea'; linea: LineaCarrito } | { tipo: 'quitada'; quitada: LineaQuitada };

// Las quitadas vuelven a su posición entre las líneas vivas, en el orden en
// que estaban: así la fila de deshacer aparece donde estaba el producto.
function intercalar(lineas: LineaCarrito[], quitadas: LineaQuitada[]): FilaLista[] {
  const filas: FilaLista[] = lineas.map((linea) => ({ tipo: 'linea', linea }));
  for (const quitada of [...quitadas].sort((a, b) => a.posicion - b.posicion)) {
    filas.splice(Math.min(quitada.posicion, filas.length), 0, { tipo: 'quitada', quitada });
  }
  return filas;
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
    agregar,
    agregarCombo,
    aplicarCupon,
    quitarCupon,
  } = useCarrito();
  const { formatearMonto } = useConfiguracion();
  const [quitadas, setQuitadas] = useState<LineaQuitada[]>([]);

  const totalUnidades = lineas.reduce((acumulado, linea) => acumulado + linea.cantidad, 0);
  const filas = intercalar(lineas, quitadas);

  async function quitarLinea(linea: LineaCarrito, posicion: number) {
    if (!linea.id) return;
    await quitar(linea.id);
    setQuitadas((actuales) => [...actuales, { linea, posicion }]);
  }

  // Vuelve a agregar la misma variante (o el mismo kit) con la misma
  // cantidad. No es una restauración: el servidor valida el stock y el
  // precio de nuevo, y la línea vuelve donde la ubique la API.
  async function deshacer(quitada: LineaQuitada) {
    const { linea } = quitada;
    if (linea.tipo === 'combo' && linea.comboId) {
      await agregarCombo(linea.comboId, linea.cantidad);
    } else if (linea.varianteId) {
      await agregar(linea.varianteId, linea.cantidad);
    }
    setQuitadas((actuales) => actuales.filter((q) => q !== quitada));
  }

  function renderFila(fila: FilaLista, posicion: number) {
    if (fila.tipo === 'quitada') {
      return (
        <FilaQuitada
          key={`quitada-${fila.quitada.linea.id}`}
          linea={fila.quitada.linea}
          onDeshacer={() => deshacer(fila.quitada)}
        />
      );
    }
    const { linea } = fila;
    return (
      <FilaCarrito
        key={linea.id}
        linea={linea}
        onCambiarCantidad={async (cantidad) => {
          if (linea.id) await cambiarCantidad(linea.id, cantidad);
        }}
        onQuitar={() => quitarLinea(linea, posicion)}
      />
    );
  }

  if (lineas.length === 0) {
    return (
      <Contenedor ancho="normal" className="py-16">
        {quitadas.length > 0 ? (
          <ul className="mb-10 flex flex-col gap-3">{filas.map(renderFila)}</ul>
        ) : null}
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
      </Contenedor>
    );
  }

  return (
    <Contenedor ancho="normal" className="py-10">
      <h1 className="font-serif text-2xl text-tinta">
        Carrito ({totalUnidades} {totalUnidades === 1 ? 'artículo' : 'artículos'})
      </h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col divide-y divide-linea border-y border-linea">
            {filas.map(renderFila)}
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
          <div className="flex flex-col gap-4 rounded-lg border border-linea bg-white p-6">
            <h2 className="font-serif text-lg text-tinta">Resumen</h2>

            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between text-tinta">
                <dt className="text-texto-secundario">Subtotal</dt>
                <dd>{formatearMonto(totales.subtotal, totales.usd.subtotal)}</dd>
              </div>
              {totales.descuento > 0 ? (
                <div className="flex justify-between text-whatsapp">
                  <dt>Descuento{cupon ? ` (${cupon.codigo})` : ''}</dt>
                  <dd>-{formatearMonto(totales.descuento, totales.usd.descuento)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between text-tinta">
                <dt className="text-texto-secundario">Envío</dt>
                <dd>{formatearMonto(totales.envio, totales.usd.envio)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-linea pt-2 text-base font-semibold text-tinta">
                <dt>Total</dt>
                <dd>{formatearMonto(totales.total, totales.usd.total)}</dd>
              </div>
            </dl>

            <Boton
              type="button"
              variante="rosa"
              className="w-full"
              onClick={() => navigate('/checkout')}
            >
              Continuar al pago
            </Boton>
            <p className="text-xs text-texto-secundario">
              Pago seguro con Wompi. Coordinamos el envío por WhatsApp una vez confirmado.
            </p>
          </div>
        </div>
      </div>
    </Contenedor>
  );
}

// --- Fila de carrito ---------------------------------------------------------

function FilaCarrito({
  linea,
  onCambiarCantidad,
  onQuitar,
}: {
  linea: LineaCarrito;
  onCambiarCantidad: (cantidad: number) => Promise<void>;
  onQuitar: () => Promise<void>;
}) {
  const { formatearMonto } = useConfiguracion();
  const subtotalLinea = linea.precioUnitario * linea.cantidad;
  const sinDisponibilidadSuficiente =
    typeof linea.disponible === 'number' && linea.disponible < linea.cantidad;

  const { cargando: cambiando, ejecutar: ejecutarCambiar } = useAccionAsincrona(onCambiarCantidad);
  // Sin aviso de éxito: la confirmación es la fila de deshacer que queda en
  // el lugar de la línea.
  const { cargando: quitando, ejecutar: ejecutarQuitar } = useAccionAsincrona(onQuitar);
  // Una sola línea no permite dos operaciones a la vez: cambiar cantidad y
  // quitar tocan el mismo carrito_item.
  const cargando = cambiando || quitando;

  async function alCambiarCantidad(cantidad: number) {
    try {
      await ejecutarCambiar(cantidad);
    } catch {
      // El hook ya mostró el aviso de error.
    }
  }

  async function alQuitar() {
    try {
      await ejecutarQuitar();
    } catch {
      // El hook ya mostró el aviso de error.
    }
  }

  return (
    <li className="flex gap-4 py-5">
      <div className="w-20 shrink-0 sm:w-24">
        {/* La foto del color elegido (la resuelve el backend). */}
        <ImagenProducto
          nombre={linea.nombreProducto}
          colorHex={linea.color?.hex}
          url={linea.imagenUrl}
        />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <p className="font-serif text-base text-tinta">{linea.descripcion}</p>
        <p className="text-sm text-texto-secundario">{formatearMonto(linea.precioUnitario)}</p>
        {sinDisponibilidadSuficiente ? (
          <p className="text-sm text-red-600">
            {linea.disponible === 0
              ? 'Ya no hay disponibilidad de este producto.'
              : `Solo quedan ${linea.disponible} disponibles: ajustá la cantidad.`}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-4">
          <ControlCantidad
            cantidad={linea.cantidad}
            disponible={linea.disponible}
            cargando={cargando}
            onCambiar={alCambiarCantidad}
          />
          <span className="text-sm font-semibold text-tinta">{formatearMonto(subtotalLinea)}</span>
          {/* 44×44: área de toque cómoda en celular. Tinta sobre blanco
              para que se vea sin buscarlo; la etiqueta nombra la línea
              para que un lector de pantalla distinga una de otra. */}
          <button
            type="button"
            onClick={alQuitar}
            disabled={cargando}
            aria-busy={quitando || undefined}
            aria-label={`Quitar ${linea.descripcion} del carrito`}
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full text-tinta transition-colors hover:bg-rosa-palo/60 hover:text-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconoPapelera />
          </button>
        </div>
      </div>
    </li>
  );
}

// --- Fila de deshacer --------------------------------------------------------

// Ocupa el lugar de la línea quitada. Se ve distinta a propósito (sin foto,
// sin precio, borde punteado, fondo arena) para que no parezca que el
// producto sigue en el carrito; tampoco cuenta para el total, que sale del
// servidor y ya no la incluye.
function FilaQuitada({
  linea,
  onDeshacer,
}: {
  linea: LineaCarrito;
  onDeshacer: () => Promise<void>;
}) {
  const { cargando, ejecutar } = useAccionAsincrona(onDeshacer);
  const boton = useRef<HTMLButtonElement>(null);
  const idTexto = `quitada-${linea.id}`;

  // El botón de papelera desaparece al quitar: el foco pasa a Deshacer, que
  // es lo que está en ese mismo lugar, en vez de perderse al inicio de la
  // página.
  useEffect(() => {
    boton.current?.focus();
  }, []);

  async function alDeshacer() {
    try {
      await ejecutar();
    } catch {
      // El hook ya mostró el aviso de error (p. ej. ya no hay stock).
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-texto-secundario/50 bg-arena px-4 py-3">
        <p id={idTexto} className="flex-1 text-sm text-texto-secundario">
          Quitaste <span className="text-tinta">{linea.descripcion}</span>
          {linea.cantidad > 1 ? ` (${linea.cantidad} unidades)` : ''}.
        </p>
        <button
          ref={boton}
          type="button"
          onClick={alDeshacer}
          disabled={cargando}
          aria-busy={cargando || undefined}
          aria-describedby={idTexto}
          className="min-h-11 rounded-full border border-rosa px-5 text-sm font-medium text-rosa transition-colors hover:bg-rosa hover:text-hueso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cargando ? 'Volviendo a agregar…' : 'Deshacer'}
        </button>
      </div>
    </li>
  );
}

function IconoPapelera() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M9 7V4.5h6V7" />
      <path d="M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function ControlCantidad({
  cantidad,
  disponible,
  cargando,
  onCambiar,
}: {
  cantidad: number;
  disponible?: number;
  cargando: boolean;
  onCambiar: (cantidad: number) => void;
}) {
  const alTope = typeof disponible === 'number' && cantidad >= disponible;

  return (
    <div
      className="flex items-center rounded-full border border-linea"
      aria-busy={cargando || undefined}
    >
      <button
        type="button"
        onClick={() => onCambiar(Math.max(1, cantidad - 1))}
        disabled={cargando || cantidad <= 1}
        aria-label="Restar una unidad"
        className="px-3 py-1 text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      <span className="w-6 text-center text-sm text-tinta">{cantidad}</span>
      <button
        type="button"
        onClick={() => onCambiar(cantidad + 1)}
        disabled={cargando || alTope}
        aria-label="Sumar una unidad"
        className="px-3 py-1 text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-40"
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
        <Boton type="submit" variante="fantasma" cargando={cargando} disabled={!codigo.trim()}>
          Aplicar
        </Boton>
      </form>

      {cupon ? (
        <p className="text-sm text-whatsapp">
          Cupón {cupon.codigo} aplicado.{' '}
          <button
            type="button"
            onClick={onQuitar}
            disabled={cargando}
            aria-busy={cargando || undefined}
            className="rounded-md underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cargando ? 'Quitando…' : 'Quitar'}
          </button>
        </p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
    </div>
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
