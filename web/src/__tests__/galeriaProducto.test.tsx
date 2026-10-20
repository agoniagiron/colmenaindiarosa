// Galería de la ficha: muestra la galería que manda el backend para la
// variante elegida y, al cambiar de color, la foto grande salta a la
// primera de ese color (lo que estaba roto: con "Rubio arena" elegido se
// veía la foto rosa).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GaleriaProducto } from '../paginas/ProductoDetalle.tsx';
import type { ImagenProducto } from '../tipos/index.ts';

const foto = (id: string): ImagenProducto => ({
  id,
  url: `https://ejemplo.com/${id}.webp`,
  altTexto: `HANNAH ${id}`,
});

const ROSA_14 = {
  color: { nombre: 'Rosa', hex: '#e8a0b4' },
  imagenes: [foto('rosa-1'), foto('rosa-2'), foto('generica')],
};
const ROSA_16 = { ...ROSA_14 };
const RUBIO_14 = {
  color: { nombre: 'Rubio arena', hex: '#d9b98a' },
  imagenes: [foto('rubio-1'), foto('generica')],
};

const fotoGrande = () => screen.getAllByRole('img').at(-1);

afterEach(cleanup);

describe('GaleriaProducto', () => {
  it('muestra la galería de la variante elegida, empezando por la primera', () => {
    render(<GaleriaProducto producto={{ nombre: 'HANNAH' }} variante={ROSA_14} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(fotoGrande()).toHaveAttribute('src', 'https://ejemplo.com/rosa-1.webp');
  });

  it('al cambiar de color, la foto grande salta a la primera del color nuevo', () => {
    const { rerender } = render(
      <GaleriaProducto producto={{ nombre: 'HANNAH' }} variante={ROSA_14} />,
    );
    // Elige la genérica, que también está en la galería del rubio.
    fireEvent.click(screen.getByRole('button', { name: 'Ver imagen 3 de HANNAH' }));
    expect(fotoGrande()).toHaveAttribute('src', 'https://ejemplo.com/generica.webp');

    rerender(<GaleriaProducto producto={{ nombre: 'HANNAH' }} variante={RUBIO_14} />);
    expect(fotoGrande()).toHaveAttribute('src', 'https://ejemplo.com/rubio-1.webp');
  });

  it('al cambiar solo la longitud (mismo color), mantiene la foto elegida', () => {
    const { rerender } = render(
      <GaleriaProducto producto={{ nombre: 'HANNAH' }} variante={ROSA_14} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver imagen 2 de HANNAH' }));

    rerender(<GaleriaProducto producto={{ nombre: 'HANNAH' }} variante={ROSA_16} />);
    expect(fotoGrande()).toHaveAttribute('src', 'https://ejemplo.com/rosa-2.webp');
  });
});
