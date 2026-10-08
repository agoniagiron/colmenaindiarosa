import { useEffect, useState } from 'react';

const CONSULTA = '(prefers-reduced-motion: reduce)';

// Usado por CarruselHeroe.tsx para no autoavanzar cuando la clienta tiene
// activada la preferencia del sistema: las flechas y los puntos siguen
// funcionando igual, solo se apaga el avance automático cada 5s.
export function usePrefiereMovimientoReducido(): boolean {
  const [prefiereReducido, setPrefiereReducido] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(CONSULTA).matches,
  );

  useEffect(() => {
    const medio = window.matchMedia(CONSULTA);
    const alCambiar = (evento: MediaQueryListEvent) => setPrefiereReducido(evento.matches);
    medio.addEventListener('change', alCambiar);
    return () => medio.removeEventListener('change', alCambiar);
  }, []);

  return prefiereReducido;
}
