interface EstrellasProps {
  calificacion: number;
  maximo?: number;
}

export function Estrellas({ calificacion, maximo = 5 }: EstrellasProps) {
  const porcentaje = Math.max(0, Math.min(1, calificacion / maximo)) * 100;
  const estrellas = '★'.repeat(maximo);

  return (
    <span
      role="img"
      aria-label={`Calificación: ${calificacion.toFixed(1)} de ${maximo} estrellas`}
      className="relative inline-block leading-none text-linea"
    >
      <span aria-hidden="true">{estrellas}</span>
      <span
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden whitespace-nowrap text-rosa"
        style={{ width: `${porcentaje}%` }}
      >
        {estrellas}
      </span>
    </span>
  );
}
