import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { Boton } from '../componentes/Boton.tsx';
import { CampoTexto } from '../componentes/CampoTexto.tsx';
import { EstadoVacio } from '../componentes/EstadoVacio.tsx';
import { ImagenProducto } from '../componentes/ImagenProducto.tsx';
import { useCarrito } from '../contexto/ContextoCarrito.tsx';
import { useConfiguracion } from '../contexto/ContextoConfiguracion.tsx';
import { formatearEspecificacionesVariante } from '../dominio/formatearEspecificacionesVariante.ts';
import type { LineaCarrito } from '../tipos/index.ts';
import { useAccionAsincrona } from '../utilidades/useAccionAsincrona.ts';

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
  const { formatearMonto } = useConfiguracion();

  const totalUnidades = lineas.reduce((acumulado, linea) => acumulado + linea.cantidad, 0);

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
                key={linea.id}
                linea={linea}
                onCambiarCantidad={async (cantidad) => {
                  if (linea.id) await cambiarCantidad(linea.id, cantidad);
                }}
                onQuitar={async () => {
                  if (linea.id) await quitar(linea.id);
                }}
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
  onCambiarCantidad: (cantidad: number) => Promise<void>;
  onQuitar: () => Promise<void>;
}) {
  const { formatearMonto } = useConfiguracion();
  const subtotalLinea = linea.precioUnitario * linea.cantidad;
  const especificaciones = formatearEspecificacionesVariante(linea);
  const sinDisponibilidadSuficiente =
    typeof linea.disponible === 'number' && linea.disponible < linea.cantidad;

  const { cargando: cambiando, ejecutar: ejecutarCambiar } = useAccionAsincrona(onCambiarCantidad);
  const { cargando: quitando, ejecutar: ejecutarQuitar } = useAccionAsincrona(onQuitar, {
    mensajeExito: 'Producto quitado del carrito',
  });
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
        <ImagenProducto nombre={linea.nombreProducto} colorHex={linea.color?.hex} />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <p className="font-serif text-base text-tinta">{linea.nombreProducto}</p>
        {especificaciones ? (
          <p className="text-sm text-texto-secundario">{especificaciones}</p>
        ) : null}
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
          <button
            type="button"
            onClick={alQuitar}
            disabled={cargando}
            aria-busy={quitando || undefined}
            className="rounded-md text-sm text-texto-secundario underline-offset-2 hover:text-rosa hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-50"
          >
            {quitando ? 'Quitando…' : 'Quitar'}
          </button>
        </div>
      </div>
    </li>
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
