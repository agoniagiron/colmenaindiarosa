// "Encuentra tu tono": bajo cada tono, las pelucas con la foto de ese color.
// El carrusel nunca cambia de tono solo, deja de avanzar apenas la persona
// toca algo, y con una sola peluca no muestra asomo ni controles. Sin
// tonos, la sección no aparece.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeroePortada } from '../datos/repositorio.ts';

vi.mock('../contexto/ContextoConfiguracion.tsx', () => ({
  useConfiguracion: () => ({
    cargando: true,
    obtenerNumero: () => undefined,
    obtenerBooleano: () => undefined,
    obtenerTexto: () => undefined,
    formatearMonto: (v: number) => `$${v}`,
    formatearDual: (v: { cop: number }) => `$${v.cop}`,
  }),
}));
vi.mock('../contexto/ContextoCarrito.tsx', () => ({
  useCarrito: () => ({ agregarCombo: vi.fn() }),
}));

const { repositorio } = await import('../datos/index.ts');
const { Inicio } = await import('../paginas/Inicio.tsx');

const producto = (id: string, color: string) => ({
  id,
  slug: id,
  nombre: id.toUpperCase(),
  sku: `SKU-${id}-${color}`,
  imagen: { url: `https://ejemplo.com/${id}-${color}.jpg`, altTexto: `${id} ${color}` },
});

const HEROE: HeroePortada = {
  tonos: [
    {
      nombre: 'Rosa',
      hex: '#e8a0b4',
      productos: [producto('hannah', 'rosa'), producto('lola', 'rosa')],
    },
    { nombre: 'Rubio', hex: '#eee', productos: [producto('hannah', 'rubio')] },
  ],
};

function renderInicio() {
  return render(
    <MemoryRouter>
      <Inicio />
    </MemoryRouter>,
  );
}

const carrusel = () => screen.getByRole('group', { name: /^Pelucas en tono/ });
const fotoActiva = () => carrusel().querySelector('a:not([aria-hidden])')!.getAttribute('href');

beforeEach(() => {
  vi.spyOn(repositorio, 'listarLimitadas').mockResolvedValue([]);
  vi.spyOn(repositorio, 'listarCombos').mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Inicio: carrusel por tono', () => {
  it('al elegir un tono muestra las pelucas de ese tono con la foto de ese color', async () => {
    vi.spyOn(repositorio, 'obtenerHeroePortada').mockResolvedValue(HEROE);
    renderInicio();

    expect(await screen.findByRole('group', { name: 'Pelucas en tono Rosa' })).toBeInTheDocument();
    expect(fotoActiva()).toBe('/producto/hannah?variante=SKU-hannah-rosa');

    fireEvent.click(screen.getAllByRole('button', { name: 'Rubio' })[0]!);

    expect(carrusel()).toHaveAccessibleName('Pelucas en tono Rubio');
    const fotos = carrusel().querySelectorAll('img');
    expect([...fotos].map((f) => f.getAttribute('src'))).toEqual([
      'https://ejemplo.com/hannah-rubio.jpg',
    ]);
  });

  it('con una sola peluca: ancho completo, sin flechas, puntos ni contador', async () => {
    vi.spyOn(repositorio, 'obtenerHeroePortada').mockResolvedValue({
      tonos: [HEROE.tonos[1]!],
    });
    renderInicio();

    await screen.findByRole('group', { name: 'Pelucas en tono Rubio' });
    expect(screen.queryByRole('button', { name: 'Peluca siguiente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Ir a una peluca' })).not.toBeInTheDocument();
    expect(carrusel().querySelector('a')).toHaveStyle({ width: '100%' });
  });

  it('recorre solo dentro del tono hasta que la persona toca algo; después no avanza más', async () => {
    vi.spyOn(repositorio, 'obtenerHeroePortada').mockResolvedValue(HEROE);
    vi.useFakeTimers();
    renderInicio();
    // Resuelve la carga de la portada sin dejar correr el reloj.
    await act(async () => {});
    expect(carrusel()).toHaveAccessibleName('Pelucas en tono Rosa');

    // Escaparate: avanza solo a la segunda peluca rosa...
    act(() => vi.advanceTimersByTime(5000));
    expect(fotoActiva()).toBe('/producto/lola?variante=SKU-lola-rosa');
    // ...y vuelve a la primera sin pasar nunca al rubio.
    act(() => vi.advanceTimersByTime(5000));
    expect(fotoActiva()).toBe('/producto/hannah?variante=SKU-hannah-rosa');
    expect(carrusel()).toHaveAccessibleName('Pelucas en tono Rosa');

    // Una flecha: desde acá maneja ella.
    fireEvent.click(screen.getByRole('button', { name: 'Peluca siguiente' }));
    expect(fotoActiva()).toBe('/producto/lola?variante=SKU-lola-rosa');
    act(() => vi.advanceTimersByTime(20000));
    expect(fotoActiva()).toBe('/producto/lola?variante=SKU-lola-rosa');
  });

  it('tocar un tono también detiene el avance automático', async () => {
    vi.spyOn(repositorio, 'obtenerHeroePortada').mockResolvedValue(HEROE);
    vi.useFakeTimers();
    renderInicio();
    // Resuelve la carga de la portada sin dejar correr el reloj.
    await act(async () => {});
    expect(carrusel()).toHaveAccessibleName('Pelucas en tono Rosa');

    // Tocar el tono que ya está activo cuenta como interacción.
    fireEvent.click(screen.getAllByRole('button', { name: 'Rosa' })[0]!);
    act(() => vi.advanceTimersByTime(20000));
    expect(fotoActiva()).toBe('/producto/hannah?variante=SKU-hannah-rosa');
  });

  it('sin tonos no muestra la sección; queda un título solo para lectores de pantalla', async () => {
    vi.spyOn(repositorio, 'obtenerHeroePortada').mockResolvedValue({ tonos: [] });
    renderInicio();

    await waitFor(() => expect(screen.queryByText(/Encuentra tu tono/)).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('sr-only');
    expect(screen.queryByRole('group', { name: 'Elegir tono de cabello' })).not.toBeInTheDocument();
  });
});
