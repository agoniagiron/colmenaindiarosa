import { useEffect, useId, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Boton } from '../componentes/Boton.tsx';
import { Contenedor } from '../componentes/Contenedor.tsx';
import { EsqueletoCarga } from '../componentes/EsqueletoCarga.tsx';
import { EstadoVacio } from '../componentes/EstadoVacio.tsx';
import { Estrellas } from '../componentes/Estrellas.tsx';
import { ImagenProducto } from '../componentes/ImagenProducto.tsx';
import { TarjetaProducto } from '../componentes/TarjetaProducto.tsx';
import { useCarrito } from '../contexto/ContextoCarrito.tsx';
import { useConfiguracion } from '../contexto/ContextoConfiguracion.tsx';
import { repositorio } from '../datos/index.ts';
import type { Producto, VarianteProducto } from '../tipos/index.ts';
import { useAccionAsincrona } from '../utilidades/useAccionAsincrona.ts';
import {
  disponibleDe,
  elegirAlCambiar,
  estadoOpcion,
  GRUPOS_ATRIBUTO,
  ordenDeGrupos,
  valorAtributo,
} from './selectorVariantes.ts';
import type { AjusteAutomatico, ClaveAtributo, EstadoOpcion } from './selectorVariantes.ts';

const PARAMETRO_VARIANTE = 'variante';

// --- Atributos de variante ---------------------------------------------------
// La lógica del selector (qué opción está disponible, cuál elegir al cambiar)
// vive en selectorVariantes.ts, con sus pruebas.

function valoresDisponibles(variantes: VarianteProducto[], clave: ClaveAtributo): string[] {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const variante of variantes) {
    const valor = valorAtributo(variante, clave);
    if (valor && !vistos.has(valor)) {
      vistos.add(valor);
      resultado.push(valor);
    }
  }
  return resultado;
}

// Un enlace con ?variante=SKU manda (la clienta ya eligió, o lo compartió
// así). Si no, la ficha abre en la misma variante que muestra la tarjeta:
// la decide el backend (varianteMostradaId), así el precio no "sube" al
// entrar.
function elegirVarianteInicial(
  variantes: VarianteProducto[],
  skuUrl: string | null,
  varianteMostradaId: string | null,
): VarianteProducto {
  const porSku = skuUrl ? variantes.find((variante) => variante.sku === skuUrl) : undefined;
  if (porSku) return porSku;
  const mostrada = variantes.find((variante) => variante.id === varianteMostradaId);
  if (mostrada) return mostrada;
  return variantes.find((variante) => disponibleDe(variante) > 0) ?? variantes[0];
}

// --- Página -------------------------------------------------------------------

