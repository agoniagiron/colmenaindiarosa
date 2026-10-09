import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagenProducto } from './ImagenProducto.tsx';
import type { ProductoHeroe } from '../datos/index.ts';
import { usePrefiereMovimientoReducido } from '../utilidades/usePrefiereMovimientoReducido.ts';

const INTERVALO_MS = 5000;
const DURACION_FUNDIDO_MS = 300;

interface CarruselHeroeProps {
  // El recorrido completo (todas las pelucas destacadas, agrupadas por
  // tono y en ese orden — ver Inicio.tsx), no solo las del tono activo:
  // el recorrido nunca se corta al llegar al final de un tono, sigue con
  // el siguiente y da la vuelta al llegar al final.
  //
  // El índice es controlado por el padre (Inicio.tsx), no por este
  // componente: así la hilera de tonos de la izquierda puede resaltar el
  // tono que corresponde a lo que se ve acá, venga el cambio de donde
  // venga (autoavance, flecha, punto o elegir un tono a mano).
  productos: ProductoHeroe[];
  indice: number;
  onCambiarIndice: (indice: number) => void;
}

export function CarruselHeroe({ productos, indice, onCambiarIndice }: CarruselHeroeProps) {
  const prefiereMovimientoReducido = usePrefiereMovimientoReducido();
  const [pausadoPorHover, setPausadoPorHover] = useState(false);

  // Nunca se detiene sola: la única pausa es el cursor encima (punto 6
  // del pedido). El temporizador se reinicia cada vez que `indice`
  // cambia, sin importar el origen (autoavance, flecha, punto o un tono
  // elegido a mano) — por eso usar una flecha no hace que salte de
  // inmediato: vuelve a contar los 5s completos desde ahí.
  useEffect(() => {
    if (pausadoPorHover || prefiereMovimientoReducido || productos.length <= 1) return;
    const temporizador = setTimeout(() => {
      onCambiarIndice((indice + 1) % productos.length);
    }, INTERVALO_MS);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCambiarIndice es el setter de Inicio.tsx, estable entre renders.
  }, [indice, pausadoPorHover, prefiereMovimientoReducido, productos.length]);

  const indiceSeguro = productos.length > 0 ? Math.min(indice, productos.length - 1) : 0;
  const actual = productos[indiceSeguro];

  // Fundido corto entre fotos: la saliente se desvanece mientras la
  // entrante aparece, en paralelo — una vitrina, no una diapositiva con
  // corte seco. Con prefers-reduced-motion no hay nada que animar: el
  // cambio es directo (ver el `if` de abajo).
  const [transicion, setTransicion] = useState<{
    saliente: ProductoHeroe;
    fase: 'inicio' | 'fin';
  } | null>(null);
  const anteriorRef = useRef(actual);

  useEffect(() => {
    const anterior = anteriorRef.current;
    anteriorRef.current = actual;
    if (!actual || !anterior || anterior.id === actual.id || prefiereMovimientoReducido) return;

    setTransicion({ saliente: anterior, fase: 'inicio' });
    const idFrame = requestAnimationFrame(() => {
      setTransicion((t) => (t ? { ...t, fase: 'fin' } : t));
    });
    const idTimeout = setTimeout(() => setTransicion(null), DURACION_FUNDIDO_MS);
    return () => {
      cancelAnimationFrame(idFrame);
      clearTimeout(idTimeout);
    };
  }, [actual, prefiereMovimientoReducido]);

  if (!actual) return null;
  const hayVarias = productos.length > 1;

  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label="Pelucas destacadas en portada"
      className="relative"
      onMouseEnter={() => setPausadoPorHover(true)}
      onMouseLeave={() => setPausadoPorHover(false)}
    >
      <div className="relative">
        {transicion ? (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
              transicion.fase === 'inicio' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <TarjetaDestacada producto={transicion.saliente} />
          </div>
        ) : null}
        <div
          className={
            transicion
              ? `transition-opacity duration-300 ${
                  transicion.fase === 'inicio' ? 'opacity-0' : 'opacity-100'
                }`
              : ''
          }
        >
          <TarjetaDestacada producto={actual} />
        </div>
      </div>

      {hayVarias ? (
        <>
          <button
            type="button"
            aria-label="Peluca anterior"
            onClick={() => onCambiarIndice((indice - 1 + productos.length) % productos.length)}
            className="absolute left-2 top-[38%] -translate-y-1/2 rounded-full bg-white/90 p-2 text-tinta shadow-lg transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            <FlechaIcono direccion="izquierda" />
          </button>
          <button
            type="button"
            aria-label="Peluca siguiente"
            onClick={() => onCambiarIndice((indice + 1) % productos.length)}
            className="absolute right-2 top-[38%] -translate-y-1/2 rounded-full bg-white/90 p-2 text-tinta shadow-lg transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            <FlechaIcono direccion="derecha" />
          </button>

          {/* Un punto por peluca del recorrido completo, no solo las del
              tono activo (punto 4 del pedido). La posición en el arreglo
              es la llave: la misma peluca puede repetirse en más de un
              tono y no sirve como identificador único acá. */}
          <div role="group" aria-label="Ir a una peluca" className="mt-3 flex justify-center gap-2">
            {productos.map((producto, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir a ${producto.nombre}`}
                aria-current={i === indiceSeguro}
                onClick={() => onCambiarIndice(i)}
                className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
                  i === indiceSeguro ? 'w-6 bg-rosa' : 'w-2.5 bg-linea hover:bg-texto-secundario'
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

// Columna derecha más alta que ancha (punto 7): aspect-[2/3], no el
// aspect-[3/4] por defecto de ImagenProducto. Mismo mecanismo de
// className que ya usa SeccionMarca en Inicio.tsx para su propio
// aspect-square — acá reemplaza el aspecto en vez del redondeado.
function TarjetaDestacada({ producto }: { producto: ProductoHeroe }) {
  return (
    <Link to={`/producto/${producto.slug}`} className="group block">
      <ImagenProducto
        nombre={producto.nombre}
        colorHex={producto.colores[0]?.hex}
        url={producto.imagenPrincipal?.url}
        // Altura propia hasta lg (que es donde el layout de SeccionHeroe
        // pasa a dos columnas lado a lado): con el aspect-[2/3] de
        // escritorio sin tope, en celular la foto sola ocupa toda la
        // pantalla y la clienta no ve que abajo hay más contenido.
        className="h-[52vh] max-h-[440px] rounded-tl-[999px] rounded-tr-[999px] rounded-bl-lg rounded-br-lg transition-opacity group-hover:opacity-90 lg:aspect-[2/3] lg:h-auto lg:max-h-none"
      />
      <p className="mt-4 text-center font-serif text-lg text-tinta">{producto.nombre}</p>
    </Link>
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
