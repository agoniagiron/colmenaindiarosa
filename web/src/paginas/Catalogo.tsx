import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boton } from '../componentes/Boton.tsx';
import { Contenedor } from '../componentes/Contenedor.tsx';
import { EsqueletoCarga } from '../componentes/EsqueletoCarga.tsx';
import { EstadoVacio } from '../componentes/EstadoVacio.tsx';
import { TarjetaProducto } from '../componentes/TarjetaProducto.tsx';
import { repositorio } from '../datos/index.ts';
import type {
  Facetas,
  FiltrosProducto,
  OrdenProducto,
  Paginacion,
  ResultadoPaginado,
} from '../datos/index.ts';
import type { Categoria, Producto, ValorAtributo } from '../tipos/index.ts';

const PRODUCTOS_POR_PAGINA = 8;

// --- Contrato URL <-> filtros ---------------------------------------------

type ClaveFiltroLista = 'categoriaSlug' | 'tipoBase' | 'longitud' | 'talla' | 'color';

interface CampoFiltro {
  clave: ClaveFiltroLista;
  parametro: string;
  etiqueta: string;
}

const CAMPOS_FILTRO: CampoFiltro[] = [
  { clave: 'categoriaSlug', parametro: 'categoria', etiqueta: 'Categoría' },
  { clave: 'tipoBase', parametro: 'tipoBase', etiqueta: 'Tipo de base' },
  { clave: 'longitud', parametro: 'longitud', etiqueta: 'Longitud' },
  { clave: 'talla', parametro: 'talla', etiqueta: 'Talla' },
  { clave: 'color', parametro: 'color', etiqueta: 'Color' },
];

const ORDENES: { valor: OrdenProducto; etiqueta: string }[] = [
  { valor: 'relevancia', etiqueta: 'Relevancia' },
  { valor: 'precio_asc', etiqueta: 'Precio: menor a mayor' },
  { valor: 'precio_desc', etiqueta: 'Precio: mayor a menor' },
  { valor: 'calificacion_desc', etiqueta: 'Mejor calificados' },
];

function esOrdenValido(valor: string | null): valor is OrdenProducto {
  return ORDENES.some((opcion) => opcion.valor === valor);
}

function leerLista(searchParams: URLSearchParams, clave: string): string[] {
  const valor = searchParams.get(clave);
  return valor ? valor.split(',').filter(Boolean) : [];
}

interface EstadoCatalogo {
  filtros: FiltrosProducto;
  orden: OrdenProducto;
  pagina: number;
}

function analizarParametros(searchParams: URLSearchParams): EstadoCatalogo {
  const filtros: FiltrosProducto = {};
  for (const campo of CAMPOS_FILTRO) {
    const valores = leerLista(searchParams, campo.parametro);
    if (valores.length > 0) filtros[campo.clave] = valores;
  }

  const ordenParametro = searchParams.get('orden');
  const orden: OrdenProducto = esOrdenValido(ordenParametro) ? ordenParametro : 'relevancia';

  const paginaCruda = Number(searchParams.get('pagina'));
  const pagina = Number.isInteger(paginaCruda) && paginaCruda > 0 ? paginaCruda : 1;

  return { filtros, orden, pagina };
}

function construirParametros(
  filtros: FiltrosProducto,
  orden: OrdenProducto,
  pagina: number,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const campo of CAMPOS_FILTRO) {
    const valores = filtros[campo.clave];
    if (valores && valores.length > 0) params.set(campo.parametro, valores.join(','));
  }
  if (orden !== 'relevancia') params.set('orden', orden);
  if (pagina > 1) params.set('pagina', String(pagina));
  return params;
}

// --- Opciones de filtro (facetas) ------------------------------------------

interface OpcionesFiltro extends Facetas {
  categorias: Categoria[];
}

// --- Página -----------------------------------------------------------------

