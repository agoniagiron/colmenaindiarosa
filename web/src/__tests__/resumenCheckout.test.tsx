// Resumen del checkout: es donde la clienta paga, y cada línea tiene que
// dejar claro qué compra (foto del color elegido, nombre con sus atributos)
// y por cuánto. El texto llega armado del backend (describirLinea).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TotalesCarrito } from '../tipos/index.ts';
import { formatearPesos } from '../utilidades/formatearPesos.ts';

// Intl separa el signo con un espacio de no separación; Testing Library
// normaliza el texto del DOM pero no el esperado.
const pesos = (valor: number) => formatearPesos(valor).replace(/\s/g, ' ');

vi.mock('../contexto/ContextoConfiguracion.tsx', () => ({
  useConfiguracion: () => ({ formatearMonto: (cop: number) => formatearPesos(cop) }),
}));

const { ResumenPedido } = await import('../paginas/CheckoutPagina.tsx');

const TOTALES: TotalesCarrito = {
  subtotal: 1980000,
  descuento: 0,
  envio: 0,
  total: 1980000,
  descuentoAplicado: 'ninguno',
  descuentoDescartado: null,
  usd: { subtotal: 0, descuento: 0, envio: 0, total: 0 },
};

afterEach(cleanup);

describe('ResumenPedido (checkout)', () => {
  it('cada línea muestra la foto del color, el nombre con los atributos y el precio', () => {
    render(
      <ResumenPedido
        lineas={[
          {
            id: 'l-1',
            nombreProducto: 'HANNAH',
            descripcion: 'HANNAH — Rosa / 14 / Lace frontal 13x4 / Mediana / 210',
            imagenUrl: 'https://ejemplo.com/rosa-1.webp',
            color: { nombre: 'Rosa', hex: '#e8a0b4' },
            cantidad: 2,
            precioUnitario: 990000,
          },
        ]}
        totales={TOTALES}
      />,
    );

    expect(
      screen.getByText('HANNAH — Rosa / 14 / Lace frontal 13x4 / Mediana / 210'),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'HANNAH' })).toHaveAttribute(
      'src',
      'https://ejemplo.com/rosa-1.webp',
    );
    expect(screen.getByText(`2 × ${pesos(990000)}`)).toBeInTheDocument();
    expect(screen.getAllByText(pesos(1980000)).length).toBeGreaterThan(0);
  });
});
