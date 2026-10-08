import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App.tsx';
import type { HeroePortada } from '../datos/repositorio.ts';

// Reemplaza el mock global de setup.ts (que usa repositorioMemoria tal
// cual) para controlar exactamente qué trae obtenerHeroePortada en cada
// prueba: el fallback (punto 9 del pedido) solo se ve de verdad con la
// lista vacía, y las pelucas de muestra siempre tienen alguna destacada.
const { obtenerHeroePortadaMock } = vi.hoisted(() => ({
  obtenerHeroePortadaMock: vi.fn<() => Promise<HeroePortada>>(),
}));

vi.mock('../datos/index.ts', () => ({
  repositorio: {
    listarCategorias: vi.fn().mockResolvedValue([]),
    listarProductos: vi.fn().mockResolvedValue({
      datos: [],
      paginacion: { pagina: 1, porPagina: 12, total: 0, totalPaginas: 0 },
    }),
    listarFacetas: vi.fn().mockResolvedValue({
      tiposBase: [],
      longitudes: [],
      tallas: [],
      densidades: [],
      colores: [
        { nombre: 'Negro', hex: '#111111', conteo: 5 },
        { nombre: 'Rubio', hex: '#e8c27a', conteo: 2 },
      ],
    }),
    obtenerHeroePortada: obtenerHeroePortadaMock,
    obtenerProducto: vi.fn().mockResolvedValue(null),
    listarRelacionados: vi.fn().mockResolvedValue([]),
    buscarCupon: vi.fn().mockResolvedValue(null),
    obtenerConfiguracionPublica: vi.fn().mockResolvedValue([]),
    listarLimitadas: vi.fn().mockResolvedValue([]),
    listarCombos: vi.fn().mockResolvedValue([]),
  },
}));

afterEach(cleanup);

// El nombre accesible de un botón de tono ("Castaño 1 pieza") y el del
// botón "Ver 1 pieza en Castaño" comparten el nombre del color: hay que
// acotar la búsqueda a la hilera para no matchear los dos.
function hileraDeTonos() {
  return within(screen.getByRole('group', { name: 'Elegir tono de cabello' }));
}

describe('Inicio: héroe de la portada', () => {
  it('sin ninguna peluca marcada para portada, cae a la silueta y a los colores del catálogo', async () => {
    obtenerHeroePortadaMock.mockResolvedValue({ destacadas: [], colores: [] });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /elige tu tono/i })).toBeInTheDocument();
    // La hilera de tonos sale del catálogo (Negro y Rubio, del mock de facetas).
    expect(await hileraDeTonos().findByRole('button', { name: /Negro/ })).toBeInTheDocument();
    // Sin destacadas no hay carrusel: ninguna flecha ni punto.
    expect(screen.queryByRole('button', { name: 'Peluca siguiente' })).not.toBeInTheDocument();
  });

  // Peluca Uno solo tiene Castaño; Peluca Dos tiene las dos variantes, en
  // Castaño y en Rubio — así el tono activo por defecto (Castaño, el
  // primero de la unión) deja DOS destacadas, y elegir Rubio deja UNA sola.
  const DESTACADAS_DOS_TONOS = {
    destacadas: [
      {
        id: 'p1',
        slug: 'peluca-uno',
        nombre: 'Peluca Uno',
        colores: [{ nombre: 'Castaño', hex: '#4a2d1b' }],
      },
      {
        id: 'p2',
        slug: 'peluca-dos',
        nombre: 'Peluca Dos',
        colores: [
          { nombre: 'Castaño', hex: '#4a2d1b' },
          { nombre: 'Rubio', hex: '#e8c27a' },
        ],
      },
    ],
    colores: [
      { nombre: 'Castaño', hex: '#4a2d1b' },
      { nombre: 'Rubio', hex: '#e8c27a' },
    ],
  };

  it('con pelucas marcadas para portada, muestra el carrusel y una hilera de tonos propia', async () => {
    obtenerHeroePortadaMock.mockResolvedValue(DESTACADAS_DOS_TONOS);

    render(<App />);

    expect(await screen.findByText('Peluca Uno')).toBeInTheDocument();
    // La hilera usa los colores de las destacadas (Castaño/Rubio), no el
    // catálogo completo (Negro, que no está acá).
    expect(hileraDeTonos().getByRole('button', { name: /Castaño/ })).toBeInTheDocument();
    expect(hileraDeTonos().queryByRole('button', { name: /Negro/ })).not.toBeInTheDocument();
    // Dos destacadas en el tono activo (Castaño): sí hay flecha.
    expect(screen.getByRole('button', { name: 'Peluca siguiente' })).toBeInTheDocument();
  });

  it('al elegir un tono, el carrusel se filtra a las destacadas de ese color', async () => {
    obtenerHeroePortadaMock.mockResolvedValue(DESTACADAS_DOS_TONOS);

    render(<App />);

    await screen.findByText('Peluca Uno');
    hileraDeTonos().getByRole('button', { name: /Rubio/ }).click();

    await waitFor(() => {
      expect(screen.getByText('Peluca Dos')).toBeInTheDocument();
    });
    expect(screen.queryByText('Peluca Uno')).not.toBeInTheDocument();
    // Una sola peluca en ese tono: sin flechas.
    expect(screen.queryByRole('button', { name: 'Peluca siguiente' })).not.toBeInTheDocument();
  });
});
