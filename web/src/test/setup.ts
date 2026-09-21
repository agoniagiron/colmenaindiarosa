import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Los componentes acceden a los datos únicamente vía datos/index.ts. En
// pruebas se usa siempre repositorioMemoria (sin red), sin importar cuál
// implementación esté activa en producción.
vi.mock('../datos/index.ts', async () => {
  const { repositorioMemoria } = await import('../datos/repositorioMemoria.ts');
  return { repositorio: repositorioMemoria };
});

// ContextoSesion intenta restaurar la sesión pegándole a la API al montar.
// En pruebas no hay backend: se simula "sin sesión activa" para que quede
// deslogueado sin hacer fetch real contra una URL relativa (falla en jsdom).
vi.mock('../contexto/apiAuth.ts', () => ({
  refrescarSesion: () => Promise.reject(new Error('sin sesión (mock de pruebas)')),
  obtenerYo: () => Promise.reject(new Error('sin sesión (mock de pruebas)')),
  iniciarSesion: () => Promise.reject(new Error('no implementado en pruebas')),
  registrar: () => Promise.reject(new Error('no implementado en pruebas')),
  cerrarSesion: () => Promise.resolve(),
  ErrorAuth: class ErrorAuth extends Error {},
}));

// Mismo motivo que el mock de apiAuth.ts, para ContextoSesionAdmin.
vi.mock('../contexto/apiAuthAdmin.ts', () => ({
  refrescarSesion: () => Promise.reject(new Error('sin sesión admin (mock de pruebas)')),
  obtenerYo: () => Promise.reject(new Error('sin sesión admin (mock de pruebas)')),
  iniciarSesion: () => Promise.reject(new Error('no implementado en pruebas')),
  cerrarSesion: () => Promise.resolve(),
  ErrorAuthAdmin: class ErrorAuthAdmin extends Error {},
}));
