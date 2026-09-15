import { Link, NavLink, Outlet } from 'react-router-dom';

const ENLACES_ADMIN = [
  { etiqueta: 'Inicio', to: '/admin', fin: true },
  { etiqueta: 'Inventario', to: '/admin/inventario', fin: false },
  { etiqueta: 'Abastecimiento', to: '/admin/abastecimiento', fin: false },
  { etiqueta: 'Proveedores', to: '/admin/proveedores', fin: false },
  { etiqueta: 'Pedidos', to: '/admin/pedidos', fin: false },
  { etiqueta: 'Reportes', to: '/admin/reportes', fin: false },
];

function claseEnlaceAdmin({ isActive }: { isActive: boolean }) {
  return `block shrink-0 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
    isActive ? 'bg-rosa text-hueso' : 'text-hueso/80 hover:bg-hueso/10'
  }`;
}

export function LayoutAdmin() {
  return (
    <div className="flex min-h-screen flex-col bg-hueso text-tinta sm:flex-row">
      <aside className="shrink-0 bg-tinta px-4 py-4 sm:w-60 sm:py-6">
        <Link
          to="/"
          className="block rounded-md px-2 font-serif text-xl text-hueso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa"
        >
          India <em className="italic text-rosa">Rosa</em>
        </Link>
        <nav
          aria-label="Administración"
          className="mt-4 flex gap-1 overflow-x-auto sm:mt-8 sm:flex-col sm:overflow-visible"
        >
          {ENLACES_ADMIN.map((enlace) => (
            <NavLink key={enlace.to} to={enlace.to} end={enlace.fin} className={claseEnlaceAdmin}>
              {enlace.etiqueta}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 px-4 py-6 sm:px-10 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
