// Pestaña Imágenes del panel con fotos por color: el aviso de colores sin
// fotos, la marca de portada que manda el backend y la asignación de un
// color a varias fotos de una vez. Componente real y fetch simulado.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ImagenProductoDetalle,
  ProductoDetalle,
  VarianteDetalle,
} from '../contexto/apiProductosAdmin.ts';
import { PestanaImagenes } from '../paginas/admin/PestanaImagenes.tsx';

const ROSA = { id: 'v-rosa', valor: 'Rosa', hex: '#e8a0b4' };
const RUBIO = { id: 'v-rubio', valor: 'Rubio arena', hex: '#d9b98a' };

function variante(id: string, color: typeof ROSA): VarianteDetalle {
  return {
    id,
    sku: `SKU-${id}`,
    activa: true,
    valoresAtributo: [
      { valorAtributo: { ...color, atributo: { id: 'a-color', nombre: 'Color', slug: 'color' } } },
    ],
  } as VarianteDetalle;
}

function imagen(id: string, valorAtributoId: string | null, orden: number): ImagenProductoDetalle {
  return {
    id,
    productoId: 'p-1',
    valorAtributoId,
    url: `https://ejemplo.com/${id}.webp`,
    altTexto: `Foto ${id}`,
    tipo: 'galeria',
    orden,
    ancho: null,
    alto: null,
    creadoEn: '2026-10-19T00:00:00Z',
  };
}

function producto(cambios: Partial<ProductoDetalle> = {}): ProductoDetalle {
  return {
    id: 'p-1',
    variantes: [variante('var-rosa', ROSA), variante('var-rubio', RUBIO)],
    imagenes: [imagen('i-1', null, 0), imagen('i-2', null, 1), imagen('i-3', null, 2)],
    coloresSinFotos: [ROSA, RUBIO],
    imagenPortadaId: 'i-1',
    ...cambios,
  } as ProductoDetalle;
}

let pedidos: { url: string; metodo: string; cuerpo: unknown }[] = [];

beforeEach(() => {
  pedidos = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const metodo = init.method ?? 'GET';
      pedidos.push({ url, metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : null });
      if (metodo === 'PATCH' && url.endsWith('/api/admin/productos/p-1/imagenes/valor')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      throw new Error(`Pedido inesperado: ${metodo} ${url}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderizar(p: ProductoDetalle, onCambiado = () => {}) {
  render(
    <PestanaImagenes producto={p} accessToken="token" puedeGestionar onCambiado={onCambiado} />,
  );
}

describe('PestanaImagenes: fotos por color', () => {
  it('avisa los colores que no tienen ninguna foto asignada', () => {
    renderizar(producto());
    expect(screen.getByText('Hay 2 colores sin fotos')).toBeInTheDocument();
    expect(screen.getAllByText('Rubio arena').length).toBeGreaterThan(0);
  });

  it('sin colores pendientes no muestra el aviso', () => {
    renderizar(producto({ coloresSinFotos: [] }));
    expect(screen.queryByText(/sin fotos/)).not.toBeInTheDocument();
  });

  it('marca como portada la que dice el backend, no la primera por orden', () => {
    renderizar(producto({ imagenPortadaId: 'i-3' }));
    const portada = screen.getByText('Portada');
    expect(portada.closest('div')?.querySelector('img')).toHaveAttribute('alt', 'Foto i-3');
  });

  it('asigna un color a varias fotos de una vez', async () => {
    const onCambiado = vi.fn();
    renderizar(producto(), onCambiado);

    fireEvent.click(screen.getByLabelText('Seleccionar Foto i-1'));
    fireEvent.click(screen.getByLabelText('Seleccionar Foto i-2'));
    expect(screen.getByText('2 seleccionadas')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Asignar a'), { target: { value: ROSA.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(onCambiado).toHaveBeenCalled());
    expect(pedidos).toEqual([
      {
        url: expect.stringContaining('/api/admin/productos/p-1/imagenes/valor'),
        metodo: 'PATCH',
        cuerpo: { ids: ['i-1', 'i-2'], valorAtributoId: ROSA.id },
      },
    ]);
  });

  it('"Genérica" manda null', async () => {
    const onCambiado = vi.fn();
    renderizar(producto({ imagenes: [imagen('i-1', ROSA.id, 0)] }), onCambiado);

    fireEvent.click(screen.getByLabelText('Seleccionar Foto i-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(onCambiado).toHaveBeenCalled());
    expect(pedidos[0]!.cuerpo).toEqual({ ids: ['i-1'], valorAtributoId: null });
  });
});
