import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { CampoTexto } from '../componentes/CampoTexto.tsx';
import { useCarrito } from '../contexto/ContextoCarrito.tsx';
import { useConfiguracion } from '../contexto/ContextoConfiguracion.tsx';
import { useSesion } from '../contexto/ContextoSesion.tsx';

const ENLACES_NAV = [
  { etiqueta: 'Inicio', to: '/' },
  { etiqueta: 'Catálogo', to: '/catalogo' },
];

const CATEGORIAS_PIE = ['Pelucas', 'Cuidado', 'Extensiones', 'Accesorios'];

function claseEnlaceNav({ isActive }: { isActive: boolean }) {
  return `border-b pb-0.5 text-xs tracking-[0.17em] uppercase transition-colors ${
    isActive ? 'border-rosa text-tinta' : 'border-transparent text-tinta hover:border-rosa'
  }`;
}

export function LayoutTienda() {
  const { lineas } = useCarrito();
  const { usuario } = useSesion();
  const { obtenerTexto, mostrarSelectorMoneda, moneda, setMoneda } = useConfiguracion();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');

  const totalUnidades = lineas.reduce((acumulado, linea) => acumulado + linea.cantidad, 0);
  const avisoSuperior = obtenerTexto('tienda.aviso_superior');

  function alEnviarBusqueda(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    navigate('/catalogo');
  }

  return (
    <div className="flex min-h-screen flex-col bg-hueso text-tinta">
      {avisoSuperior ? (
        <div className="bg-negro px-4 py-2.5 text-center text-xs tracking-[0.12em] text-hueso/90 uppercase">
          {avisoSuperior}
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-linea bg-hueso">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="rounded-md font-serif text-lg tracking-[0.09em] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            India Rosa
          </Link>

          <nav aria-label="Principal" className="flex items-center gap-6">
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
            className="order-last w-full sm:order-none sm:ml-auto sm:w-56"
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

          <div className="flex items-center gap-3">
            {mostrarSelectorMoneda ? (
              <div
                role="group"
                aria-label="Moneda"
                className="flex overflow-hidden rounded-full border border-linea"
              >
                {(['COP', 'USD'] as const).map((opcion) => (
                  <button
                    key={opcion}
                    type="button"
                    aria-pressed={moneda === opcion}
                    onClick={() => setMoneda(opcion)}
                    className={`px-3 py-1.5 text-[11px] tracking-[0.1em] transition-colors ${
                      moneda === opcion
                        ? 'bg-negro text-hueso'
                        : 'text-texto-secundario hover:text-tinta'
                    }`}
                  >
                    {opcion}
                  </button>
                ))}
              </div>
            ) : null}

            <Link
              to="/cuenta"
              className="rounded-full px-3 py-1.5 text-xs tracking-[0.1em] uppercase hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
            >
              {usuario ? usuario.nombre : 'Cuenta'}
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
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-linea bg-arena">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div>
            <p className="font-serif text-lg">India Rosa</p>
            <p className="mt-2 max-w-[32ch] text-sm text-texto-secundario">
              Pelucas, extensiones y cuidado del cabello. Cali, Valle del Cauca.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-base">Tienda</h2>
            <ul className="mt-3 space-y-2 text-sm text-texto-secundario">
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
            <h2 className="font-serif text-base">Ayuda</h2>
            <ul className="mt-3 space-y-2 text-sm text-texto-secundario">
              <li>Guía de tallas</li>
              <li>Envíos</li>
              <li>Cambios y devoluciones</li>
              <li>Cuidados</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-base">Escríbenos</h2>
            <p className="mt-3 text-sm text-texto-secundario">
              Coordinamos disponibilidad y forma de pago por WhatsApp.
            </p>
          </div>
        </div>

        <div className="border-t border-linea px-4 py-5 text-center text-xs text-texto-secundario sm:px-6">
          © {new Date().getFullYear()} India Rosa
        </div>
      </footer>
    </div>
  );
}
