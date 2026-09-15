import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface CampoTextoProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  ocultarEtiqueta?: boolean;
  error?: string;
}

export function CampoTexto({
  etiqueta,
  ocultarEtiqueta = false,
  error,
  id,
  className = '',
  ...props
}: CampoTextoProps) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;
  const idError = error ? `${idCampo}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={idCampo}
        className={ocultarEtiqueta ? 'sr-only' : 'text-sm font-medium text-tinta'}
      >
        {etiqueta}
      </label>
      <input
        id={idCampo}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={idError}
        className={`rounded-xl border border-linea bg-white px-3 py-2 text-sm text-tinta placeholder:text-texto-secundario focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${className}`.trim()}
        {...props}
      />
      {error ? (
        <p id={idError} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
