// Crear un color sin salir del flujo de carga: en el modal "Agregar
// variante" y en el paso 1 del asistente. Lo que importa es que, después de
// crearlo, lo ya cargado siga ahí (precio, costo, largo elegido) y el color
// nuevo quede seleccionado. Se ejecuta de verdad: el componente real, con la
// recarga de la lista como la hace la página, y fetch simulado.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtributoConValores, ProductoDetalle } from '../contexto/apiProductosAdmin.ts';
import { ModalNuevaVariante } from '../paginas/admin/AdminProductoDetalle.tsx';
import { AsistenteVariantes } from '../paginas/admin/AsistenteVariantes.tsx';

const LONGITUD: AtributoConValores = {
  id: 'a-largo',
  nombre: 'Longitud',
  slug: 'longitud',
  orden: 1,
  obligatorio: true,
  valoresAtributo: [
    { id: 'v-16', valor: '16"', hex: null, codigo: '16' },
    { id: 'v-24', valor: '24"', hex: null, codigo: '24' },
  ],
};

const colorCon = (...extra: AtributoConValores['valoresAtributo']): AtributoConValores => ({
  id: 'a-color',
  nombre: 'Color',
  slug: 'color',
  orden: 2,
  obligatorio: true,
  valoresAtributo: [{ id: 'v-negro', valor: 'Negro', hex: '#000000', codigo: 'NEG' }, ...extra],
});

const BORGONA = { id: 'v-borgona', valor: 'Borgoña', hex: '#5b1a2a', codigo: 'BOR' };

// Simula la API: el POST crea Borgoña y, desde ahí, la lista de la
// categoría lo incluye. Guarda cada pedido para revisarlo.
let colorCreado = false;
let pedidos: { url: string; metodo: string; cuerpo: unknown }[] = [];
let respuestaPostValor: () => Response = () =>
  new Response(JSON.stringify({ ...BORGONA, orden: 9, activo: true, atributoId: 'a-color' }), {
    status: 201,
  });

