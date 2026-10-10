// Miniatura con galería al pasar el mouse, compartida entre /admin/limitadas
// y la sección de limitadas del inicio (y pensada para no ser agnóstica de
// si la foto viene de un producto o de un kit: recibe las fotos ya
// resueltas, nunca decide de dónde vienen).
//
// Reglas de interacción (pedidas explícitamente, no inventar otras):
// - Con mouse: la galería se pide una sola vez, solo tras un hover real de
//   más de ~200ms (uno que solo pasó de largo no dispara descargas), y
//   rota una foto cada ~900ms. Al salir el mouse, vuelve a la principal,
//   nunca se queda en la última foto de la rotación.
// - En táctil (sin hover) nunca rota: se ve solo la principal más un
//   indicador "1/N" si hay más de una foto. No hay listener de touch acá
//   a propósito, para no interceptar el toque que abre el detalle.
// - Tope de 5 fotos en la rotación, sin importar cuántas devuelva
//   cargarGaleria.

import { useEffect, useRef, useState } from 'react';
import { ImagenProducto } from './ImagenProducto.tsx';

type Textura = 'straight' | 'wavy' | 'curly';
type TipoMarcador = 'cabello' | 'frasco' | 'aro';

export interface FotoGaleria {
  url: string;
  altTexto: string;
}

interface MiniaturaGaleriaProps {
  nombre: string;
  colorHex?: string;
  textura?: Textura;
  tipo?: TipoMarcador;
  className?: string;
  carga?: 'lazy' | 'eager';
  // null cuando todavía no hay ninguna foto propia: ImagenProducto cae al
  // mismo SVG de respaldo que el resto del sitio.
  imagenPrincipal: FotoGaleria | null;
  // Total real de fotos (puede ser más de 5): solo para el indicador "1/N"
  // en táctil, sin traer la galería completa solo para contar.
  cantidadImagenes: number;
  // Se llama una sola vez, solo tras un hover real en un dispositivo con
  // hover. El resultado se cachea en este componente mientras viva.
  cargarGaleria: () => Promise<FotoGaleria[]>;
}

const DEMORA_ROTACION_MS = 900;
const UMBRAL_HOVER_INTENCIONAL_MS = 200;
const MAX_FOTOS_ROTACION = 5;

// La principal siempre va primera en la secuencia de rotación: así, al
// volver al índice 0 (mouse leave), se ve la principal de verdad, no la
// que la galería traiga primero según su propio orden.
function construirSecuencia(
  principal: FotoGaleria | null,
  galeria: FotoGaleria[],
): FotoGaleria[] {
  if (principal === null) return galeria.slice(0, MAX_FOTOS_ROTACION);
  const resto = galeria.filter((foto) => foto.url !== principal.url);
  return [principal, ...resto].slice(0, MAX_FOTOS_ROTACION);
}

export function MiniaturaGaleria({
  nombre,
  colorHex,
  textura,
  tipo,
  className,
  carga,
  imagenPrincipal,
  cantidadImagenes,
  cargarGaleria,
}: MiniaturaGaleriaProps) {
  const [secuencia, setSecuencia] = useState<FotoGaleria[] | null>(null);
  const [indice, setIndice] = useState(0);

  const soportaHoverRef = useRef(
    typeof window !== 'undefined' ? window.matchMedia('(hover: hover)').matches : false,
  );
  const temporizadorEntradaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cargandoRef = useRef(false);

  function detenerRotacion() {
    if (intervaloRef.current !== null) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
    setIndice(0);
  }

  function iniciarRotacion(fotos: FotoGaleria[]) {
    if (fotos.length <= 1) return;
    intervaloRef.current = setInterval(() => {
      setIndice((i) => (i + 1) % fotos.length);
    }, DEMORA_ROTACION_MS);
  }

  async function hoverIntencional() {
    if (!soportaHoverRef.current || cantidadImagenes <= 1) return;
    if (secuencia !== null) {
      iniciarRotacion(secuencia);
      return;
    }
    if (cargandoRef.current) return;
    cargandoRef.current = true;
    try {
      const fotos = await cargarGaleria();
      const nuevaSecuencia = construirSecuencia(imagenPrincipal, fotos);
      setSecuencia(nuevaSecuencia);
      iniciarRotacion(nuevaSecuencia);
    } finally {
      cargandoRef.current = false;
    }
  }

  function alEntrarMouse() {
    temporizadorEntradaRef.current = setTimeout(() => {
      void hoverIntencional();
    }, UMBRAL_HOVER_INTENCIONAL_MS);
  }

  function alSalirMouse() {
    if (temporizadorEntradaRef.current !== null) {
      clearTimeout(temporizadorEntradaRef.current);
      temporizadorEntradaRef.current = null;
    }
    detenerRotacion();
  }

  useEffect(
    () => () => {
      if (temporizadorEntradaRef.current !== null) clearTimeout(temporizadorEntradaRef.current);
      if (intervaloRef.current !== null) clearInterval(intervaloRef.current);
    },
    [],
  );

  const fotoActual = secuencia?.[indice] ?? imagenPrincipal;
  const mostrarIndicadorTactil = !soportaHoverRef.current && cantidadImagenes > 1;

  return (
    <div className="relative" onMouseEnter={alEntrarMouse} onMouseLeave={alSalirMouse}>
      <ImagenProducto
        nombre={nombre}
        colorHex={colorHex}
        textura={textura}
        tipo={tipo}
        url={fotoActual?.url}
        className={className}
        carga={carga}
      />
      {mostrarIndicadorTactil ? (
        <span
          aria-hidden="true"
          className="absolute right-1.5 bottom-1.5 rounded-full bg-tinta/70 px-1.5 py-0.5 text-[11px] font-medium text-hueso"
        >
          1/{cantidadImagenes}
        </span>
      ) : null}
    </div>
  );
}
