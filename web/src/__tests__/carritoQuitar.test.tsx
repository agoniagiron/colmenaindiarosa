// Quitar del carrito: la papelera tiene que ser fácil de encontrar y, por
// eso mismo, fácil de tocar sin querer. Lo que se quita deja en su lugar
// una fila de deshacer que no cuenta como producto del carrito.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LineaCarrito } from '../tipos/index.ts';
import { ProveedorAvisos } from '../contexto/ContextoAvisos.tsx';

vi.mock('../contexto/ContextoConfiguracion.tsx', () => ({
  useConfiguracion: () => ({ formatearMonto: (cop: number) => `$${cop}` }),
}));

const HANNAH: LineaCarrito = {
  id: 'l-1',
  tipo: 'variante',
  varianteId: 'v-1',
  nombreProducto: 'HANNAH',
  descripcion: 'HANNAH — Rosa / 14',
  precioUnitario: 990000,
  cantidad: 2,
};
const KIT: LineaCarrito = {
  id: 'l-2',
  tipo: 'combo',
  comboId: 'c-1',
  nombreProducto: 'Kit cuidado',
  descripcion: 'Kit cuidado',
  precioUnitario: 120000,
  cantidad: 1,
};

const quitar = vi.fn();
const agregar = vi.fn();
const agregarCombo = vi.fn();
let estado: { lineas: LineaCarrito[]; setLineas: (l: LineaCarrito[]) => void };

vi.mock('../contexto/ContextoCarrito.tsx', () => ({
  useCarrito: () => ({
    lineas: estado.lineas,
    cupon: null,
    totales: {
      subtotal: estado.lineas.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0),
      descuento: 0,
      envio: 0,
      total: estado.lineas.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0),
      usd: { subtotal: 0, descuento: 0, envio: 0, total: 0 },
    },
    cargandoCupon: false,
    errorCupon: null,
    cambiarCantidad: vi.fn(),
    quitar,
    agregar,
    agregarCombo,
    aplicarCupon: vi.fn(),
    quitarCupon: vi.fn(),
  }),
}));

const { CarritoPagina } = await import('../paginas/CarritoPagina.tsx');

// Simula el contexto: quitar y agregar cambian las líneas como lo haría la
// respuesta de la API.
function ConCarrito({ inicial }: { inicial: LineaCarrito[] }) {
  const [lineas, setLineas] = useState(inicial);
  estado = { lineas, setLineas };
  return (
    <MemoryRouter>
      <ProveedorAvisos>
        <CarritoPagina />
      </ProveedorAvisos>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Carrito: quitar y deshacer', () => {
  it('la papelera tiene una etiqueta accesible que nombra la línea', () => {
    render(<ConCarrito inicial={[HANNAH]} />);
    expect(
      screen.getByRole('button', { name: 'Quitar HANNAH — Rosa / 14 del carrito' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
  });

  it('quitar deja una fila de deshacer que no cuenta para el total, y deshacer vuelve a agregar la misma cantidad', async () => {
    quitar.mockImplementation(async (id: string) => {
      act(() => estado.setLineas(estado.lineas.filter((l) => l.id !== id)));
    });
    agregar.mockImplementation(async () => {
      act(() => estado.setLineas([...estado.lineas, { ...HANNAH, id: 'l-3' }]));
    });
    render(<ConCarrito inicial={[HANNAH, KIT]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar HANNAH — Rosa / 14 del carrito' }));

    const deshacer = await screen.findByRole('button', { name: 'Deshacer' });
    expect(quitar).toHaveBeenCalledWith('l-1');
    // El foco queda en Deshacer, no se pierde.
    expect(deshacer).toHaveFocus();
    // Ya no hay papelera para HANNAH ni cuenta en el título ni en el total.
    expect(
      screen.queryByRole('button', { name: 'Quitar HANNAH — Rosa / 14 del carrito' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Carrito (1 artículo)');
    expect(screen.getAllByText('$120000').length).toBeGreaterThan(0);
    expect(screen.queryByText('$1980000')).not.toBeInTheDocument();

    fireEvent.click(deshacer);
    await waitFor(() => expect(agregar).toHaveBeenCalledWith('v-1', 2));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: 'Quitar HANNAH — Rosa / 14 del carrito' }),
    ).toBeInTheDocument();
  });

  it('quitar la última línea muestra el carrito vacío con el deshacer, y un kit vuelve como kit', async () => {
    quitar.mockImplementation(async () => {
      act(() => estado.setLineas([]));
    });
    agregarCombo.mockResolvedValue(undefined);
    render(<ConCarrito inicial={[KIT]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar Kit cuidado del carrito' }));
    const deshacer = await screen.findByRole('button', { name: 'Deshacer' });
    expect(screen.getByText('Tu carrito está vacío')).toBeInTheDocument();

    fireEvent.click(deshacer);
    await waitFor(() => expect(agregarCombo).toHaveBeenCalledWith('c-1', 1));
    expect(agregar).not.toHaveBeenCalled();
  });

  it('si deshacer falla (p. ej. sin stock), la fila sigue para reintentar', async () => {
    quitar.mockImplementation(async () => {
      act(() => estado.setLineas([]));
    });
    agregar.mockRejectedValue(new Error('Ya no hay disponibilidad de este producto.'));
    render(<ConCarrito inicial={[HANNAH]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar HANNAH — Rosa / 14 del carrito' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Deshacer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya no hay disponibilidad');
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument();
  });
});
