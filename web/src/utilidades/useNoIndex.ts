import { useEffect } from 'react';

// Inyecta <meta name="robots" content="noindex, nofollow"> mientras el
// componente que llama a este hook está montado, y lo saca al desmontar.
// Se usa en la pantalla de acceso administrativo y en todo /admin: nada
// de eso debe aparecer indexado, y robots.txt/sitemap.xml tampoco las
// mencionan (ver web/public/robots.txt).
export function useNoIndex(): void {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);
}
