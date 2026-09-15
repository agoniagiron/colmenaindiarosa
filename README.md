# India Rosa

Tienda en línea de pelucas, extensiones y productos para el cabello. Ver `CLAUDE.md` para el contexto completo del producto y las convenciones del proyecto.

## Requisitos

- Node 20 (ver `.nvmrc`)
- npm 10+
- Docker (para la base de datos local)

## Primeros pasos

```bash
npm install
cp api/.env.example api/.env
cp web/.env.example web/.env
docker compose up -d
npm run dev
```

## Base de datos

`docker-compose.yml` levanta un único contenedor de PostgreSQL 16 para desarrollo, con datos persistidos en un volumen de Docker.

```bash
docker compose up -d      # levanta la base de datos en segundo plano
docker compose down       # la apaga (los datos se conservan en el volumen)
docker compose down -v    # la apaga y borra también el volumen de datos
```

Credenciales de desarrollo (ya reflejadas en `api/.env.example` como `DATABASE_URL`): usuario `india_rosa`, contraseña `india_rosa`, base de datos `india_rosa`, puerto `5432`.

`npm run dev` levanta el backend (`api/`, puerto 3001) y el frontend (`web/`, puerto de Vite) en paralelo. En desarrollo, las peticiones a `/api` desde el frontend se redirigen automáticamente al backend (proxy configurado en `web/vite.config.ts`).

## Scripts de la raíz

- `npm run dev` — levanta `api/` y `web/` en paralelo.
- `npm run build` — compila ambos paquetes.
- `npm run lint` — corre ESLint y Prettier en ambos paquetes.
- `npm run test` — corre las pruebas de ambos paquetes con Vitest.

## Estructura

- `api/` — backend (Node, Express, TypeScript).
- `web/` — frontend (React, Vite, TypeScript, Tailwind CSS).
