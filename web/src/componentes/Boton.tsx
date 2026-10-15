import type { ButtonHTMLAttributes } from 'react';
import { clasesBoton } from './clasesBoton.ts';
import type { VarianteBoton } from './clasesBoton.ts';
import { IndicadorCarga } from './IndicadorCarga.tsx';

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  // Mientras es true: se deshabilita, se marca aria-busy, ignora clics y
  // muestra un spinner superpuesto sin cambiar el ancho del botón (el
  // contenido sigue ocupando su lugar, solo se vuelve invisible).
  cargando?: boolean;
}

export function Boton({
  variante = 'rosa',
  className = '',
  cargando = false,
  disabled,
  onClick,
  children,
  ...props
}: BotonProps) {
  const clases = clasesBoton(variante, className);

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
