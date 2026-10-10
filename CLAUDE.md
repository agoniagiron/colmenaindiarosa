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

## Fase actual: visual con datos simulados

El proyecto se está construyendo frontend primero. La base de datos y la API
todavía no existen. Reglas mientras dure esta fase:

- Todos los datos vienen de `web/src/datos/`, no de peticiones HTTP.
- El acceso a datos pasa siempre por la interfaz `Repositorio`
  (`web/src/datos/repositorio.ts`). Los componentes nunca importan el archivo
  de datos simulados directamente.
- El cálculo de totales del carrito vive en un único módulo puro
  (`web/src/dominio/calcularTotales.ts`). Cuando exista el backend, ese
  archivo se mueve al servidor sin reescribirse. No dupliques esa lógica en
  ningún componente.
- No escribas llamadas `fetch` a endpoints que no existen. Nada de
  AuthContext contra `/api/auth/*`.
- La sesión se simula en memoria y se pierde al recargar. Es intencional.

Cuando el backend exista, esta sección se elimina.

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
