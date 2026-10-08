import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boton } from '../componentes/Boton.tsx';
import { CarruselHeroe } from '../componentes/CarruselHeroe.tsx';
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
  const [tonoActivo, setTonoActivo] = useState<string | null>(null);

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
        const primerTono =
          heroeCargado.destacadas.length > 0
            ? heroeCargado.colores[0]?.nombre
            : facetas.colores[0]?.nombre;
        setTonoActivo((actual) => actual ?? primerTono ?? null);
      },
    );

    return () => {
      vigente = false;
    };
  }, []);

  const cargando = heroe === null || facetasCatalogo === null;

  // Sin destacadas de portada, la hilera sale del catálogo completo (como
  // siempre); con destacadas, solo de los colores que de verdad tienen —
  // el conteo ("N piezas") sigue siendo el del catálogo en los dos casos.
  const conteoPorNombre = useMemo(
    () => new Map((facetasCatalogo?.colores ?? []).map((c) => [c.nombre, c.conteo])),
    [facetasCatalogo],
  );
  const tonos: TonoConConteo[] | null = cargando
    ? null
    : heroe.destacadas.length > 0
      ? heroe.colores.map((color) => ({ ...color, conteo: conteoPorNombre.get(color.nombre) ?? 0 }))
      : facetasCatalogo.colores;

  const tono =
    cargando || !tonos || tonos.length === 0
      ? null
      : (tonos.find((t) => t.nombre === tonoActivo) ?? tonos[0]!);

  // Al tono elegido: solo las destacadas que tengan ese color. Si no hay
  // destacadas, vacío (se usa la silueta de respaldo, no el carrusel).
  const destacadasFiltradas = useMemo(() => {
    if (cargando || heroe.destacadas.length === 0) return [];
    if (!tono) return heroe.destacadas;
    return heroe.destacadas.filter((d) => d.colores.some((c) => c.nombre === tono.nombre));
  }, [cargando, heroe, tono]);

  // Sin ningún color publicado en el catálogo no hay héroe que armar: nada
  // de titular con una hilera vacía debajo. Mientras carga (tonos === null)
  // sigue sin saberse si va a quedar vacío, así que el titular ya se
  // muestra (con la hilera y el retrato en esqueleto).
  if (tonos !== null && tonos.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6">
      <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
        <div>
          <h1 className="font-serif text-4xl text-tinta sm:text-5xl lg:text-6xl">
            Elige tu tono
            <br />y nosotras el resto
          </h1>
          <p className="mt-5 max-w-[38ch] text-[15.5px] text-texto-secundario">
            Cabello 100% humano, seleccionado uno por uno. Empieza por el color: todo lo demás se
            acomoda a él.
          </p>

          {cargando || !tono ? (
            <div className="mt-8 flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, indice) => (
                <EsqueletoCarga key={indice} alto="h-11" redondeado="rounded-full" />
              ))}
            </div>
          ) : (
            <>
              <div role="group" aria-label="Elegir tono de cabello" className="mt-8 flex flex-col">
                {tonos!.map((item) => {
                  const activo = item.nombre === tono.nombre;
                  return (
                    <button
                      key={item.nombre}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => setTonoActivo(item.nombre)}
                      className={`flex items-center gap-4 rounded-full px-3 py-2.5 text-left transition-colors hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
                        activo ? 'bg-arena ring-1 ring-linea' : ''
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-10 w-10 shrink-0 rounded-full shadow-[0_0_0_1px_var(--color-linea)] transition-transform ${
                          activo ? 'scale-110 shadow-[0_0_0_2px_var(--color-rosa)]' : ''
                        }`}
                        style={{ backgroundColor: item.hex }}
                      />
                      <span
                        className={`text-sm tracking-wide ${activo ? 'font-normal text-tinta' : 'text-texto-secundario'}`}
                      >
                        {item.nombre}
                      </span>
                      <span className="ml-auto text-xs text-texto-secundario">
                        {item.conteo} {item.conteo === 1 ? 'pieza' : 'piezas'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <Link
                to={`/catalogo?color=${encodeURIComponent(tono.nombre)}`}
                className="mt-8 inline-block"
              >
                <Boton type="button" variante="tinta" className="uppercase tracking-[0.14em]">
                  Ver {tono.conteo} {tono.conteo === 1 ? 'pieza' : 'piezas'} en {tono.nombre}
                </Boton>
              </Link>
            </>
          )}
        </div>

        {cargando || !tono ? (
          <EsqueletoCarga alto="aspect-[3/4] h-auto" redondeado="rounded-lg" />
        ) : heroe.destacadas.length > 0 ? (
          <CarruselHeroe productos={destacadasFiltradas} />
        ) : (
          <figure className="relative">
            <ImagenProducto
              nombre={tono.nombre}
              colorHex={tono.hex}
              className="rounded-tl-[999px] rounded-tr-[999px] rounded-bl-lg rounded-br-lg"
            />
            <figcaption className="absolute bottom-5 left-5 rounded-full bg-white px-4 py-2 text-xs tracking-[0.1em] text-tinta shadow-lg">
              {tono.nombre}
            </figcaption>
          </figure>
        )}
      </div>
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
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <EsqueletoCarga ancho="w-2/3" alto="h-5" />
        </div>
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3.5 px-4 text-[14.5px] sm:px-6">
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
      </div>
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
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <EsqueletoCarga ancho="w-1/3" alto="h-8" />
        <div className="mt-7 grid gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, indice) => (
            <EsqueletoCarga key={indice} alto="h-80" redondeado="rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (limitadas.length === 0) return null;

  return (
    <section className="border-t border-linea bg-arena py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
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
      </div>
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
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <EsqueletoCarga ancho="w-1/3" alto="h-8" />
        <div className="mt-7 grid gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, indice) => (
            <EsqueletoCarga key={indice} alto="h-96" redondeado="rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (combos.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-[46ch]">
        <h2 className="font-serif text-3xl text-tinta sm:text-4xl">Kits armados</h2>
        <p className="mt-2 text-sm text-texto-secundario">
          Lo que más se pide junto, a un precio mejor que por separado.
        </p>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {combos.map((combo) => (
          <TarjetaKit
            key={combo.id}
            combo={combo}
            formatearDual={formatearDual}
            onAgregar={() => agregarCombo(combo.id, 1)}
          />
        ))}
      </div>
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
        <ImagenProducto nombre={combo.nombre} />
        {!combo.disponible ? (
          <span className="absolute inset-0 flex items-center justify-center bg-tinta/40 text-sm font-medium text-hueso">
            Agotado
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-serif text-lg text-tinta">{combo.nombre}</h3>
        {combo.items.length > 0 ? (
          <ul className="list-disc pl-4 text-[13.5px] leading-relaxed text-texto-secundario">
            {combo.items.map((item) => (
              <li key={item.varianteId}>
                {item.cantidad > 1 ? `${item.cantidad} × ` : ''}
                {item.nombreProducto}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex flex-wrap items-baseline gap-2.5 pt-3">
          <span className="text-lg font-medium text-tinta">{formatearDual(combo.precio)}</span>
          <span className="text-sm text-texto-secundario line-through">
            {formatearDual(combo.precioPiezasPorSeparado)}
          </span>
          {ahorro > 0 ? (
            <span className="rounded-full bg-rosa px-2.5 py-0.5 text-xs text-hueso">
              ahorras {ahorro}%
            </span>
          ) : null}
        </div>

        <Boton
          type="button"
          variante="rosa"
          disabled={!combo.disponible}
          cargando={agregando}
          onClick={() => void alAgregar()}
          className="mt-3 w-full"
        >
          {!combo.disponible ? 'Agotado' : 'Agregar al carrito'}
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
      <div className="mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
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
      </div>
    </section>
  );
}
