// Único archivo que cambia según la implementación activa de `Repositorio`.
// Ahora que existe la API, expone repositorioHttp; repositorioMemoria y
// datos/muestra.ts se mantienen aparte para las pruebas.

export { repositorioHttp as repositorio } from './repositorioHttp.ts';
export type {
  Facetas,
  FiltrosProducto,
  OrdenProducto,
  Pagina,
  Paginacion,
  Repositorio,
  ResultadoPaginado,
} from './repositorio.ts';
