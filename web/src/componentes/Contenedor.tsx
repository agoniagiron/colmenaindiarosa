import type { ReactNode } from 'react';

type AnchoContenedor = 'amplio' | 'normal';

interface ContenedorProps {
  ancho?: AnchoContenedor;
  className?: string;
  children: ReactNode;
}

// Único lugar donde viven los anchos máximos de página: header, hero,
// secciones de Inicio y el catálogo comparten 'amplio'; las páginas de
// lectura (ficha de producto, carrito, cuenta) usan 'normal' porque a
// 1600px el texto corrido queda con líneas larguísimas.
const CLASES_POR_ANCHO: Record<AnchoContenedor, string> = {
  amplio: 'w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10',
  normal: 'w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10',
};

export function Contenedor({ ancho = 'amplio', className = '', children }: ContenedorProps) {
  return <div className={`${CLASES_POR_ANCHO[ancho]} ${className}`.trim()}>{children}</div>;
}
