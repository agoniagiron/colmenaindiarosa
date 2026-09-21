import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import type { TipoCupon, TipoImagen } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Mismas rondas que usa el hash de contraseñas en el módulo de auth
// (api/src/modulos/auth/servicio.ts).
const RONDAS_BCRYPT = 12;

// Sin valores por defecto: las contraseñas de los usuarios de prueba no
// viven en el código. Si faltan, el seed falla antes de tocar la base.
function claveObligatoria(nombreVariable: string): string {
  const valor = process.env[nombreVariable];
  if (!valor) {
    throw new Error(
      `Falta ${nombreVariable} en el entorno. Definila en api/.env (ver api/.env.example) antes de correr el seed.`,
    );
  }
  return valor;
}

const SEED_CLIENTE_CLAVE = claveObligatoria('SEED_CLIENTE_CLAVE');
const SEED_ADMIN_CLAVE = claveObligatoria('SEED_ADMIN_CLAVE');

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

const CATEGORIAS = [
  { nombre: 'Pelucas', slug: 'pelucas', orden: 1 },
  { nombre: 'Cuidado', slug: 'cuidado', orden: 2 },
  { nombre: 'Extensiones', slug: 'extensiones', orden: 3 },
  { nombre: 'Accesorios', slug: 'accesorios', orden: 4 },
] as const;

async function seedCategorias(): Promise<Record<string, string>> {
  const idPorSlug: Record<string, string> = {};
  for (const categoria of CATEGORIAS) {
    const registro = await prisma.categoria.upsert({
      where: { slug: categoria.slug },
      update: { nombre: categoria.nombre, orden: categoria.orden, activa: true },
      create: {
        nombre: categoria.nombre,
        slug: categoria.slug,
        orden: categoria.orden,
        activa: true,
      },
    });
    idPorSlug[categoria.slug] = registro.id;
  }
  return idPorSlug;
}

// ---------------------------------------------------------------------------
// Atributos y valores
//
// Los slugs deben coincidir exactamente con SLUGS_ATRIBUTO en
// api/src/modulos/catalogo/servicio.ts (tipo_base, longitud, color, talla,
// densidad): ese módulo arma los filtros del catálogo buscando por slug.
// ---------------------------------------------------------------------------

interface ValorAtributoSeed {
  valor: string;
  hex?: string;
}

const ATRIBUTOS: { slug: string; nombre: string; orden: number; valores: ValorAtributoSeed[] }[] = [
  {
    slug: 'tipo_base',
    nombre: 'Tipo de base',
    orden: 1,
    valores: [
      { valor: 'Lace front' },
      { valor: 'Full lace' },
      { valor: 'Monofilamento' },
      { valor: 'Tradicional' },
    ],
  },
  {
    slug: 'longitud',
    nombre: 'Longitud',
    orden: 2,
    valores: [{ valor: 'Corta' }, { valor: 'Media' }, { valor: 'Larga' }, { valor: 'Extra larga' }],
  },
  {
    slug: 'color',
    nombre: 'Color',
    orden: 3,
    valores: [
      { valor: 'Negro natural', hex: '#1c1412' },
      { valor: 'Castaño oscuro', hex: '#3b2620' },
      { valor: 'Chocolate', hex: '#5a3a2a' },
      { valor: 'Caramelo', hex: '#8a5a34' },
      { valor: 'Miel', hex: '#a97e4c' },
      { valor: 'Rubio arena', hex: '#c9a97c' },
    ],
  },
  {
    slug: 'talla',
    nombre: 'Talla de gorro',
    orden: 4,
    valores: [{ valor: 'Pequeña' }, { valor: 'Mediana' }, { valor: 'Grande' }],
  },
  {
    slug: 'densidad',
    nombre: 'Densidad',
    orden: 5,
    valores: [{ valor: '130%' }, { valor: '150%' }, { valor: '180%' }],
  },
];

interface AtributoIds {
  id: string;
  valores: Record<string, string>;
}

async function seedAtributos(): Promise<Record<string, AtributoIds>> {
  const idsPorSlug: Record<string, AtributoIds> = {};

  for (const atributo of ATRIBUTOS) {
    const registroAtributo = await prisma.atributo.upsert({
      where: { slug: atributo.slug },
      update: { nombre: atributo.nombre, orden: atributo.orden },
      create: { nombre: atributo.nombre, slug: atributo.slug, orden: atributo.orden },
    });

    const valores: Record<string, string> = {};
    for (const [orden, valorAtributo] of atributo.valores.entries()) {
      const registroValor = await prisma.valorAtributo.upsert({
        where: {
          atributoId_valor: { atributoId: registroAtributo.id, valor: valorAtributo.valor },
        },
        update: { hex: valorAtributo.hex ?? null, orden },
        create: {
          atributoId: registroAtributo.id,
          valor: valorAtributo.valor,
          hex: valorAtributo.hex ?? null,
          orden,
        },
      });
      valores[valorAtributo.valor] = registroValor.id;
    }

    idsPorSlug[atributo.slug] = { id: registroAtributo.id, valores };
  }

  return idsPorSlug;
}

