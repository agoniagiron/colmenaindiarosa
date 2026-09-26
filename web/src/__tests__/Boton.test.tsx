import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Boton } from '../componentes/Boton.tsx';

afterEach(cleanup);

describe('Boton con cargando', () => {
  it('mientras cargando es false, un clic dispara onClick normalmente', () => {
    const alClic = vi.fn();
    render(
      <Boton type="button" cargando={false} onClick={alClic}>
        Agregar al carrito
      </Boton>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }));
    expect(alClic).toHaveBeenCalledTimes(1);
  });

  it('mientras cargando es true, se deshabilita, se marca aria-busy y un segundo clic no dispara onClick', () => {
    const alClic = vi.fn();
    const { rerender } = render(
      <Boton type="button" cargando={false} onClick={alClic}>
        Agregar al carrito
      </Boton>,
    );

    rerender(
      <Boton type="button" cargando={true} onClick={alClic}>
        Agregar al carrito
      </Boton>,
    );

    const boton = screen.getByRole('button', { name: 'Agregar al carrito' });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(boton);
    expect(alClic).not.toHaveBeenCalled();
  });

  it('el contenido sigue ocupando su lugar mientras carga (mismo ancho, sin saltos)', () => {
    render(
      <Boton type="button" cargando={true}>
        Agregar al carrito
      </Boton>,
    );

    // El texto sigue en el DOM (invisible, no removido): eso es lo que
    // mantiene el ancho del botón estable en vez de que se achique.
    expect(screen.getByText('Agregar al carrito')).toBeInTheDocument();
  });
});
