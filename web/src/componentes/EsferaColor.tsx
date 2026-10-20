// La esfera de un color, en un solo lugar: el selector de la ficha, los
// filtros del catálogo, Inicio, la pantalla de Atributos, el asistente de
// variantes, el creador de color en línea y la pestaña de Imágenes.
//
// Un color combinado (hexSecundario) se dibuja partido en vertical, con
// fondoDeColor.ts: la mitad izquierda con hex, la derecha con hexSecundario,
// corte limpio y sin línea entre las dos. Sigue siendo un solo color.
//
// Deshabilitada (agotado o que no viene en esta combinación) lleva una
// franja diagonal clara con contorno oscuro. Sin opacidad: atenuar un color
// de cabello lo convierte en otro (un negro al 40% parece gris). La franja
// va a 45° y es una línea dibujada encima; el corte del combinado es
// vertical y no tiene trazo, así que no se confunden.

import { fondoDeColor } from './fondoDeColor.ts';

interface EsferaColorProps {
  hex?: string | null;
  hexSecundario?: string | null;
  deshabilitada?: boolean;
  // Tamaño lo pone quien la usa (h-4 w-4; dentro de un botón, h-full w-full).
  className?: string;
}

export function EsferaColor({
  hex,
  hexSecundario,
  deshabilitada = false,
  className = '',
}: EsferaColorProps) {
  return (
    <span
      aria-hidden="true"
      data-combinado={hex && hexSecundario ? '' : undefined}
      className={`relative block shrink-0 overflow-hidden rounded-full ${className}`.trim()}
      style={{ background: fondoDeColor(hex, hexSecundario) }}
    >
      {deshabilitada ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-0.5 w-[140%] rotate-45 bg-hueso shadow-[0_0_0_1px_rgba(26,21,19,0.55)]" />
        </span>
      ) : null}
    </span>
  );
}
