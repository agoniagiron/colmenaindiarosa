import { useId, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface CampoAccesoProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  error?: string;
  // Para "¿Olvidaste tu contraseña?" en la misma línea que la etiqueta
  // (ver LOGIN del pedido) — cualquier otro campo lo deja sin usar.
  accionEtiqueta?: ReactNode;
}

// Estilo propio de las pantallas de acceso (login/registro), separado de
// CampoTexto.tsx a propósito: ese componente lo usa el resto del sitio
// (cuenta, catálogo, panel admin) y este pedido es "solo visual" para
// estas dos pantallas — tocar CampoTexto habría cambiado todos los demás
// formularios sin que nadie lo pidiera.
export function CampoAcceso({
  etiqueta,
  error,
  accionEtiqueta,
  id,
  type,
  className = '',
  ...props
}: CampoAccesoProps) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;
  const idError = error ? `${idCampo}-error` : undefined;
  const esClave = type === 'password';
  const [mostrarClave, setMostrarClave] = useState(false);

  return (
    // Grid en vez de un orden de DOM "visual": así el link de
    // accionEtiqueta puede ir AL FINAL del DOM (después del input, en el
    // orden en que Tab lo visita) y aun así dibujarse arriba, junto a la
    // etiqueta. Si fuera al revés — el link primero en el DOM para que
    // quede arriba — Tab saltaría del correo a "¿Olvidaste tu
    // contraseña?" antes de llegar al campo de contraseña, un salto sin
    // sentido para quien navega con teclado.
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-2 gap-y-1.5">
      <label htmlFor={idCampo} className="col-start-1 row-start-1 text-sm font-medium text-tinta">
        {etiqueta}
      </label>

      <div className="relative col-span-2 row-start-2">
        <input
          id={idCampo}
          type={esClave && mostrarClave ? 'text' : type}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={idError}
          className={`h-12 w-full rounded-md border border-linea bg-white px-3.5 text-sm text-tinta placeholder:text-texto-secundario focus-visible:border-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/30 ${esClave ? 'pr-11' : ''} ${className}`.trim()}
          {...props}
        />
        {esClave ? (
          <button
            type="button"
            onClick={() => setMostrarClave((actual) => !actual)}
            aria-label={mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-texto-secundario hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            <IconoOjo abierto={mostrarClave} />
          </button>
        ) : null}
      </div>

      {accionEtiqueta ? (
        <div className="col-start-2 row-start-1 justify-self-end">{accionEtiqueta}</div>
      ) : null}

      {error ? (
        <p id={idError} className="col-span-2 row-start-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function IconoOjo({ abierto }: { abierto: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {abierto ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
          <path d="M9.88 5.09A9.77 9.77 0 0 1 12 5c6 0 9.5 6.5 9.5 6.5a16.6 16.6 0 0 1-3.06 3.9M6.6 6.6C4.1 8.3 2.5 11.5 2.5 11.5S6 18 12 18c1.08 0 2.1-.18 3.04-.5" />
        </>
      ) : (
        <>
          <path d="M2.5 11.5S6 5 12 5s9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 11.5 2.5 11.5Z" />
          <circle cx="12" cy="11.5" r="2.5" />
        </>
      )}
    </svg>
  );
}
