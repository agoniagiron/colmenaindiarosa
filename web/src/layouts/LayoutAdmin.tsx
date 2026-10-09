import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { useSesionAdmin } from '../contexto/ContextoSesionAdmin.tsx';
import { useNoIndex } from '../utilidades/useNoIndex.ts';

// `permiso: undefined` = siempre visible para cualquier admin autenticado.
// `construido: false` = todavía no tiene una página real detrás (aunque
// exista una ruta): se muestra igual, pero deshabilitada con una marca de
// "pronto" — nunca oculta. El filtro por permiso sigue mandando por
// encima: sin el permiso, ni siquiera se ve deshabilitada.
interface EnlaceAdmin {
  etiqueta: string;
  to: string;
  fin: boolean;
  permiso?: string;
  construido?: boolean;
}

interface GrupoAdmin {
  titulo?: string;
  enlaces: EnlaceAdmin[];
}

const GRUPOS_ADMIN: GrupoAdmin[] = [
  {
    enlaces: [
      {
        etiqueta: 'Analítica',
        to: '/admin/analitica',
        fin: false,
        permiso: 'reportes.ver',
        construido: true,
      },
      {
        etiqueta: 'Pedidos',
        to: '/admin/pedidos',
        fin: false,
        permiso: 'pedidos.ver',
        construido: true,
      },
    ],
  },
  {
    titulo: 'Catálogo',
    enlaces: [
      {
        etiqueta: 'Productos',
        to: '/admin/productos',
        fin: false,
        permiso: 'productos.ver',
        construido: true,
      },
      {
        etiqueta: 'Promociones',
        to: '/admin/promociones',
        fin: false,
        permiso: 'promociones.ver',
        construido: true,
      },
      {
        etiqueta: 'Kits',
        to: '/admin/kits',
        fin: false,
        permiso: 'combos.ver',
        construido: true,
      },
      { etiqueta: 'Limitadas', to: '/admin/limitadas', fin: false, permiso: 'limitadas.gestionar' },
    ],
  },
  {
    titulo: 'Operación',
    enlaces: [
      { etiqueta: 'Inventario', to: '/admin/inventario', fin: false, permiso: 'inventario.ver' },
      {
        etiqueta: 'Abastecimiento',
        to: '/admin/abastecimiento',
        fin: false,
        permiso: 'abastecimiento.ver',
      },
      { etiqueta: 'Proveedores', to: '/admin/proveedores', fin: false, permiso: 'proveedores.ver' },
    ],
  },
  {
    titulo: 'Sistema',
    enlaces: [
      {
        etiqueta: 'Configuración',
        to: '/admin/configuracion',
        fin: false,
        permiso: 'configuracion.ver',
      },
      { etiqueta: 'Usuarios', to: '/admin/usuarios', fin: false, permiso: 'usuarios.ver' },
    ],
  },
];

function claseEnlaceAdmin({ isActive }: { isActive: boolean }) {
  return `block shrink-0 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa ${
    isActive ? 'bg-rosa text-hueso' : 'text-hueso/80 hover:bg-hueso/10'
  }`;
}

export function LayoutAdmin() {
  useNoIndex();
  const { usuarioAdmin, restaurando } = useSesionAdmin();

  if (restaurando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hueso text-sm text-texto-secundario">
        Cargando…
      </div>
    );
  }

  if (!usuarioAdmin) {
    return <Navigate to="/" replace />;
  }

  const permisos = usuarioAdmin.permisos;

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
          {GRUPOS_ADMIN.map((grupo, indice) => {
            const enlacesVisibles = grupo.enlaces.filter(
              (enlace) => !enlace.permiso || permisos.includes(enlace.permiso),
            );
            if (enlacesVisibles.length === 0) return null;

            return (
              <div key={grupo.titulo ?? `grupo-${indice}`} className="contents sm:block">
                {grupo.titulo ? (
                  <p className="hidden px-4 pt-4 pb-1 text-[10.5px] tracking-[0.14em] text-hueso/40 uppercase sm:block">
                    {grupo.titulo}
                  </p>
                ) : null}
                {enlacesVisibles.map((enlace) =>
                  enlace.construido ? (
                    <NavLink
                      key={enlace.to}
                      to={enlace.to}
                      end={enlace.fin}
                      className={claseEnlaceAdmin}
                    >
                      {enlace.etiqueta}
                    </NavLink>
                  ) : (
                    <span
                      key={enlace.to}
                      aria-disabled="true"
                      title="Todavía no está construida"
                      className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm whitespace-nowrap text-hueso/35"
                    >
                      {enlace.etiqueta}
                      <span className="rounded-full bg-hueso/10 px-2 py-0.5 text-[10px] tracking-wide text-hueso/50 uppercase">
                        Pronto
                      </span>
                    </span>
                  ),
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 px-4 py-6 sm:px-10 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
