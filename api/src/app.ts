import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { manejadorErrores, rutaNoEncontrada } from './middleware/manejadorErrores.js';
import { requiereAuth } from './middleware/requiereAuth.js';
import { requiereAuthAdmin, requierePermiso } from './middleware/requiereAuthAdmin.js';
import { sesionVisita } from './middleware/sesionVisita.js';
import { rutasAdminCombos } from './modulos/admin/combos/rutas.js';
import { rutasAdminPedidos } from './modulos/admin/pedidos/rutas.js';
import { rutasAdminAtributos } from './modulos/admin/productos/rutasAtributos.js';
import { rutasAdminImagenes } from './modulos/admin/productos/rutasImagenes.js';
import { rutasAdminProductos } from './modulos/admin/productos/rutasProductos.js';
import { rutasAdminVariantes } from './modulos/admin/productos/rutasVariantes.js';
import { rutasAdminPromociones } from './modulos/admin/promociones/rutas.js';
import { rutasAnalitica } from './modulos/analitica/rutas.js';
import { rutasAdminAnalitica } from './modulos/analitica/rutasAdmin.js';
import { rutasAuth } from './modulos/auth/rutas.js';
import { rutasAuthAdmin } from './modulos/authAdmin/rutas.js';
import { rutasCarrito } from './modulos/carrito/rutas.js';
import { rutasCatalogo } from './modulos/catalogo/rutas.js';
import { rutasCombos } from './modulos/combos/rutas.js';
import { rutasConfiguracion } from './modulos/configuracion/rutas.js';
import { rutasCuenta } from './modulos/cuenta/rutas.js';
import { rutasLimitadas } from './modulos/limitadas/rutas.js';
import { rutasWebhookWompi } from './modulos/pagos/rutas.js';
import { rutasCheckout, rutasPedidos } from './modulos/pedidos/rutas.js';
import { rutasPortada } from './modulos/portada/rutas.js';
import { rutasPromociones } from './modulos/promociones/rutas.js';
import { rutasSalud } from './modulos/salud/rutas.js';

export const app = express();

app.use(helmet());
// Origen único tomado de env, nunca comodín: las cookies de sesión viajan
// con credentials, y con origin: '*' el navegador las descarta.
app.use(cors({ origin: env.ORIGEN_WEB, credentials: true }));
app.use(compression());
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use('/health', rutasSalud);
// sesionVisita también en /api/auth: login necesita la cookie de invitante
// para fusionar el carrito anónimo al iniciar sesión.
app.use('/api/auth', sesionVisita, rutasAuth);
// Todo el panel de administración cuelga de /api/admin/ a propósito: los
// endpoints que se agreguen ahí en próximos prompts (inventario, pedidos,
// etc.) pueden compartir un único middleware de prefijo en vez de repetir
// requiereAuthAdmin ruta por ruta. Por ahora solo existe auth/.
app.use('/api/admin/auth', rutasAuthAdmin);
app.use(
  '/api/admin/analitica',
  requiereAuthAdmin,
  requierePermiso('reportes.ver'),
  rutasAdminAnalitica,
);
app.use('/api/admin/pedidos', requiereAuthAdmin, requierePermiso('pedidos.ver'), rutasAdminPedidos);
app.use(
  '/api/admin/productos',
  requiereAuthAdmin,
  requierePermiso('productos.ver'),
  rutasAdminProductos,
);
app.use(
  '/api/admin/variantes',
  requiereAuthAdmin,
  requierePermiso('productos.ver'),
  rutasAdminVariantes,
);
app.use(
  '/api/admin/atributos',
  requiereAuthAdmin,
  requierePermiso('productos.ver'),
  rutasAdminAtributos,
);
app.use(
  '/api/admin/imagenes',
  requiereAuthAdmin,
  requierePermiso('productos.ver'),
  rutasAdminImagenes,
);
app.use('/api/admin/combos', requiereAuthAdmin, requierePermiso('combos.ver'), rutasAdminCombos);
app.use(
  '/api/admin/promociones',
  requiereAuthAdmin,
  requierePermiso('promociones.ver'),
  rutasAdminPromociones,
);
app.use('/api/cuenta', requiereAuth, rutasCuenta);
app.use('/api/carrito', sesionVisita, rutasCarrito);
app.use('/api/analitica', sesionVisita, rutasAnalitica);
app.use('/api/checkout', requiereAuth, rutasCheckout);
app.use('/api/pedidos', requiereAuth, rutasPedidos);
// Público: lo llama Wompi, no pasa por sesionVisita ni auth.
app.use('/api/webhooks/wompi', rutasWebhookWompi);
app.use('/api/configuracion', rutasConfiguracion);
app.use('/api/limitadas', rutasLimitadas);
app.use('/api/combos', rutasCombos);
app.use('/api/promociones', rutasPromociones);
app.use('/api/portada', rutasPortada);
app.use('/api', sesionVisita, rutasCatalogo);

app.use(rutaNoEncontrada);
app.use(manejadorErrores);
