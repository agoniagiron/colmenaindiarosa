import bcrypt from 'bcrypt';
import type { TipoToken } from '@prisma/client';
import { fusionarCarritoAnonimo } from '../carrito/servicio.js';
import { ErrorApi } from '../../lib/errorApi.js';
import { servicioCorreo } from '../../lib/correo.js';
import { firmarAccessToken } from '../../lib/jwt.js';
import { prisma } from '../../lib/prisma.js';
import { generarTokenCrudo, hashearToken } from '../../lib/tokens.js';
import type { DatosActualizarPerfil, DatosLogin, DatosRegistro } from './esquemas.js';

const RONDAS_BCRYPT = 12;
const DURACION_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const DURACION_VERIFICACION_MS = 24 * 60 * 60 * 1000;
const DURACION_RECUPERACION_MS = 60 * 60 * 1000;

// Hash fijo contra el que comparar cuando el correo no existe, para que
// login tarde lo mismo con correo inválido que con contraseña inválida
// (evita filtrar por tiempo de respuesta cuál de los dos falló).
const HASH_FICTICIO = bcrypt.hashSync('correo-inexistente', RONDAS_BCRYPT);

const SELECT_USUARIO_SEGURO = {
  id: true,
  nombre: true,
  apellido: true,
  correo: true,
  telefono: true,
  correoVerificado: true,
  creadoEn: true,
} as const;

async function buscarTokenValido(tokenCrudo: string, tipo: TipoToken) {
  const registro = await prisma.tokenUsuario.findUnique({
    where: { tokenHash: hashearToken(tokenCrudo) },
  });
  if (!registro || registro.tipo !== tipo || registro.usadoEn || registro.expiraEn < new Date()) {
    return null;
  }
  return registro;
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

export async function registrar(datos: DatosRegistro) {
  const existente = await prisma.usuario.findUnique({
    where: { correo: datos.correo },
    select: { id: true },
  });
  if (existente) {
    throw ErrorApi.conflicto('Ya existe una cuenta con ese correo');
  }

  const claveHash = await bcrypt.hash(datos.clave, RONDAS_BCRYPT);

  return prisma.usuario.create({
    data: {
      nombre: datos.nombre,
      correo: datos.correo,
      claveHash,
      telefono: datos.telefono,
      aceptoTerminos: true,
      aceptoTratamiento: true,
      aceptoEn: new Date(),
    },
    select: SELECT_USUARIO_SEGURO,
  });
}

// ---------------------------------------------------------------------------
// Login / refresh / logout
// ---------------------------------------------------------------------------

async function crearSesion(usuarioId: string): Promise<string> {
  const refreshTokenCrudo = generarTokenCrudo();
  await prisma.sesionAuth.create({
    data: {
      usuarioId,
      refreshTokenHash: hashearToken(refreshTokenCrudo),
      expiraEn: new Date(Date.now() + DURACION_REFRESH_MS),
    },
  });
  return refreshTokenCrudo;
}

export async function login(datos: DatosLogin, visitanteId: string | undefined) {
  const usuario = await prisma.usuario.findUnique({ where: { correo: datos.correo } });

  const coincide = usuario
    ? await bcrypt.compare(datos.clave, usuario.claveHash)
    : await bcrypt.compare(datos.clave, HASH_FICTICIO);

  if (!usuario || !usuario.activo || !coincide) {
    throw ErrorApi.noAutenticado('Correo o contraseña incorrectos');
  }

  const accessToken = firmarAccessToken(usuario.id);
  const refreshTokenCrudo = await crearSesion(usuario.id);

  let avisoCarrito: string[] = [];
  try {
    avisoCarrito = (await fusionarCarritoAnonimo(usuario.id, visitanteId)).avisos;
  } catch {
    // La fusión del carrito no debe bloquear el login si falla.
  }

  return {
    accessToken,
    refreshTokenCrudo,
    avisoCarrito,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      telefono: usuario.telefono,
      correoVerificado: usuario.correoVerificado,
      creadoEn: usuario.creadoEn,
    },
  };
}