export function ProductoDetalle() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { agregar } = useCarrito();

  const [producto, setProducto] = useState<Producto | null | undefined>(undefined);
  const [relacionados, setRelacionados] = useState<Producto[]>([]);
  const [cargandoRelacionados, setCargandoRelacionados] = useState(true);

  const [cantidad, setCantidad] = useState(1);
  // Grupos que se acomodaron solos en la última elección (con el valor que
  // lo provocó), para avisarlo debajo de cada uno.
  const [ajustes, setAjustes] = useState<(AjusteAutomatico & { motivo: string })[]>([]);
  useEffect(() => setAjustes([]), [slug]);
  const { cargando: agregando, ejecutar: ejecutarAgregar } = useAccionAsincrona(agregar, {
    mensajeExito: 'Agregado al carrito',
  });

  useEffect(() => {
    let vigente = true;
    setProducto(undefined);

    if (!slug) {
      setProducto(null);
      return;
    }

    repositorio.obtenerProducto(slug).then((encontrado) => {
      if (vigente) setProducto(encontrado);
    });

    return () => {
      vigente = false;
    };
  }, [slug]);

  useEffect(() => {
    let vigente = true;
    setCargandoRelacionados(true);

    if (!slug) {
      setRelacionados([]);
      setCargandoRelacionados(false);
      return;
    }

    repositorio
      .listarRelacionados(slug)
      .then((encontrados) => {
        if (vigente) setRelacionados(encontrados);
      })
      .finally(() => {
        if (vigente) setCargandoRelacionados(false);
      });

    return () => {
      vigente = false;
    };
  }, [slug]);

  const varianteActual = producto
    ? elegirVarianteInicial(
        producto.variantes,
        searchParams.get(PARAMETRO_VARIANTE),
        producto.varianteMostradaId,
      )
    : null;

  // La variante elegida siempre queda reflejada en la URL, aunque haya
  // llegado por selección por defecto (sin query param todavía).
  useEffect(() => {
    if (!varianteActual) return;
    if (searchParams.get(PARAMETRO_VARIANTE) === varianteActual.sku) return;

    const params = new URLSearchParams(searchParams);
    params.set(PARAMETRO_VARIANTE, varianteActual.sku);
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varianteActual?.sku]);

  function seleccionarAtributo(clave: ClaveAtributo, valor: string) {
    if (!producto || !varianteActual) return;
    const { variante: nueva, ajustes } = elegirAlCambiar(
      producto.variantes,
      clave,
      valor,
      varianteActual,
      ordenDeGrupos(producto.ordenAtributos),
    );
    // Si al elegir algo arriba cambió un grupo de abajo, se dice cuál y por
    // qué: nada se acomoda en silencio.
    setAjustes(ajustes.map((ajuste) => ({ ...ajuste, motivo: valor })));
    if (nueva.id === varianteActual.id) return;

    const params = new URLSearchParams(searchParams);
    params.set(PARAMETRO_VARIANTE, nueva.sku);
    setSearchParams(params, { replace: true });
    setCantidad(1);
  }

  async function alAgregar() {
    if (!varianteActual || disponibleDe(varianteActual) <= 0) return;
    try {
      await ejecutarAgregar(varianteActual.id, cantidad);
    } catch {
      // El hook ya mostró el aviso de error.
    }
  }

  if (producto === undefined) {
    return (
      <Contenedor ancho="normal" className="py-10">
        <EsqueletoDetalle />
      </Contenedor>
    );
  }

  if (producto === null || !varianteActual) {
    return (
      <Contenedor ancho="normal" className="py-16">
        <EstadoVacio
          titulo="Producto no encontrado"
          descripcion="Puede que el enlace esté mal escrito o que el producto ya no esté disponible."
          accion={
            <Boton type="button" variante="rosa" onClick={() => navigate('/catalogo')}>
              Ver catálogo
            </Boton>
          }
        />
      </Contenedor>
    );
  }

  // El orden (y la jerarquía) del selector es el que configura la categoría
  // en el panel; ver selectorVariantes.ts.
  const orden = ordenDeGrupos(producto.ordenAtributos);
  const grupos = orden.map((clave) => GRUPOS_ATRIBUTO.find((g) => g.clave === clave)!);
  const hayAtributos = grupos.some(
    (grupo) => valoresDisponibles(producto.variantes, grupo.clave).length > 0,
  );
  const disponible = disponibleDe(varianteActual);

  return (
    <Contenedor ancho="normal" className="py-10">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <GaleriaProducto
          producto={producto}
          variante={varianteActual}
          colorHex={varianteActual.color?.hex}
        />

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-serif text-2xl text-tinta sm:text-3xl">{producto.nombre}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Estrellas calificacion={producto.calificacion} />
              <span className="text-texto-secundario">
                ({producto.cantidadResenas} {producto.cantidadResenas === 1 ? 'reseña' : 'reseñas'})
              </span>
            </div>
          </div>

          <BloquePrecio variante={varianteActual} />

          {hayAtributos ? (
            <div className="flex flex-col gap-5">
              {grupos.map((grupo) => {
                const valores = valoresDisponibles(producto.variantes, grupo.clave);
                if (valores.length === 0) return null;

                return (
                  <GrupoSelectorAtributo
                    key={grupo.clave}
                    etiqueta={grupo.etiqueta}
                    valores={valores}
                    valorActual={valorAtributo(varianteActual, grupo.clave)}
                    esColor={grupo.clave === 'color'}
                    estadoDe={(valor) =>
                      estadoOpcion(producto.variantes, grupo.clave, valor, varianteActual, orden)
                    }
                    aviso={avisoDeAjuste(ajustes.find((a) => a.clave === grupo.clave))}
                    hexDe={(valor) =>
                      producto.variantes.find((variante) => variante.color?.nombre === valor)?.color
                        ?.hex
                    }
                    onSeleccionar={(valor) => seleccionarAtributo(grupo.clave, valor)}
                  />
                );
              })}
            </div>
          ) : null}

          <SelectorCompra
            disponible={disponible}
            cantidad={cantidad}
            onCambiarCantidad={setCantidad}
            onAgregar={alAgregar}
            cargando={agregando}
          />

          <Acordeon
            secciones={[
              { titulo: 'Descripción', contenido: producto.descripcion },
              {
                titulo: 'Envío y entrega',
                contenido:
                  'Envío a toda Colombia. Desde cierto monto de compra aplicamos un descuento sobre el subtotal (lo ves en la barra superior). Entrega estimada según tu ciudad, coordinada por WhatsApp una vez confirmado el pedido.',
              },
              {
                titulo: 'Cuidados',
                contenido:
                  'Usa productos sin sulfatos, lava con agua tibia y peina con cuidado de puntas a raíz. Deja secar al aire, lejos de fuentes de calor directo, y guarda en su empaque o sobre un soporte para mantener la forma.',
              },
            ]}
          />
        </div>
      </div>

      <SeccionRelacionados productos={relacionados} cargando={cargandoRelacionados} />
    </Contenedor>
  );
}

