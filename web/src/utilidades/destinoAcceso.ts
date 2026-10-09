// Adónde volver después de iniciar sesión o registrarse (parámetro
// ?regresar= en /ingresar y /registro). Nunca se confía en el valor tal
// cual: solo se aceptan rutas internas que empiecen con "/" — y ni
// siquiera "//lo-que-sea", que un navegador interpreta como URL absoluta
// (protocol-relative) y terminaría navegando a otro dominio. Cualquier
// otra cosa cae al destino por defecto.
const DESTINO_POR_DEFECTO = '/cuenta';

export function destinoSeguro(valor: string | null): string {
  if (!valor || !valor.startsWith('/') || valor.startsWith('//')) {
    return DESTINO_POR_DEFECTO;
  }
  return valor;
}
