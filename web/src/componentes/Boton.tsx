import type { ButtonHTMLAttributes } from 'react';

type VarianteBoton = 'rosa' | 'tinta' | 'fantasma' | 'whatsapp';

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
}

const CLASES_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa focus-visible:ring-offset-2 focus-visible:ring-offset-hueso';

const CLASES_VARIANTE: Record<VarianteBoton, string> = {
  rosa: 'bg-rosa text-hueso hover:bg-rosa/90',
  tinta: 'bg-negro text-hueso hover:bg-rosa',
  fantasma: 'border border-linea bg-transparent text-tinta hover:bg-arena',
  whatsapp: 'bg-whatsapp text-hueso hover:bg-whatsapp/90',
};

export function Boton({ variante = 'rosa', className = '', ...props }: BotonProps) {
  const clases = `${CLASES_BASE} ${CLASES_VARIANTE[variante]} ${className}`.trim();
  return <button className={clases} {...props} />;
}
