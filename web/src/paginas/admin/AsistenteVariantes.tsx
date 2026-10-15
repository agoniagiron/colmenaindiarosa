// Asistente de variantes en lote: elegir largos y colores, poner el precio
// por longitud, y revisar la vista previa con el stock de cada combinación.
// El SKU, qué combinaciones ya existen y cuáles chocan los calcula siempre
// el backend (previsualizar y crear recalculan lo mismo): acá solo se arma
// lo que la persona elige y escribe.

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Boton } from '../../componentes/Boton.tsx';
import * as api from '../../contexto/apiProductosAdmin.ts';
import type {
  AtributoConValores,
  CombinacionLote,
  ProductoDetalle,
  ResultadoLote,
  VistaPreviaLote,
} from '../../contexto/apiProductosAdmin.ts';
import { formatearPesos } from '../../utilidades/formatearPesos.ts';

const SLUG_LONGITUD = 'longitud';
const SLUG_COLOR = 'color';

type Paso = 1 | 2 | 3;

// Etiquetas para los campos que puede nombrar un 400 de validación del lote
// (ver describirError en apiProductosAdmin.ts).
const ETIQUETAS_LOTE: Record<string, string> = {
  longitudes: 'Longitudes',
  'longitudes.precio': 'Precio por longitud',
  'longitudes.costo': 'Costo por longitud',
  colores: 'Colores',
  fijos: 'Atributos fijos',
  combinaciones: 'Combinaciones',
  'combinaciones.precio': 'Precio corregido',
  'combinaciones.stock': 'Stock',
};

interface Fila {
  incluida: boolean;
  // Vacío = usa el precio de su longitud. Solo se manda si se corrigió.
  precio: string;
  stock: string;
}

function clave(longitudId: string, colorId: string | null): string {
  return `${longitudId}:${colorId ?? ''}`;
}

function claveDe(combinacion: CombinacionLote): string {
  return clave(combinacion.longitud.id, combinacion.color?.id ?? null);
}

function esEnteroNoNegativo(texto: string): boolean {
  return /^\d+$/.test(texto.trim());
}

function esPrecioValido(texto: string): boolean {
  return /^\d+$/.test(texto.trim()) && Number(texto) > 0;
}