export async function refrescar(refreshTokenCrudo: string) {
  const sesion = await prisma.sesionAuth.findUnique({
    where: { refreshTokenHash: hashearToken(refreshTokenCrudo) },
  });

  if (!sesion || sesion.revocadaEn || sesion.expiraEn < new Date()) {
    throw ErrorApi.noAutenticado('Sesión inválida o expirada');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: sesion.usuarioId } });
  if (!usuario || !usuario.activo) {
    throw ErrorApi.noAutenticado('Sesión inválida o expirada');
  }

  const nuevoRefreshCrudo = generarTokenCrudo();
  await prisma.$transaction([
    prisma.sesionAuth.update({ where: { id: sesion.id }, data: { revocadaEn: new Date() } }),
    prisma.sesionAuth.create({
      data: {
        usuarioId: usuario.id,
        refreshTokenHash: hashearToken(nuevoRefreshCrudo),
        expiraEn: new Date(Date.now() + DURACION_REFRESH_MS),
      },
    }),
  ]);

  const accessToken = firmarAccessToken(usuario.id);
  return { accessToken, refreshTokenCrudo: nuevoRefreshCrudo };
}

export async function cerrarSesion(refreshTokenCrudo: string | undefined): Promise<void> {
  if (!refreshTokenCrudo) return;
  await prisma.sesionAuth.updateMany({
    where: { refreshTokenHash: hashearToken(refreshTokenCrudo), revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export async function obtenerPerfil(usuarioId: string) {
  return prisma.usuario.findUnique({ where: { id: usuarioId }, select: SELECT_USUARIO_SEGURO });
}

export async function actualizarPerfil(usuarioId: string, datos: DatosActualizarPerfil) {
  return prisma.usuario.update({
    where: { id: usuarioId },
    data: datos,
    select: SELECT_USUARIO_SEGURO,
  });
}

// ---------------------------------------------------------------------------
// Verificación de correo (no es requisito para comprar: solo confirma el
// dato de contacto)
// ---------------------------------------------------------------------------

export async function solicitarVerificacionCorreo(usuarioId: string): Promise<void> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { correo: true, correoVerificado: true },
  });
  if (!usuario || usuario.correoVerificado) return;

  const tokenCrudo = generarTokenCrudo();
  await prisma.tokenUsuario.create({
    data: {
      usuarioId,
      tipo: 'verificacionCorreo',
      tokenHash: hashearToken(tokenCrudo),
      expiraEn: new Date(Date.now() + DURACION_VERIFICACION_MS),
    },
  });

  await servicioCorreo.enviar({
    para: usuario.correo,
    asunto: 'Confirmá tu correo - India Rosa',
    texto: `Para confirmar tu correo usá este token (vence en 24 horas): ${tokenCrudo}`,
  });
}

export async function confirmarVerificacionCorreo(tokenCrudo: string): Promise<void> {
  const registro = await buscarTokenValido(tokenCrudo, 'verificacionCorreo');
  if (!registro) {
    throw ErrorApi.peticionInvalida('El token no es válido o ya expiró');
  }

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: registro.usuarioId },
      data: { correoVerificado: true, correoVerificadoEn: new Date() },
    }),
    prisma.tokenUsuario.update({ where: { id: registro.id }, data: { usadoEn: new Date() } }),
  ]);
}

// ---------------------------------------------------------------------------
// Recuperación de contraseña
// ---------------------------------------------------------------------------

export async function solicitarRecuperacion(correo: string): Promise<void> {
  const usuario = await prisma.usuario.findUnique({
    where: { correo },
    select: { id: true, correo: true },
  });
  // Silencio si no existe: revelar qué correos están registrados es una fuga.
  if (!usuario) return;

  const tokenCrudo = generarTokenCrudo();
  await prisma.tokenUsuario.create({
    data: {
      usuarioId: usuario.id,
      tipo: 'recuperarClave',
      tokenHash: hashearToken(tokenCrudo),
      expiraEn: new Date(Date.now() + DURACION_RECUPERACION_MS),
    },
  });

  await servicioCorreo.enviar({
    para: usuario.correo,
    asunto: 'Recuperar contraseña - India Rosa',
    texto: `Para restablecer tu contraseña usá este token (vence en 1 hora): ${tokenCrudo}`,
  });
}

export async function confirmarRecuperacion(tokenCrudo: string, claveNueva: string): Promise<void> {
  const registro = await buscarTokenValido(tokenCrudo, 'recuperarClave');
  if (!registro) {
    throw ErrorApi.peticionInvalida('El token no es válido o ya expiró');
  }

  const claveHash = await bcrypt.hash(claveNueva, RONDAS_BCRYPT);

  await prisma.$transaction([
    prisma.usuario.update({ where: { id: registro.usuarioId }, data: { claveHash } }),
    prisma.tokenUsuario.update({ where: { id: registro.id }, data: { usadoEn: new Date() } }),
    // Cambiar la contraseña revoca todo lo que estaba logueado con la vieja.
    prisma.sesionAuth.updateMany({
      where: { usuarioId: registro.usuarioId, revocadaEn: null },
      data: { revocadaEn: new Date() },
    }),
  ]);
}
