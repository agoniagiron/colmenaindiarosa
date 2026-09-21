export function formatearFechaHora(fecha: string): string {
  return new Date(fecha).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
