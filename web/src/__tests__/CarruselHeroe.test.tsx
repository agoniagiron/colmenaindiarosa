import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CarruselHeroe } from '../componentes/CarruselHeroe.tsx';
import type { ProductoHeroe } from '../datos/repositorio.ts';

afterEach(cleanup);

function producto(id: string, nombre: string): ProductoHeroe {
  return { id, slug: id, nombre, colores: [{ nombre: 'Negro', hex: '#111' }] };
}

const TRES: ProductoHeroe[] = [
  producto('p1', 'Peluca Uno'),
  producto('p2', 'Peluca Dos'),
  producto('p3', 'Peluca Tres'),
];

function renderizar(productos: ProductoHeroe[]) {
  return render(
    <MemoryRouter>
      <CarruselHeroe productos={productos} />
    </MemoryRouter>,
  );
}

describe('CarruselHeroe', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // matchMedia no existe en jsdom por defecto.
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('con una sola peluca no muestra flechas ni puntos', () => {
    renderizar([producto('p1', 'Peluca Única')]);

    expect(screen.getByText('Peluca Única')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Peluca anterior' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Peluca siguiente' })).not.toBeInTheDocument();
  });

  it('avanza sola cada 5 segundos', () => {
    renderizar(TRES);

    expect(screen.getByText('Peluca Uno')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Peluca Dos')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Peluca Tres')).toBeInTheDocument();

    // Da la vuelta.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Peluca Uno')).toBeInTheDocument();
  });

  it('usar una flecha detiene el avance automático para siempre', () => {
    renderizar(TRES);

    fireEvent.click(screen.getByRole('button', { name: 'Peluca siguiente' }));
    expect(screen.getByText('Peluca Dos')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(20000);
    });
    // Si siguiera avanzando sola, ya habría dado varias vueltas.
    expect(screen.getByText('Peluca Dos')).toBeInTheDocument();
  });

  it('usar un punto también detiene el avance automático', () => {
    renderizar(TRES);

    fireEvent.click(screen.getByRole('button', { name: 'Ir a Peluca Tres' }));
    expect(screen.getByText('Peluca Tres')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByText('Peluca Tres')).toBeInTheDocument();
  });

  it('con prefers-reduced-motion activo, no avanza sola pero las flechas sí funcionan', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    renderizar(TRES);

    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByText('Peluca Uno')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Peluca siguiente' }));
    expect(screen.getByText('Peluca Dos')).toBeInTheDocument();
  });

  it('cambiar el conjunto de pelucas (otro tono) reinicia el índice y el avance automático', () => {
    const { rerender } = renderizar(TRES);

    fireEvent.click(screen.getByRole('button', { name: 'Peluca siguiente' }));
    expect(screen.getByText('Peluca Dos')).toBeInTheDocument();

    const OTRO_TONO: ProductoHeroe[] = [
      producto('p4', 'Peluca Cuatro'),
      producto('p5', 'Peluca Cinco'),
    ];
    rerender(
      <MemoryRouter>
        <CarruselHeroe productos={OTRO_TONO} />
      </MemoryRouter>,
    );

    // Arranca de cero con el conjunto nuevo...
    expect(screen.getByText('Peluca Cuatro')).toBeInTheDocument();

    // ...y el autoavance volvió a correr, aunque antes se hubiera
    // detenido con la flecha.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Peluca Cinco')).toBeInTheDocument();
  });
});