// ---------------------------------------------------------------------------
// Productos, variantes, precios e imágenes
//
// Nombres, slugs, descripciones y combinaciones de atributos reutilizan
// exactamente los de web/src/datos/muestra.ts. descripcionCorta, cuidados
// y envioNotas no existen en ese archivo (es de la fase de datos simulados,
// previa al esquema actual), así que son texto nuevo, breve y en el mismo
// tono cercano del resto del sitio.
// ---------------------------------------------------------------------------

interface VarianteSeed {
  sku: string;
  precioActual: number;
  precioAntes?: number;
  stockActual: number;
  stockReservado: number;
  // slug de atributo -> texto del valor, ej. { color: 'Chocolate' }
  atributos?: Record<string, string>;
}

interface ImagenSeed {
  sufijo: number;
  altTexto: string;
  tipo: TipoImagen;
}

interface ProductoSeed {
  nombre: string;
  slug: string;
  categoriaSlug: string;
  descripcionCorta: string;
  descripcion: string;
  cuidados: string;
  envioNotas: string;
  destacado: boolean;
  variantes: VarianteSeed[];
}

function imagenesProducto(nombre: string, cantidad: 3 | 4): ImagenSeed[] {
  const alts = [
    `${nombre}, vista principal`,
    `${nombre}, tono más claro`,
    `${nombre}, tono más oscuro`,
    `${nombre}, tono intenso`,
  ];
  return alts.slice(0, cantidad).map((altTexto, indice) => ({
    sufijo: indice + 1,
    altTexto,
    tipo: indice === 0 ? 'principal' : 'galeria',
  }));
}

const CUIDADOS_PELUCAS =
  'Cepilla con brocha de cerdas suaves antes de cada uso. Lava cada 8 a 10 usos con shampoo sin sulfatos y deja secar sobre un soporte de cabeza. Evita el calor directo si la fibra no está indicada para plancha.';
const ENVIO_PELUCAS =
  'Se envía en caja rígida con soporte interno que protege la base y el encaje. Entrega en 2 a 5 días hábiles según la ciudad.';
const CUIDADOS_EXTENSIONES =
  'Desenreda con peine de cerdas anchas, de puntas a raíz. Lava cada 15 a 20 usos con shampoo sin sulfatos y deja secar al aire libre.';
const ENVIO_EXTENSIONES =
  'Se envía en bolsa con cierre hermético dentro de caja protegida. Entrega en 2 a 5 días hábiles.';
const ENVIO_CUIDADO =
  'Frasco sellado con precinto de seguridad, embalado con protección para evitar derrames en el trayecto.';
const ENVIO_ACCESORIOS =
  'Empaque compacto. Entrega en 2 a 5 días hábiles junto con el resto del pedido.';

