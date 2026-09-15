interface EsqueletoCargaProps {
  ancho?: string;
  alto?: string;
  redondeado?: string;
  className?: string;
}

export function EsqueletoCarga({
  ancho = 'w-full',
  alto = 'h-4',
  redondeado = 'rounded-lg',
  className = '',
}: EsqueletoCargaProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-arena ${ancho} ${alto} ${redondeado} ${className}`.trim()}
    />
  );
}
