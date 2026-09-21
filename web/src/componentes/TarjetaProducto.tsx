import { Link } from 'react-router-dom';
import { Estrellas } from './Estrellas.tsx';
import { ImagenProducto } from './ImagenProducto.tsx';
import { useConfiguracion } from '../contexto/ContextoConfiguracion.tsx';
import type { Producto } from '../tipos/index.ts';

interface TarjetaProductoProps {
  producto: Producto;
}

export function TarjetaProducto({ producto }: TarjetaProductoProps) {
  const { formatearDual } = useConfiguracion();

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

  return (
    <Link
      to={`/producto/${producto.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-linea bg-white transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa focus-visible:ring-offset-2"
    >
      <div className="relative overflow-hidden bg-arena">
        <div className="transition-transform group-hover:scale-105">
          <ImagenProducto
            nombre={producto.nombre}
            colorHex={colorPrincipal}
            url={imagenPrincipal?.url}
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
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-serif text-base text-tinta">{producto.nombre}</h3>
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
  );
}