const PRODUCTOS: ProductoSeed[] = [
  // --- Pelucas: máximo 4 variantes, combinaciones distintas entre productos ---
  {
    nombre: 'Peluca Lace Front Valentina',
    slug: 'peluca-lace-front-valentina',
    categoriaSlug: 'pelucas',
    descripcionCorta: 'Lace front de cabello humano remy, línea frontal invisible.',
    descripcion:
      'Peluca de lace front con encaje transparente en la línea frontal, cabello 100% humano remy.',
    cuidados: CUIDADOS_PELUCAS,
    envioNotas: ENVIO_PELUCAS,
    destacado: true,
    variantes: [
      {
        sku: 'PLV-NEG-130',
        precioActual: 420000,
        precioAntes: 480000,
        stockActual: 14,
        stockReservado: 2,
        atributos: {
          tipo_base: 'Lace front',
          longitud: 'Larga',
          talla: 'Mediana',
          densidad: '130%',
          color: 'Negro natural',
        },
      },
      {
        sku: 'PLV-CAS-150',
        precioActual: 440000,
        stockActual: 9,
        stockReservado: 1,
        atributos: {
          tipo_base: 'Lace front',
          longitud: 'Larga',
          talla: 'Mediana',
          densidad: '150%',
          color: 'Castaño oscuro',
        },
      },
      {
        sku: 'PLV-CHO-150',
        precioActual: 440000,
        stockActual: 6,
        stockReservado: 0,
        atributos: {
          tipo_base: 'Lace front',
          longitud: 'Larga',
          talla: 'Mediana',
          densidad: '150%',
          color: 'Chocolate',
        },
      },
      {
        // Variante agotada, para probar el estado "sin stock" en el catálogo.
        sku: 'PLV-CAR-180',
        precioActual: 465000,
        stockActual: 0,
        stockReservado: 0,
        atributos: {
          tipo_base: 'Lace front',
          longitud: 'Larga',
          talla: 'Mediana',
          densidad: '180%',
          color: 'Caramelo',
        },
      },
    ],
  },
  {
    nombre: 'Peluca Full Lace Camila',
    slug: 'peluca-full-lace-camila',
    categoriaSlug: 'pelucas',
    descripcionCorta: 'Full lace con encaje en toda la base, raya en cualquier dirección.',
    descripcion:
      'Peluca full lace con encaje en toda la base, permite peinados hacia atrás y raya en cualquier dirección.',
    cuidados: CUIDADOS_PELUCAS,
    envioNotas: ENVIO_PELUCAS,
    destacado: true,
    variantes: [
      {
        sku: 'PFC-MED-MIEL',
        precioActual: 520000,
        stockActual: 8,
        stockReservado: 1,
        atributos: {
          tipo_base: 'Full lace',
          longitud: 'Media',
          talla: 'Grande',
          densidad: '150%',
          color: 'Miel',
        },
      },
      {
        sku: 'PFC-LAR-RUB',
        precioActual: 545000,
        stockActual: 5,
        stockReservado: 0,
        atributos: {
          tipo_base: 'Full lace',
          longitud: 'Larga',
          talla: 'Grande',
          densidad: '150%',
          color: 'Rubio arena',
        },
      },
      {
        sku: 'PFC-EXL-NEG',
        precioActual: 570000,
        stockActual: 3,
        stockReservado: 1,
        atributos: {
          tipo_base: 'Full lace',
          longitud: 'Extra larga',
          talla: 'Grande',
          densidad: '150%',
          color: 'Negro natural',
        },
      },
    ],
  },
  {
    nombre: 'Peluca Bob Cleo',
    slug: 'peluca-bob-cleo',
    categoriaSlug: 'pelucas',
    descripcionCorta: 'Bob a la altura de la mandíbula, nacimiento natural.',
    descripcion:
      'Peluca corte bob a la altura de la mandíbula, base de monofilamento para un nacimiento natural.',
    cuidados: CUIDADOS_PELUCAS,
    envioNotas: ENVIO_PELUCAS,
    destacado: false,
    variantes: [
      {
        sku: 'PBC-PEQ-CAS',
        precioActual: 310000,
        stockActual: 11,
        stockReservado: 0,
        atributos: {
          tipo_base: 'Monofilamento',
          longitud: 'Corta',
          talla: 'Pequeña',
          densidad: '130%',
          color: 'Castaño oscuro',
        },
      },
      {
        sku: 'PBC-MED-CHO',
        precioActual: 310000,
        stockActual: 7,
        stockReservado: 2,
        atributos: {
          tipo_base: 'Monofilamento',
          longitud: 'Corta',
          talla: 'Mediana',
          densidad: '130%',
          color: 'Chocolate',
        },
      },
      {
        sku: 'PBC-MED-NEG',
        precioActual: 310000,
        stockActual: 10,
        stockReservado: 0,
        atributos: {
          tipo_base: 'Monofilamento',
          longitud: 'Corta',
          talla: 'Mediana',
          densidad: '130%',
          color: 'Negro natural',
        },
      },
    ],
  },
  {
    nombre: 'Peluca Ondulada Renata',
    slug: 'peluca-ondulada-renata',
    categoriaSlug: 'pelucas',
    descripcionCorta: 'Ondas suaves, base tradicional cosida, uso diario.',
    descripcion: 'Peluca de ondas suaves, base tradicional cosida, ideal para uso diario.',
    cuidados: CUIDADOS_PELUCAS,
    envioNotas: ENVIO_PELUCAS,
    destacado: false,
    variantes: [
      {
        sku: 'POR-D130',
        precioActual: 265000,
        stockActual: 13,
        stockReservado: 0,
        atributos: {
          tipo_base: 'Tradicional',
          longitud: 'Media',
          talla: 'Mediana',
          densidad: '130%',
          color: 'Caramelo',
        },
      },
      {
        sku: 'POR-D150',
        precioActual: 280000,
        stockActual: 9,
        stockReservado: 1,
        atributos: {
          tipo_base: 'Tradicional',
          longitud: 'Media',
          talla: 'Mediana',
          densidad: '150%',
          color: 'Caramelo',
        },
      },
      {
        sku: 'POR-D180',
        precioActual: 300000,
        stockActual: 4,
        stockReservado: 0,
        atributos: {
          tipo_base: 'Tradicional',
          longitud: 'Media',
          talla: 'Mediana',
          densidad: '180%',
          color: 'Caramelo',
        },
      },
    ],
  },
  {
    nombre: 'Peluca Rizada Solange',
    slug: 'peluca-rizada-solange',
    categoriaSlug: 'pelucas',
    descripcionCorta: 'Rizos definidos, densidad alta, lace front voluminoso.',
    descripcion:
      'Peluca de rizos definidos, densidad alta y encaje lace front para un look voluminoso.',
    cuidados: CUIDADOS_PELUCAS,
    envioNotas: ENVIO_PELUCAS,
    destacado: true,
    variantes: [
      {
        sku: 'PRS-NEG',
        precioActual: 480000,
        stockActual: 6,
        stockReservado: 1,
        atributos: {
          tipo_base: 'Lace front',
          longitud: 'Extra larga',
          talla: 'Grande',
          densidad: '180%',
          color: 'Negro natural',
        },
      },
      {
        sku: 'PRS-CHO',
        precioActual: 480000,
        stockActual: 5,
        stockReservado: 0,
        atributos: {
          tipo_base: 'Lace front',
          longitud: 'Extra larga',
          talla: 'Grande',
          densidad: '180%',
          color: 'Chocolate',
        },
      },
      {
        sku: 'PRS-MIEL',
        precioActual: 495000,
        stockActual: 3,
        stockReservado: 0,
        atributos: {
          tipo_base: 'Lace front',
          longitud: 'Extra larga',
          talla: 'Grande',
          densidad: '180%',
          color: 'Miel',
        },
      },
      {
        sku: 'PRS-RUB',
        precioActual: 495000,
        stockActual: 2,
        stockReservado: 1,
        atributos: {
          tipo_base: 'Lace front',
          longitud: 'Extra larga',
          talla: 'Grande',
          densidad: '180%',
          color: 'Rubio arena',
        },
      },
    ],
  },

  // --- Cuidado: sin atributos, una sola variante ---
  {
    nombre: 'Shampoo Reparador Keratina',
    slug: 'shampoo-reparador-keratina',
    categoriaSlug: 'cuidado',
    descripcionCorta: 'Shampoo sin sulfatos con keratina hidrolizada.',
    descripcion:
      'Shampoo sin sulfatos con keratina hidrolizada para cabello natural y pelucas de fibra.',
    cuidados:
      'Aplica sobre cabello húmedo, masajea y enjuaga bien. Uso recomendado 2 a 3 veces por semana.',
    envioNotas: ENVIO_CUIDADO,
    destacado: false,
    variantes: [{ sku: 'SRK-250', precioActual: 42000, stockActual: 40, stockReservado: 3 }],
  },
  {
    nombre: 'Acondicionador Hidratante Argán',
    slug: 'acondicionador-hidratante-argan',
    categoriaSlug: 'cuidado',
    descripcionCorta: 'Con aceite de argán, sella la cutícula y da brillo.',
    descripcion: 'Acondicionador con aceite de argán para sellar la cutícula y dar brillo.',
    cuidados: 'Aplica desde medios a puntas después del shampoo, deja actuar 2 minutos y enjuaga.',
    envioNotas: ENVIO_CUIDADO,
    destacado: false,
    variantes: [{ sku: 'AHA-250', precioActual: 45000, stockActual: 35, stockReservado: 2 }],
  },
  {
    nombre: 'Aceite Capilar Nutritivo',
    slug: 'aceite-capilar-nutritivo',
    categoriaSlug: 'cuidado',
    descripcionCorta: 'Multiusos, controla el frizz y nutre las puntas.',
    descripcion: 'Aceite nutritivo multiusos para puntas abiertas y control del frizz.',
    cuidados: 'Aplica una a dos gotas sobre cabello seco o húmedo, evitando la raíz.',
    envioNotas: ENVIO_CUIDADO,
    destacado: false,
    variantes: [{ sku: 'ACN-60', precioActual: 38000, stockActual: 50, stockReservado: 0 }],
  },

  // --- Extensiones: varían por color y longitud ---
  {
    nombre: 'Extensiones Clip-in Seda',
    slug: 'extensiones-clip-in-seda',
    categoriaSlug: 'extensiones',
    descripcionCorta: 'Cabello 100% humano, colocación sin calor.',
    descripcion:
      'Set de extensiones clip-in de cabello 100% humano, fácil colocación sin necesidad de calor.',
    cuidados: CUIDADOS_EXTENSIONES,
    envioNotas: ENVIO_EXTENSIONES,
    destacado: true,
    variantes: [
      {
        sku: 'ECS-NEG-MED',
        precioActual: 260000,
        stockActual: 12,
        stockReservado: 1,
        atributos: { color: 'Negro natural', longitud: 'Media' },
      },
      {
        sku: 'ECS-CAS-LAR',
        precioActual: 280000,
        stockActual: 8,
        stockReservado: 0,
        atributos: { color: 'Castaño oscuro', longitud: 'Larga' },
      },
      {
        sku: 'ECS-CHO-LAR',
        precioActual: 280000,
        stockActual: 6,
        stockReservado: 1,
        atributos: { color: 'Chocolate', longitud: 'Larga' },
      },
    ],
  },
  {
    nombre: 'Extensiones Cortina Invisible',
    slug: 'extensiones-cortina-invisible',
    categoriaSlug: 'extensiones',
    descripcionCorta: 'Trama invisible en una sola pieza, distribución uniforme.',
    descripcion:
      'Extensiones tipo cortina de trama invisible, distribución uniforme en una sola pieza.',
    cuidados: CUIDADOS_EXTENSIONES,
    envioNotas: ENVIO_EXTENSIONES,
    destacado: false,
    variantes: [
      {
        sku: 'ECI-MIEL-MED',
        precioActual: 240000,
        stockActual: 9,
        stockReservado: 0,
        atributos: { color: 'Miel', longitud: 'Media' },
      },
      {
        sku: 'ECI-RUB-LAR',
        precioActual: 255000,
        stockActual: 5,
        stockReservado: 1,
        atributos: { color: 'Rubio arena', longitud: 'Larga' },
      },
    ],
  },

  // --- Accesorios: sin atributos, una sola variante ---
  {
    nombre: 'Gorro de Malla para Peluca',
    slug: 'gorro-de-malla-para-peluca',
    categoriaSlug: 'accesorios',
    descripcionCorta: 'Transpirable, base antes de colocar la peluca.',
    descripcion: 'Gorro de malla transpirable para usar como base antes de colocar la peluca.',
    cuidados: 'Lava a mano con agua tibia y jabón neutro. Deja secar extendido, no en secadora.',
    envioNotas: ENVIO_ACCESORIOS,
    destacado: false,
    variantes: [{ sku: 'GMP-UNI', precioActual: 18000, stockActual: 60, stockReservado: 0 }],
  },
  {
    nombre: 'Peine Especial para Pelucas',
    slug: 'peine-especial-para-pelucas',
    categoriaSlug: 'accesorios',
    descripcionCorta: 'Cerdas anchas, desenreda sin dañar la fibra.',
    descripcion:
      'Peine de cerdas anchas y espaciadas, diseñado para desenredar pelucas y extensiones sin dañarlas.',
    cuidados: 'Limpia con un paño húmedo después de cada uso para quitar residuos de fibra.',
    envioNotas: ENVIO_ACCESORIOS,
    destacado: false,
    variantes: [{ sku: 'PEP-UNI', precioActual: 22000, stockActual: 45, stockReservado: 0 }],
  },
];

