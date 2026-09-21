import bcrypt from 'bcrypt';
import { ErrorApi } from '../../lib/errorApi.js';
import { firmarAccessTokenAdmin } from '../../lib/jwtAdmin.js';
import { obtenerPermisosEfectivos } from '../../lib/permisosAdmin.js';
import { prisma } from '../../lib/prisma.js';
import { generarTokenCrudo, hashearToken } from '../../lib/tokens.js';
import type { DatosLoginAdmin } from './esquemas.js';

const RONDAS_BCRYPT = 12;
const DURACION_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FALLOS_CONSECUTIVOS = 5;

// Mismo propósito que HASH_FICTICIO en modulos/auth/servicio.ts: que login
// tarde lo mismo con correo inválido que con contraseña inválida.
const HASH_FICTICIO = bcrypt.hashSync('correo-admin-inexistente', RONDAS_BCRYPT);

function serializarPermisos(permisos: Set<string>): string[] {
  return [...permisos].sort();
}

// idx_auditoria_usuario cubre exactamente (usuario_admin_id, creado_en):
// esto es un index scan, no un seq scan (verificado con EXPLAIN).
async function contarFallosConsecutivosRecientes(usuarioAdminId: string): Promise<number> {
  const intentos = await prisma.auditoriaAdmin.findMany({
    where: { usuarioAdminId, accion: { in: ['admin.login.exito', 'admin.login.fallido'] } },
    orderBy: { creadoEn: 'desc' },
    take: MAX_FALLOS_CONSECUTIVOS,
    select: { accion: true },
  });

  let fallos = 0;
  for (const intento of intentos) {
    if (intento.accion === 'admin.login.fallido') fallos++;
    else break;
  }
  return fallos;
}

async function registrarIntentoLogin(
  usuarioAdminId: string | null,
  exito: boolean,
  ipHash: string | null,
): Promise<void> {
  try {
    await prisma.auditoriaAdmin.create({
      data: {
        usuarioAdminId,
        accion: exito ? 'admin.login.exito' : 'admin.login.fallido',
        entidad: 'usuario_admin',
        entidadId: usuarioAdminId,
        ipHash,
      },
    });
  } catch {
    // La auditoría nunca debe tumbar el login.
  }
}

async function crearSesionAdmin(usuarioAdminId: string): Promise<string> {
  const refreshTokenCrudo = generarTokenCrudo();
  await prisma.sesionAdmin.create({
    data: {
      usuarioAdminId,
      refreshTokenHash: hashearToken(refreshTokenCrudo),
      expiraEn: new Date(Date.now() + DURACION_REFRESH_MS),
    },
  });
  return refreshTokenCrudo;
}

export async function loginAdmin(datos: DatosLoginAdmin, ipHash: string | null) {
  const usuarioAdmin = await prisma.usuarioAdmin.findUnique({ where: { correo: datos.correo } });

  // Bloqueado tras 5 fallos consecutivos: la contraseña correcta también
  // "falla" durante la ventana de bloqueo, sin ningún mensaje ni código
  // distinto al de credenciales inválidas. Así el bloqueo nunca delata
  // que el correo existe — a alguien probando por fuerza bruta le pinta
  // exactamente igual que una contraseña incorrecta más.
  const bloqueado = usuarioAdmin
    ? (await contarFallosConsecutivosRecientes(usuarioAdmin.id)) >= MAX_FALLOS_CONSECUTIVOS
    : false;

  const coincide =
    usuarioAdmin && !bloqueado
      ? await bcrypt.compare(datos.clave, usuarioAdmin.claveHash)
      : await bcrypt.compare(datos.clave, HASH_FICTICIO);

  if (!usuarioAdmin || !usuarioAdmin.activo || !coincide) {
    await registrarIntentoLogin(usuarioAdmin?.id ?? null, false, ipHash);
    throw ErrorApi.noAutenticado('Correo o contraseña incorrectos');
  }

  await registrarIntentoLogin(usuarioAdmin.id, true, ipHash);

  const accessToken = firmarAccessTokenAdmin(usuarioAdmin.id);
  const refreshTokenCrudo = await crearSesionAdmin(usuarioAdmin.id);
  const permisos = await obtenerPermisosEfectivos(usuarioAdmin.id);

  await prisma.usuarioAdmin.update({
    where: { id: usuarioAdmin.id },
    data: { ultimoAccesoEn: new Date() },
  });

  return {
    accessToken,
    refreshTokenCrudo,
    usuarioAdmin: {
      id: usuarioAdmin.id,
      nombre: usuarioAdmin.nombre,
      correo: usuarioAdmin.correo,
      telefono: usuarioAdmin.telefono,
      debeCambiarClave: usuarioAdmin.debeCambiarClave,
      permisos: serializarPermisos(permisos),
    },
  };
}

export async function refrescarAdmin(refreshTokenCrudo: string) {
  const sesion = await prisma.sesionAdmin.findUnique({
    where: { refreshTokenHash: hashearToken(refreshTokenCrudo) },
  });

  if (!sesion || sesion.revocadaEn || sesion.expiraEn < new Date()) {
    throw ErrorApi.noAutenticado('Sesión inválida o expirada');
  }

  const usuarioAdmin = await prisma.usuarioAdmin.findUnique({
    where: { id: sesion.usuarioAdminId },
  });
  if (!usuarioAdmin || !usuarioAdmin.activo) {
    throw ErrorApi.noAutenticado('Sesión inválida o expirada');
  }

  const nuevoRefreshCrudo = generarTokenCrudo();
  await prisma.$transaction([
    prisma.sesionAdmin.update({ where: { id: sesion.id }, data: { revocadaEn: new Date() } }),
    prisma.sesionAdmin.create({
      data: {
        usuarioAdminId: usuarioAdmin.id,
        refreshTokenHash: hashearToken(nuevoRefreshCrudo),
        expiraEn: new Date(Date.now() + DURACION_REFRESH_MS),
      },
    }),
  ]);

  const accessToken = firmarAccessTokenAdmin(usuarioAdmin.id);
  return { accessToken, refreshTokenCrudo: nuevoRefreshCrudo };
}

export async function cerrarSesionAdmin(refreshTokenCrudo: string | undefined): Promise<void> {
  if (!refreshTokenCrudo) return;
  await prisma.sesionAdmin.updateMany({
    where: { refreshTokenHash: hashearToken(refreshTokenCrudo), revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
}

export async function obtenerPerfilAdmin(usuarioAdminId: string) {
  const usuarioAdmin = await prisma.usuarioAdmin.findUnique({
    where: { id: usuarioAdminId },
    select: {
      id: true,
      nombre: true,
      correo: true,
      telefono: true,
      debeCambiarClave: true,
      creadoEn: true,
    },
  });
  if (!usuarioAdmin) return null;

  const permisos = await obtenerPermisosEfectivos(usuarioAdminId);
  return { ...usuarioAdmin, permisos: serializarPermisos(permisos) };
}
