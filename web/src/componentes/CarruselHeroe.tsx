import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { ImagenProducto } from './ImagenProducto.tsx';
import type { ProductoHeroe } from '../datos/index.ts';
import { usePrefiereMovimientoReducido } from '../utilidades/usePrefiereMovimientoReducido.ts';

const INTERVALO_MS = 5000;
// La foto siguiente asoma ~48px por el borde derecho (pedido: 40-60px),
// más un gap de 12px entre fotos que también cuenta dentro de esa reserva
// — ver el cálculo de ASOMO_TOTAL_PX más abajo.
const ASOMO_VISIBLE_PX = 48;
const GAP_PX = 12;
const ASOMO_TOTAL_PX = ASOMO_VISIBLE_PX + GAP_PX;
// Mínimo de arrastre (mouse o touch) para contarlo como swipe y no como
// un tap que debería navegar a la ficha de la foto activa.
const UMBRAL_DESLIZAR_PX = 50;

interface CarruselHeroeProps {
  // Las pelucas de UN tono, cada una con su foto de ese color (ver
  // Inicio.tsx). El carrusel nunca pasa a otro tono.
  productos: ProductoHeroe[];
  nombreTono: string;
  // El índice es controlado por el padre: al cambiar de tono vuelve a 0.
  indice: number;
  onCambiarIndice: (indice: number) => void;
  // Escaparate: recorre solo hasta que la persona toca algo. Desde la
  // primera flecha, punto, swipe o tono, maneja ella y no avanza más.
  avanzaSolo: boolean;
  onInteraccion: () => void;
}

export function CarruselHeroe({
  productos,
  nombreTono,
  indice,
  onCambiarIndice,
  avanzaSolo,
  onInteraccion,
}: CarruselHeroeProps) {
  const prefiereMovimientoReducido = usePrefiereMovimientoReducido();
  const [pausadoPorHover, setPausadoPorHover] = useState(false);
  const hayVarias = productos.length > 1;

  // El cursor encima pausa; tocar un control lo detiene del todo (ver
  // avanzaSolo). Con una sola foto no hay nada que recorrer.
  useEffect(() => {
    if (!avanzaSolo || pausadoPorHover || prefiereMovimientoReducido || !hayVarias) return;
    const temporizador = setTimeout(() => {
      onCambiarIndice((indice + 1) % productos.length);
    }, INTERVALO_MS);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCambiarIndice es el setter de Inicio.tsx, estable entre renders.
  }, [
    indice,
    avanzaSolo,
    pausadoPorHover,
    prefiereMovimientoReducido,
    hayVarias,
    productos.length,
  ]);

  const indiceSeguro = productos.length > 0 ? Math.min(indice, productos.length - 1) : 0;

  function irA(nuevo: number) {
    onInteraccion();
    onCambiarIndice((nuevo + productos.length) % productos.length);
  }

  // Arrastre con mouse o touch (pointer events cubre los dos): un umbral
  // mínimo para no confundir un tap (que debe navegar a la ficha) con un
  // swipe (que debe cambiar de foto y NO navegar).
  const inicioX = useRef<number | null>(null);
  const arrastrando = useRef(false);

  function alBajarPuntero(evento: ReactPointerEvent) {
    inicioX.current = evento.clientX;
    arrastrando.current = false;
  }

  function alSoltarPuntero(evento: ReactPointerEvent) {
    if (inicioX.current === null || !hayVarias) {
      inicioX.current = null;
      return;
    }
    const delta = evento.clientX - inicioX.current;
    inicioX.current = null;
    if (Math.abs(delta) < UMBRAL_DESLIZAR_PX) return;
    arrastrando.current = true;
    irA(delta < 0 ? indiceSeguro + 1 : indiceSeguro - 1);
  }

  // Captura el click que el navegador dispara después de un swipe sobre
  // el <Link> de la foto, antes de que navegue — un swipe cambia de foto,
  // no abre la ficha de la que quedó debajo del dedo al soltar.
  function alClicCapturado(evento: ReactMouseEvent) {
    if (arrastrando.current) {
      evento.preventDefault();
      evento.stopPropagation();
      arrastrando.current = false;
    }
  }

  if (productos.length === 0) return null;

  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label={`Pelucas en tono ${nombreTono}`}
      className="relative overflow-hidden rounded-2xl"
      onMouseEnter={() => setPausadoPorHover(true)}
      onMouseLeave={() => setPausadoPorHover(false)}
    >
      <div
        className="flex aspect-[4/5] touch-pan-y transition-transform duration-500 ease-out lg:aspect-[11/10]"
        style={
          hayVarias
            ? {
                gap: `${GAP_PX}px`,
                transform: `translateX(calc(-1 * ${indiceSeguro} * (100% - ${ASOMO_VISIBLE_PX}px)))`,
              }
            : undefined
        }
        onPointerDown={alBajarPuntero}
        onPointerUp={alSoltarPuntero}
        onClickCapture={alClicCapturado}
      >
        {productos.map((producto, i) => (
          <Link
            key={producto.id}
            to={`/producto/${producto.slug}?variante=${encodeURIComponent(producto.sku)}`}
            className="relative block shrink-0"
            // Una sola foto ocupa todo el ancho: sin asomo de una siguiente
            // que no existe ni hueco al costado.
            style={{ width: hayVarias ? `calc(100% - ${ASOMO_TOTAL_PX}px)` : '100%' }}
            tabIndex={i === indiceSeguro ? 0 : -1}
            aria-hidden={i === indiceSeguro ? undefined : true}
          >
            <ImagenProducto
              nombre={producto.imagen.altTexto || producto.nombre}
              url={producto.imagen.url}
              className="h-full w-full"
            />
          </Link>
        ))}
      </div>

      {hayVarias ? (
        <>
          {/* Degradado para que las flechas y el contador blancos se lean
              incluso sobre fotos claras (el caso más común con nuestras
              fotos). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/35 to-transparent"
          />

          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-between">
            <div className="pointer-events-auto flex items-center gap-3">
              <button
                type="button"
                aria-label="Peluca anterior"
                onClick={() => irA(indiceSeguro - 1)}
                className="rounded-full p-1.5 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <FlechaIcono direccion="izquierda" />
              </button>
              <button
                type="button"
                aria-label="Peluca siguiente"
                onClick={() => irA(indiceSeguro + 1)}
                className="rounded-full p-1.5 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <FlechaIcono direccion="derecha" />
              </button>

              {/* Mismo arreglo `productos` que el contador de abajo: un
                  punto por foto, sin desincronizarse nunca entre sí. */}
              <div role="group" aria-label="Ir a una peluca" className="flex items-center gap-1.5">
                {productos.map((producto, i) => (
                  <button
                    key={producto.id}
                    type="button"
                    aria-label={`Ir a ${producto.nombre}`}
                    aria-current={i === indiceSeguro}
                    onClick={() => irA(i)}
                    className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      i === indiceSeguro ? 'w-5 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            </div>

            <span className="pointer-events-none text-xs font-medium tracking-[0.08em] text-white">
              {String(indiceSeguro + 1).padStart(2, '0')} /{' '}
              {String(productos.length).padStart(2, '0')}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

function FlechaIcono({ direccion }: { direccion: 'izquierda' | 'derecha' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direccion === 'izquierda' ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19'} />
    </svg>
  );
}