async function seedProductos(
  categoriaIds: Record<string, string>,
  atributoIds: Record<string, AtributoIds>,
): Promise<void> {
  for (const producto of PRODUCTOS) {
    const categoriaId = categoriaIds[producto.categoriaSlug];
    if (!categoriaId) {
      throw new Error(`Categoría no encontrada para el slug "${producto.categoriaSlug}"`);
    }

    const datosProducto = {
      nombre: producto.nombre,
      descripcionCorta: producto.descripcionCorta,
      descripcion: producto.descripcion,
      cuidados: producto.cuidados,
      envioNotas: producto.envioNotas,
      categoriaId,
      estado: 'publicado' as const,
      publicadoEn: new Date(),
    };

    const registroProducto = await prisma.producto.upsert({
      where: { slug: producto.slug },
      update: datosProducto,
      create: { ...datosProducto, slug: producto.slug },
    });

    for (const variante of producto.variantes) {
      const registroVariante = await prisma.varianteProducto.upsert({
        where: { sku: variante.sku },
        update: {
          productoId: registroProducto.id,
          precioActual: variante.precioActual,
          precioAntes: variante.precioAntes ?? null,
          stockActual: variante.stockActual,
          stockReservado: variante.stockReservado,
          activa: true,
        },
        create: {
          productoId: registroProducto.id,
          sku: variante.sku,
          precioActual: variante.precioActual,
          precioAntes: variante.precioAntes ?? null,
          stockActual: variante.stockActual,
          stockReservado: variante.stockReservado,
          activa: true,
        },
      });

      for (const [slugAtributo, textoValor] of Object.entries(variante.atributos ?? {})) {
        const atributo = atributoIds[slugAtributo];
        const valorId = atributo?.valores[textoValor];
        if (!valorId) {
          throw new Error(
            `Valor de atributo no encontrado: "${slugAtributo}" -> "${textoValor}" (variante ${variante.sku})`,
          );
        }
        await prisma.varianteValorAtributo.upsert({
          where: { varianteId_valorId: { varianteId: registroVariante.id, valorId } },
          update: {},
          create: { varianteId: registroVariante.id, valorId },
        });
      }

      // precio_variante es un histórico de precios, sin llave natural propia:
      // se registra la fila "precio inicial" solo si todavía no existe una
      // para esta variante, así el seed se puede correr varias veces sin
      // acumular filas de histórico repetidas.
      const yaTienePrecioInicial = await prisma.precioVariante.findFirst({
        where: { varianteId: registroVariante.id, motivo: 'precio inicial' },
        select: { id: true },
      });
      if (!yaTienePrecioInicial) {
        await prisma.precioVariante.create({
          data: {
            varianteId: registroVariante.id,
            precio: variante.precioActual,
            precioAntes: variante.precioAntes ?? null,
            motivo: 'precio inicial',
          },
        });
      }
    }

    // imagen_producto tampoco tiene llave natural: se reemplaza el set
    // completo de imágenes del producto en cada corrida.
    const cantidadImagenes = producto.categoriaSlug === 'pelucas' ? 4 : 3;
    await prisma.imagenProducto.deleteMany({ where: { productoId: registroProducto.id } });
    await prisma.imagenProducto.createMany({
      data: imagenesProducto(producto.nombre, cantidadImagenes).map((imagen) => ({
        productoId: registroProducto.id,
        url: `/productos/${producto.slug}-${imagen.sufijo}.jpg`,
        altTexto: imagen.altTexto,
        tipo: imagen.tipo,
        orden: imagen.sufijo - 1,
      })),
    });

    await prisma.productoResumen.upsert({
      where: { productoId: registroProducto.id },
      update: {},
      create: { productoId: registroProducto.id, calificacionPromedio: 0, cantidadResenas: 0 },
    });
  }
}

