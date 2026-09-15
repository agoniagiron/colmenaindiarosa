import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ArbolRutas } from '../App.tsx';

afterEach(cleanup);

function CapturadorUbicacion() {
  const ubicacion = useLocation();
  return <div data-testid="ubicacion">{ubicacion.pathname + ubicacion.search}</div>;
}

function renderizarCatalogo(rutaInicial: string) {
  return render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <CapturadorUbicacion />
      <ArbolRutas />
    </MemoryRouter>,
  );
}

describe('Catálogo - filtros sincronizados con la URL', () => {
  it('refleja en los controles un filtro que llega como query param inicial', async () => {
    renderizarCatalogo('/catalogo?categoria=pelucas');

    const casillaPelucas = await screen.findByRole('checkbox', { name: 'Pelucas' });
    const casillaCuidado = await screen.findByRole('checkbox', { name: 'Cuidado' });

    expect(casillaPelucas).toBeChecked();
    expect(casillaCuidado).not.toBeChecked();
  });

  it('actualiza la URL al marcar un filtro de categoría', async () => {
    renderizarCatalogo('/catalogo');

    const casillaPelucas = await screen.findByRole('checkbox', { name: 'Pelucas' });
    fireEvent.click(casillaPelucas);

    await waitFor(() => {
      expect(screen.getByTestId('ubicacion')).toHaveTextContent('/catalogo?categoria=pelucas');
    });
  });

  it('quita el filtro de la URL si se vuelve a desmarcar la casilla', async () => {
    renderizarCatalogo('/catalogo?categoria=pelucas');

    const casillaPelucas = await screen.findByRole('checkbox', { name: 'Pelucas' });
    expect(casillaPelucas).toBeChecked();

    fireEvent.click(casillaPelucas);

    await waitFor(() => {
      expect(screen.getByTestId('ubicacion')).toHaveTextContent('/catalogo');
    });
    expect(screen.getByTestId('ubicacion')).not.toHaveTextContent('categoria');
  });
});
