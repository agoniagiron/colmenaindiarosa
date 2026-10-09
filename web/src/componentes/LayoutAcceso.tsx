import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface LayoutAccesoProps {
  // Login usa 'izquierda' (imagen a la izquierda, formulario a la
  // derecha), Registro usa 'derecha' — espejados a propósito (ver pedido).
  ladoImagen: 'izquierda' | 'derecha';
  children: ReactNode;
}

export function LayoutAcceso({ ladoImagen, children }: LayoutAccesoProps) {
  const panelImagen = (
    <div className="hidden min-h-screen flex-col items-center justify-center bg-arena px-10 text-center lg:flex lg:w-1/2">
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
    <div className="flex min-h-screen flex-col lg:flex-row">
      {ladoImagen === 'izquierda' ? panelImagen : null}

      <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-white px-4 py-10 sm:px-6 lg:w-1/2 lg:flex-none lg:px-10">
        <div className="w-full max-w-[420px]">
          {/* Solo en celular: sin esto la marca desaparece del todo (el
              panel de imagen, que es donde vive el logo grande, se oculta
              completo — ver abajo). */}
          <Link
            to="/"
            className="mb-8 block text-center font-serif text-lg tracking-[0.08em] text-tinta uppercase lg:hidden"
          >
            India Rosa
          </Link>
          {children}
        </div>
      </div>

      {ladoImagen === 'derecha' ? panelImagen : null}
    </div>
  );
}