// ---------------------------------------------------------------------------
// Destacados de inicio
// ---------------------------------------------------------------------------

const SLUGS_DESTACADOS = PRODUCTOS.filter((p) => p.destacado).map((p) => p.slug);

async function seedDestacados(): Promise<void> {
  // Sin llave natural: se reemplaza la sección "inicio" completa en cada
  // corrida en lugar de un upsert fila por fila.
  await prisma.productoDestacado.deleteMany({ where: { seccion: 'inicio' } });

  const productos = await prisma.producto.findMany({
    where: { slug: { in: SLUGS_DESTACADOS } },
    select: { id: true, slug: true },
  });
  const idPorSlug = new Map(productos.map((p) => [p.slug, p.id]));

  await prisma.productoDestacado.createMany({
    data: SLUGS_DESTACADOS.map((slug, orden) => {
      const productoId = idPorSlug.get(slug);
      if (!productoId) throw new Error(`Producto destacado no encontrado: "${slug}"`);
      return { productoId, seccion: 'inicio', orden };
    }),
  });
}

// ---------------------------------------------------------------------------
// Cupones
// ---------------------------------------------------------------------------

const CUPONES: {
  codigo: string;
  descripcion: string;
  tipo: TipoCupon;
  valor: number;
  montoMinimo: number;
}[] = [
  {
    codigo: 'INDIAROSA10',
    descripcion: '10% de descuento en todo el catálogo.',
    tipo: 'porcentaje',
    valor: 10,
    montoMinimo: 0,
  },
  {
    codigo: 'ROSA20',
    descripcion: '20% de descuento en compras desde $500.000.',
    tipo: 'porcentaje',
    valor: 20,
    montoMinimo: 500000,
  },
  {
    codigo: 'ENVIOGRATIS',
    descripcion: 'Envío gratis en cualquier compra.',
    tipo: 'envio',
    valor: 0,
    montoMinimo: 0,
  },
];

