import type { ReactNode } from 'react';

interface EstadoVacioProps {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  icono?: ReactNode;
}

export function EstadoVacio({ titulo, descripcion, accion, icono }: EstadoVacioProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-linea bg-arena/40 px-6 py-12 text-center">
      {icono ? <div className="text-texto-secundario">{icono}</div> : null}
      <h2 className="font-serif text-lg text-tinta">{titulo}</h2>
      {descripcion ? <p className="max-w-sm text-sm text-texto-secundario">{descripcion}</p> : null}
      {accion ? <div className="mt-2">{accion}</div> : null}
    </div>
  );
}
