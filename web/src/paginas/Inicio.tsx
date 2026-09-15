import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Boton } from '../componentes/Boton.tsx';
import { EsqueletoCarga } from '../componentes/EsqueletoCarga.tsx';
import { TarjetaProducto } from '../componentes/TarjetaProducto.tsx';
import { repositorio } from '../datos/index.ts';
import { formatearPesos } from '../utilidades/formatearPesos.ts';
import type { Categoria, Cupon, Producto } from '../tipos/index.ts';

const CANTIDAD_DESTACADOS = 4;

const NUMERO_WHATSAPP = import.meta.env.VITE_NUMERO_WHATSAPP as string | undefined;
const MENSAJE_ASESORIA_WHATSAPP = 'Hola, quiero asesoría para elegir una peluca';

export function Inicio() {
  const [destacados, setDestacados] = useState<Producto[]>([]);
  const [cargandoDestacados, setCargandoDestacados] = useState(true);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);

  const [cuponPorcentaje, setCuponPorcentaje] = useState<Cupon | null>(null);
  const [cuponMontoMinimo, setCuponMontoMinimo] = useState<Cupon | null>(null);
  const [cargandoCupones, setCargandoCupones] = useState(true);

  useEffect(() => {
    let vigente = true;

    repositorio
      .listarProductos({ destacado: true }, 'relevancia', {
        pagina: 1,
        porPagina: CANTIDAD_DESTACADOS,
      })
      .then((resultado) => {
        if (vigente) setDestacados(resultado.datos);
      })
      .finally(() => {
        if (vigente) setCargandoDestacados(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    let vigente = true;

    repositorio
      .listarCategorias()
      .then((resultado) => {
        if (vigente) setCategorias(resultado);
      })
      .finally(() => {
        if (vigente) setCargandoCategorias(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    let vigente = true;

    Promise.all([repositorio.buscarCupon('INDIAROSA10'), repositorio.buscarCupon('ROSA20')])
      .then(([porcentaje, montoMinimo]) => {
        if (vigente) {
          setCuponPorcentaje(porcentaje);
          setCuponMontoMinimo(montoMinimo);
        }
      })
      .finally(() => {
        if (vigente) setCargandoCupones(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-16 pb-16 sm:gap-24">
      <SeccionHero productos={destacados.slice(0, 3)} cargando={cargandoDestacados} />
      <BarraBeneficios />
      <SeccionMasPedido productos={destacados} cargando={cargandoDestacados} />
      <SeccionDescuentos
        cuponPorcentaje={cuponPorcentaje}
        cuponMontoMinimo={cuponMontoMinimo}
        cargando={cargandoCupones}
      />
      <SeccionCategorias categorias={categorias} cargando={cargandoCategorias} />
    </div>
  );
}

// --- Sección 1: hero partido -------------------------------------------

function SeccionHero({ productos, cargando }: { productos: Producto[]; cargando: boolean }) {
  const navigate = useNavigate();

  function abrirAsesoriaWhatsapp() {
    if (!NUMERO_WHATSAPP) return;
    const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(MENSAJE_ASESORIA_WHATSAPP)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16">
      <div className="flex flex-col gap-5">
        <h1 className="font-serif text-3xl text-tinta sm:text-4xl">
          Cabello 100% humano, con asesoría en cada paso
        </h1>
        <p className="max-w-md text-texto-secundario">
          Pelucas y extensiones de cabello 100% humano, elegidas contigo. Te acompañamos por
          WhatsApp para encontrar el color, la base y la densidad correctas antes de comprar.
        </p>
        <div className="flex flex-wrap gap-3">
          <Boton type="button" variante="rosa" onClick={() => navigate('/catalogo')}>
            Ver catálogo
          </Boton>
          {NUMERO_WHATSAPP ? (
            <Boton type="button" variante="fantasma" onClick={abrirAsesoriaWhatsapp}>
              Escríbenos por WhatsApp
            </Boton>
          ) : null}
        </div>
      </div>

      <div>
        {cargando ? (
          <div className="mx-auto flex max-w-xs flex-col items-center gap-4">
            <EsqueletoCarga alto="aspect-[3/4] h-auto" redondeado="rounded-2xl" />
            <EsqueletoCarga ancho="w-2/3" alto="h-4" />
            <EsqueletoCarga ancho="w-1/3" alto="h-4" />
          </div>
        ) : (
          <CarruselHero productos={productos} />
        )}
      </div>
    </section>
  );
}

function CarruselHero({ productos }: { productos: Producto[] }) {
  const [indice, setIndice] = useState(0);

  if (productos.length === 0) return null;

  const indiceSeguro = indice % productos.length;
  const producto = productos[indiceSeguro];

  function irAAnterior() {
    setIndice((actual) => (actual - 1 + productos.length) % productos.length);
  }

  function irASiguiente() {
    setIndice((actual) => (actual + 1) % productos.length);
  }

  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-4">
      <div className="w-full">
        <TarjetaProducto producto={producto} />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={irAAnterior}
          aria-label="Producto anterior"
          className="rounded-full p-2 text-tinta hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
          </svg>
        </button>

        <div className="flex gap-2">
          {productos.map((item, posicion) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndice(posicion)}
              aria-label={`Ver ${item.nombre}`}
              aria-current={posicion === indiceSeguro}
              className={`h-2.5 w-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
                posicion === indiceSeguro ? 'bg-rosa' : 'bg-linea'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={irASiguiente}
          aria-label="Producto siguiente"
          className="rounded-full p-2 text-tinta hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// --- Sección 2: barra de beneficios --------------------------------------

const BENEFICIOS = [
  { titulo: 'Envío nacional', descripcion: 'A toda Colombia' },
  { titulo: 'Cabello humano', descripcion: '100% remy' },
  { titulo: 'Cambios en 5 días', descripcion: 'Sin complicaciones' },
  { titulo: 'Asesoría por WhatsApp', descripcion: 'Antes de comprar' },
];

function BarraBeneficios() {
  return (
    <section className="bg-arena py-8">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 sm:px-6 lg:grid-cols-4">
        {BENEFICIOS.map((beneficio) => (
          <div key={beneficio.titulo} className="text-center">
            <p className="font-serif text-sm text-tinta sm:text-base">{beneficio.titulo}</p>
            <p className="text-xs text-texto-secundario sm:text-sm">{beneficio.descripcion}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Sección 3: lo más pedido este mes -----------------------------------

function SeccionMasPedido({ productos, cargando }: { productos: Producto[]; cargando: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <h2 className="font-serif text-2xl text-tinta">Lo más pedido este mes</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {cargando
          ? Array.from({ length: CANTIDAD_DESTACADOS }).map((_, indice) => (
              <div key={indice} className="flex flex-col gap-3">
                <EsqueletoCarga alto="aspect-[3/4] h-auto" redondeado="rounded-2xl" />
                <EsqueletoCarga ancho="w-3/4" alto="h-4" />
                <EsqueletoCarga ancho="w-1/2" alto="h-4" />
              </div>
            ))
          : productos.map((producto) => <TarjetaProducto key={producto.id} producto={producto} />)}
      </div>
    </section>
  );
}

// --- Sección 4: descuentos activos ---------------------------------------

function SeccionDescuentos({
  cuponPorcentaje,
  cuponMontoMinimo,
  cargando,
}: {
  cuponPorcentaje: Cupon | null;
  cuponMontoMinimo: Cupon | null;
  cargando: boolean;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <h2 className="font-serif text-2xl text-tinta">Descuentos activos</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {cargando ? (
          <>
            <EsqueletoCarga alto="h-40" redondeado="rounded-2xl" />
            <EsqueletoCarga alto="h-40" redondeado="rounded-2xl" />
          </>
        ) : (
          <>
            {cuponPorcentaje ? (
              <BloqueDescuento
                fondo="bg-rosa-palo"
                titulo="En tu primera compra"
                descripcion={`${cuponPorcentaje.valor}% de descuento con el código`}
                cupon={cuponPorcentaje}
              />
            ) : null}
            {cuponMontoMinimo ? (
              <BloqueDescuento
                fondo="bg-arena"
                titulo="Compras grandes"
                descripcion={`${cuponMontoMinimo.valor}% de descuento en pedidos desde ${formatearPesos(cuponMontoMinimo.montoMinimo)}`}
                cupon={cuponMontoMinimo}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function BloqueDescuento({
  fondo,
  titulo,
  descripcion,
  cupon,
}: {
  fondo: string;
  titulo: string;
  descripcion: string;
  cupon: Cupon;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(cupon.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin acceso al portapapeles: el código sigue visible para copiarlo a mano.
    }
  }

  return (
    <div className={`flex flex-col gap-3 rounded-2xl p-8 ${fondo}`}>
      <h3 className="font-serif text-xl text-tinta">{titulo}</h3>
      <p className="text-tinta/80">{descripcion}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-hueso px-4 py-1.5 font-mono text-sm text-tinta">
          {cupon.codigo}
        </span>
        <Boton type="button" variante="tinta" onClick={() => void copiarCodigo()}>
          {copiado ? '¡Copiado!' : 'Copiar código'}
        </Boton>
      </div>
    </div>
  );
}

// --- Sección 5: categorías -------------------------------------------------

function SeccionCategorias({
  categorias,
  cargando,
}: {
  categorias: Categoria[];
  cargando: boolean;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <h2 className="font-serif text-2xl text-tinta">Categorías</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {cargando
          ? Array.from({ length: 4 }).map((_, indice) => (
              <EsqueletoCarga key={indice} alto="aspect-square h-auto" redondeado="rounded-2xl" />
            ))
          : categorias.map((categoria) => (
              <Link
                key={categoria.id}
                to={`/catalogo?categoria=${categoria.slug}`}
                className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-rosa-palo text-center transition-colors hover:bg-rosa hover:text-hueso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa focus-visible:ring-offset-2"
              >
                <span className="font-serif text-lg text-tinta group-hover:text-hueso">
                  {categoria.nombre}
                </span>
              </Link>
            ))}
      </div>
    </section>
  );
}