async function seedCupones(): Promise<void> {
  for (const cupon of CUPONES) {
    await prisma.cupon.upsert({
      where: { codigo: cupon.codigo },
      update: {
        descripcion: cupon.descripcion,
        tipo: cupon.tipo,
        valor: cupon.valor,
        montoMinimo: cupon.montoMinimo,
        activo: true,
      },
      create: {
        codigo: cupon.codigo,
        descripcion: cupon.descripcion,
        tipo: cupon.tipo,
        valor: cupon.valor,
        montoMinimo: cupon.montoMinimo,
        vigenteDesde: new Date(),
        activo: true,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Proveedores
//
// No tienen un campo único además del id, así que se busca por nombre y se
// actualiza o se crea (upsert manual) para no duplicar en corridas repetidas.
// ---------------------------------------------------------------------------

const PROVEEDORES = [
  {
    nombre: 'Hair Import Co.',
    contacto: 'Laura Méndez',
    telefono: '+57 300 555 0101',
    correo: 'ventas@hairimportco.com',
    pais: 'Colombia',
    diasEntrega: 12,
  },
  {
    nombre: 'Belleza Natural SAS',
    contacto: 'Diego Osorio',
    telefono: '+57 301 555 0202',
    correo: 'pedidos@bellezanatural.co',
    pais: 'Colombia',
    diasEntrega: 7,
  },
  {
    nombre: 'CosméticaPital Distribuciones',
    contacto: 'Marcela Ruiz',
    telefono: '+57 302 555 0303',
    correo: 'compras@cosmeticapital.com',
    pais: 'Colombia',
    diasEntrega: 5,
  },
] as const;

async function seedProveedores(): Promise<void> {
  for (const proveedor of PROVEEDORES) {
    const existente = await prisma.proveedor.findFirst({ where: { nombre: proveedor.nombre } });
    if (existente) {
      await prisma.proveedor.update({
        where: { id: existente.id },
        data: { ...proveedor, activo: true },
      });
    } else {
      await prisma.proveedor.create({ data: { ...proveedor, activo: true } });
    }
  }
}

// ---------------------------------------------------------------------------
// Usuarios
//
// schema.prisma está desactualizado respecto a la base real en dos puntos
// que afectan esta sección (no se toca el schema: está fuera del alcance
// de este prompt, es "solo el seed"):
//
//   1. La tabla `usuario` (clientes) NO tiene columna `rol` en la base real,
//      aunque el modelo Prisma la declara. Cualquier lectura o escritura de
//      `usuario` a través del cliente de Prisma falla con P2022 por esa
//      columna fantasma, así que el cliente de prueba se inserta con SQL
//      crudo contra las columnas que sí existen.
//   2. Los roles de administración viven en un sistema propio que tampoco
//      está modelado en schema.prisma: `usuario_admin` (staff, separado de
//      `usuario`), `rol` (Superadministrador / Gerente / Bodega / Atención
//      al cliente, ya cargados con datos reales) y la tabla puente
//      `usuario_admin_rol`. "el rol Superadministrador" del prompt es la
//      fila de `rol` con slug 'superadministrador', no un enum. Por eso el
//      usuario_admin también se crea con SQL crudo.
//
// Nada de esto toca la estructura de la base: solo hace INSERT ... ON
// CONFLICT contra tablas que ya existen.
// ---------------------------------------------------------------------------

interface UsuarioClienteSeed {
  nombre: string;
  correo: string;
  telefono: string;
  clave: string;
}

interface UsuarioAdminSeed {
  nombre: string;
  correo: string;
  telefono: string;
  clave: string;
  rolSlug: string;
}

const USUARIO_CLIENTE: UsuarioClienteSeed = {
  nombre: 'Cliente de Prueba',
  correo: 'cliente.prueba@indiarosa.co',
  telefono: '+57 310 000 0000',
  clave: SEED_CLIENTE_CLAVE,
};

const USUARIO_ADMIN: UsuarioAdminSeed = {
  nombre: 'Administración India Rosa',
  correo: 'admin@indiarosa.co',
  telefono: '+57 300 000 0000',
  clave: SEED_ADMIN_CLAVE,
  rolSlug: 'superadministrador',
};

async function seedUsuarioCliente(usuario: UsuarioClienteSeed): Promise<void> {
  const claveHash = await bcrypt.hash(usuario.clave, RONDAS_BCRYPT);
  await prisma.$executeRaw`
    INSERT INTO usuario (
      nombre, correo, clave_hash, telefono, activo,
      correo_verificado, correo_verificado_en,
      acepto_terminos, acepto_tratamiento, acepto_en
    )
    VALUES (
      ${usuario.nombre}, ${usuario.correo}, ${claveHash}, ${usuario.telefono}, true,
      true, now(),
      true, true, now()
    )
    ON CONFLICT (correo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      clave_hash = EXCLUDED.clave_hash,
      telefono = EXCLUDED.telefono,
      activo = true,
      correo_verificado = true,
      correo_verificado_en = now(),
      acepto_terminos = true,
      acepto_tratamiento = true,
      acepto_en = now(),
      actualizado_en = now()
  `;
}

async function seedUsuarioAdmin(usuario: UsuarioAdminSeed): Promise<void> {
  const claveHash = await bcrypt.hash(usuario.clave, RONDAS_BCRYPT);

  // debe_cambiar_clave va explícito en true solo en el INSERT: si el
  // admin ya existe y ya cumplió el cambio obligatorio, re-correr el seed
  // no debe resetearlo a true de nuevo (por eso no está en el UPDATE).
  const filas = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO usuario_admin (nombre, correo, clave_hash, telefono, activo, debe_cambiar_clave)
    VALUES (${usuario.nombre}, ${usuario.correo}, ${claveHash}, ${usuario.telefono}, true, true)
    ON CONFLICT (correo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      clave_hash = EXCLUDED.clave_hash,
      telefono = EXCLUDED.telefono,
      activo = true,
      actualizado_en = now()
    RETURNING id
  `;
  const usuarioAdminId = filas[0]?.id;
  if (!usuarioAdminId) throw new Error('No se pudo crear/actualizar el usuario_admin.');

  const rolFilas = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM rol WHERE slug = ${usuario.rolSlug} LIMIT 1
  `;
  const rolId = rolFilas[0]?.id;
  if (!rolId) throw new Error(`No se encontró el rol con slug "${usuario.rolSlug}".`);

  await prisma.$executeRaw`
    INSERT INTO usuario_admin_rol (usuario_admin_id, rol_id, asignado_en)
    VALUES (${usuarioAdminId}::uuid, ${rolId}::uuid, now())
    ON CONFLICT (usuario_admin_id, rol_id) DO NOTHING
  `;
}

async function seedUsuarios(): Promise<void> {
  await seedUsuarioCliente(USUARIO_CLIENTE);
  await seedUsuarioAdmin(USUARIO_ADMIN);
}

// ---------------------------------------------------------------------------
// Conteo final
// ---------------------------------------------------------------------------

const TABLAS_CONTEO = [
  'categoria',
  'atributo',
  'valorAtributo',
  'producto',
  'varianteProducto',
  'varianteValorAtributo',
  'precioVariante',
  'imagenProducto',
  'productoDestacado',
  'productoResumen',
  'cupon',
  'proveedor',
  'usuario',
] as const;

async function mostrarConteos(): Promise<void> {
  console.log('\nConteo de filas por tabla:');
  for (const tabla of TABLAS_CONTEO) {
    const modelo = prisma[tabla] as { count: () => Promise<number> };
    const total = await modelo.count();
    console.log(`  ${tabla}: ${total}`);
  }

  // usuario_admin y usuario_admin_rol no están modeladas en schema.prisma
  // (ver comentario en la sección Usuarios), así que se cuentan con SQL crudo.
  const [{ total: totalUsuarioAdmin }] = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::bigint AS total FROM usuario_admin
  `;
  console.log(`  usuario_admin: ${totalUsuarioAdmin}`);
  const [{ total: totalUsuarioAdminRol }] = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::bigint AS total FROM usuario_admin_rol
  `;
  console.log(`  usuario_admin_rol: ${totalUsuarioAdminRol}`);
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const categoriaIds = await seedCategorias();
  const atributoIds = await seedAtributos();
  await seedProductos(categoriaIds, atributoIds);
  await seedDestacados();
  await seedCupones();
  await seedProveedores();
  await seedUsuarios();

  console.log('Seed completado.');
  console.log('Usuarios de prueba (correo / clave):');
  console.log(`  ${USUARIO_CLIENTE.correo} / ${USUARIO_CLIENTE.clave}`);
  console.log(`  ${USUARIO_ADMIN.correo} / ${USUARIO_ADMIN.clave} (rol: ${USUARIO_ADMIN.rolSlug})`);

  await mostrarConteos();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
