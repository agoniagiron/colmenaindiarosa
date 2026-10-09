import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { CampoTexto } from '../componentes/CampoTexto.tsx';
import { Contenedor } from '../componentes/Contenedor.tsx';
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
  // Solo celular (ver abajo): el buscador no vive como campo permanente,
  // se despliega al tocar la lupa; el menú con lo que en escritorio es la
  // fila completa (nav, moneda, cuenta) se despliega con la hamburguesa.
  // Mutuamente excluyentes a propósito — no tiene sentido tener los dos
  // abiertos a la vez en una pantalla angosta.
  const [busquedaMovilAbierta, setBusquedaMovilAbierta] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const inputBusquedaMovilRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (busquedaMovilAbierta) inputBusquedaMovilRef.current?.focus();
  }, [busquedaMovilAbierta]);

  const totalUnidades = lineas.reduce((acumulado, linea) => acumulado + linea.cantidad, 0);
  const avisoSuperior = obtenerTexto('tienda.aviso_superior');

  function alEnviarBusqueda(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    navigate('/catalogo');
    setBusquedaMovilAbierta(false);
  }

  function alternarBusquedaMovil() {
    setBusquedaMovilAbierta((actual) => !actual);
    setMenuMovilAbierto(false);
  }

  function alternarMenuMovil() {
    setMenuMovilAbierto((actual) => !actual);
    setBusquedaMovilAbierta(false);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-hueso text-tinta">
      {avisoSuperior ? (
        <div className="bg-negro px-4 py-2.5 text-center text-xs tracking-[0.12em] text-hueso/90 uppercase">
          {avisoSuperior}
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-linea bg-hueso">
        {/* Debajo de lg (tablets y celulares acostados incluidos): una
            sola fila de 64px. El buscador y todo lo demás que no entra
            (nav, moneda, cuenta) se despliegan debajo al tocar sus
            íconos — ver los dos bloques condicionales después de esta
            fila. Desde lg: la fila de siempre, sin tocar. */}
        <div className="flex h-16 items-center justify-between px-4 lg:hidden">
          <Link
            to="/"
            className="rounded-md font-serif text-lg tracking-[0.09em] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
          >
            India Rosa
          </Link>

          <div className="flex items-center">
            <button
              type="button"
              aria-label="Buscar"
              aria-expanded={busquedaMovilAbierta}
              onClick={alternarBusquedaMovil}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
            >
              <IconoLupa />
            </button>

            <Link
              to="/carrito"
              aria-label={`Carrito, ${totalUnidades} ${totalUnidades === 1 ? 'producto' : 'productos'}`}
              className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
            >
              <IconoCarrito />
              {totalUnidades > 0 ? (
                <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rosa px-1 text-xs font-semibold text-hueso">
                  {totalUnidades}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              aria-label={menuMovilAbierto ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuMovilAbierto}
              onClick={alternarMenuMovil}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
            >
              <IconoHamburguesa abierto={menuMovilAbierto} />
            </button>
          </div>
        </div>

        {busquedaMovilAbierta ? (
          <form
            role="search"
            onSubmit={alEnviarBusqueda}
            className="border-t border-linea px-4 py-3 lg:hidden"
          >
            <label htmlFor="buscar-movil" className="sr-only">
              Buscar productos
            </label>
            <input
              ref={inputBusquedaMovilRef}
              id="buscar-movil"
              type="search"
              placeholder="Buscar productos"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              className="h-11 w-full rounded-xl border border-linea bg-white px-3 text-sm text-tinta placeholder:text-texto-secundario focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
            />
          </form>
        ) : null}

        {menuMovilAbierto ? (
          <div className="border-t border-linea px-4 py-3 lg:hidden">
            <nav aria-label="Principal">
              <ul className="flex flex-col gap-1">
                {ENLACES_NAV.map((enlace) => (
                  <li key={enlace.to}>
                    <NavLink
                      to={enlace.to}
                      end={enlace.to === '/'}
                      onClick={() => setMenuMovilAbierto(false)}
                      className={({ isActive }) =>
                        `flex min-h-11 items-center rounded-md px-3 text-sm tracking-[0.1em] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
                          isActive ? 'bg-arena text-tinta' : 'text-tinta hover:bg-arena'
                        }`
                      }
                    >
                      {enlace.etiqueta}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            {mostrarSelectorMoneda ? (
              <div
                role="group"
                aria-label="Moneda"
                className="mt-3 flex w-fit overflow-hidden rounded-full border border-linea"
              >
                {(['COP', 'USD'] as const).map((opcion) => (
                  <button
                    key={opcion}
                    type="button"
                    aria-pressed={moneda === opcion}
                    onClick={() => setMoneda(opcion)}
                    className={`min-h-11 px-4 text-[11px] tracking-[0.1em] transition-colors ${
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
              onClick={() => setMenuMovilAbierto(false)}
              className="mt-3 flex min-h-11 items-center rounded-md px-3 text-sm tracking-[0.1em] uppercase hover:bg-arena focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
            >
              {usuario ? usuario.nombre : 'Cuenta'}
            </Link>
          </div>
        ) : null}

        {/* Desde lg: exactamente la fila de siempre, sin cambios. */}
        <Contenedor className="hidden flex-wrap items-center gap-6 py-4 lg:flex">
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

          <form role="search" onSubmit={alEnviarBusqueda} className="ml-auto w-56">
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
              <IconoCarrito className="h-6 w-6" />
              {totalUnidades > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rosa px-1 text-xs font-semibold text-hueso">
                  {totalUnidades}
                </span>
              ) : null}
            </Link>
          </div>
        </Contenedor>
      </header>

      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>

      <footer className="border-t border-linea bg-arena">
        <Contenedor className="grid gap-8 py-14 sm:grid-cols-2 lg:grid-cols-4">
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
        </Contenedor>

        <div className="border-t border-linea px-4 py-5 text-center text-xs text-texto-secundario sm:px-6">
          © {new Date().getFullYear()} India Rosa
        </div>
      </footer>
    </div>
  );
}

function IconoLupa() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function IconoCarrito({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
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
  );
}

function IconoHamburguesa({ abierto }: { abierto: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      {abierto ? (
        <path d="M5 5l14 14M19 5L5 19" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}