beforeEach(() => {
  colorCreado = false;
  pedidos = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const metodo = init.method ?? 'GET';
      pedidos.push({ url, metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : null });
      if (metodo === 'POST' && url.endsWith('/api/admin/atributos')) {
        const respuesta = respuestaPostValor();
        if (respuesta.status === 201) colorCreado = true;
        return respuesta;
      }
      if (metodo === 'PATCH' && url.includes('/api/admin/atributos/valores/')) {
        colorCreado = true;
        return new Response(JSON.stringify({ ...BORGONA, activo: true }), { status: 200 });
      }
      if (metodo === 'POST' && url.includes('/variantes')) {
        return new Response(JSON.stringify({ id: 'var-1' }), { status: 201 });
      }
      throw new Error(`Pedido inesperado: ${metodo} ${url}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  respuestaPostValor = () =>
    new Response(JSON.stringify({ ...BORGONA, orden: 9, activo: true, atributoId: 'a-color' }), {
      status: 201,
    });
});

// Como AdminProductoDetalle: la lista vive en el padre y se recarga sin
// remontar el modal ni el asistente.
function useAtributos() {
  const [atributos, setAtributos] = useState<AtributoConValores[]>([LONGITUD, colorCon()]);
  async function recargar() {
    await Promise.resolve();
    setAtributos([LONGITUD, colorCreado ? colorCon(BORGONA) : colorCon()]);
  }
  return { atributos, recargar };
}

function ModalConPadre({ puedeEditar = true }: { puedeEditar?: boolean }) {
  const { atributos, recargar } = useAtributos();
  return (
    <ModalNuevaVariante
      abierto
      onCerrar={() => {}}
      productoId="p-1"
      codigoProducto="IR-FRO-M01"
      atributos={atributos}
      accessToken="token"
      puedeCrearValores
      puedeEditar={puedeEditar}
      onAtributosCambiados={recargar}
      onCreada={() => {}}
    />
  );
}

function AsistenteConPadre() {
  const { atributos, recargar } = useAtributos();
  return (
    <AsistenteVariantes
      producto={{ id: 'p-1', codigoProducto: 'IR-FRO-M01' } as ProductoDetalle}
      atributos={atributos}
      accessToken="token"
      puedeCrearValores
      puedeEditar
      onAtributosCambiados={recargar}
      onCancelar={() => {}}
      onCreado={() => {}}
    />
  );
}

function escribirColor(nombre: string, codigo: string) {
  fireEvent.click(screen.getByRole('button', { name: '+ Nuevo color' }));
  const grupo = screen.getByRole('group', { name: 'Nuevo color' });
  fireEvent.change(within(grupo).getByLabelText('Nombre'), { target: { value: nombre } });
  fireEvent.change(within(grupo).getByLabelText('Código (va en el SKU)'), {
    target: { value: codigo },
  });
  return grupo;
}

describe('crear un color en el modal "Agregar variante"', () => {
  it('no pierde precio, costo ni largo, y el color nuevo queda elegido', async () => {
    render(<ModalConPadre />);

    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '990000' } });
    fireEvent.change(screen.getByLabelText('Costo'), { target: { value: '350000' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Longitud/ }), {
      target: { value: 'v-24' },
    });

    const grupo = escribirColor('Borgoña', 'bor');
    // Vista previa del SKU con el largo elegido y el código que se escribe.
    expect(within(grupo).getByTestId('vista-previa-sku')).toHaveTextContent('IR-FRO-M01-24-BOR');

    fireEvent.click(within(grupo).getByRole('button', { name: 'Crear color' }));

    const selectColor = screen.getByRole('combobox', { name: /Color/ });
    await waitFor(() => expect(selectColor).toHaveValue('v-borgona'));
    expect(screen.getByLabelText('Precio')).toHaveValue(990000);
    expect(screen.getByLabelText('Costo')).toHaveValue(350000);
    expect(screen.getByRole('combobox', { name: /Longitud/ })).toHaveValue('v-24');
    expect(screen.queryByRole('group', { name: 'Nuevo color' })).not.toBeInTheDocument();

    // Color universal: el POST no manda categorías.
    const post = pedidos.find((p) => p.metodo === 'POST' && p.url.endsWith('/api/admin/atributos'));
    expect(post?.cuerpo).toEqual({
      atributoId: 'a-color',
      valor: 'Borgoña',
      codigo: 'BOR',
      hex: '#3b2620',
    });

    // Y la variante sale con lo que ya estaba cargado más el color nuevo.
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    await waitFor(() =>
      expect(pedidos.some((p) => p.metodo === 'POST' && p.url.includes('/variantes'))).toBe(true),
    );
    const variante = pedidos.find((p) => p.url.includes('/variantes'))!.cuerpo as {
      precio: number;
      valoresAtributo: string[];
    };
    expect(variante.precio).toBe(990000);
    expect(variante.valoresAtributo).toEqual(expect.arrayContaining(['v-24', 'v-borgona']));
  });

  it('Enter crea el color sin enviar la variante', async () => {
    render(<ModalConPadre />);
    const grupo = escribirColor('Borgoña', 'BOR');
    fireEvent.keyDown(within(grupo).getByLabelText('Código (va en el SKU)'), { key: 'Enter' });

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /Color/ })).toHaveValue('v-borgona'),
    );
    expect(pedidos.some((p) => p.url.includes('/variantes'))).toBe(false);
  });

  it('si existe desactivado ofrece reactivarlo, y reactivado queda elegido', async () => {
    respuestaPostValor = () =>
      new Response(
        JSON.stringify({
          error: {
            codigo: 'conflicto',
            mensaje: 'Borgoña ya existe pero está desactivado',
            detalles: { valorId: 'v-borgona', valor: 'Borgoña', activo: false, campo: 'valor' },
          },
        }),
        { status: 409 },
      );
    render(<ModalConPadre />);
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '990000' } });
    const grupo = escribirColor('borgoña', 'BOR');
    fireEvent.click(within(grupo).getByRole('button', { name: 'Crear color' }));

    expect(
      await within(grupo).findByText('Borgoña ya existe pero está desactivado'),
    ).toBeInTheDocument();
    fireEvent.click(within(grupo).getByRole('button', { name: 'Reactivarlo' }));

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /Color/ })).toHaveValue('v-borgona'),
    );
    expect(pedidos.some((p) => p.metodo === 'PATCH')).toBe(true);
    expect(screen.getByLabelText('Precio')).toHaveValue(990000);
  });

  it('sin productos.editar no ofrece reactivar: dice a quién pedírselo', async () => {
    respuestaPostValor = () =>
      new Response(
        JSON.stringify({
          error: {
            codigo: 'conflicto',
            mensaje: 'Borgoña ya existe pero está desactivado',
            detalles: { valorId: 'v-borgona', valor: 'Borgoña', activo: false, campo: 'valor' },
          },
        }),
        { status: 409 },
      );
    render(<ModalConPadre puedeEditar={false} />);
    const grupo = escribirColor('Borgoña', 'BOR');
    fireEvent.click(within(grupo).getByRole('button', { name: 'Crear color' }));

    expect(await within(grupo).findByText(/permiso de edición/)).toBeInTheDocument();
    expect(within(grupo).queryByRole('button', { name: 'Reactivarlo' })).not.toBeInTheDocument();
  });

  it('un código repetido se muestra junto al campo Código', async () => {
    respuestaPostValor = () =>
      new Response(
        JSON.stringify({
          error: {
            codigo: 'conflicto',
            mensaje: 'El código NEG ya lo usa Negro',
            detalles: { valorId: 'v-negro', valor: 'Negro', activo: true, campo: 'codigo' },
          },
        }),
        { status: 409 },
      );
    render(<ModalConPadre />);
    const grupo = escribirColor('Azabache', 'NEG');
    fireEvent.click(within(grupo).getByRole('button', { name: 'Crear color' }));

    const campoCodigo = within(grupo).getByLabelText('Código (va en el SKU)');
    await waitFor(() => expect(campoCodigo).toHaveAttribute('aria-invalid', 'true'));
    expect(campoCodigo).toHaveAccessibleDescription('El código NEG ya lo usa Negro');
  });
});

describe('crear un color en el paso 1 del asistente', () => {
  it('no pierde los largos elegidos y el color nuevo queda marcado', async () => {
    render(<AsistenteConPadre />);

    fireEvent.click(screen.getByRole('button', { name: '16"' }));
    fireEvent.click(screen.getByRole('button', { name: '24"' }));
    fireEvent.click(screen.getByRole('button', { name: 'Negro' }));

    const grupo = escribirColor('Borgoña', 'BOR');
    expect(within(grupo).getByTestId('vista-previa-sku')).toHaveTextContent(
      'IR-FRO-M01-{largo}-BOR',
    );
    fireEvent.click(within(grupo).getByRole('button', { name: 'Crear color' }));

    const borgona = await screen.findByRole('button', { name: 'Borgoña' });
    expect(borgona).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Negro' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '16"' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '24"' })).toHaveAttribute('aria-pressed', 'true');
  });
});
