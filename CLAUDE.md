# India Rosa

## Producto
Tienda en línea de pelucas, extensiones, productos de cuidado capilar y
accesorios. Cliente final: mujeres en Colombia. El pago NO se procesa en el
sitio: el carrito genera un mensaje de WhatsApp con el detalle del pedido y
la tienda confirma disponibilidad y forma de pago por chat.

## Stack
- Monorepo con dos paquetes: `api/` (backend) y `web/` (frontend).
- Backend: Node.js 20, Express 5, TypeScript, Prisma ORM, PostgreSQL 16.
- Validación con Zod. Autenticación con JWT (access token corto + refresh
  token en cookie httpOnly). Contraseñas con bcrypt.
- Frontend: React 19, Vite, TypeScript, React Router 7, TanStack Query,
  Tailwind CSS.
- Pruebas: Vitest y Supertest en el backend, Vitest y Testing Library en el
  frontend.
- Gestor de paquetes: npm workspaces.

## Roles
- `cliente`: navega, arma el carrito, envía el pedido por WhatsApp, ve su
  historial.
- `admin`: todo lo anterior más el panel de inventario, abastecimiento,
  proveedores, pedidos y reportes.

## Reglas de negocio
- Envío: $15.000. Gratis cuando (subtotal - descuento) >= $400.000.
- Los totales los calcula únicamente el backend. El frontend muestra lo que
  devuelve la API, nunca recalcula ni envía precios.
- El stock se reserva al crear el pedido, no al confirmarlo por WhatsApp.
- Desactivar un valor de atributo impide crear variantes nuevas con él,
  pero no toca las que ya existen, que siguen visibles y vendibles. Es
  deliberado.
- El número de WhatsApp de la tienda vive en la variable de entorno
  NUMERO_WHATSAPP. Nunca escrito en el código.

## Convenciones
- Todo el código en TypeScript estricto. Nada de `any` sin justificar.
- Nombres de variables, funciones y comentarios en español, salvo términos
  técnicos consolidados (request, handler, middleware).
- Precios en pesos colombianos, guardados como enteros (sin decimales).
- Formato de moneda con `Intl.NumberFormat('es-CO')`.
- Textos de interfaz en español, en tono cercano y directo, sin mayúsculas
  sostenidas ni signos de admiración de relleno.
- Errores de la API con forma `{ error: { codigo, mensaje, detalles? } }`.
- La imagen de portada de un producto o un kit es la primera por orden. El campo tipo nunca vale 'principal'.

## Reglas de trabajo
- Antes de escribir código, presenta un plan corto y espera aprobación
  explícita.
- Un cambio por vez. No mezcles refactors con funcionalidad nueva.
- No toques archivos fuera del alcance del prompt actual.
- No instales dependencias sin avisarlas primero en el plan.
- No inventes datos ni endpoints que no estén especificados.

## Identidad visual
- Fondo hueso `#FBF7F4`, arena `#EFE3DA`, rosa palo `#EBC9C6`,
  rosa de marca `#B02E58`, tinta `#2A1F1D`, texto secundario `#8A7A73`,
  línea `#E4D8D0`, verde WhatsApp `#1FA855`.
- Títulos en serif (Georgia o similar). Texto corrido en sans-serif del
  sistema.
- Bordes redondeados generosos en tarjetas (14–18px), botones tipo píldora.

## Estado actual: la API está andando

El backend (`api/`) está en marcha contra la base de Supabase y el frontend
lo consume. No hay datos simulados en la tienda ni en el panel.

- El catálogo se lee a través de la interfaz `Repositorio`
  (`web/src/datos/repositorio.ts`); `web/src/datos/index.ts` exporta
  `repositorioHttp`. `repositorioMemoria` y `datos/muestra.ts` quedan solo
  para las pruebas: ningún componente los importa.
- El resto de la API (auth, carrito, checkout, pedidos, cuenta, panel) se
  llama desde los módulos `web/src/contexto/api*.ts`. Un endpoint nuevo
  primero existe en `api/` y después se consume desde ahí.
- Los totales del carrito y del pedido los calcula solo
  `api/src/dominio/calcularTotales.ts`. El frontend no tiene copia de esa
  lógica.
- La sesión es real: JWT de acceso corto y refresh token en cookie
  httpOnly, para clientas (`/api/auth/*`) y para el panel
  (`/api/admin/auth/*`).

## Prisma y la base de datos

La base de datos en Supabase es la ÚNICA fuente de verdad. Fue creada con
scripts SQL y contiene 45 tablas.

- NUNCA ejecutes prisma db push, prisma migrate dev, prisma migrate reset
  ni prisma migrate deploy. Ninguno. Esos comandos hacen que la base se
  parezca al schema.prisma, y schema.prisma siempre está incompleto
  respecto a la base.
- El ÚNICO comando permitido es prisma db pull, que hace lo contrario:
  actualiza schema.prisma a partir de la base.
- Si un modelo o columna falta en schema.prisma, la respuesta es correr
  db pull, nunca escribirlo a mano ni empujarlo a la base.
- Los cambios de esquema se hacen con SQL en Supabase y después db pull.
- categoria, atributo, valor_atributo y proveedor son estructura del
  catálogo, no contenido. No se incluyen en limpiezas de datos de prueba.
