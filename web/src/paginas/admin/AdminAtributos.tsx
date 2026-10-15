// Pantalla de atributos: qué atributos usa cada categoría (en qué orden y si
// son obligatorios) y qué valores permite de cada uno. También crea valores
// nuevos habilitándolos en las categorías en el MISMO formulario: un valor
// creado sin categoría no aparecería en ningún lado.
//
// Color es universal: la lista es la misma en todas las categorías que lo
// usan, así que acá no se eligen colores por categoría (el servidor mantiene
// esas filas completas). Un color se esconde desactivándolo, en la sección
// de colores, y se reactiva desde ahí mismo.
//
// Cambiar esto no toca variantes existentes: solo limita lo que se ofrece al
// crear variantes nuevas. El orden de cada categoría es también el orden del
// selector de la ficha de la tienda.

import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Boton } from '../../componentes/Boton.tsx';
import { CampoTexto } from '../../componentes/CampoTexto.tsx';
import { EsqueletoCarga } from '../../componentes/EsqueletoCarga.tsx';
import * as api from '../../contexto/apiProductosAdmin.ts';
import type {
  AtributoConfigurable,
  AtributoEnCategoria,
  ConfiguracionAtributos,
} from '../../contexto/apiProductosAdmin.ts';
import { useSesionAdmin } from '../../contexto/ContextoSesionAdmin.tsx';

// Atributos que van en el SKU: sus valores necesitan código.
const SLUGS_CON_CODIGO = ['longitud', 'color'];

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-linea bg-arena p-5">
      <h2 className="mb-3 font-serif text-lg text-tinta">{titulo}</h2>
      {children}
    </section>
  );
}

// Los valores de un atributo universal no se eligen en el editor: se
// comparan y se mandan vacíos (el servidor los ignora y completa los suyos).
function normalizar(
  elegidos: AtributoEnCategoria[],
  atributos: AtributoConfigurable[],
): AtributoEnCategoria[] {
  const universales = new Set(atributos.filter((a) => a.universal).map((a) => a.id));
  return elegidos.map((e) => (universales.has(e.atributoId) ? { ...e, valorIds: [] } : e));
}

function iguales(a: AtributoEnCategoria[], b: AtributoEnCategoria[]): boolean {
  return (
    JSON.stringify(a.map((x) => ({ ...x, valorIds: [...x.valorIds].sort() }))) ===
    JSON.stringify(b.map((x) => ({ ...x, valorIds: [...x.valorIds].sort() })))
  );
}

