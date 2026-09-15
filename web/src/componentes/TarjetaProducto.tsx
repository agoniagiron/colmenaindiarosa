import { Link } from 'react-router-dom';
import { Estrellas } from './Estrellas.tsx';
import { ImagenProducto } from './ImagenProducto.tsx';
import { formatearPesos } from '../utilidades/formatearPesos.ts';
import type { Producto } from '../tipos/index.ts';

interface TarjetaProductoProps {
  producto: Producto;
}

export function TarjetaProducto({ producto }: TarjetaProductoProps) {
  const precioDesde = Math.min(...producto.variantes.map((variante) => variante.precio));
  const agotado = producto.variantes.every(
    (variante) => variante.stockActual - variante.stockReservado <= 0,
  );
  const colorPrincipal = producto.variantes.find((variante) => variante.color)?.color?.hex;

  return (
    <Link
      to={`/producto/${producto.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-linea bg-white transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa focus-visible:ring-offset-2"
    >
      <div className="relative overflow-hidden bg-arena">
        <div className="transition-transform group-hover:scale-105">
          <ImagenProducto nombre={producto.nombre} colorHex={colorPrincipal} />
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
          <span className="text-lg font-semibold text-tinta">{formatearPesos(precioDesde)}</span>
          {producto.precioAntes ? (
            <span className="text-sm text-texto-secundario line-through">
              {formatearPesos(producto.precioAntes)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
