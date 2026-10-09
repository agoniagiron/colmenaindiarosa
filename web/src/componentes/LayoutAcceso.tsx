import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface LayoutAccesoProps {
  // Login usa 'izquierda' (imagen a la izquierda, formulario a la
  // derecha), Registro usa 'derecha' — espejados a propósito (ver pedido).
  ladoImagen: 'izquierda' | 'derecha';
  children: ReactNode;
  // Ingresar/Registro viven dentro de LayoutTienda, que ya tiene su propio
  // header con el logo — ahí esta marca chica sobra. AdminAcceso no tiene
  // ningún header (va "sola", ver el pedido), así que la necesita: true
  // por defecto para no romperlo si algún día se usa este layout sin
  // pasar el prop.
  mostrarMarcaMovil?: boolean;
}

export function LayoutAcceso({
  ladoImagen,
  children,
  mostrarMarcaMovil = true,
}: LayoutAccesoProps) {
  const panelImagen = (
    <div className="hidden flex-col items-center justify-center bg-arena px-10 text-center lg:flex lg:w-1/2">
      {/* Acá va la imagen de fondo cuando haya una (bg-cover bg-center en
          este mismo div, o un <img> absoluto detrás del contenido). Con
          foto, el texto de abajo va a necesitar un velo oscuro semi-
          transparente encima para seguir siendo legible — todavía no
          hace falta porque no hay foto. */}
      <p className="font-serif text-3xl tracking-[0.1em] text-tinta uppercase">India Rosa</p>
      <p className="mt-3 max-w-[30ch] text-base text-texto-secundario">
        Elige tu tono y nosotras el resto.
      </p>
    </div>
  );

  return (
    // flex-1: ocupa exactamente lo que le queda dentro de <main> (que a su
    // vez es flex-1 dentro de LayoutTienda) — ni un número de alto propio,
    // ni un 100vh que en celular cuenta la barra de direcciones de más.
    <div className="flex flex-1 flex-col lg:flex-row">
      {ladoImagen === 'izquierda' ? panelImagen : null}

      <div className="flex flex-1 flex-col items-center justify-center bg-white px-4 py-10 sm:px-6 lg:w-1/2 lg:flex-none lg:px-10">
        <div className="w-full max-w-[420px]">
          {mostrarMarcaMovil ? (
            <Link
              to="/"
              className="mb-8 block text-center font-serif text-lg tracking-[0.08em] text-tinta uppercase lg:hidden"
            >
              India Rosa
            </Link>
          ) : null}
          {children}
        </div>
      </div>

      {ladoImagen === 'derecha' ? panelImagen : null}
    </div>
  );
}
