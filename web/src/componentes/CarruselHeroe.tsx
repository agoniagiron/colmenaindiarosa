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
  // El recorrido completo (todas las pelucas destacadas, agrupadas por
  // tono y en ese orden — ver Inicio.tsx), no solo las del tono activo:
  // el recorrido nunca se corta al llegar al final de un tono, sigue con
  // el siguiente y da la vuelta al llegar al final.
  //
  // El índice es controlado por el padre (Inicio.tsx), no por este
  // componente: así la hilera de tonos de la izquierda puede resaltar el
  // tono que corresponde a lo que se ve acá, venga el cambio de donde
  // venga (autoavance, flecha, punto, swipe o un tono elegido a mano).
  productos: ProductoHeroe[];
  indice: number;
  onCambiarIndice: (indice: number) => void;
}

export function CarruselHeroe({ productos, indice, onCambiarIndice }: CarruselHeroeProps) {
  const prefiereMovimientoReducido = usePrefiereMovimientoReducido();
  const [pausadoPorHover, setPausadoPorHover] = useState(false);

  // Nunca se detiene sola: la única pausa es el cursor encima o un
  // arrastre en curso. El temporizador se reinicia cada vez que `indice`
  // cambia, sin importar el origen (autoavance, flecha, punto, swipe o un
  // tono elegido a mano) — por eso tocar un control no lo mata para
  // siempre: solo retrasa el próximo avance automático, que sigue solo.
  useEffect(() => {
    if (pausadoPorHover || prefiereMovimientoReducido || productos.length <= 1) return;
    const temporizador = setTimeout(() => {
      onCambiarIndice((indice + 1) % productos.length);
    }, INTERVALO_MS);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCambiarIndice es el setter de Inicio.tsx, estable entre renders.
  }, [indice, pausadoPorHover, prefiereMovimientoReducido, productos.length]);

  const indiceSeguro = productos.length > 0 ? Math.min(indice, productos.length - 1) : 0;
  const hayVarias = productos.length > 1;

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
    if (delta < 0) onCambiarIndice((indiceSeguro + 1) % productos.length);
    else onCambiarIndice((indiceSeguro - 1 + productos.length) % productos.length);
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
      aria-label="Pelucas destacadas en portada"
      className="relative overflow-hidden rounded-2xl"
      onMouseEnter={() => setPausadoPorHover(true)}
      onMouseLeave={() => setPausadoPorHover(false)}
    >
      <div
        className="flex aspect-[4/5] touch-pan-y transition-transform duration-500 ease-out lg:aspect-[11/10]"
        style={{
          gap: `${GAP_PX}px`,
          transform: `translateX(calc(-1 * ${indiceSeguro} * (100% - ${ASOMO_VISIBLE_PX}px)))`,
        }}
        onPointerDown={alBajarPuntero}
        onPointerUp={alSoltarPuntero}
        onClickCapture={alClicCapturado}
      >
        {productos.map((producto, i) => (
          <Link
            key={producto.id}
            to={`/producto/${producto.slug}`}
            className="relative block shrink-0"
            style={{ width: `calc(100% - ${ASOMO_TOTAL_PX}px)` }}
            tabIndex={i === indiceSeguro ? 0 : -1}
            aria-hidden={i === indiceSeguro ? undefined : true}
          >
            <ImagenProducto
              nombre={producto.nombre}
              colorHex={producto.colores[0]?.hex}
              url={producto.imagenPrincipal?.url}
              className="h-full w-full"
            />
          </Link>
        ))}
      </div>

      {/* Degradado para que las flechas y el contador blancos se lean
          incluso sobre fotos claras (el caso más común con nuestras
          fotos). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/35 to-transparent"
      />

      {hayVarias ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-3">
            <button
              type="button"
              aria-label="Peluca anterior"
              onClick={() =>
                onCambiarIndice((indiceSeguro - 1 + productos.length) % productos.length)
              }
              className="rounded-full p-1.5 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <FlechaIcono direccion="izquierda" />
            </button>
            <button
              type="button"
              aria-label="Peluca siguiente"
              onClick={() => onCambiarIndice((indiceSeguro + 1) % productos.length)}
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
                  onClick={() => onCambiarIndice(i)}
                  className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    i === indiceSeguro ? 'w-5 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </div>

          <span className="pointer-events-none text-xs font-medium tracking-[0.08em] text-white">
            {String(indiceSeguro + 1).padStart(2, '0')} / {String(productos.length).padStart(2, '0')}
          </span>
        </div>
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
