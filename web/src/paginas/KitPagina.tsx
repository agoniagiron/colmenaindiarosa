import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Boton } from '../componentes/Boton.tsx';
import { Contenedor } from '../componentes/Contenedor.tsx';
import { EsqueletoCarga } from '../componentes/EsqueletoCarga.tsx';
import { EstadoVacio } from '../componentes/EstadoVacio.tsx';
import { ImagenProducto } from '../componentes/ImagenProducto.tsx';
import { useCarrito } from '../contexto/ContextoCarrito.tsx';
import { useConfiguracion } from '../contexto/ContextoConfiguracion.tsx';
import { repositorio } from '../datos/index.ts';
import type { ComboDetalle, PiezaKit } from '../tipos/index.ts';
import { useAccionAsincrona } from '../utilidades/useAccionAsincrona.ts';

export function KitPagina() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { agregarCombo } = useCarrito();
  const { formatearDual } = useConfiguracion();

  const [combo, setCombo] = useState<ComboDetalle | null | undefined>(undefined);

  const { cargando: agregando, ejecutar: ejecutarAgregar } = useAccionAsincrona(
    async () => {
      if (!combo) return;
      await agregarCombo(combo.id, 1);
    },
    { mensajeExito: 'Agregado al carrito' },
  );

  useEffect(() => {
    let vigente = true;
    setCombo(undefined);

    if (!slug) {
      setCombo(null);
      return;
    }

    repositorio.obtenerCombo(slug).then((encontrado) => {
      if (vigente) setCombo(encontrado);
    });

    return () => {
      vigente = false;
    };
  }, [slug]);

  async function alAgregar() {
    if (!combo?.comprable) return;
    try {
      await ejecutarAgregar();
    } catch {
      // El hook ya mostró el aviso de error.
    }
  }

  if (combo === undefined) {
    return (
      <Contenedor ancho="normal" className="py-10">
        <EsqueletoDetalleKit />
      </Contenedor>
    );
  }

  if (combo === null) {
    return (
      <Contenedor ancho="normal" className="py-16">
        <EstadoVacio
          titulo="Kit no encontrado"
          descripcion="Puede que el enlace esté mal escrito o que este kit ya no esté disponible."
          accion={
            <Boton type="button" variante="rosa" onClick={() => navigate('/')}>
              Volver al inicio
            </Boton>
          }
        />
      </Contenedor>
    );
  }

  const ahorroPorcentaje =
    combo.precioPiezasPorSeparado.cop > 0
      ? Math.round((1 - combo.precio.cop / combo.precioPiezasPorSeparado.cop) * 100)
      : 0;

  return (
    <Contenedor ancho="normal" className="py-10">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <GaleriaKit nombre={combo.nombre} imagenes={combo.imagenes} />

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-serif text-2xl text-tinta sm:text-3xl">{combo.nombre}</h1>
            {combo.descripcion ? (
              <p className="mt-2 text-sm text-texto-secundario">{combo.descripcion}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-semibold text-tinta">
                {formatearDual(combo.precio)}
              </span>
              <span className="text-lg text-texto-secundario line-through">
                {formatearDual(combo.precioPiezasPorSeparado)}
              </span>
              {ahorroPorcentaje > 0 ? (
                <span className="rounded-full bg-rosa px-2 py-0.5 text-sm font-medium text-hueso">
                  Ahorras {ahorroPorcentaje}%
                </span>
              ) : null}
            </div>
            {/* El ahorro es el argumento de venta del kit: no alcanza con el
                tachado, se lo nombra en texto para que no dependa de que la
                clienta haga la resta sola. */}
            {ahorroPorcentaje > 0 ? (
              <p className="text-sm text-texto-secundario">
                Comprando las piezas por separado pagarías{' '}
                {formatearDual(combo.precioPiezasPorSeparado)}.
              </p>
            ) : null}
          </div>

          <SeccionPiezas piezas={combo.piezas} />

          {!combo.comprable ? (
            <p className="rounded-lg bg-rosa-palo px-3.5 py-2.5 text-sm text-tinta">
              Este kit no está disponible en este momento.
            </p>
          ) : null}

          <Boton
            type="button"
            variante="rosa"
            disabled={!combo.comprable}
            cargando={agregando}
            onClick={() => void alAgregar()}
            className="w-full"
          >
            {combo.comprable ? 'Agregar al carrito' : 'No disponible'}
          </Boton>
        </div>
      </div>
    </Contenedor>
  );
}

// --- Galería (miniaturas + imagen principal, mismo lenguaje que ProductoDetalle) ---

function GaleriaKit({
  nombre,
  imagenes,
}: {
  nombre: string;
  imagenes: { url: string; altTexto: string }[];
}) {
  const [indiceActivo, setIndiceActivo] = useState(0);
  const indiceSeguro = imagenes.length > 0 ? Math.min(indiceActivo, imagenes.length - 1) : 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {imagenes.length > 1 ? (
        <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:w-20 sm:flex-col sm:overflow-visible">
          {imagenes.map((imagen, indice) => (
            <button
              key={imagen.url}
              type="button"
              onClick={() => setIndiceActivo(indice)}
              aria-label={`Ver imagen ${indice + 1} de ${nombre}`}
              aria-current={indice === indiceSeguro}
              className={`w-16 shrink-0 overflow-hidden rounded-lg border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
                indice === indiceSeguro ? 'border-rosa' : 'border-transparent'
              }`}
            >
              <ImagenProducto nombre={nombre} url={imagen.url} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="order-1 flex-1 sm:order-2">
        <ImagenProducto nombre={nombre} url={imagenes[indiceSeguro]?.url} />
      </div>
    </div>
  );
}

// --- Piezas del kit -----------------------------------------------------------

function SeccionPiezas({ piezas }: { piezas: PiezaKit[] }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-tinta">Este kit incluye</h2>
      <ul className="mt-2 flex flex-col divide-y divide-linea">
        {piezas.map((pieza) => (
          <li key={pieza.varianteId}>
            <FilaPieza pieza={pieza} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilaPieza({ pieza }: { pieza: PiezaKit }) {
  const contenido = (
    <>
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
        <ImagenProducto nombre={pieza.nombreProducto} url={pieza.imagen?.url} carga="lazy" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-tinta">
          {pieza.cantidad > 1 ? `${pieza.cantidad} × ` : ''}
          {pieza.nombreProducto}
        </p>
      </div>
    </>
  );

  if (pieza.productoSlug) {
    return (
      <Link
        to={`/producto/${pieza.productoSlug}`}
        className="flex items-center gap-3 rounded-lg py-2 transition-colors hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
      >
        {contenido}
      </Link>
    );
  }

  // Sin productoSlug: la pieza no tiene ficha pública propia (solo_kits,
  // archivada o inactiva) — se muestra, pero nunca enlaza a un 404.
  return <div className="flex items-center gap-3 py-2">{contenido}</div>;
}

// --- Esqueleto de carga -----------------------------------------------------

function EsqueletoDetalleKit() {
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
        <EsqueletoCarga ancho="w-1/2" alto="h-10" />
        <EsqueletoCarga alto="h-24" />
        <EsqueletoCarga alto="h-12" />
      </div>
    </div>
  );
}
