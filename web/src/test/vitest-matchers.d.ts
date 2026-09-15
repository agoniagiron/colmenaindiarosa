// Este archivo existe porque el augment de tipos que trae jest-dom
// (`@testing-library/jest-dom/vitest`) extiende la interfaz `Assertion`
// del paquete `vitest`, pero en Vitest 4 esa interfaz se reexporta desde
// `@vitest/expect`, así que el merge de declaraciones de jest-dom no llega
// a aplicarse. Se repite aquí apuntando al módulo correcto hasta que
// jest-dom lo actualice.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type -- espeja la firma que usa jest-dom en su propio vitest.d.ts */
declare module '@vitest/expect' {
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
}