const claseInput =
  'w-full rounded-lg border border-linea bg-white px-2.5 py-1.5 text-sm text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:bg-arena disabled:text-texto-secundario';

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
        activo
          ? 'border-rosa bg-rosa-palo text-tinta'
          : 'border-linea bg-white text-texto-secundario hover:text-tinta'
      }`}
    >
      {children}
    </button>
  );
}

export function AsistenteVariantes({
  producto,
  atributos,
  accessToken,
  onCancelar,
  onCreado,
}: {
  producto: ProductoDetalle;
  atributos: AtributoConValores[];
  accessToken: string;
  onCancelar: () => void;
  onCreado: (resultado: ResultadoLote) => void;
}) {
  const atributoLongitud = atributos.find((a) => a.slug === SLUG_LONGITUD);
  const atributoColor = atributos.find((a) => a.slug === SLUG_COLOR);
  const otrosAtributos = atributos.filter((a) => a.slug !== SLUG_LONGITUD && a.slug !== SLUG_COLOR);

  const [paso, setPaso] = useState<Paso>(1);
  const [longitudes, setLongitudes] = useState<string[]>([]);
  const [colores, setColores] = useState<string[]>([]);
  const [fijos, setFijos] = useState<Record<string, string>>({});
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [costos, setCostos] = useState<Record<string, string>>({});
  const [vista, setVista] = useState<VistaPreviaLote | null>(null);
  const [filas, setFilas] = useState<Record<string, Fila>>({});
  const [stockPorLongitud, setStockPorLongitud] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skusEnConflicto, setSkusEnConflicto] = useState<string[]>([]);

  // Los ids siempre en el orden de los valores del atributo, no en el orden
  // en que se tocaron.
  const longitudesOrdenadas = (atributoLongitud?.valoresAtributo ?? []).filter((v) =>
    longitudes.includes(v.id),
  );
  const coloresOrdenados = (atributoColor?.valoresAtributo ?? []).filter((v) =>
    colores.includes(v.id),
  );

  function alternar(lista: string[], id: string): string[] {
    return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];
  }

  function datosBase(): api.DatosPrevisualizarLote {
    return {
      longitudes: longitudesOrdenadas.map((v) => ({
        valorId: v.id,
        precio: Number(precios[v.id]),
        ...(costos[v.id]?.trim() ? { costo: Number(costos[v.id]) } : {}),
      })),
      colores: coloresOrdenados.map((v) => v.id),
      fijos: Object.values(fijos).filter(Boolean),
    };
  }

  async function verCombinaciones() {
    setCargando(true);
    setError(null);
    setSkusEnConflicto([]);
    try {
      const resultado = await api.previsualizarLoteVariantes(accessToken, producto.id, datosBase());
      setVista(resultado);
      setFilas(
        Object.fromEntries(
          resultado.combinaciones.map((c) => [
            claveDe(c),
            { incluida: !c.yaExiste && !c.skuOcupado, precio: '', stock: '' },
          ]),
        ),
      );
      setStockPorLongitud({});
      setPaso(3);
    } catch (e) {
      setError(api.describirError(e, ETIQUETAS_LOTE, 'No se pudo armar la vista previa'));
    } finally {
      setCargando(false);
    }
  }

  function cambiarFila(claveFila: string, cambios: Partial<Fila>) {
    setFilas((actual) => ({ ...actual, [claveFila]: { ...actual[claveFila]!, ...cambios } }));
  }

  function aplicarStockALongitud(longitudId: string) {
    const valor = stockPorLongitud[longitudId] ?? '';
    if (!esEnteroNoNegativo(valor) || !vista) return;
    setFilas((actual) => {
      const nuevo = { ...actual };
      for (const c of vista.combinaciones) {
        const k = claveDe(c);
        if (c.longitud.id === longitudId && nuevo[k]?.incluida) {
          nuevo[k] = { ...nuevo[k], stock: valor };
        }
      }
      return nuevo;
    });
  }

  const incluidas = vista
    ? vista.combinaciones.filter((c) => !c.yaExiste && filas[claveDe(c)]?.incluida)
    : [];
  const sinStock = incluidas.filter((c) => !esEnteroNoNegativo(filas[claveDe(c)]?.stock ?? ''));
  const conPrecioInvalido = incluidas.filter((c) => {
    const precio = filas[claveDe(c)]?.precio ?? '';
    return precio.trim() !== '' && !esPrecioValido(precio);
  });
  const existentes = vista ? vista.combinaciones.filter((c) => c.yaExiste).length : 0;

  async function crear() {
    if (!vista || incluidas.length === 0 || sinStock.length > 0 || conPrecioInvalido.length > 0) {
      return;
    }
    setCargando(true);
    setError(null);
    setSkusEnConflicto([]);
    try {
      const resultado = await api.crearLoteVariantes(accessToken, producto.id, {
        ...datosBase(),
        combinaciones: incluidas.map((c) => {
          const fila = filas[claveDe(c)]!;
          return {
            longitudId: c.longitud.id,
            colorId: c.color?.id ?? null,
            stock: Number(fila.stock),
            ...(fila.precio.trim() ? { precio: Number(fila.precio) } : {}),
          };
        }),
      });
      onCreado(resultado);
    } catch (e) {
      if (e instanceof api.ErrorProductosAdmin) {
        setError(api.describirError(e, ETIQUETAS_LOTE, 'No se pudieron crear las variantes'));
        const detalles = e.detalles as { skus?: string[] } | undefined;
        setSkusEnConflicto(detalles?.skus ?? []);
      } else {
        setError('No se pudieron crear las variantes');
      }
    } finally {
      setCargando(false);
    }
  }

  // --- Sin lo mínimo para armar SKU ------------------------------------------

  if (!producto.codigoProducto) {
    return (
      <section className="rounded-lg border border-linea bg-arena p-5">
        <p className="text-sm text-tinta">
          Este producto no tiene código de modelo. Cargalo en la pestaña General: de él salen los
          SKU de todas las variantes.
        </p>
        <div className="mt-4">
          <Boton type="button" variante="fantasma" onClick={onCancelar}>
            Volver
          </Boton>
        </div>
      </section>
    );
  }

  if (!atributoLongitud) {
    return (
      <section className="rounded-lg border border-linea bg-arena p-5">
        <p className="text-sm text-tinta">
          La categoría de este producto no usa longitud, y el asistente arma las variantes por
          longitud (el precio se define por largo). Usá &quot;Agregar una variante&quot;.
        </p>
        <div className="mt-4">
          <Boton type="button" variante="fantasma" onClick={onCancelar}>
            Volver
          </Boton>
        </div>
      </section>
    );
  }

  // El orden de la categoría decide si el color va arriba del largo.
  const colorPrimero = !!atributoColor && atributoColor.orden < atributoLongitud.orden;

  // Lo que falta para pasar al paso 2, con el nombre de cada cosa: los
  // obligatorios de la categoría (el backend lo valida igual al crear).
  const faltaEnPaso1 = [
    ...(longitudes.length === 0 ? ['al menos una longitud'] : []),
    ...(atributoColor?.obligatorio && colores.length === 0 ? ['al menos un color'] : []),
    ...otrosAtributos
      .filter((a) => a.obligatorio && !fijos[a.id])
      .map((a) => a.nombre.toLowerCase()),
  ];

  const pasos: { numero: Paso; titulo: string }[] = [
    { numero: 1, titulo: 'Largos y colores' },
    { numero: 2, titulo: 'Precio por longitud' },
    { numero: 3, titulo: 'Vista previa y stock' },
  ];

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-linea bg-arena p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg text-tinta">Generar variantes</h2>
          <p className="text-[13px] text-texto-secundario">
            Código del producto: <span className="font-mono">{producto.codigoProducto}</span>
          </p>
        </div>
        <ol className="flex gap-1.5 text-[12px]">
          {pasos.map((p) => (
            <li
              key={p.numero}
              aria-current={p.numero === paso ? 'step' : undefined}
              className={`rounded-full px-3 py-1 ${
                p.numero === paso ? 'bg-negro text-hueso' : 'bg-hueso text-texto-secundario'
              }`}
            >
              {p.numero}. {p.titulo}
            </li>
          ))}
        </ol>
      </div>

      {paso === 1 ? (
        <div className="flex flex-col gap-5">
          {/* Longitud y color en el orden que configura la categoría (en
              extensiones, primero el color). */}
          <div className={`flex gap-5 ${colorPrimero ? 'flex-col-reverse' : 'flex-col'}`}>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-tinta">
                Longitudes que maneja este modelo
              </legend>
              <div className="flex flex-wrap gap-2">
                {atributoLongitud.valoresAtributo.map((v) => (
                  <Chip
                    key={v.id}
                    activo={longitudes.includes(v.id)}
                    onClick={() => setLongitudes((l) => alternar(l, v.id))}
                  >
                    {v.valor}
                  </Chip>
                ))}
              </div>
            </fieldset>

            {atributoColor ? (
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-tinta">
                  Colores{' '}
                  <span className="font-normal text-texto-secundario">
                    {atributoColor.obligatorio
                      ? '(elegí al menos uno)'
                      : '(si no elegís ninguno, una variante por longitud)'}
                  </span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {atributoColor.valoresAtributo.map((v) => (
                    <Chip
                      key={v.id}
                      activo={colores.includes(v.id)}
                      onClick={() => setColores((c) => alternar(c, v.id))}
                    >
                      {v.hex ? (
                        <span
                          aria-hidden="true"
                          className="h-3.5 w-3.5 rounded-full border border-linea"
                          style={{ backgroundColor: v.hex }}
                        />
                      ) : null}
                      {v.valor}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </div>

          {otrosAtributos.length > 0 ? (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-tinta">
                Atributos fijos{' '}
                <span className="font-normal text-texto-secundario">
                  (iguales para todas las variantes)
                </span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {otrosAtributos.map((atrib) => (
                  <label key={atrib.id} className="flex flex-col gap-1 text-sm text-tinta">
                    {atrib.nombre}
                    <select
                      value={fijos[atrib.id] ?? ''}
                      onChange={(e) => setFijos({ ...fijos, [atrib.id]: e.target.value })}
                      required={atrib.obligatorio}
                      aria-invalid={(atrib.obligatorio && !fijos[atrib.id]) || undefined}
                      className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
                    >
                      <option value="">{atrib.obligatorio ? 'Elegir…' : 'Sin valor'}</option>
                      {atrib.valoresAtributo.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.valor}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <p className="text-[13px] text-texto-secundario">
            {longitudes.length} {longitudes.length === 1 ? 'longitud' : 'longitudes'}
            {colores.length > 0
              ? ` × ${colores.length} ${colores.length === 1 ? 'color' : 'colores'}`
              : ', sin color'}{' '}
            = {longitudes.length * Math.max(colores.length, 1)}{' '}
            {longitudes.length * Math.max(colores.length, 1) === 1
              ? 'combinación'
              : 'combinaciones'}
          </p>

          {faltaEnPaso1.length > 0 ? (
            <p className="text-[13px] text-texto-secundario">
              Para seguir falta elegir: {faltaEnPaso1.join(', ')}.
            </p>
          ) : null}

          <div className="flex justify-between gap-2">
            <Boton type="button" variante="fantasma" onClick={onCancelar}>
              Cancelar
            </Boton>
            <Boton type="button" disabled={faltaEnPaso1.length > 0} onClick={() => setPaso(2)}>
              Siguiente
            </Boton>
          </div>
        </div>
      ) : null}

      {paso === 2 ? (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-texto-secundario">
            El precio de cada longitud se aplica a todos sus colores. Después, en la vista previa,
            podés corregir una combinación suelta.
          </p>
          <table className="w-full max-w-lg text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-texto-secundario uppercase">
                <th className="py-2 pr-3">Longitud</th>
                <th className="py-2 pr-3">Precio</th>
                <th className="py-2">Costo (opcional)</th>
              </tr>
            </thead>
            <tbody>
              {longitudesOrdenadas.map((v) => (
                <tr key={v.id} className="border-t border-linea">
                  <td className="py-2 pr-3 text-tinta">{v.valor}</td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      aria-label={`Precio de la longitud ${v.valor}`}
                      value={precios[v.id] ?? ''}
                      onChange={(e) => setPrecios({ ...precios, [v.id]: e.target.value })}
                      className={claseInput}
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      aria-label={`Costo de la longitud ${v.valor}`}
                      value={costos[v.id] ?? ''}
                      onChange={(e) => setCostos({ ...costos, [v.id]: e.target.value })}
                      className={claseInput}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {error ? <p className="text-sm text-rosa">{error}</p> : null}
          <div className="flex justify-between gap-2">
            <Boton type="button" variante="fantasma" onClick={() => setPaso(1)}>
              Atrás
            </Boton>
            <Boton
              type="button"
              cargando={cargando}
              disabled={
                cargando ||
                longitudesOrdenadas.some(
                  (v) =>
                    !esPrecioValido(precios[v.id] ?? '') ||
                    ((costos[v.id] ?? '').trim() !== '' && !esEnteroNoNegativo(costos[v.id] ?? '')),
                )
              }
              onClick={() => void verCombinaciones()}
            >
              Ver combinaciones
            </Boton>
          </div>
        </div>
      ) : null}

      {paso === 3 && vista ? (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-texto-secundario">
            Desmarcá las combinaciones que no existen. El stock es obligatorio en cada una: es la
            carga inicial. Si dejás el precio vacío, usa el de su longitud.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-wide text-texto-secundario uppercase">
                  <th className="py-2 pr-3">Crear</th>
                  <th className="py-2 pr-3">Color</th>
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Precio</th>
                  <th className="py-2">Stock</th>
                </tr>
              </thead>
              {longitudesOrdenadas.map((longitud) => {
                const delGrupo = vista.combinaciones.filter((c) => c.longitud.id === longitud.id);
                const precioLongitud = delGrupo[0]?.precio ?? 0;
                return (
                  <tbody key={longitud.id} className="border-t-2 border-linea">
                    <tr className="bg-hueso">
                      <td colSpan={5} className="px-2 py-2">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <span className="font-medium text-tinta">Longitud {longitud.valor}</span>
                          <span className="text-texto-secundario">
                            {formatearPesos(precioLongitud)}
                          </span>
                          <span className="ml-auto flex items-center gap-2 text-[13px] text-texto-secundario">
                            Stock para toda la longitud
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              aria-label={`Stock para toda la longitud ${longitud.valor}`}
                              value={stockPorLongitud[longitud.id] ?? ''}
                              onChange={(e) =>
                                setStockPorLongitud({
                                  ...stockPorLongitud,
                                  [longitud.id]: e.target.value,
                                })
                              }
                              className={`${claseInput} w-20`}
                            />
                            <Boton
                              type="button"
                              variante="fantasma"
                              disabled={!esEnteroNoNegativo(stockPorLongitud[longitud.id] ?? '')}
                              onClick={() => aplicarStockALongitud(longitud.id)}
                            >
                              Aplicar
                            </Boton>
                          </span>
                        </div>
                      </td>
                    </tr>
                    {delGrupo.map((c) => {
                      const k = claveDe(c);
                      const fila = filas[k]!;
                      const bloqueada = c.yaExiste || c.skuOcupado;
                      const enConflicto = skusEnConflicto.includes(c.sku);
                      const faltaStock =
                        fila.incluida && !bloqueada && !esEnteroNoNegativo(fila.stock);
                      const nombre = `${longitud.valor}${c.color ? ` ${c.color.valor}` : ''}`;
                      return (
                        <tr
                          key={k}
                          className={`border-t border-linea ${
                            !fila.incluida || bloqueada ? 'text-texto-secundario' : 'text-tinta'
                          }`}
                        >
                          <td className="py-1.5 pr-3">
                            <input
                              type="checkbox"
                              aria-label={`Crear ${nombre}`}
                              checked={fila.incluida && !bloqueada}
                              disabled={bloqueada}
                              onChange={(e) => cambiarFila(k, { incluida: e.target.checked })}
                              className="h-4 w-4 accent-rosa"
                            />
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className="flex items-center gap-2">
                              {c.color?.hex ? (
                                <span
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 rounded-full border border-linea"
                                  style={{ backgroundColor: c.color.hex }}
                                />
                              ) : null}
                              {c.color?.valor ?? '—'}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3">
                            <span
                              className={`font-mono text-[12.5px] ${enConflicto ? 'text-rosa' : ''}`}
                            >
                              {c.sku}
                            </span>
                            {c.yaExiste ? (
                              <span className="block text-[12px]">Ya existe: se salta</span>
                            ) : null}
                            {c.skuOcupado ? (
                              <span className="block text-[12px] text-rosa">
                                Ese SKU ya lo usa otra variante
                              </span>
                            ) : null}
                          </td>
                          <td className="py-1.5 pr-3">
                            <input
                              type="number"
                              min={1}
                              inputMode="numeric"
                              aria-label={`Precio de ${nombre}`}
                              placeholder={String(c.precio)}
                              value={fila.precio}
                              disabled={!fila.incluida || bloqueada}
                              onChange={(e) => cambiarFila(k, { precio: e.target.value })}
                              className={`${claseInput} w-32`}
                            />
                          </td>
                          <td className="py-1.5">
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              aria-label={`Stock de ${nombre}`}
                              aria-invalid={faltaStock || undefined}
                              value={fila.stock}
                              disabled={!fila.incluida || bloqueada}
                              onChange={(e) => cambiarFila(k, { stock: e.target.value })}
                              className={`${claseInput} w-24 ${faltaStock ? 'border-rosa' : ''}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>

          <div className="flex flex-col gap-1 text-[13px]">
            <p className="text-tinta">
              Se van a crear {incluidas.length} {incluidas.length === 1 ? 'variante' : 'variantes'}
              {existentes > 0 ? ` (${existentes} ya existían y se saltan)` : ''}.
            </p>
            {sinStock.length > 0 ? (
              <p className="text-rosa">
                Falta el stock en {sinStock.length}{' '}
                {sinStock.length === 1 ? 'combinación marcada' : 'combinaciones marcadas'}. Puede
                ser 0, pero tiene que estar escrito.
              </p>
            ) : null}
            {conPrecioInvalido.length > 0 ? (
              <p className="text-rosa">Hay precios corregidos que no son un número mayor a 0.</p>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-lg bg-rosa-palo px-3.5 py-2.5 text-sm text-tinta">
              <p>{error}</p>
              {skusEnConflicto.length > 0 ? (
                <ul className="mt-1 list-disc pl-5 font-mono text-[12.5px]">
                  {skusEnConflicto.map((sku) => (
                    <li key={sku}>{sku}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-between gap-2">
            <Boton type="button" variante="fantasma" onClick={() => setPaso(2)}>
              Atrás
            </Boton>
            <Boton
              type="button"
              cargando={cargando}
              disabled={
                cargando ||
                incluidas.length === 0 ||
                sinStock.length > 0 ||
                conPrecioInvalido.length > 0
              }
              onClick={() => void crear()}
            >
              Crear {incluidas.length} {incluidas.length === 1 ? 'variante' : 'variantes'}
            </Boton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