export function AdminAtributos() {
  const { usuarioAdmin, accessToken } = useSesionAdmin();
  const [config, setConfig] = useState<ConfiguracionAtributos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  // Si el editor de categoría tiene cambios sin guardar, no se puede crear
  // un valor: crear recarga la configuración y esos cambios se perderían.
  const [cambiosPendientes, setCambiosPendientes] = useState(false);

  function recargar() {
    if (!accessToken) return;
    api
      .obtenerConfiguracionAtributos(accessToken)
      .then((r) => {
        setConfig(r);
        setError(null);
        setCategoriaId((actual) => actual ?? r.categorias[0]?.id ?? null);
      })
      .catch((e: unknown) =>
        setError(
          e instanceof api.ErrorProductosAdmin ? e.message : 'No se pudo cargar la configuración',
        ),
      );
  }

  useEffect(recargar, [accessToken]);

  if (!usuarioAdmin || !accessToken) return null;
  if (!usuarioAdmin.permisos.includes('productos.ver')) {
    return <Navigate to="/admin" replace />;
  }
  const puedeEditar = usuarioAdmin.permisos.includes('productos.editar');
  const puedeCrear = usuarioAdmin.permisos.includes('productos.crear');

  if (error) return <p className="text-sm text-rosa">{error}</p>;
  if (!config) {
    return (
      <div className="flex flex-col gap-3">
        <EsqueletoCarga alto="h-8" ancho="w-1/3" />
        <EsqueletoCarga alto="h-64" />
      </div>
    );
  }

  const categoria = config.categorias.find((c) => c.id === categoriaId) ?? null;
  const atributosCategoria = categoria ? normalizar(categoria.atributos, config.atributos) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-[28px] text-tinta">Atributos</h1>
        <p className="text-[13px] text-texto-secundario">
          Qué atributos usa cada categoría, en qué orden y qué valores ofrece. Cambiar esto no
          modifica las variantes que ya existen: solo lo que se puede elegir al crear nuevas.
        </p>
      </div>

      <nav
        aria-label="Categorías"
        className="flex flex-wrap gap-1.5 rounded-full border border-linea bg-arena p-1"
      >
        {config.categorias.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === categoriaId}
            onClick={() => setCategoriaId(c.id)}
            className={`rounded-full px-4 py-1.5 text-[13px] transition-colors ${
              c.id === categoriaId
                ? 'bg-negro text-hueso'
                : 'text-texto-secundario hover:text-tinta'
            }`}
          >
            {c.nombre}
          </button>
        ))}
      </nav>

      {categoria ? (
        <EditorCategoria
          // key: al cambiar de categoría, el borrador arranca de cero. Va sin
          // los valores universales: crear o reactivar un color no borra lo
          // que se está editando.
          key={categoria.id + JSON.stringify(atributosCategoria)}
          categoria={{ ...categoria, atributos: atributosCategoria }}
          atributos={config.atributos}
          accessToken={accessToken}
          puedeEditar={puedeEditar}
          onGuardado={setConfig}
          onCambiosPendientes={setCambiosPendientes}
        />
      ) : null}

      {puedeCrear ? (
        <FormularioNuevoValor
          config={config}
          accessToken={accessToken}
          bloqueado={cambiosPendientes}
          puedeEditar={puedeEditar}
          onCreado={recargar}
        />
      ) : null}

      {config.atributos
        .filter((a) => a.universal)
        .map((a) => (
          <ListaValoresUniversales
            key={a.id}
            atributo={a}
            categorias={config.categorias.filter((c) =>
              c.atributos.some((x) => x.atributoId === a.id),
            )}
            accessToken={accessToken}
            puedeEditar={puedeEditar}
            onCambiado={recargar}
          />
        ))}
    </div>
  );
}

// --- Configuración de una categoría -------------------------------------------

