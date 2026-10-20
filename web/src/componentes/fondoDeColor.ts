// Cómo se pinta un color: sólido con hex, o partido en vertical (mitad
// izquierda hex, mitad derecha hexSecundario) si es combinado. En un archivo
// aparte de EsferaColor.tsx para que ese archivo exporte solo el componente
// (refresco en caliente de Vite), igual que clasesBoton.ts. Lo usan la
// esfera y los cuadraditos de color de los kits del panel: una sola
// definición.

export function fondoDeColor(
  hex: string | null | undefined,
  hexSecundario: string | null | undefined,
): string | undefined {
  if (!hex) return undefined;
  if (!hexSecundario) return hex;
  return `linear-gradient(90deg, ${hex} 0 50%, ${hexSecundario} 50% 100%)`;
}
