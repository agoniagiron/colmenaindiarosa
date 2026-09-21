import { prisma } from './prisma.js';

// Siempre se recorre usuarioAdminRol -> rolPermiso: sin atajos por
// es_sistema. El Superadministrador tiene las 29 filas asignadas en
// rol_permiso, así que en la práctica no cambia nada, pero un permiso
// nuevo que se agregue mañana no lo tiene nadie hasta que se le asigne
// explícitamente a un rol.
async function consultarPermisosEfectivos(usuarioAdminId: string): Promise<Set<string>> {
  const asignaciones = await prisma.usuarioAdminRol.findMany({
    where: { usuarioAdminId },
    select: {
      rol: {
        select: {
          permisos: { select: { permiso: { select: { clave: true } } } },
        },
      },
    },
  });

  const claves = new Set<string>();
  for (const asignacion of asignaciones) {
    for (const rolPermiso of asignacion.rol.permisos) {
      claves.add(rolPermiso.permiso.clave);
    }
  }
  return claves;
}

// Caché en memoria con TTL corto: el join usuarioAdminRol -> rolPermiso ->
// permiso no cambia seguido, así que no hace falta recorrerlo en cada
// request. 15 segundos porque es la ventana máxima que alguien sigue
// operando con un permiso ya revocado — más que eso (por ejemplo el
// minuto que se había considerado primero) es demasiado tiempo con un
// permiso viejo todavía vigente. Lo que NUNCA se cachea es `activo`:
// requiereAuthAdmin lo consulta fresco en cada request, así que un admin
// desactivado se corta al instante aunque su caché de permisos no haya
// vencido.
const TTL_CACHE_MS = 15 * 1000;
const cachePermisos = new Map<string, { permisos: Set<string>; expiraEn: number }>();

export async function obtenerPermisosEfectivos(usuarioAdminId: string): Promise<Set<string>> {
  const entrada = cachePermisos.get(usuarioAdminId);
  if (entrada && entrada.expiraEn > Date.now()) {
    return entrada.permisos;
  }

  const permisos = await consultarPermisosEfectivos(usuarioAdminId);
  cachePermisos.set(usuarioAdminId, { permisos, expiraEn: Date.now() + TTL_CACHE_MS });
  return permisos;
}
