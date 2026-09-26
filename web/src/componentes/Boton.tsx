import type { ButtonHTMLAttributes } from 'react';
import { IndicadorCarga } from './IndicadorCarga.tsx';

type VarianteBoton = 'rosa' | 'tinta' | 'fantasma' | 'whatsapp';

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  // Mientras es true: se deshabilita, se marca aria-busy, ignora clics y
  // muestra un spinner superpuesto sin cambiar el ancho del botón (el
  // contenido sigue ocupando su lugar, solo se vuelve invisible).
  cargando?: boolean;
}

const CLASES_BASE =
  'relative inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa focus-visible:ring-offset-2 focus-visible:ring-offset-hueso';

const CLASES_VARIANTE: Record<VarianteBoton, string> = {
  rosa: 'bg-rosa text-hueso hover:bg-rosa/90',
  tinta: 'bg-negro text-hueso hover:bg-rosa',
  fantasma: 'border border-linea bg-transparent text-tinta hover:bg-arena',
  whatsapp: 'bg-whatsapp text-hueso hover:bg-whatsapp/90',
};

export function Boton({
  variante = 'rosa',
  className = '',
  cargando = false,
  disabled,
  onClick,
  children,
  ...props
}: BotonProps) {
  const clases = `${CLASES_BASE} ${CLASES_VARIANTE[variante]} ${className}`.trim();

  return (
    <button
      className={clases}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      onClick={(evento) => {
        // El atributo disabled ya bloquea el clic nativo; esto es una
        // segunda barrera por si el consumidor pasa disabled={false} a
        // propósito mientras cargando es true.
        if (cargando) return;
        onClick?.(evento);
      }}
      {...props}
    >
      <span className={cargando ? 'invisible' : 'contents'}>{children}</span>
      {cargando ? (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <IndicadorCarga />
        </span>
      ) : null}
    </button>
  );
}
