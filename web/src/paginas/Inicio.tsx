import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boton } from '../componentes/Boton.tsx';
import { CarruselHeroe } from '../componentes/CarruselHeroe.tsx';
import { Contenedor } from '../componentes/Contenedor.tsx';
import { EsqueletoCarga } from '../componentes/EsqueletoCarga.tsx';
import { ImagenProducto } from '../componentes/ImagenProducto.tsx';
import { useCarrito } from '../contexto/ContextoCarrito.tsx';
import { useConfiguracion } from '../contexto/ContextoConfiguracion.tsx';
import { repositorio } from '../datos/index.ts';
import type { Facetas, HeroePortada, TonoConConteo } from '../datos/repositorio.ts';
import { estimarEntrega } from '../dominio/estimarEntrega.ts';
import type { ReglasEntrega } from '../dominio/estimarEntrega.ts';
import type { Combo, EdicionLimitada } from '../tipos/index.ts';
import { useAccionAsincrona } from '../utilidades/useAccionAsincrona.ts';

export function Inicio() {
  return (
    <div className="flex flex-col">
      <SeccionHeroe />
      <BarraEntrega />
      <SeccionLimitadas />
      <SeccionKits />
      <SeccionMarca />
    </div>
  );
}

// --- Héroe: tonos + retrato --------------------------------------------------

