import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { CampoTexto } from '../componentes/CampoTexto.tsx';
import { useCarrito } from '../contexto/ContextoCarrito.tsx';
import { useSesion } from '../contexto/ContextoSesion.tsx';
import { UMBRAL_ENVIO_GRATIS } from '../dominio/calcularTotales.ts';
import { formatearPesos } from '../utilidades/formatearPesos.ts';

const ENLACES_NAV = [
  { etiqueta: 'Inicio', to: '/' },
  { etiqueta: 'Catálogo', to: '/catalogo' },
];

const CATEGORIAS_PIE = ['Pelucas', 'Cuidado', 'Extensiones', 'Accesorios'];

function claseEnlaceNav({ isActive }: { isActive: boolean }) {
  return `rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
    isActive ? 'bg-rosa-palo text-tinta' : 'text-tinta hover:bg-arena'
  }`;
}

export function LayoutTienda() {
  const { lineas } = useCarrito();
  const { usuario } = useSesion();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');

  const totalUnidades = lineas.reduce((acumulado, linea) => acumulado + linea.cantidad, 0);

  function alEnviarBusqueda(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    navigate('/catalogo');
  }

  return (
    <div className="flex min-h-screen flex-col bg-hueso text-tinta">
      <div className="bg-tinta px-4 py-2 text-center text-sm text-hueso">
        Envío gratis en pedidos desde {formatearPesos(UMBRAL_ENVIO_GRATIS)}
      </div>

      <header className="border-b border-linea bg-hueso">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="rounded-md font-serif text-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            India <em className="italic text-rosa">Rosa</em>
          </Link>

          <nav aria-label="Principal" className="flex items-center gap-1">
            {ENLACES_NAV.map((enlace) => (
              <NavLink
                key={enlace.to}
                to={enlace.to}
                end={enlace.to === '/'}
                className={claseEnlaceNav}
              >
                {enlace.etiqueta}
              </NavLink>
            ))}
          </nav>

          <form
            role="search"
            onSubmit={alEnviarBusqueda}
            className="order-last w-full sm:order-none sm:ml-auto sm:w-64"
          >
            <CampoTexto
              etiqueta="Buscar productos"
              ocultarEtiqueta
              type="search"
              placeholder="Buscar productos"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
            />
          </form>

          <Link
            to="/cuenta"
            className="rounded-full px-3 py-1.5 text-sm font-medium hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            {usuario ? usuario.nombre : 'Mi cuenta'}
          </Link>

          <Link
            to="/carrito"
            aria-label={`Carrito, ${totalUnidades} ${totalUnidades === 1 ? 'producto' : 'productos'}`}
            className="relative rounded-full p-2 hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6"
              />
              <circle cx="9" cy="20" r="1.4" />
              <circle cx="17" cy="20" r="1.4" />
            </svg>
            {totalUnidades > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rosa px-1 text-xs font-semibold text-hueso">
                {totalUnidades}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-linea bg-arena/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div>
            <p className="font-serif text-xl">
              India <em className="italic text-rosa">Rosa</em>
            </p>
            <p className="mt-2 text-sm text-texto-secundario">
              Pelucas, extensiones y cuidado capilar para mujeres en Colombia.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold tracking-wide text-texto-secundario uppercase">
              Ayuda
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>Envíos</li>
              <li>Cambios y devoluciones</li>
              <li>Preguntas frecuentes</li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold tracking-wide text-texto-secundario uppercase">
              Categorías
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {CATEGORIAS_PIE.map((categoria) => (
                <li key={categoria}>
                  <Link
                    to="/catalogo"
                    className="rounded-md hover:text-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
                  >
                    {categoria}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold tracking-wide text-texto-secundario uppercase">
              Contacto
            </h2>
            <p className="mt-3 text-sm text-texto-secundario">
              Coordinamos disponibilidad y forma de pago por WhatsApp.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
