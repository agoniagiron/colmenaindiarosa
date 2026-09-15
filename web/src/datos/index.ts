// Único archivo que cambia cuando exista la API: hoy expone la
// implementación en memoria, mañana expondrá una implementación por HTTP
// con la misma interfaz `Repositorio`.

export { repositorioMemoria as repositorio } from './repositorioMemoria.ts';
export type {
  FiltrosProducto,
  OrdenProducto,
  Pagina,
  Paginacion,
  Repositorio,
  ResultadoPaginado,
} from './repositorio.ts';