function EditorCategoria({
  categoria,
  atributos,
  accessToken,
  puedeEditar,
  onGuardado,
  onCambiosPendientes,
}: {
  categoria: ConfiguracionAtributos['categorias'][number];
  atributos: AtributoConfigurable[];
  accessToken: string;
  puedeEditar: boolean;
  onGuardado: (config: ConfiguracionAtributos) => void;
  onCambiosPendientes: (hay: boolean) => void;
}) {
  const [borrador, setBorrador] = useState<AtributoEnCategoria[]>(categoria.atributos);
  const [agregarId, setAgregarId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atributoPorId = new Map(atributos.map((a) => [a.id, a]));
  const sinUsar = atributos.filter((a) => !borrador.some((b) => b.atributoId === a.id));
  const hayCambios = !iguales(borrador, categoria.atributos);
  useEffect(() => onCambiosPendientes(hayCambios), [hayCambios, onCambiosPendientes]);

  function cambiar(indice: number, cambios: Partial<AtributoEnCategoria>) {
    setBorrador((actual) => actual.map((a, i) => (i === indice ? { ...a, ...cambios } : a)));
  }

  function mover(indice: number, delta: -1 | 1) {
    setBorrador((actual) => {
      const nuevo = [...actual];
      const destino = indice + delta;
      if (destino < 0 || destino >= nuevo.length) return actual;
      [nuevo[indice], nuevo[destino]] = [nuevo[destino]!, nuevo[indice]!];
      return nuevo;
    });
  }

  function alternarValor(indice: number, valorId: string) {
    const actual = borrador[indice]!;
    cambiar(indice, {
      valorIds: actual.valorIds.includes(valorId)
        ? actual.valorIds.filter((id) => id !== valorId)
        : [...actual.valorIds, valorId],
    });
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      onGuardado(await api.guardarConfiguracionCategoria(accessToken, categoria.id, borrador));
    } catch (e) {
      setError(
        api.describirError(e, { atributos: 'Atributos' }, 'No se pudo guardar la configuración'),
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Seccion titulo={`Atributos de ${categoria.nombre}`}>
      <div className="flex flex-col gap-4">
        {borrador.length === 0 ? (
          <p className="text-sm text-texto-secundario">
            {categoria.nombre} no usa atributos: sus variantes van sin largo, color ni medidas.
          </p>
        ) : null}

        {borrador.map((elegido, indice) => {
          const atributo = atributoPorId.get(elegido.atributoId);
          if (!atributo) return null;
          return (
            <div key={elegido.atributoId} className="rounded-lg border border-linea bg-hueso p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-tinta">
                  {indice + 1}. {atributo.nombre}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Subir ${atributo.nombre}`}
                    disabled={!puedeEditar || indice === 0}
                    onClick={() => mover(indice, -1)}
                    className="rounded-full border border-linea px-2 text-sm disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Bajar ${atributo.nombre}`}
                    disabled={!puedeEditar || indice === borrador.length - 1}
                    onClick={() => mover(indice, 1)}
                    className="rounded-full border border-linea px-2 text-sm disabled:opacity-40"
                  >
                    ↓
                  </button>
                </div>
                <label className="flex items-center gap-1.5 text-[13px] text-tinta">
                  <input
                    type="checkbox"
                    checked={elegido.obligatorio}
                    disabled={!puedeEditar}
                    onChange={(e) => cambiar(indice, { obligatorio: e.target.checked })}
                    className="h-4 w-4 accent-rosa"
                  />
                  Obligatorio
                </label>
                {atributo.universal ? null : (
                  <span className="text-[12px] text-texto-secundario">
                    {elegido.valorIds.length} de {atributo.valores.length} valores
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  {atributo.universal ? null : (
                    <>
                      <Boton
                        type="button"
                        variante="fantasma"
                        disabled={!puedeEditar}
                        onClick={() =>
                          cambiar(indice, { valorIds: atributo.valores.map((v) => v.id) })
                        }
                      >
                        Todos
                      </Boton>
                      <Boton
                        type="button"
                        variante="fantasma"
                        disabled={!puedeEditar}
                        onClick={() => cambiar(indice, { valorIds: [] })}
                      >
                        Ninguno
                      </Boton>
                    </>
                  )}
                  <Boton
                    type="button"
                    variante="fantasma"
                    disabled={!puedeEditar}
                    onClick={() => setBorrador((actual) => actual.filter((_, i) => i !== indice))}
                  >
                    Quitar de {categoria.nombre}
                  </Boton>
                </div>
              </div>
              {atributo.universal ? (
                <p className="mt-3 text-[13px] text-texto-secundario">
                  Usa todos los valores activos ({atributo.valores.filter((v) => v.activo).length}),
                  los mismos en todas las categorías. Se crean y se desactivan más abajo.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {atributo.valores.map((valor) => {
                    const permitido = elegido.valorIds.includes(valor.id);
                    return (
                      <button
                        key={valor.id}
                        type="button"
                        aria-pressed={permitido}
                        disabled={!puedeEditar}
                        onClick={() => alternarValor(indice, valor.id)}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
                          permitido
                            ? 'border-rosa bg-rosa-palo text-tinta'
                            : 'border-linea bg-white text-texto-secundario line-through'
                        }`}
                      >
                        {valor.hex ? (
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 rounded-full border border-linea"
                            style={{ backgroundColor: valor.hex }}
                          />
                        ) : null}
                        {valor.valor}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {puedeEditar && sinUsar.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm text-tinta">
              Agregar atributo
              <select
                value={agregarId}
                onChange={(e) => setAgregarId(e.target.value)}
                className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
              >
                <option value="">Elegir…</option>
                {sinUsar.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </label>
            <Boton
              type="button"
              variante="fantasma"
              disabled={!agregarId}
              onClick={() => {
                const atributo = atributoPorId.get(agregarId);
                if (!atributo) return;
                // Entra al final, con todos sus valores y obligatorio: lo
                // más común. Se ajusta antes de guardar. Uno universal va
                // sin valores: los completa el servidor, todos.
                setBorrador((actual) => [
                  ...actual,
                  {
                    atributoId: atributo.id,
                    obligatorio: true,
                    valorIds: atributo.universal ? [] : atributo.valores.map((v) => v.id),
                  },
                ]);
                setAgregarId('');
              }}
            >
              Agregar
            </Boton>
          </div>
        ) : null}

        {error ? <p className="text-sm text-rosa">{error}</p> : null}

        {puedeEditar ? (
          <div className="flex items-center justify-end gap-2">
            {hayCambios ? (
              <span className="mr-auto text-[13px] text-ambar">Hay cambios sin guardar.</span>
            ) : null}
            <Boton
              type="button"
              variante="fantasma"
              disabled={!hayCambios || guardando}
              onClick={() => setBorrador(categoria.atributos)}
            >
              Descartar
            </Boton>
            <Boton
              type="button"
              cargando={guardando}
              disabled={!hayCambios}
              onClick={() => void guardar()}
            >
              Guardar cambios
            </Boton>
          </div>
        ) : null}
      </div>
    </Seccion>
  );
}

// --- Nuevo valor, habilitado en categorías en el mismo paso ----------------------

function FormularioNuevoValor({
  config,
  accessToken,
  bloqueado,
  puedeEditar,
  onCreado,
}: {
  config: ConfiguracionAtributos;
  accessToken: string;
  bloqueado: boolean;
  puedeEditar: boolean;
  onCreado: () => void;
}) {
  const [atributoId, setAtributoId] = useState('');
  const [valor, setValor] = useState('');
  const [codigo, setCodigo] = useState('');
  const [hex, setHex] = useState('#3b2620');
  const [categoriaIds, setCategoriaIds] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [existente, setExistente] = useState<api.ValorExistente | null>(null);

  const atributo = config.atributos.find((a) => a.id === atributoId);
  const esColor = atributo?.slug === 'color';
  const universal = !!atributo?.universal;
  const pideCodigo = !!atributo && SLUGS_CON_CODIGO.includes(atributo.slug);
  // Solo las categorías que usan este atributo: en las demás no tendría
  // dónde aparecer.
  const categoriasQueLoUsan = config.categorias.filter((c) =>
    c.atributos.some((a) => a.atributoId === atributoId),
  );
  // Crear uno no universal recarga la configuración y cambia lo que el
  // editor de arriba tiene en borrador; uno universal no lo toca.
  const bloqueadoAhora = bloqueado && !universal;

  function elegirAtributo(id: string) {
    setAtributoId(id);
    // Arrancan todas marcadas; se desmarca la que no corresponda.
    setCategoriaIds(
      config.categorias
        .filter((c) => c.atributos.some((a) => a.atributoId === id))
        .map((c) => c.id),
    );
    setAviso(null);
    setError(null);
    setExistente(null);
  }

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    if (!atributo) return;
    setEnviando(true);
    setError(null);
    setAviso(null);
    setExistente(null);
    try {
      const creado = await api.crearValorAtributo(accessToken, {
        atributoId: atributo.id,
        valor: valor.trim(),
        ...(codigo.trim() ? { codigo: codigo.trim() } : {}),
        ...(esColor ? { hex } : {}),
        // Universal: el servidor lo habilita en todas las que lo usan.
        ...(universal ? {} : { categoriaIds }),
      });
      const habilitadas = universal
        ? categoriasQueLoUsan
        : config.categorias.filter((c) => categoriaIds.includes(c.id));
      const nombres = habilitadas.map((c) => c.nombre).join(', ');
      setAviso(
        nombres
          ? `${creado.valor} quedó creado y habilitado en ${nombres}.`
          : `${creado.valor} quedó creado.`,
      );
      setValor('');
      setCodigo('');
      onCreado();
    } catch (e) {
      setExistente(api.valorExistenteDe(e));
      setError(
        api.describirError(
          e,
          {
            valor: 'Nombre',
            codigo: 'Código',
            hex: 'Color',
            categoriaIds: 'Categorías',
          },
          'No se pudo crear el valor',
        ),
      );
    } finally {
      setEnviando(false);
    }
  }

  async function reactivar(choque: api.ValorExistente) {
    setEnviando(true);
    try {
      await api.cambiarActivoValor(accessToken, choque.valorId, true);
      setError(null);
      setExistente(null);
      setAviso(`${choque.valor} está activo otra vez.`);
      setValor('');
      setCodigo('');
      onCreado();
    } catch (e) {
      setError(e instanceof Error ? e.message : `No se pudo reactivar ${choque.valor}`);
    } finally {
      setEnviando(false);
    }
  }

  const nombreAtributo = atributo?.nombre.toLowerCase() ?? '';

  return (
    <Seccion titulo="Nuevo valor">
      <form onSubmit={(e) => void crear(e)} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-tinta">
            Atributo
            <select
              value={atributoId}
              onChange={(e) => elegirAtributo(e.target.value)}
              required
              className="rounded-lg border border-linea bg-hueso px-3 py-2 text-sm"
            >
              <option value="">Elegir…</option>
              {config.atributos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
          <CampoTexto
            etiqueta="Nombre"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={esColor ? 'Borgoña' : ''}
            required
          />
          <CampoTexto
            etiqueta={pideCodigo ? 'Código (va en el SKU)' : 'Código (opcional)'}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder={esColor ? 'BOR' : ''}
            maxLength={10}
            required={pideCodigo}
          />
        </div>

        {esColor ? (
          <label className="flex items-center gap-3 text-sm text-tinta">
            Tono
            <input
              type="color"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded border border-linea"
            />
            <span className="font-mono text-[12px] text-texto-secundario">{hex}</span>
          </label>
        ) : null}

        {atributo && universal ? (
          <p className="text-[13px] text-texto-secundario">
            {categoriasQueLoUsan.length > 0
              ? `Se habilita en todas las categorías que usan ${nombreAtributo}: ${categoriasQueLoUsan
                  .map((c) => c.nombre)
                  .join(', ')}.`
              : `Ninguna categoría usa ${nombreAtributo} todavía: va a aparecer en la primera que lo agregue.`}
          </p>
        ) : null}

        {atributo && !universal ? (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-tinta">
              Habilitar en{' '}
              <span className="font-normal text-texto-secundario">
                (sin esto, el valor no aparece en ningún lado)
              </span>
            </legend>
            {categoriasQueLoUsan.length === 0 ? (
              <p className="text-[13px] text-ambar">
                Ninguna categoría usa {nombreAtributo} todavía. Agregalo primero a una categoría
                arriba.
              </p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {categoriasQueLoUsan.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-tinta">
                    <input
                      type="checkbox"
                      checked={categoriaIds.includes(c.id)}
                      onChange={(e) =>
                        setCategoriaIds((actual) =>
                          e.target.checked ? [...actual, c.id] : actual.filter((id) => id !== c.id),
                        )
                      }
                      className="h-4 w-4 accent-rosa"
                    />
                    {c.nombre}
                  </label>
                ))}
              </div>
            )}
            {categoriasQueLoUsan.length > 0 && categoriaIds.length === 0 ? (
              <p className="mt-2 text-[13px] text-ambar">
                Elegí al menos una categoría: si no, el valor no va a aparecer en ningún lado.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {error ? <p className="text-sm text-rosa">{error}</p> : null}
        {existente && !existente.activo ? (
          puedeEditar ? (
            <div>
              <Boton
                type="button"
                variante="fantasma"
                cargando={enviando}
                onClick={() => void reactivar(existente)}
              >
                Reactivar {existente.valor}
              </Boton>
            </div>
          ) : (
            <p className="text-[13px] text-texto-secundario">
              Pedile a alguien con permiso de edición que lo reactive en Atributos.
            </p>
          )
        ) : null}
        {aviso ? (
          <p role="status" className="text-sm text-verde">
            {aviso}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          {bloqueadoAhora ? (
            <span className="mr-auto text-[13px] text-ambar">
              Guardá o descartá los cambios de arriba antes de crear un valor.
            </span>
          ) : null}
          <Boton
            type="submit"
            cargando={enviando}
            disabled={
              bloqueadoAhora ||
              !atributo ||
              !valor.trim() ||
              (!universal && categoriaIds.length === 0)
            }
          >
            {universal ? 'Crear' : 'Crear y habilitar'}
          </Boton>
        </div>
      </form>
    </Seccion>
  );
}

// --- Valores de un atributo universal (colores) ---------------------------------
// Todos los creados, activos y desactivados. Desactivar esconde el valor de
// lo que se ofrece al crear variantes nuevas; las variantes que ya lo usan
// siguen visibles y vendibles. Pide productos.editar.

function ListaValoresUniversales({
  atributo,
  categorias,
  accessToken,
  puedeEditar,
  onCambiado,
}: {
  atributo: AtributoConfigurable;
  categorias: ConfiguracionAtributos['categorias'];
  accessToken: string;
  puedeEditar: boolean;
  onCambiado: () => void;
}) {
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function alternar(valorId: string, activo: boolean) {
    setCambiandoId(valorId);
    setError(null);
    try {
      await api.cambiarActivoValor(accessToken, valorId, activo);
      onCambiado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    } finally {
      setCambiandoId(null);
    }
  }

  const activos = atributo.valores.filter((v) => v.activo).length;
  const dondeSeUsa =
    categorias.length > 0
      ? categorias.map((c) => c.nombre).join(', ')
      : 'todas las categorías que lo usen';

  return (
    <Seccion titulo={`Valores de ${atributo.nombre.toLowerCase()}`}>
      <p className="mb-3 text-[13px] text-texto-secundario">
        {activos} activos de {atributo.valores.length}. Son los mismos en {dondeSeUsa}. Un valor
        desactivado no se ofrece al crear variantes nuevas; las que ya lo usan no cambian.
      </p>
      <ul className="flex flex-col divide-y divide-linea">
        {atributo.valores.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3 py-2">
            {v.hex ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 rounded-full border border-linea"
                style={{ backgroundColor: v.hex }}
              />
            ) : null}
            <span className={v.activo ? 'text-tinta' : 'text-texto-secundario line-through'}>
              {v.valor}
            </span>
            {v.codigo ? (
              <span className="font-mono text-[12px] text-texto-secundario">{v.codigo}</span>
            ) : null}
            {v.activo ? null : (
              <span className="rounded-full bg-arena px-2 py-0.5 text-[12px] text-texto-secundario">
                Desactivado
              </span>
            )}
            {puedeEditar ? (
              <div className="ml-auto">
                <Boton
                  type="button"
                  variante="fantasma"
                  cargando={cambiandoId === v.id}
                  disabled={cambiandoId !== null}
                  aria-label={`${v.activo ? 'Desactivar' : 'Reactivar'} ${v.valor}`}
                  onClick={() => void alternar(v.id, !v.activo)}
                >
                  {v.activo ? 'Desactivar' : 'Reactivar'}
                </Boton>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? <p className="mt-2 text-sm text-rosa">{error}</p> : null}
    </Seccion>
  );
}
