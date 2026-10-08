// Base de todas las URLs de la API. Si VITE_API_URL está definida (como en
// producción, donde el frontend y la API viven en dominios distintos), las
// peticiones van ahí. Si no está definida (como hoy en desarrollo), la base
// queda vacía y las rutas siguen siendo relativas: el proxy de /api en
// vite.config.ts las redirige a localhost:3001 sin que nadie tenga que
// configurar nada.
const valorCrudo = import.meta.env.VITE_API_URL ?? '';

// Sin barra final: si alguien configura la variable como
// "https://api.colmenaindiarosa.com/" (con barra), BASE_URL + '/api/carrito'
// no debe terminar en "//api/carrito".
export const BASE_URL_API = valorCrudo.replace(/\/$/, '');
