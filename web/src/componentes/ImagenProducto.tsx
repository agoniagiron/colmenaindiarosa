// Marcador de posición mientras no existen fotos reales de producto.
// Cuando lleguen las fotos, solo este componente cambia (pasa a <img>).

interface ImagenProductoProps {
  nombre: string;
  colorHex?: string;
  className?: string;
}

const COLOR_RESPALDO = '#EFE3DA';

export function ImagenProducto({ nombre, colorHex, className = '' }: ImagenProductoProps) {
  return (
    <div
      role="img"
      aria-label={nombre}
      className={`aspect-[3/4] w-full overflow-hidden rounded-xl ${className}`.trim()}
      style={{
        backgroundColor: colorHex ?? COLOR_RESPALDO,
        backgroundImage:
          'repeating-linear-gradient(135deg, rgba(255,255,255,0.16) 0px, rgba(255,255,255,0.16) 10px, transparent 10px, transparent 20px)',
      }}
    />
  );
}