function SeccionHeroe() {
  const [heroe, setHeroe] = useState<HeroePortada | null>(null);
  const [facetasCatalogo, setFacetasCatalogo] = useState<Facetas | null>(null);
  // Solo se usa en la rama de respaldo (sin destacadas): ahí el tono lo
  // elige la clienta a mano, como siempre. Con destacadas, el tono activo
  // no se guarda acá — se deriva de `indiceRecorrido` más abajo, para que
  // la hilera siga al carrusel y nunca al revés (punto 2 del pedido).
  const [tonoActivoManual, setTonoActivoManual] = useState<string | null>(null);
  const [indiceRecorrido, setIndiceRecorrido] = useState(0);

  useEffect(() => {
    let vigente = true;

    // Las dos piden en paralelo: el héroe (destacadas de portada, si hay)
    // y las facetas del catálogo completo, que siguen siendo la fuente
    // del conteo ("N piezas") y del respaldo cuando no hay destacadas
    // (ver abajo) — nunca se duplica esa cuenta acá.
    Promise.all([repositorio.obtenerHeroePortada(), repositorio.listarFacetas({})]).then(
      ([heroeCargado, facetas]) => {
        if (!vigente) return;
        setHeroe(heroeCargado);
        setFacetasCatalogo(facetas);
      },
    );

    return () => {
      vigente = false;
    };
  }, []);

  const cargando = heroe === null || facetasCatalogo === null;
  const hayDestacadas = !cargando && heroe.destacadas.length > 0;

  // Sin destacadas de portada, la hilera sale del catálogo completo (como
  // siempre); con destacadas, solo de los colores que de verdad tienen —
  // el conteo ("N piezas") sigue siendo el del catálogo en los dos casos.
  const conteoPorNombre = useMemo(
    () => new Map((facetasCatalogo?.colores ?? []).map((c) => [c.nombre, c.conteo])),
    [facetasCatalogo],
  );
  const tonos: TonoConConteo[] | null = cargando
    ? null
    : hayDestacadas
      ? heroe.colores.map((color) => ({ ...color, conteo: conteoPorNombre.get(color.nombre) ?? 0 }))
      : facetasCatalogo.colores;

  // El recorrido completo: las pelucas del primer tono, una por una, y al
  // terminar las del siguiente — en el mismo orden en que aparecen los
  // tonos (punto 1). Una peluca con más de un color aparece una vez por
  // cada tono que tenga, así que no sirve deduplicarla.
  const recorrido = useMemo(() => {
    if (!hayDestacadas) return [];
    return heroe.colores.flatMap((color) =>
      heroe.destacadas
        .filter((producto) => producto.colores.some((c) => c.nombre === color.nombre))
        .map((producto) => ({ producto, tonoNombre: color.nombre })),
    );
  }, [hayDestacadas, heroe]);

  const indiceSeguro = recorrido.length > 0 ? indiceRecorrido % recorrido.length : 0;

  const tono =
    cargando || !tonos || tonos.length === 0
      ? null
      : hayDestacadas
        ? (tonos.find((t) => t.nombre === recorrido[indiceSeguro]?.tonoNombre) ?? tonos[0]!)
        : (tonos.find((t) => t.nombre === tonoActivoManual) ?? tonos[0]!);

  // Sin ningún color publicado en el catálogo no hay héroe que armar: nada
  // de titular con una hilera vacía debajo. Mientras carga (tonos === null)
  // sigue sin saberse si va a quedar vacío, así que el titular ya se
  // muestra (con la hilera y el retrato en esqueleto).
  if (tonos !== null && tonos.length === 0) return null;

  function elegirTono(nombreTono: string) {
    if (hayDestacadas) {
      // Reposiciona el recorrido a la primera peluca de ese tono; el
      // autoavance sigue de ahí, hacia el siguiente tono (punto 5).
      const indice = recorrido.findIndex((item) => item.tonoNombre === nombreTono);
      if (indice !== -1) setIndiceRecorrido(indice);
    } else {
      setTonoActivoManual(nombreTono);
    }
  }

  return (
    <section className="w-full bg-arena pt-14 pb-20">
      <Contenedor className="grid gap-10 lg:grid-cols-[0.42fr_0.58fr] lg:items-center">
        <div>
          <h1 className="font-serif text-5xl text-tinta sm:text-6xl lg:text-7xl">
            Elige tu tono
            <br />y nosotras el resto
          </h1>
          <p className="mt-5 line-clamp-3 max-w-[38ch] text-[15.5px] text-texto-secundario">
            Cabello 100% humano, seleccionado uno por uno. Empieza por el color: todo lo demás se
            acomoda a él.
          </p>

          {cargando || !tono ? (
            <>
              <div className="mt-6 flex gap-3 lg:hidden">
                {Array.from({ length: 4 }).map((_, indice) => (
                  <EsqueletoCarga key={indice} ancho="w-14" alto="h-14" redondeado="rounded-2xl" />
                ))}
              </div>
              <div className="mt-8 hidden flex-col gap-2 lg:flex">
                {Array.from({ length: 4 }).map((_, indice) => (
                  <EsqueletoCarga key={indice} alto="h-11" redondeado="rounded-full" />
                ))}
              </div>
              <EsqueletoCarga ancho="w-40" alto="h-12" redondeado="rounded-full" className="mt-8" />
            </>
          ) : (
            <>
              {/* Celular/tablet: fila horizontal con scroll si no caben,
                  círculo + nombre debajo, 44px mínimo de blanco tocable.
                  Desde lg: lista vertical con el activo en píldora (ver
                  abajo) — son dos layouts bastante distintos como para
                  compartir un solo árbol de elementos. */}
              <div
                role="group"
                aria-label="Elegir tono de cabello"
                className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:hidden"
              >
                {tonos!.map((item) => {
                  const activo = item.nombre === tono.nombre;
                  return (
                    <button
                      key={item.nombre}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => elegirTono(item.nombre)}
                      className="flex min-h-11 shrink-0 flex-col items-center gap-1.5 rounded-2xl px-2 py-2"
                    >
                      <span
                        aria-hidden="true"
                        className={`h-10 w-10 rounded-full shadow-[0_0_0_1px_var(--color-linea)] ${
                          activo ? 'shadow-[0_0_0_2px_var(--color-rosa)]' : ''
                        }`}
                        style={{ backgroundColor: item.hex }}
                      />
                      <span
                        className={`text-xs whitespace-nowrap ${activo ? 'font-medium text-tinta' : 'text-texto-secundario'}`}
                      >
                        {item.nombre}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div role="group" aria-label="Elegir tono de cabello" className="mt-8 hidden flex-col gap-1 lg:flex">
                {tonos!.map((item) => {
                  const activo = item.nombre === tono.nombre;
                  return (
                    <button
                      key={item.nombre}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => elegirTono(item.nombre)}
                      className={`flex w-fit items-center gap-3 rounded-full border px-3 py-2 text-left transition-colors ${
                        activo
                          ? 'border-linea bg-white'
                          : 'border-transparent hover:border-linea hover:bg-white/60'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-10 w-10 shrink-0 rounded-full shadow-[0_0_0_1px_var(--color-linea)] ${
                          activo ? 'shadow-[0_0_0_2px_var(--color-rosa)]' : ''
                        }`}
                        style={{ backgroundColor: item.hex }}
                      />
                      <span
                        className={`text-sm tracking-wide ${activo ? 'font-medium text-tinta' : 'text-texto-secundario'}`}
                      >
                        {item.nombre}
                      </span>
                    </button>
                  );
                })}
              </div>

              <Link
                to={`/catalogo?color=${encodeURIComponent(tono.nombre)}`}
                className="mt-8 block w-full lg:inline-block lg:w-auto"
              >
                <Boton
                  type="button"
                  variante="tinta"
                  className="w-full uppercase tracking-[0.14em] lg:w-auto"
                >
                  Ver piezas
                </Boton>
              </Link>
            </>
          )}
        </div>

        {cargando || !tono ? (
          <EsqueletoCarga alto="aspect-[4/5] h-auto lg:aspect-[11/10]" redondeado="rounded-2xl" />
        ) : hayDestacadas ? (
          <CarruselHeroe
            productos={recorrido.map((item) => item.producto)}
            indice={indiceSeguro}
            onCambiarIndice={setIndiceRecorrido}
          />
        ) : (
          <figure className="relative overflow-hidden rounded-2xl">
            <ImagenProducto
              nombre={tono.nombre}
              colorHex={tono.hex}
              className="aspect-[4/5] h-auto lg:aspect-[11/10]"
            />
            <figcaption className="absolute bottom-5 left-5 rounded-full bg-white px-4 py-2 text-xs tracking-[0.1em] text-tinta shadow-lg">
              {tono.nombre}
            </figcaption>
          </figure>
        )}
      </Contenedor>
    </section>
  );
}

// --- Barra de entrega ---------------------------------------------------------

function BarraEntrega() {
  const { cargando, obtenerNumero, obtenerBooleano, obtenerTexto, formatearMonto } =
    useConfiguracion();
  const [ciudad, setCiudad] = useState('Cali');

  const envioCosto = obtenerNumero('envio.costo');
  const descuentoUmbral = obtenerNumero('descuento.umbral');
  const descuentoPorcentaje = obtenerNumero('descuento.porcentaje');
  const descuentoActivo = obtenerBooleano('descuento.activo');
  const diasCali = obtenerNumero('entrega.dias_cali');
  const diasPrincipales = obtenerNumero('entrega.dias_principales');
  const diasResto = obtenerNumero('entrega.dias_resto');
  const ciudadesPrincipales = useMemo(
    () =>
      (obtenerTexto('entrega.ciudades_principales') ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    [obtenerTexto],
  );

  if (cargando) {
    return (
      <section className="border-y border-linea py-5">
        <Contenedor>
          <EsqueletoCarga ancho="w-2/3" alto="h-5" />
        </Contenedor>
      </section>
    );
  }

  // El envío nunca falta (es una regla de negocio fija): si no llegó esta
  // clave, algo anda mal con configuracion y mejor no mostrar nada mal
  // calculado.
  if (
    envioCosto === undefined ||
    diasCali === undefined ||
    diasPrincipales === undefined ||
    diasResto === undefined
  ) {
    return null;
  }

  const reglas: ReglasEntrega = {
    diasCali,
    diasPrincipales,
    diasResto,
    ciudadesPrincipales,
  };
  const estimacion = estimarEntrega(ciudad, reglas);
  const hayDescuento =
    descuentoActivo === true && descuentoUmbral !== undefined && descuentoPorcentaje !== undefined;

  return (
    <section className="border-y border-linea py-5">
      <Contenedor className="flex flex-wrap items-center gap-3.5 text-[14.5px]">
        <span>
          Envío de <strong className="font-medium text-rosa">{formatearMonto(envioCosto)}</strong> a
          todo el país.
        </span>

        <label className="flex items-center gap-2">
          <span className="sr-only">Elegir ciudad de entrega</span>
          <select
            value={ciudad}
            onChange={(evento) => setCiudad(evento.target.value)}
            className="rounded-full border border-linea bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            <option value="Cali">Cali</option>
            {ciudadesPrincipales.map((nombreCiudad) => (
              <option key={nombreCiudad} value={nombreCiudad}>
                {nombreCiudad}
              </option>
            ))}
            <option value="Otra ciudad">Otra ciudad</option>
          </select>
        </label>

        <span>
          Tu pedido llega <strong className="font-medium text-rosa">{estimacion.texto}</strong>.
        </span>

        {hayDescuento ? (
          <>
            <span aria-hidden="true" className="h-5 w-px bg-linea" />
            <span>
              Desde{' '}
              <strong className="font-medium text-rosa">{formatearMonto(descuentoUmbral)}</strong>{' '}
              te descontamos el{' '}
              <strong className="font-medium text-rosa">{descuentoPorcentaje}%</strong>.
            </span>
          </>
        ) : null}
      </Contenedor>
    </section>
  );
}

// --- Ediciones limitadas -------------------------------------------------------

function SeccionLimitadas() {
  const { formatearDual } = useConfiguracion();
  const [limitadas, setLimitadas] = useState<EdicionLimitada[] | null>(null);

  useEffect(() => {
    let vigente = true;
    repositorio.listarLimitadas().then((datos) => {
      if (vigente) setLimitadas(datos);
    });
    return () => {
      vigente = false;
    };
  }, []);

  if (limitadas === null) {
    return (
      <section className="py-16">
        <Contenedor>
          <EsqueletoCarga ancho="w-1/3" alto="h-8" />
          <div className="mt-7 grid gap-6 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, indice) => (
              <EsqueletoCarga key={indice} alto="h-80" redondeado="rounded-lg" />
            ))}
          </div>
        </Contenedor>
      </section>
    );
  }

  if (limitadas.length === 0) return null;

  return (
    <section className="border-t border-linea bg-arena py-16 sm:py-20">
      <Contenedor>
        <div className="max-w-[46ch]">
          <h2 className="font-serif text-3xl text-tinta sm:text-4xl">Ediciones limitadas</h2>
          <p className="mt-2 text-sm text-texto-secundario">
            Lotes que no se repiten. Cuando se acaban las unidades, la pieza sale del catálogo.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {limitadas.map((edicion) => (
            <TarjetaLimitada key={edicion.id} edicion={edicion} formatearDual={formatearDual} />
          ))}
        </div>
      </Contenedor>
    </section>
  );
}