export function Catalogo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filtros, orden } = analizarParametros(searchParams);

  const [resultado, setResultado] = useState<ResultadoPaginado<Producto> | null>(null);
  const [cargandoResultado, setCargandoResultado] = useState(true);

  const [opciones, setOpciones] = useState<OpcionesFiltro | null>(null);
  const [cargandoOpciones, setCargandoOpciones] = useState(true);

  const [panelMovilAbierto, setPanelMovilAbierto] = useState(false);

  useEffect(() => {
    let vigente = true;

    Promise.all([repositorio.listarCategorias(), repositorio.listarFacetas({})])
      .then(([categorias, facetas]) => {
        if (vigente) setOpciones({ categorias, ...facetas });
      })
      .finally(() => {
        if (vigente) setCargandoOpciones(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    const parametros = analizarParametros(searchParams);

    setCargandoResultado(true);
    repositorio
      .listarProductos(parametros.filtros, parametros.orden, {
        pagina: parametros.pagina,
        porPagina: PRODUCTOS_POR_PAGINA,
      })
      .then((datosResultado) => {
        if (vigente) setResultado(datosResultado);
      })
      .finally(() => {
        if (vigente) setCargandoResultado(false);
      });

    return () => {
      vigente = false;
    };
  }, [searchParams]);

  function commitFiltros(nuevosFiltros: FiltrosProducto, nuevoOrden: OrdenProducto = orden) {
    setSearchParams(construirParametros(nuevosFiltros, nuevoOrden, 1), { replace: true });
  }

  function alternarFiltro(clave: ClaveFiltroLista, valor: string) {
    const actuales = filtros[clave] ?? [];
    const nuevos = actuales.includes(valor)
      ? actuales.filter((item) => item !== valor)
      : [...actuales, valor];
    commitFiltros({ ...filtros, [clave]: nuevos });
  }

  function cambiarOrden(nuevoOrden: OrdenProducto) {
    commitFiltros(filtros, nuevoOrden);
  }

  function irAPagina(nuevaPagina: number) {
    setSearchParams(construirParametros(filtros, orden, nuevaPagina), { replace: true });
  }

  function limpiarFiltros() {
    const params = new URLSearchParams();
    if (orden !== 'relevancia') params.set('orden', orden);
    setSearchParams(params, { replace: true });
  }

  const totalFiltrosActivos = CAMPOS_FILTRO.reduce(
    (acumulado, campo) => acumulado + (filtros[campo.clave]?.length ?? 0),
    0,
  );

  return (
    <Contenedor className="py-10">
      <h1 className="font-serif text-2xl text-tinta">Catálogo</h1>

      <div className="mt-6 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
        <aside className="hidden lg:block">
          {cargandoOpciones || !opciones ? (
            <EsqueletosFiltros />
          ) : (
            <GruposFiltro filtros={filtros} opciones={opciones} onAlternar={alternarFiltro} />
          )}
        </aside>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPanelMovilAbierto(true)}
                className="rounded-full border border-linea px-4 py-2 text-sm font-medium text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa lg:hidden"
              >
                Filtros{totalFiltrosActivos > 0 ? ` (${totalFiltrosActivos})` : ''}
              </button>
              <p className="text-sm text-texto-secundario">
                {cargandoResultado || !resultado
                  ? 'Buscando…'
                  : `${resultado.paginacion.total} ${resultado.paginacion.total === 1 ? 'resultado' : 'resultados'}`}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-tinta">
              Ordenar por
              <select
                value={orden}
                onChange={(evento) => cambiarOrden(evento.target.value as OrdenProducto)}
                className="rounded-xl border border-linea bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
              >
                {ORDENES.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {totalFiltrosActivos > 0 && opciones ? (
            <ChipsFiltro
              filtros={filtros}
              opciones={opciones}
              onQuitar={alternarFiltro}
              onLimpiarTodo={limpiarFiltros}
            />
          ) : null}

          <div className="mt-6">
            {cargandoResultado || !resultado ? (
              <GrillaEsqueleto />
            ) : resultado.datos.length === 0 ? (
              <EstadoVacio
                titulo="No encontramos productos con estos filtros"
                descripcion="Prueba quitando alguno de los filtros activos."
                accion={
                  <Boton type="button" variante="rosa" onClick={limpiarFiltros}>
                    Limpiar filtros
                  </Boton>
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
                  {resultado.datos.map((producto) => (
                    <TarjetaProducto key={producto.id} producto={producto} />
                  ))}
                </div>
                <ControlPaginacion paginacion={resultado.paginacion} onIrAPagina={irAPagina} />
              </>
            )}
          </div>
        </div>
      </div>

      {opciones ? (
        <PanelFiltrosMovil
          abierto={panelMovilAbierto}
          alCerrar={() => setPanelMovilAbierto(false)}
          filtrosIniciales={filtros}
          opciones={opciones}
          onAplicar={commitFiltros}
        />
      ) : null}
    </Contenedor>
  );
}

// --- Grupos de filtro (casillas y círculos de color) -----------------------

function GruposFiltro({
  filtros,
  opciones,
  onAlternar,
}: {
  filtros: FiltrosProducto;
  opciones: OpcionesFiltro;
  onAlternar: (clave: ClaveFiltroLista, valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <GrupoCasillas
        titulo="Categoría"
        opciones={opciones.categorias.map((categoria) => ({
          valor: categoria.slug,
          etiqueta: categoria.nombre,
        }))}
        seleccionados={filtros.categoriaSlug ?? []}
        onAlternar={(valor) => onAlternar('categoriaSlug', valor)}
      />
      <GrupoCasillas
        titulo="Tipo de base"
        opciones={opciones.tiposBase.map((valor) => ({ valor, etiqueta: valor }))}
        seleccionados={filtros.tipoBase ?? []}
        onAlternar={(valor) => onAlternar('tipoBase', valor)}
      />
      <GrupoCasillas
        titulo="Longitud"
        opciones={opciones.longitudes.map((valor) => ({ valor, etiqueta: valor }))}
        seleccionados={filtros.longitud ?? []}
        onAlternar={(valor) => onAlternar('longitud', valor)}
      />
      <GrupoCasillas
        titulo="Talla"
        opciones={opciones.tallas.map((valor) => ({ valor, etiqueta: valor }))}
        seleccionados={filtros.talla ?? []}
        onAlternar={(valor) => onAlternar('talla', valor)}
      />
      <GrupoColores
        colores={opciones.colores}
        seleccionados={filtros.color ?? []}
        onAlternar={(valor) => onAlternar('color', valor)}
      />
    </div>
  );
}

function GrupoCasillas({
  titulo,
  opciones,
  seleccionados,
  onAlternar,
}: {
  titulo: string;
  opciones: { valor: string; etiqueta: string }[];
  seleccionados: string[];
  onAlternar: (valor: string) => void;
}) {
  if (opciones.length === 0) return null;

  return (
    <fieldset>
      <legend className="font-serif text-sm text-tinta">{titulo}</legend>
      <div className="mt-2 flex flex-col gap-2">
        {opciones.map((opcion) => (
          <label
            key={opcion.valor}
            className="flex items-center gap-2 text-sm text-texto-secundario"
          >
            <input
              type="checkbox"
              checked={seleccionados.includes(opcion.valor)}
              onChange={() => onAlternar(opcion.valor)}
              className="h-4 w-4 rounded border-linea text-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
            />
            {opcion.etiqueta}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function GrupoColores({
  colores,
  seleccionados,
  onAlternar,
}: {
  colores: ValorAtributo[];
  seleccionados: string[];
  onAlternar: (valor: string) => void;
}) {
  if (colores.length === 0) return null;

  return (
    <fieldset>
      <legend className="font-serif text-sm text-tinta">Color</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {colores.map((color) => {
          const activo = seleccionados.includes(color.nombre);
          return (
            <button
              key={color.nombre}
              type="button"
              aria-pressed={activo}
              aria-label={color.nombre}
              title={color.nombre}
              onClick={() => onAlternar(color.nombre)}
              className={`h-8 w-8 rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa focus-visible:ring-offset-2 ${
                activo ? 'border-rosa' : 'border-linea'
              }`}
              style={{ backgroundColor: color.hex }}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

// --- Chips de filtros activos ------------------------------------------------

function ChipsFiltro({
  filtros,
  opciones,
  onQuitar,
  onLimpiarTodo,
}: {
  filtros: FiltrosProducto;
  opciones: OpcionesFiltro;
  onQuitar: (clave: ClaveFiltroLista, valor: string) => void;
  onLimpiarTodo: () => void;
}) {
  const nombrePorSlugCategoria = new Map(
    opciones.categorias.map((categoria) => [categoria.slug, categoria.nombre]),
  );

  const chips: { clave: ClaveFiltroLista; valor: string; etiqueta: string }[] = [
    ...(filtros.categoriaSlug ?? []).map((valor) => ({
      clave: 'categoriaSlug' as const,
      valor,
      etiqueta: nombrePorSlugCategoria.get(valor) ?? valor,
    })),
    ...(filtros.tipoBase ?? []).map((valor) => ({
      clave: 'tipoBase' as const,
      valor,
      etiqueta: valor,
    })),
    ...(filtros.longitud ?? []).map((valor) => ({
      clave: 'longitud' as const,
      valor,
      etiqueta: valor,
    })),
    ...(filtros.talla ?? []).map((valor) => ({ clave: 'talla' as const, valor, etiqueta: valor })),
    ...(filtros.color ?? []).map((valor) => ({ clave: 'color' as const, valor, etiqueta: valor })),
  ];

  if (chips.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={`${chip.clave}-${chip.valor}`}
          type="button"
          onClick={() => onQuitar(chip.clave, chip.valor)}
          aria-label={`Quitar filtro ${chip.etiqueta}`}
          className="rounded-full bg-rosa-palo px-3 py-1 text-sm text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
        >
          <span aria-hidden="true">{chip.etiqueta} ×</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onLimpiarTodo}
        className="text-sm font-medium text-rosa underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
      >
        Limpiar todo
      </button>
    </div>
  );
}

// --- Panel de filtros en móvil -----------------------------------------------

function PanelFiltrosMovil({
  abierto,
  alCerrar,
  filtrosIniciales,
  opciones,
  onAplicar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  filtrosIniciales: FiltrosProducto;
  opciones: OpcionesFiltro;
  onAplicar: (filtros: FiltrosProducto) => void;
}) {
  const [borrador, setBorrador] = useState<FiltrosProducto>(filtrosIniciales);

  useEffect(() => {
    // Solo resincronizamos al abrir: mientras el panel está abierto, el
    // borrador vive aparte de la URL hasta que se presiona "Aplicar filtros".
    if (abierto) setBorrador(filtrosIniciales);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  function alternar(clave: ClaveFiltroLista, valor: string) {
    setBorrador((actual) => {
      const lista = actual[clave] ?? [];
      const nuevaLista = lista.includes(valor)
        ? lista.filter((item) => item !== valor)
        : [...lista, valor];
      return { ...actual, [clave]: nuevaLista };
    });
  }

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-tinta/50 lg:hidden" onClick={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
        className="flex h-full w-full max-w-sm flex-col bg-hueso p-6"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-tinta">Filtros</h2>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar filtros"
            className="rounded-full p-2 hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          <GruposFiltro filtros={borrador} opciones={opciones} onAlternar={alternar} />
        </div>

        <Boton
          type="button"
          variante="rosa"
          className="mt-4 w-full"
          onClick={() => {
            onAplicar(borrador);
            alCerrar();
          }}
        >
          Aplicar filtros
        </Boton>
      </div>
    </div>
  );
}

// --- Paginación ---------------------------------------------------------------

function ControlPaginacion({
  paginacion,
  onIrAPagina,
}: {
  paginacion: Paginacion;
  onIrAPagina: (pagina: number) => void;
}) {
  if (paginacion.totalPaginas <= 1) return null;

  const paginas = Array.from({ length: paginacion.totalPaginas }, (_, indice) => indice + 1);

  return (
    <nav aria-label="Paginación" className="mt-8 flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={paginacion.pagina <= 1}
        onClick={() => onIrAPagina(paginacion.pagina - 1)}
        className="rounded-full px-3 py-1.5 text-sm font-medium text-tinta hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-40"
      >
        Anterior
      </button>
      {paginas.map((numero) => (
        <button
          key={numero}
          type="button"
          aria-current={numero === paginacion.pagina ? 'page' : undefined}
          onClick={() => onIrAPagina(numero)}
          className={`h-9 w-9 rounded-full text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
            numero === paginacion.pagina ? 'bg-rosa text-hueso' : 'text-tinta hover:bg-arena'
          }`}
        >
          {numero}
        </button>
      ))}
      <button
        type="button"
        disabled={paginacion.pagina >= paginacion.totalPaginas}
        onClick={() => onIrAPagina(paginacion.pagina + 1)}
        className="rounded-full px-3 py-1.5 text-sm font-medium text-tinta hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-40"
      >
        Siguiente
      </button>
    </nav>
  );
}

// --- Esqueletos de carga -------------------------------------------------------

function GrillaEsqueleto() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
      {Array.from({ length: PRODUCTOS_POR_PAGINA }).map((_, indice) => (
        <div key={indice} className="flex flex-col gap-3">
          <EsqueletoCarga alto="aspect-[3/4] h-auto" redondeado="rounded-lg" />
          <EsqueletoCarga ancho="w-3/4" alto="h-4" />
          <EsqueletoCarga ancho="w-1/2" alto="h-4" />
        </div>
      ))}
    </div>
  );
}

function EsqueletosFiltros() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 4 }).map((_, indice) => (
        <div key={indice} className="flex flex-col gap-2">
          <EsqueletoCarga ancho="w-1/2" alto="h-4" />
          <EsqueletoCarga alto="h-4" />
          <EsqueletoCarga alto="h-4" />
        </div>
      ))}
    </div>
  );
}