// --- Galería (miniaturas + imagen principal) ---------------------------------
function GaleriaProducto({
  producto,
  variante,
  colorHex,
}: {
  producto: any; // o usa el tipo Producto de tu index.ts
  variante?: any; // o usa el tipo VarianteProducto de tu index.ts
  colorHex?: string;
}) {
  const [indiceActivo, setIndiceActivo] = useState(0);

  // Lógica de prioridad: si la variante tiene imágenes, úsalas. Si no, usa las generales.
  const imagenesVariante =
    variante?.imagenes && variante.imagenes.length > 0 ? variante.imagenes : null;
  const imagenesProducto =
    producto.imagenes && producto.imagenes.length > 0 ? producto.imagenes : null;
  const imagenes = imagenesVariante || imagenesProducto;

  const indiceSeguro = imagenes ? Math.min(indiceActivo, imagenes.length - 1) : 0;
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {imagenes && imagenes.length > 1 ? (
        <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:w-20 sm:flex-col sm:overflow-visible">
          {imagenes.map((imagen: any, indice: number) => (
            <button
              key={imagen.id}
              type="button"
              onClick={() => setIndiceActivo(indice)}
              aria-label={`Ver imagen ${indice + 1} de ${producto.nombre}`}
              aria-current={indice === indiceSeguro}
              className={`w-16 shrink-0 overflow-hidden rounded-lg border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
                indice === indiceSeguro ? 'border-rosa' : 'border-transparent'
              }`}
            >
              <ImagenProducto nombre={producto.nombre} colorHex={colorHex} url={imagen.url} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="order-1 flex-1 sm:order-2">
        <ImagenProducto
          nombre={producto.nombre}
          colorHex={colorHex}
          url={imagenes?.[indiceSeguro]?.url}
        />
      </div>
    </div>
  );
}

// --- Precio ---------------------------------------------------------------------

function BloquePrecio({ variante }: { variante: VarianteProducto }) {
  const { formatearDual } = useConfiguracion();

  // "Antes" cubre dos casos distintos que pueden convivir: una promoción
  // vigente (precioOriginal vs. precioConDescuento) y un precio de lista
  // anterior guardado a mano (precioAntes). Se muestra el más alto de los
  // dos como tachado.
  const hayPromocion = variante.precioOriginal.cop > variante.precioConDescuento.cop;
  const antes = hayPromocion
    ? variante.precioOriginal
    : variante.precioAntes && variante.precioAntes.cop > variante.precioConDescuento.cop
      ? variante.precioAntes
      : null;
  const porcentaje = antes
    ? Math.round((1 - variante.precioConDescuento.cop / antes.cop) * 100)
    : 0;
  const valorCuotaCop = Math.round(variante.precioConDescuento.cop / 4);
  const valorCuotaUsd = Math.round(variante.precioConDescuento.usd / 4);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-3xl font-semibold text-tinta">
          {formatearDual(variante.precioConDescuento)}
        </span>
        {antes ? (
          <>
            <span className="text-lg text-texto-secundario line-through">
              {formatearDual(antes)}
            </span>
            <span className="rounded-full bg-rosa px-2 py-0.5 text-sm font-medium text-hueso">
              -{porcentaje}%
            </span>
          </>
        ) : null}
      </div>
      <p className="text-sm text-texto-secundario">
        4 cuotas de {formatearDual({ cop: valorCuotaCop, usd: valorCuotaUsd })} sin interés
      </p>
    </div>
  );
}

// --- Selectores de variante -------------------------------------------------

function avisoDeAjuste(ajuste: (AjusteAutomatico & { motivo: string }) | undefined): string | null {
  if (!ajuste) return null;
  return `${ajuste.antes} no viene en ${ajuste.motivo}: te mostramos ${ajuste.despues}.`;
}

const TEXTO_ESTADO: Record<Exclude<EstadoOpcion, 'disponible'>, string> = {
  no_existe: 'no viene en esta combinación',
  agotada: 'agotado',
};

function GrupoSelectorAtributo({
  etiqueta,
  valores,
  valorActual,
  esColor,
  estadoDe,
  aviso,
  hexDe,
  onSeleccionar,
}: {
  etiqueta: string;
  valores: string[];
  valorActual: string | undefined;
  esColor: boolean;
  estadoDe: (valor: string) => EstadoOpcion;
  aviso: string | null;
  hexDe: (valor: string) => string | undefined;
  onSeleccionar: (valor: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-tinta">
        {etiqueta}
        {valorActual ? (
          <span className="font-normal text-texto-secundario"> · {valorActual}</span>
        ) : null}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {valores.map((valor) => {
          const activo = valor === valorActual;
          const estado = estadoDe(valor);
          const disponible = estado === 'disponible';
          // Agotada: tachada. No existe en esta combinación: solo atenuada.
          const tachada = estado === 'agotada';
          const etiquetaAccesible =
            estado === 'disponible' ? valor : `${valor}, ${TEXTO_ESTADO[estado]}`;

          if (esColor) {
            return (
              <button
                key={valor}
                type="button"
                disabled={!disponible}
                aria-pressed={activo}
                aria-label={etiquetaAccesible}
                title={etiquetaAccesible}
                onClick={() => onSeleccionar(valor)}
                className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
                  activo ? 'border-rosa' : 'border-linea'
                }`}
                style={{ backgroundColor: hexDe(valor) }}
              >
                {/* Sin opacidad: atenuar un color de cabello lo convierte en
                    otro (un negro al 40% parece gris). Deshabilitado, sea
                    agotado o inexistente, se marca con una diagonal clara con
                    borde, visible sobre cualquier tono; el motivo va en el
                    texto accesible y el tooltip. */}
                {!disponible ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="h-0.5 w-[140%] rotate-45 bg-hueso shadow-[0_0_0_1px_rgba(26,21,19,0.55)]" />
                  </span>
                ) : null}
              </button>
            );
          }

          return (
            <button
              key={valor}
              type="button"
              disabled={!disponible}
              aria-pressed={activo}
              aria-label={etiquetaAccesible}
              title={estado === 'disponible' ? undefined : etiquetaAccesible}
              onClick={() => onSeleccionar(valor)}
              className={`rounded-full border px-4 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-40 ${
                tachada ? 'line-through' : ''
              } ${activo ? 'border-rosa bg-rosa-palo text-tinta' : 'border-linea text-tinta hover:bg-arena'}`}
            >
              {valor}
            </button>
          );
        })}
      </div>
      {aviso ? (
        <p role="status" className="mt-2 text-[13px] text-texto-secundario">
          {aviso}
        </p>
      ) : null}
    </fieldset>
  );
}

// --- Cantidad y agregar al carrito -------------------------------------------

function SelectorCompra({
  disponible,
  cantidad,
  onCambiarCantidad,
  onAgregar,
  cargando,
}: {
  disponible: number;
  cantidad: number;
  onCambiarCantidad: (cantidad: number) => void;
  onAgregar: () => void;
  cargando: boolean;
}) {
  const agotado = disponible <= 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-tinta">Cantidad</span>
        <div className="flex items-center rounded-full border border-linea">
          <button
            type="button"
            onClick={() => onCambiarCantidad(Math.max(1, cantidad - 1))}
            disabled={agotado || cantidad <= 1}
            aria-label="Restar una unidad"
            className="px-3 py-1.5 text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <span className="w-8 text-center text-sm text-tinta">{cantidad}</span>
          <button
            type="button"
            onClick={() => onCambiarCantidad(Math.min(disponible, cantidad + 1))}
            disabled={agotado || cantidad >= disponible}
            aria-label="Sumar una unidad"
            className="px-3 py-1.5 text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>
        {!agotado ? (
          <span className="text-xs text-texto-secundario">{disponible} disponibles</span>
        ) : null}
      </div>

      <Boton
        type="button"
        variante="rosa"
        disabled={agotado}
        cargando={cargando}
        onClick={onAgregar}
        className="w-full"
      >
        {agotado ? 'Agotado' : 'Agregar al carrito'}
      </Boton>
    </div>
  );
}

// --- Acordeón -----------------------------------------------------------------

function Acordeon({ secciones }: { secciones: { titulo: string; contenido: ReactNode }[] }) {
  const [abierta, setAbierta] = useState<number | null>(0);
  const idBase = useId();

  return (
    <div className="divide-y divide-linea border-y border-linea">
      {secciones.map((seccion, indice) => {
        const abiertaActual = abierta === indice;
        const idPanel = `${idBase}-panel-${indice}`;
        const idBoton = `${idBase}-boton-${indice}`;

        return (
          <div key={seccion.titulo}>
            <h2>
              <button
                type="button"
                id={idBoton}
                aria-expanded={abiertaActual}
                aria-controls={idPanel}
                onClick={() => setAbierta(abiertaActual ? null : indice)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left font-serif text-lg text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
              >
                {seccion.titulo}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className={`h-5 w-5 shrink-0 transition-transform ${abiertaActual ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </h2>
            {abiertaActual ? (
              <div
                id={idPanel}
                role="region"
                aria-labelledby={idBoton}
                className="pb-4 text-sm text-texto-secundario"
              >
                {seccion.contenido}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// --- Relacionados ---------------------------------------------------------------

function SeccionRelacionados({
  productos,
  cargando,
}: {
  productos: Producto[];
  cargando: boolean;
}) {
  if (!cargando && productos.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="font-serif text-2xl text-tinta">También te puede interesar</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {cargando
          ? Array.from({ length: 4 }).map((_, indice) => (
              <div key={indice} className="flex flex-col gap-3">
                <EsqueletoCarga alto="aspect-[3/4] h-auto" redondeado="rounded-lg" />
                <EsqueletoCarga ancho="w-3/4" alto="h-4" />
                <EsqueletoCarga ancho="w-1/2" alto="h-4" />
              </div>
            ))
          : productos.map((producto) => <TarjetaProducto key={producto.id} producto={producto} />)}
      </div>
    </section>
  );
}

// --- Esqueleto de carga -----------------------------------------------------

function EsqueletoDetalle() {
  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="order-2 flex gap-2 sm:order-1 sm:w-20 sm:flex-col">
          {Array.from({ length: 3 }).map((_, indice) => (
            <EsqueletoCarga
              key={indice}
              ancho="w-16"
              alto="aspect-[3/4] h-auto"
              redondeado="rounded-lg"
            />
          ))}
        </div>
        <div className="order-1 flex-1 sm:order-2">
          <EsqueletoCarga alto="aspect-[3/4] h-auto" redondeado="rounded-xl" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <EsqueletoCarga ancho="w-3/4" alto="h-8" />
        <EsqueletoCarga ancho="w-1/3" alto="h-4" />
        <EsqueletoCarga ancho="w-1/2" alto="h-10" />
        <EsqueletoCarga alto="h-24" />
        <EsqueletoCarga alto="h-12" />
      </div>
    </div>
  );
}
