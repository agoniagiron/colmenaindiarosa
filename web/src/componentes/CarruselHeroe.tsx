import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagenProducto } from './ImagenProducto.tsx';
import type { ProductoHeroe } from '../datos/index.ts';
import { usePrefiereMovimientoReducido } from '../utilidades/usePrefiereMovimientoReducido.ts';

const INTERVALO_MS = 5000;

interface CarruselHeroeProps {
  // El padre (Inicio.tsx) debe pasar esta lista ya memoizada: una
  // identidad nueva se interpreta como "cambió el conjunto a mostrar"
  // (p. ej. se eligió otro tono) y reinicia el carrusel + el autoavance,
  // aunque antes se hubieran usado las flechas o los puntos.
  productos: ProductoHeroe[];
}

export function CarruselHeroe({ productos }: CarruselHeroeProps) {
  const [indice, setIndice] = useState(0);
  // Solo se prende con una flecha o un punto (ver onClick de cada uno);
  // elegir un tono no lo toca — cambia `productos`, que ya reinicia esto
  // en el efecto de abajo.
  const [detenidoManual, setDetenidoManual] = useState(false);
  const prefiereMovimientoReducido = usePrefiereMovimientoReducido();

  useEffect(() => {
    setIndice(0);
    setDetenidoManual(false);
  }, [productos]);

  useEffect(() => {
    if (detenidoManual || prefiereMovimientoReducido || productos.length <= 1) return;
    const temporizador = setInterval(() => {
      setIndice((actual) => (actual + 1) % productos.length);
    }, INTERVALO_MS);
    return () => clearInterval(temporizador);
  }, [detenidoManual, prefiereMovimientoReducido, productos.length]);

  if (productos.length === 0) return null;

  const actual = productos[Math.min(indice, productos.length - 1)]!;
  const hayVarias = productos.length > 1;

  function irA(nuevoIndice: number) {
    setDetenidoManual(true);
    setIndice(nuevoIndice);
  }

  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label="Pelucas destacadas en portada"
      className="relative"
    >
      <Link to={`/producto/${actual.slug}`} className="group block">
        <ImagenProducto
          nombre={actual.nombre}
          colorHex={actual.colores[0]?.hex}
          url={actual.imagenPrincipal?.url}
          className="rounded-tl-[999px] rounded-tr-[999px] rounded-bl-lg rounded-br-lg transition-opacity group-hover:opacity-90"
        />
        <p className="mt-4 text-center font-serif text-lg text-tinta">{actual.nombre}</p>
      </Link>

      {hayVarias ? (
        <>
          <button
            type="button"
            aria-label="Peluca anterior"
            onClick={() => irA((indice - 1 + productos.length) % productos.length)}
            className="absolute left-2 top-[42%] -translate-y-1/2 rounded-full bg-white/90 p-2 text-tinta shadow-lg transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            <FlechaIcono direccion="izquierda" />
          </button>
          <button
            type="button"
            aria-label="Peluca siguiente"
            onClick={() => irA((indice + 1) % productos.length)}
            className="absolute right-2 top-[42%] -translate-y-1/2 rounded-full bg-white/90 p-2 text-tinta shadow-lg transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            <FlechaIcono direccion="derecha" />
          </button>

          <div role="group" aria-label="Ir a una peluca" className="mt-3 flex justify-center gap-2">
            {productos.map((producto, i) => (
              <button
                key={producto.id}
                type="button"
                aria-label={`Ir a ${producto.nombre}`}
                aria-current={i === indice}
                onClick={() => irA(i)}
                className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
                  i === indice ? 'w-6 bg-rosa' : 'w-2.5 bg-linea hover:bg-texto-secundario'
                }`}
              />
            ))}
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
