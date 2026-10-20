// Colores combinados (dos tonos, esfera partida) y edición de colores en el
// panel. Componentes reales y fetch simulado.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EsferaColor } from '../componentes/EsferaColor.tsx';
import { fondoDeColor } from '../componentes/fondoDeColor.ts';
import type { ValorDeAtributo } from '../contexto/apiProductosAdmin.ts';
import { EditorValor } from '../paginas/admin/AdminAtributos.tsx';
import { CamposTono } from '../paginas/admin/CamposTono.tsx';
import { CrearValorEnLinea } from '../paginas/admin/CrearValorEnLinea.tsx';

let pedidos: { url: string; metodo: string; cuerpo: unknown }[] = [];

beforeEach(() => {
  pedidos = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const metodo = init.method ?? 'GET';
      const cuerpo = init.body ? JSON.parse(String(init.body)) : null;
      pedidos.push({ url, metodo, cuerpo });
      return new Response(JSON.stringify({ id: 'v-nuevo', ...cuerpo }), {
        status: metodo === 'POST' ? 201 : 200,
      });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('fondoDeColor y EsferaColor', () => {
  it('sólido: el hex tal cual; combinado: partido en vertical, mitad y mitad', () => {
    expect(fondoDeColor('#111111', null)).toBe('#111111');
    expect(fondoDeColor('#111111', '#d9b98a')).toBe(
      'linear-gradient(90deg, #111111 0 50%, #d9b98a 50% 100%)',
    );
    expect(fondoDeColor(null, '#d9b98a')).toBeUndefined();
  });

  it('la esfera marca si es combinada y dibuja la franja solo deshabilitada', () => {
    const { container, rerender } = render(<EsferaColor hex="#111111" hexSecundario="#d9b98a" />);
    const esfera = container.firstElementChild!;
    expect(esfera).toHaveAttribute('data-combinado');
    expect(esfera.querySelector('.rotate-45')).toBeNull();

    rerender(<EsferaColor hex="#111111" hexSecundario="#d9b98a" deshabilitada />);
    expect(container.querySelector('.rotate-45')).not.toBeNull();

    rerender(<EsferaColor hex="#111111" />);
    expect(container.firstElementChild).not.toHaveAttribute('data-combinado');
  });
});

describe('CamposTono', () => {
  function ConEstado({ inicial = null }: { inicial?: string | null }) {
    const [tonos, setTonos] = useState({ hex: '#3b2620', hexSecundario: inicial });
    return (
      <>
        <CamposTono hex={tonos.hex} hexSecundario={tonos.hexSecundario} onCambiar={setTonos} />
        <output data-testid="secundario">{tonos.hexSecundario ?? 'ninguno'}</output>
      </>
    );
  }

  it('el secundario es opcional: se agrega y se quita', () => {
    render(<ConEstado />);
    expect(screen.getByLabelText('Color primario')).toBeInTheDocument();
    expect(screen.getByTestId('secundario')).toHaveTextContent('ninguno');

    fireEvent.click(screen.getByRole('button', { name: '+ Color secundario (opcional)' }));
    expect(screen.getByLabelText('Color secundario (opcional)')).toBeInTheDocument();
    expect(screen.getByTestId('secundario')).not.toHaveTextContent('ninguno');

    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(screen.getByTestId('secundario')).toHaveTextContent('ninguno');
  });
});

describe('CrearValorEnLinea con color combinado', () => {
  it('manda los dos tonos al crear', async () => {
    const onListo = vi.fn().mockResolvedValue(undefined);
    render(
      <CrearValorEnLinea
        atributo={{ id: 'a-color', nombre: 'Color', slug: 'color' }}
        prefijoSku={null}
        accessToken="token"
        puedeEditar
        onListo={onListo}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo color' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Caramelo rubio' } });
    fireEvent.change(screen.getByLabelText('Código (va en el SKU)'), { target: { value: 'CR' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Color secundario (opcional)' }));
    fireEvent.change(screen.getByLabelText('Color secundario (opcional)'), {
      target: { value: '#d9b98a' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear color' }));

    await waitFor(() => expect(onListo).toHaveBeenCalled());
    expect(pedidos[0]).toMatchObject({
      metodo: 'POST',
      cuerpo: { valor: 'Caramelo rubio', codigo: 'CR', hex: '#3b2620', hexSecundario: '#d9b98a' },
    });
  });
});

describe('EditorValor (Atributos)', () => {
  const caramelo = (variantesQueLoUsan: number): ValorDeAtributo => ({
    id: 'v-caramelo',
    valor: 'Caramelo rubio',
    hex: '#8a5a34',
    hexSecundario: null,
    codigo: 'CR',
    orden: 3,
    activo: true,
    variantesQueLoUsan,
  });

  it('con variantes, el código está bloqueado y explica por qué; los tonos se editan', async () => {
    const onGuardado = vi.fn();
    render(
      <EditorValor
        valor={caramelo(4)}
        conTono
        accessToken="token"
        onCerrar={() => {}}
        onGuardado={onGuardado}
      />,
    );
    expect(screen.getByLabelText('Código (va en el SKU)')).toBeDisabled();
    expect(screen.getByText(/4 variantes lo usan/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Color secundario (opcional)' }));
    fireEvent.change(screen.getByLabelText('Color secundario (opcional)'), {
      target: { value: '#d9b98a' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onGuardado).toHaveBeenCalled());
    expect(pedidos).toEqual([
      {
        url: expect.stringContaining('/api/admin/atributos/valores/v-caramelo'),
        metodo: 'PUT',
        // Sin código: no cambió (y no se puede).
        cuerpo: { hex: '#8a5a34', hexSecundario: '#d9b98a' },
      },
    ]);
  });

  it('sin variantes, el código se puede cambiar', async () => {
    const onGuardado = vi.fn();
    render(
      <EditorValor
        valor={caramelo(0)}
        conTono
        accessToken="token"
        onCerrar={() => {}}
        onGuardado={onGuardado}
      />,
    );
    const campoCodigo = screen.getByLabelText('Código (va en el SKU)');
    expect(campoCodigo).toBeEnabled();
    fireEvent.change(campoCodigo, { target: { value: 'crb' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onGuardado).toHaveBeenCalled());
    expect(pedidos[0]!.cuerpo).toMatchObject({ codigo: 'CRB' });
  });
});
