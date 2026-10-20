// Los tonos de un color: "Color primario" y "Color secundario (opcional)",
// con la esfera tal como va a quedar. Lo usan el formulario de crear color
// en Atributos, la edición de un color y el creador en línea del flujo de
// variantes: un solo lugar para los dos campos.
//
// Sin secundario el color es sólido. Con secundario la esfera se parte en
// dos, pero sigue siendo un solo color (un nombre, un código).

import { useId } from 'react';
import { EsferaColor } from '../../componentes/EsferaColor.tsx';

// Tono con el que arranca el secundario al agregarlo: distinto del primario
// por defecto, para que la esfera partida se note enseguida.
const SECUNDARIO_INICIAL = '#d9b98a';

export function CamposTono({
  hex,
  hexSecundario,
  onCambiar,
  deshabilitado = false,
}: {
  hex: string;
  hexSecundario: string | null;
  onCambiar: (tonos: { hex: string; hexSecundario: string | null }) => void;
  deshabilitado?: boolean;
}) {
  const idBase = useId();

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <EsferaColor
        className="h-9 w-9 border border-linea"
        hex={hex}
        hexSecundario={hexSecundario}
      />

      <span className="flex items-center gap-2 text-sm text-tinta">
        <label htmlFor={`${idBase}-primario`} className="flex items-center gap-2">
          Color primario
          <input
            id={`${idBase}-primario`}
            type="color"
            value={hex}
            disabled={deshabilitado}
            onChange={(e) => onCambiar({ hex: e.target.value, hexSecundario })}
            className="h-8 w-12 cursor-pointer rounded border border-linea"
          />
        </label>
        <span className="font-mono text-[12px] text-texto-secundario">{hex}</span>
      </span>

      {hexSecundario === null ? (
        <button
          type="button"
          disabled={deshabilitado}
          onClick={() => onCambiar({ hex, hexSecundario: SECUNDARIO_INICIAL })}
          className="text-[13px] text-rosa underline-offset-2 hover:underline disabled:opacity-50"
        >
          + Color secundario (opcional)
        </button>
      ) : (
        <span className="flex items-center gap-2 text-sm text-tinta">
          <label htmlFor={`${idBase}-secundario`} className="flex items-center gap-2">
            Color secundario (opcional)
            <input
              id={`${idBase}-secundario`}
              type="color"
              value={hexSecundario}
              disabled={deshabilitado}
              onChange={(e) => onCambiar({ hex, hexSecundario: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-linea"
            />
          </label>
          <span className="font-mono text-[12px] text-texto-secundario">{hexSecundario}</span>
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => onCambiar({ hex, hexSecundario: null })}
            className="text-[13px] text-texto-secundario underline-offset-2 hover:underline"
          >
            Quitar
          </button>
        </span>
      )}
    </div>
  );
}
