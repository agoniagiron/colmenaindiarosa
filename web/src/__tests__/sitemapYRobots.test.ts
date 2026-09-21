import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// vitest corre con process.cwd() en la raíz del paquete web/.
const RAIZ_PUBLIC = join(process.cwd(), 'public');

// La ruta de acceso administrativo (VITE_RUTA_ADMIN, por defecto
// /acceso-interno en desarrollo) nunca debe aparecer en estos dos
// archivos: un Disallow en robots.txt es información pública y
// publicaría la ruta en vez de ocultarla (ver comentario en el propio
// robots.txt). /admin sí puede nombrarse — no es secreto, solo no se
// indexa.
describe('robots.txt y sitemap.xml no exponen la ruta administrativa', () => {
  it('robots.txt no menciona la ruta secreta y sí excluye /admin', () => {
    const contenido = readFileSync(join(RAIZ_PUBLIC, 'robots.txt'), 'utf-8');

    expect(contenido).not.toContain('acceso-interno');
    expect(contenido).toMatch(/Disallow:\s*\/admin\b/);
  });

  it('sitemap.xml solo lista rutas públicas, sin /admin ni la ruta secreta', () => {
    const contenido = readFileSync(join(RAIZ_PUBLIC, 'sitemap.xml'), 'utf-8');
    // Solo las URLs listadas (<loc>), no los comentarios del archivo (que
    // sí pueden mencionar /admin en prosa explicando por qué no está).
    const urls = [...contenido.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).not.toContain('acceso-interno');
      expect(url).not.toMatch(/\/admin\b/);
    }
  });
});
