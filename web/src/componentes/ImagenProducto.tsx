// Marcador de posición mientras no existe una foto real de producto: una
// silueta en SVG coloreada con el hex de la variante (mismo criterio que
// docs/diseno-portada.html, función `silueta`). Cuando `url` apunta a una
// foto real y esa foto carga sin error, se usa la foto y el marcador no se
// dibuja — así que este es también el único lugar que cambia el día que
// haya fotos reales de verdad.

import { useId, useState } from 'react';

type Textura = 'straight' | 'wavy' | 'curly';
type TipoMarcador = 'cabello' | 'frasco' | 'aro';

interface ImagenProductoProps {
  nombre: string;
  colorHex?: string;
  // Solo afecta al marcador de cabello. Por defecto 'wavy', igual que la
  // mayoría de los usos en el prototipo.
  textura?: Textura;
  // Qué silueta dibujar cuando no hay foto: cabello (pelucas, extensiones),
  // frasco (cuidado) o aro (accesorios).
  tipo?: TipoMarcador;
  url?: string;
  className?: string;
}

// Misma paleta de tonos reales de la tienda (ver seed de `color`): cuando
// no llega un hex propio, el nombre del producto elige uno de forma
// estable, para que dos productos distintos no se vean idénticos.
const PALETA_RESPALDO = ['#1c1412', '#3b2620', '#5a3a2a', '#8a5a34', '#a97e4c', '#c9a97c'];

function tonoDesdeNombre(nombre: string): string {
  let hash = 0;
  for (let indice = 0; indice < nombre.length; indice += 1) {
    hash = (hash * 31 + nombre.charCodeAt(indice)) | 0;
  }
  return PALETA_RESPALDO[Math.abs(hash) % PALETA_RESPALDO.length]!;
}

const CUERPOS_CABELLO: Record<Textura, string> = {
  straight:
    'M78 150 Q78 74 150 74 Q222 74 222 150 L232 330 L188 330 Q198 220 190 160 L110 160 Q102 220 112 330 L68 330 Z',
  wavy: 'M76 152 Q76 74 150 74 Q224 74 224 152 q10 44 -4 72 q14 34 -2 66 q10 24 4 40 l-42 0 q16 -70 6 -142 l-84 0 q-10 72 6 142 l-42 0 q-6 -16 4 -40 q-16 -32 -2 -66 q-14 -28 -4 -72 Z',
  curly:
    'M70 156 Q70 70 150 70 Q230 70 230 156 q16 40 -6 66 q20 32 -8 56 q16 30 -14 42 l-40 0 q22 -62 12 -130 l-68 0 q-10 68 12 130 l-40 0 q-30 -12 -14 -42 q-28 -24 -8 -56 q-22 -26 -6 -66 Z',
};

function DegradadoTono({ id, hex }: { id: string; hex: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stopColor={hex} />
        <stop offset="65%" stopColor={hex} stopOpacity="0.85" />
        <stop offset="100%" stopColor={hex} stopOpacity="0.55" />
      </linearGradient>
    </defs>
  );
}

function SiluetaCabello({
  hex,
  textura,
  gradId,
}: {
  hex: string;
  textura: Textura;
  gradId: string;
}) {
  return (
    <>
      <DegradadoTono id={gradId} hex={hex} />
      <path d="M118 196 h64 v46 q-32 18 -64 0 Z" fill="#e0bda2" />
      <ellipse cx="150" cy="150" rx="42" ry="52" fill="#e3bfa4" />
      <path d={CUERPOS_CABELLO[textura]} fill={`url(#${gradId})`} />
      <path d="M112 262 q38 22 76 0 l26 68 l-128 0 Z" fill="#fff" opacity="0.42" />
      <circle cx="134" cy="148" r="3.2" fill="#1A1513" opacity="0.8" />
      <circle cx="166" cy="148" r="3.2" fill="#1A1513" opacity="0.8" />
      <path
        d="M142 176 q8 6 16 0"
        fill="none"
        stroke="#A32050"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.75"
      />
    </>
  );
}

// No hay una silueta de frasco/aro en docs/diseno-portada.html (solo cubre
// cabello): estas dos son propias, en el mismo espíritu (degradado del hex,
// trazo simple) para cuidado y accesorios.
function SiluetaFrasco({ hex, gradId }: { hex: string; gradId: string }) {
  return (
    <>
      <DegradadoTono id={gradId} hex={hex} />
      <rect x="128" y="96" width="44" height="30" rx="6" fill={`url(#${gradId})`} />
      <rect x="112" y="126" width="76" height="18" rx="4" fill="#fff" opacity="0.3" />
      <rect x="95" y="144" width="110" height="186" rx="20" fill={`url(#${gradId})`} />
      <rect x="112" y="196" width="76" height="46" rx="6" fill="#fff" opacity="0.4" />
    </>
  );
}

function SiluetaAro({ hex, gradId }: { hex: string; gradId: string }) {
  return (
    <>
      <DegradadoTono id={gradId} hex={hex} />
      <circle cx="150" cy="196" r="88" fill="none" stroke={`url(#${gradId})`} strokeWidth="30" />
      <path
        d="M90 150 A92 92 0 0 1 150 108"
        fill="none"
        stroke="#fff"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.35"
      />
    </>
  );
}

export function ImagenProducto({
  nombre,
  colorHex,
  textura = 'wavy',
  tipo = 'cabello',
  url,
  className = '',
}: ImagenProductoProps) {
  const [fotoFallida, setFotoFallida] = useState(false);
  const gradId = useId();
  const clases = `aspect-[3/4] w-full overflow-hidden rounded-xl ${className}`.trim();

  if (url && !fotoFallida) {
    return (
      <img
        src={url}
        alt={nombre}
        className={clases}
        style={{ objectFit: 'cover' }}
        onError={() => setFotoFallida(true)}
      />
    );
  }

  const hex = colorHex ?? tonoDesdeNombre(nombre);

  return (
    <div role="img" aria-label={nombre} className={clases}>
      <svg
        viewBox="0 0 300 380"
        width="100%"
        height="100%"
        aria-hidden="true"
        style={{ display: 'block' }}
      >
        <rect width="300" height="380" style={{ fill: 'var(--color-arena)' }} />
        {tipo === 'cabello' ? (
          <SiluetaCabello hex={hex} textura={textura} gradId={gradId} />
        ) : tipo === 'frasco' ? (
          <SiluetaFrasco hex={hex} gradId={gradId} />
        ) : (
          <SiluetaAro hex={hex} gradId={gradId} />
        )}
      </svg>
    </div>
  );
}
