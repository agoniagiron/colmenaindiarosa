// Crear un valor de atributo (por ejemplo un color) sin salir del flujo de
// carga de variantes: en el modal "Agregar variante" y en el paso 1 del
// asistente. Usa el mismo POST que la pantalla de atributos; para color el
// servidor lo habilita en todas las categorías que lo usan.
//
// Va con <div> y no con <form>: vive adentro del formulario del modal, y
// los formularios no se anidan. Enter crea; Escape cierra solo esto, no el
// modal, para no perder lo que ya estaba cargado.

import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Boton } from '../../componentes/Boton.tsx';
import * as api from '../../contexto/apiProductosAdmin.ts';
import type { AtributoConValores, ValorExistente } from '../../contexto/apiProductosAdmin.ts';

// Atributos que van en el SKU: sus valores necesitan código.
const SLUGS_CON_CODIGO = ['longitud', 'color'];

type CampoConError = 'valor' | 'codigo' | 'general';

export function CrearValorEnLinea({
  atributo,
  prefijoSku,
  accessToken,
  puedeEditar,
  onListo,
}: {
  atributo: Pick<AtributoConValores, 'id' | 'nombre' | 'slug'>;
  // Lo que va antes del código en el SKU (IR-FRO-M01-24), para la vista
  // previa. null si el producto todavía no tiene código.
  prefijoSku: string | null;
  accessToken: string;
  // Reactivar pide productos.editar: sin eso no se ofrece el botón.
  puedeEditar: boolean;
  // Valor creado, reactivado o elegido: quien lo monta recarga la lista y lo
  // deja seleccionado.
  onListo: (valorId: string) => Promise<void>;
}) {
  const idBase = useId();
  const nombreAtributo = atributo.nombre.toLowerCase();
  const pideCodigo = SLUGS_CON_CODIGO.includes(atributo.slug);
  const conTono = atributo.slug === 'color';

  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState('');
  const [codigo, setCodigo] = useState('');
  const [hex, setHex] = useState('#3b2620');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ campo: CampoConError; mensaje: string } | null>(null);
  const [existente, setExistente] = useState<ValorExistente | null>(null);

  function cerrar() {
    setAbierto(false);
    setValor('');
    setCodigo('');
    setError(null);
    setExistente(null);
  }

  async function terminar(valorId: string) {
    await onListo(valorId);
    cerrar();
  }

  async function crear() {
    if (!valor.trim() || (pideCodigo && !codigo.trim()) || enviando) return;
    setEnviando(true);
    setError(null);
    setExistente(null);
    try {
      const creado = await api.crearValorAtributo(accessToken, {
        atributoId: atributo.id,
        valor: valor.trim(),
        ...(codigo.trim() ? { codigo: codigo.trim() } : {}),
        ...(conTono ? { hex } : {}),
      });
      await terminar(creado.id);
    } catch (e) {
      const choque = api.valorExistenteDe(e);
      if (choque) {
        setExistente(choque);
        setError({
          campo: choque.campo,
          mensaje: e instanceof Error ? e.message : 'Ya existe',
        });
      } else {
        const mensaje = api.describirError(e, {}, `No se pudo crear el ${nombreAtributo}`);
        setError({ campo: /código/i.test(mensaje) ? 'codigo' : 'general', mensaje });
      }
    } finally {
      setEnviando(false);
    }
  }

  async function reactivar(choque: ValorExistente) {
    setEnviando(true);
    try {
      await api.cambiarActivoValor(accessToken, choque.valorId, true);
      await terminar(choque.valorId);
    } catch (e) {
      setError({
        campo: 'general',
        mensaje: e instanceof Error ? e.message : `No se pudo reactivar ${choque.valor}`,
      });
    } finally {
      setEnviando(false);
    }
  }

  function alPresionarTecla(evento: KeyboardEvent) {
    if (evento.key === 'Enter') {
      // Sin esto, Enter enviaría el formulario de la variante.
      evento.preventDefault();
      void crear();
    } else if (evento.key === 'Escape') {
      // Cierra esto y no el modal: lo cargado en la variante sigue ahí.
      evento.stopPropagation();
      cerrar();
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="self-start text-[13px] text-rosa underline-offset-2 hover:underline"
      >
        + Nuevo {nombreAtributo}
      </button>
    );
  }

  const errorDe = (campo: CampoConError) =>
    error?.campo === campo ? (
      <span id={`${idBase}-${campo}`} className="text-[12px] text-rosa">
        {error.mensaje}
      </span>
    ) : null;

  // Acción sobre el que ya existe: elegirlo si está activo; reactivarlo si
  // está desactivado y hay permiso; si no, a quién pedírselo.
  const accionExistente = existente ? (
    existente.activo ? (
      existente.campo === 'valor' ? (
        <Boton
          type="button"
          variante="fantasma"
          disabled={enviando}
          onClick={() => void terminar(existente.valorId)}
        >
          Elegir {existente.valor}
        </Boton>
      ) : null
    ) : puedeEditar ? (
      <Boton
        type="button"
        variante="fantasma"
        cargando={enviando}
        onClick={() => void reactivar(existente)}
      >
        Reactivarlo
      </Boton>
    ) : (
      <p className="text-[12px] text-texto-secundario">
        Pedile a alguien con permiso de edición que lo reactive en Atributos.
      </p>
    )
  ) : null;

  return (
    <div
      role="group"
      aria-label={`Nuevo ${nombreAtributo}`}
      onKeyDown={alPresionarTecla}
      className="flex flex-col gap-3 rounded-lg border border-linea bg-hueso p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-tinta">
          Nombre
          <input
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={conTono ? 'Borgoña' : ''}
            aria-invalid={error?.campo === 'valor' || undefined}
            aria-describedby={error?.campo === 'valor' ? `${idBase}-valor` : undefined}
            className="rounded-lg border border-linea bg-white px-3 py-2 text-sm"
          />
          {errorDe('valor')}
        </label>
        <label className="flex flex-col gap-1 text-sm text-tinta">
          {pideCodigo ? 'Código (va en el SKU)' : 'Código (opcional)'}
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder={conTono ? 'BOR' : ''}
            maxLength={10}
            aria-invalid={error?.campo === 'codigo' || undefined}
            aria-describedby={error?.campo === 'codigo' ? `${idBase}-codigo` : undefined}
            className="rounded-lg border border-linea bg-white px-3 py-2 font-mono text-sm"
          />
          {errorDe('codigo')}
        </label>
      </div>

      {conTono ? (
        <label className="flex items-center gap-3 text-sm text-tinta">
          Tono
          <input
            type="color"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-linea"
          />
          <span className="font-mono text-[12px] text-texto-secundario">{hex}</span>
        </label>
      ) : null}

      {pideCodigo && prefijoSku ? (
        <p className="text-[12px] text-texto-secundario">
          SKU:{' '}
          <span className="font-mono text-tinta" data-testid="vista-previa-sku">
            {prefijoSku}-{codigo.trim() || '…'}
          </span>
        </p>
      ) : null}

      {errorDe('general')}
      {accionExistente}

      <div className="flex justify-end gap-2">
        <Boton type="button" variante="fantasma" onClick={cerrar}>
          Cancelar
        </Boton>
        <Boton
          type="button"
          cargando={enviando}
          disabled={!valor.trim() || (pideCodigo && !codigo.trim())}
          onClick={() => void crear()}
        >
          Crear {nombreAtributo}
        </Boton>
      </div>
    </div>
  );
}