function TarjetaLimitada({
  edicion,
  formatearDual,
}: {
  edicion: EdicionLimitada;
  formatearDual: (precio: { cop: number; usd: number }) => string;
}) {
  const hayBarra = edicion.unidadesLote !== null && edicion.unidadesRestantes !== null;
  const porcentaje = hayBarra
    ? Math.min(100, Math.round((edicion.unidadesRestantes! / edicion.unidadesLote!) * 100))
    : 0;

  return (
    <Link
      to={`/producto/${edicion.producto.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-linea bg-white transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa focus-visible:ring-offset-2"
    >
      <div className="overflow-hidden">
        <div className="transition-transform group-hover:scale-105">
          <ImagenProducto nombre={edicion.producto.nombre} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-serif text-lg text-tinta">{edicion.nombre}</h3>
        {hayBarra ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-texto-secundario">
              Quedan {edicion.unidadesRestantes} de {edicion.unidadesLote} unidades
            </span>
            <div className="h-1.5 overflow-hidden rounded-full bg-linea">
              <div className="h-full rounded-full bg-rosa" style={{ width: `${porcentaje}%` }} />
            </div>
          </div>
        ) : null}
        <span className="mt-auto pt-1 text-lg font-medium text-tinta">
          {formatearDual(edicion.precio)}
        </span>
      </div>
    </Link>
  );
}

// --- Kits armados ---------------------------------------------------------------

function SeccionKits() {
  const { formatearDual } = useConfiguracion();
  const { agregarCombo } = useCarrito();
  const [combos, setCombos] = useState<Combo[] | null>(null);

  useEffect(() => {
    let vigente = true;
    repositorio.listarCombos().then((datos) => {
      if (vigente) setCombos(datos);
    });
    return () => {
      vigente = false;
    };
  }, []);

  if (combos === null) {
    return (
      <section className="py-16">
        <Contenedor>
          <EsqueletoCarga ancho="w-1/3" alto="h-8" />
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-6">
            {Array.from({ length: 3 }).map((_, indice) => (
              <EsqueletoCarga key={indice} alto="h-96" redondeado="rounded-lg" />
            ))}
          </div>
        </Contenedor>
      </section>
    );
  }

  if (combos.length === 0) return null;

  return (
    <section className="py-16 sm:py-20">
      <Contenedor>
        <div className="max-w-[46ch]">
          <h2 className="font-serif text-3xl text-tinta sm:text-4xl">Kits armados</h2>
          <p className="mt-2 text-sm text-texto-secundario">
            Lo que más se pide junto, a un precio mejor que por separado.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-6">
          {combos.map((combo) => (
            <TarjetaKit
              key={combo.id}
              combo={combo}
              formatearDual={formatearDual}
              onAgregar={() => agregarCombo(combo.id, 1)}
            />
          ))}
        </div>
      </Contenedor>
    </section>
  );
}

function TarjetaKit({
  combo,
  formatearDual,
  onAgregar,
}: {
  combo: Combo;
  formatearDual: (precio: { cop: number; usd: number }) => string;
  onAgregar: () => Promise<void>;
}) {
  const { cargando: agregando, ejecutar: ejecutarAgregar } = useAccionAsincrona(onAgregar, {
    mensajeExito: 'Agregado al carrito',
  });

  const ahorro =
    combo.precioPiezasPorSeparado.cop > 0
      ? Math.round((1 - combo.precio.cop / combo.precioPiezasPorSeparado.cop) * 100)
      : 0;

  async function alAgregar() {
    try {
      await ejecutarAgregar();
    } catch {
      // El hook ya mostró el aviso de error.
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-linea bg-white">
      <div className="relative overflow-hidden">
        <ImagenProducto nombre={combo.nombre} carga="lazy" />
        {!combo.disponible ? (
          <span className="absolute inset-0 flex items-center justify-center bg-tinta/40 text-sm font-medium text-hueso">
            Agotado
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5 sm:p-5">
        <h3 className="line-clamp-2 font-serif text-base text-tinta lg:text-lg">{combo.nombre}</h3>
        {combo.items.length > 0 ? (
          <ul className="list-disc pl-4 text-[13.5px] leading-relaxed text-texto-secundario">
            {/* Tope de 3 en celular (no se desbordan): a partir de lg se ven
                todas — dos listas separadas en vez de recortar con JS, para
                no depender de un listener de resize. */}
            {combo.items.slice(0, 3).map((item) => (
              <li key={item.varianteId} className="truncate lg:hidden">
                {item.cantidad > 1 ? `${item.cantidad} × ` : ''}
                {item.nombreProducto}
              </li>
            ))}
            {combo.items.length > 3 ? (
              <li className="lg:hidden" aria-hidden="true">
                y {combo.items.length - 3} más
              </li>
            ) : null}
            {combo.items.map((item) => (
              <li key={item.varianteId} className="hidden truncate lg:block">
                {item.cantidad > 1 ? `${item.cantidad} × ` : ''}
                {item.nombreProducto}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex flex-wrap items-baseline gap-1 pt-3 sm:gap-2.5">
          <span className="text-sm font-medium text-tinta sm:text-base lg:text-lg">
            {formatearDual(combo.precio)}
          </span>
          {/* La píldora va antes del tachado a propósito: con flex-wrap, si
              no entran los tres a 360px, el que salta a la línea de abajo
              es el último del DOM (el tachado) — la píldora no se achica
              ni cambia de padding, solo se abrevia el texto en celular. */}
          {ahorro > 0 ? (
            <span className="rounded-full bg-rosa px-2.5 py-0.5 text-xs text-hueso">
              <span className="sm:hidden">-{ahorro}%</span>
              <span className="hidden sm:inline">ahorras {ahorro}%</span>
            </span>
          ) : null}
          <span className="text-sm text-texto-secundario line-through">
            {formatearDual(combo.precioPiezasPorSeparado)}
          </span>
        </div>

        <Boton
          type="button"
          variante="rosa"
          disabled={!combo.disponible}
          cargando={agregando}
          onClick={() => void alAgregar()}
          className="mt-3 min-h-11 w-full"
        >
          {!combo.disponible ? (
            'Agotado'
          ) : (
            <>
              <span className="sm:hidden">Agregar</span>
              <span className="hidden sm:inline">Agregar al carrito</span>
            </>
          )}
        </Boton>
      </div>
    </article>
  );
}

// --- La marca -------------------------------------------------------------------

function SeccionMarca() {
  const { obtenerNumero } = useConfiguracion();
  const diasCali = obtenerNumero('entrega.dias_cali');
  const diasResto = obtenerNumero('entrega.dias_resto');
  const rangoEntrega =
    diasCali !== undefined && diasResto !== undefined ? `${diasCali} a ${diasResto}` : null;

  return (
    <section className="border-t border-linea py-16 sm:py-20">
      <Contenedor className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <ImagenProducto nombre="India Rosa" className="aspect-square rounded-full" />
        <div>
          <h2 className="font-serif text-3xl text-tinta sm:text-4xl">Detrás de India Rosa</h2>
          <p className="mt-4 max-w-[52ch] text-[15px] text-texto-secundario">
            Empezamos en Cali vendiendo por WhatsApp a clientas que llegaban por recomendación.
            Seguimos igual de cerca: cada peluca se revisa antes de salir y te acompañamos a elegir
            la talla del gorro, la densidad y el tono.
          </p>
          <p className="mt-3 max-w-[52ch] text-[15px] text-texto-secundario">
            Trabajamos con cabello humano remy, que se puede planchar, ondular y teñir. No vendemos
            nada que no nos pondríamos.
          </p>

          <div className="mt-8 flex flex-wrap gap-11">
            <div>
              <p className="font-serif text-3xl text-rosa">+1.400</p>
              <span className="text-[13px] text-texto-secundario">clientas desde 2021</span>
            </div>
            <div>
              <p className="font-serif text-3xl text-rosa">4,8</p>
              <span className="text-[13px] text-texto-secundario">calificación promedio</span>
            </div>
            {rangoEntrega ? (
              <div>
                <p className="font-serif text-3xl text-rosa">{rangoEntrega}</p>
                <span className="text-[13px] text-texto-secundario">días hábiles de entrega</span>
              </div>
            ) : null}
          </div>
        </div>
      </Contenedor>
    </section>
  );
}
