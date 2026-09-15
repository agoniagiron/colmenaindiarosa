import { describe, expect, it } from 'vitest';
import { repositorioMemoria } from '../datos/repositorioMemoria.ts';

const PAGINA_COMPLETA = { pagina: 1, porPagina: 100 };

async function slugsFiltrados(filtros: Parameters<typeof repositorioMemoria.listarProductos>[0]) {
  const resultado = await repositorioMemoria.listarProductos(
    filtros,
    'relevancia',
    PAGINA_COMPLETA,
  );
  return resultado.datos.map((producto) => producto.slug).sort();
}

describe('repositorioMemoria - lógica de filtrado', () => {
  it('con dos valores del mismo atributo (dos colores) devuelve los productos de ambos', async () => {
    const slugs = await slugsFiltrados({ color: ['Negro natural', 'Caramelo'] });

    expect(slugs).toEqual(
      [
        'extensiones-clip-in-seda',
        'peluca-bob-cleo',
        'peluca-full-lace-camila',
        'peluca-lace-front-valentina',
        'peluca-ondulada-renata',
        'peluca-rizada-solange',
      ].sort(),
    );
  });

  it('con dos atributos distintos (color y talla) devuelve solo lo que cumple ambas condiciones', async () => {
    const slugs = await slugsFiltrados({ color: ['Chocolate'], talla: ['Mediana'] });

    // Solange y Camila también tienen variantes color Chocolate, pero su
    // talla es "Grande": no deben aparecer. Bob Cleo y Valentina sí tienen
    // una variante que es Chocolate y Mediana a la vez.
    expect(slugs).toEqual(['peluca-bob-cleo', 'peluca-lace-front-valentina'].sort());
  });

  it('un filtro sin coincidencias no devuelve productos', async () => {
    const slugs = await slugsFiltrados({ color: ['Rubio arena'], talla: ['Pequeña'] });

    expect(slugs).toEqual([]);
  });
});
