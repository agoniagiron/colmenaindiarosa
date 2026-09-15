import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App.tsx';

describe('App', () => {
  it('muestra el logo de la tienda y la página de inicio en la ruta raíz', () => {
    render(<App />);

    const encabezado = within(screen.getByRole('banner'));
    expect(encabezado.getByText('Rosa', { selector: 'em' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /cabello 100% humano/i })).toBeInTheDocument();
  });
});
