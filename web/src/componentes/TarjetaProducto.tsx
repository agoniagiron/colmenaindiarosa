import { Link } from 'react-router-dom';
import { Boton } from './Boton.tsx';
import { Estrellas } from './Estrellas.tsx';
import { ImagenProducto } from './ImagenProducto.tsx';
import { useCarrito } from '../contexto/ContextoCarrito.tsx';
import { useConfiguracion } from '../contexto/ContextoConfiguracion.tsx';
import type { Producto } from '../tipos/index.ts';
import { useAccionAsincrona } from '../utilidades/useAccionAsincrona.ts';

interface TarjetaProductoProps {
  producto: Producto;
}

export function TarjetaProducto({ producto }: TarjetaProductoProps) {
  const { formatearDual } = useConfiguracion();
  const { agregar } = useCarrito();

  // El "desde" con descuento ya lo trae el backend (producto.precioBase);
  // el "antes" tachado se arma acá comparando contra la variante más
  // barata, la misma que decide precioBase.
  const varianteMasBarata = producto.variantes.reduce<Producto['variantes'][number] | null>(
    (mejor, variante) =>
      !mejor || variante.precioConDescuento.cop < mejor.precioConDescuento.cop ? variante : mejor,
    null,
  );
  const hayDescuento =
    varianteMasBarata &&
    varianteMasBarata.precioOriginal.cop > varianteMasBarata.precioConDescuento.cop;
  const agotado = producto.variantes.every(
    (variante) => variante.stockActual - variante.stockReservado <= 0,
  );
  const colorPrincipal = producto.variantes.find((variante) => variante.color)?.color?.hex;
  // La primera es la principal (mismo orden que ya trae el backend, por
  // orden asc — ver catalogo/servicio.ts).
  const imagenPrincipal = producto.imagenes[0];

  // El botón "Agregar al carrito" agrega la variante más barata (la misma
  // que decide el precio mostrado), sin pasar por la ficha de producto —
  // para eso está el botón, para no obligar a entrar a elegir variante
  // cuando el producto solo tiene una o la clienta no necesita elegir.
  const { cargando: agregando, ejecutar: ejecutarAgregar } = useAccionAsincrona(
    async () => {
      if (!varianteMasBarata) return;
      await agregar(varianteMasBarata.id, 1);
    },
    { mensajeExito: 'Agregado al carrito' },
  );

  async function alAgregar() {
    try {
      await ejecutarAgregar();
    } catch {
      // El hook ya mostró el aviso de error.
    }
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-linea bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link
        to={`/producto/${producto.slug}`}
        className="flex flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa focus-visible:ring-offset-2"
      >
        <div className="relative mx-3 mt-3 overflow-hidden rounded-lg bg-arena">
          <div className="transition-transform group-hover:scale-105">
            <ImagenProducto
              nombre={producto.nombre}
              colorHex={colorPrincipal}
              url={imagenPrincipal?.url}
              carga="lazy"
            />
          </div>
          {producto.destacado ? (
            <span className="absolute left-3 top-3 rounded-full bg-rosa px-3 py-1 text-xs font-medium text-hueso">
              Destacado
            </span>
          ) : null}
          {agotado ? (
            <span className="absolute inset-0 flex items-center justify-center bg-tinta/40 text-sm font-medium text-hueso">
              Agotado
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="line-clamp-2 font-serif text-sm text-tinta lg:text-base">
            {producto.nombre}
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <Estrellas calificacion={producto.calificacion} />
            <span className="text-texto-secundario">({producto.cantidadResenas})</span>
          </div>
          <div className="mt-auto flex items-baseline gap-2 pt-2">
            <span className="text-lg font-semibold text-tinta">
              {formatearDual(producto.precioBase)}
            </span>
            {hayDescuento && varianteMasBarata ? (
              <span className="text-sm text-texto-secundario line-through">
                {formatearDual(varianteMasBarata.precioOriginal)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3">
        <Boton
          type="button"
          variante="rosa"
          disabled={agotado || !varianteMasBarata}
          cargando={agregando}
          onClick={() => void alAgregar()}
          className="h-12 w-full"
        >
          {agotado ? (
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
