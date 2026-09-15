import { PrismaClient } from '@prisma/client';
import type { RolUsuario, TipoCupon } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Mismas rondas que usará el hash de contraseñas de usuarios en el Prompt 4.
const RONDAS_BCRYPT = 12;

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

interface CategoriaSeed {
  nombre: string;
  slug: string;
  orden: number;
}

const CATEGORIAS: CategoriaSeed[] = [
  { nombre: 'Pelucas', slug: 'pelucas', orden: 1 },
  { nombre: 'Cuidado', slug: 'cuidado', orden: 2 },
  { nombre: 'Extensiones', slug: 'extensiones', orden: 3 },
  { nombre: 'Accesorios', slug: 'accesorios', orden: 4 },
];

async function seedCategorias(): Promise<Record<string, string>> {
  const idsPorSlug: Record<string, string> = {};
  for (const categoria of CATEGORIAS) {
    const registro = await prisma.categoria.upsert({
      where: { slug: categoria.slug },
      update: { nombre: categoria.nombre, orden: categoria.orden, activa: true },
      create: { ...categoria, activa: true },
    });
    idsPorSlug[categoria.slug] = registro.id;
  }
  return idsPorSlug;
}

// ---------------------------------------------------------------------------
// Atributos y valores
// ---------------------------------------------------------------------------

interface ValorAtributoSeed {
  valor: string;
  hex?: string;
}

interface AtributoSeed {
  nombre: string;
  valores: ValorAtributoSeed[];
}

const ATRIBUTOS: AtributoSeed[] = [
  {
    nombre: 'Tipo de base',
    valores: [
      { valor: 'Lace front' },
      { valor: 'Full lace' },
      { valor: 'Monofilamento' },
      { valor: 'Tradicional' },
    ],
  },
  {
    nombre: 'Longitud',
    valores: [{ valor: 'Corta' }, { valor: 'Media' }, { valor: 'Larga' }, { valor: 'Extra larga' }],
  },
  {
    nombre: 'Color',
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
    nombre: 'Talla de gorro',
    valores: [{ valor: 'Pequeña' }, { valor: 'Mediana' }, { valor: 'Grande' }],
  },
  {
    nombre: 'Densidad',
    valores: [{ valor: '130%' }, { valor: '150%' }, { valor: '180%' }],
  },
];

interface AtributoIds {
  id: string;
  valores: Record<string, string>;
}

async function seedAtributos(): Promise<Record<string, AtributoIds>> {
  const idsPorAtributo: Record<string, AtributoIds> = {};

  for (const [indice, atributo] of ATRIBUTOS.entries()) {
    const registroAtributo = await prisma.atributo.upsert({
      where: { nombre: atributo.nombre },
      update: {},
      create: { nombre: atributo.nombre },
    });

    const valores: Record<string, string> = {};
    for (const [ordenValor, valorAtributo] of atributo.valores.entries()) {
      const registroValor = await prisma.valorAtributo.upsert({
        where: {
          atributoId_valor: { atributoId: registroAtributo.id, valor: valorAtributo.valor },
        },
        update: { hex: valorAtributo.hex ?? null, orden: ordenValor },
        create: {
          atributoId: registroAtributo.id,
          valor: valorAtributo.valor,
          hex: valorAtributo.hex ?? null,
          orden: ordenValor,
        },
      });
      valores[valorAtributo.valor] = registroValor.id;
    }

    idsPorAtributo[atributo.nombre] = { id: registroAtributo.id, valores };
    void indice;
  }

  return idsPorAtributo;
}

// ---------------------------------------------------------------------------
// Productos y variantes
// ---------------------------------------------------------------------------

interface VarianteSeed {
  sku: string;
  precio: number;
  stockActual: number;
  stockReservado: number;
  puntoReorden: number;
  // nombre del atributo -> texto del valor, ej. { Color: 'Chocolate' }
  atributos: Record<string, string>;
}

interface ProductoSeed {
  nombre: string;
  slug: string;
  descripcion: string;
  categoriaSlug: string;
  precioBase: number;
  precioAntes?: number;
  calificacion: number;
  cantidadResenas: number;
  destacado: boolean;
  variantes: VarianteSeed[];
}

const PRODUCTOS: ProductoSeed[] = [
  // --- Pelucas: máximo 4 variantes, combinaciones distintas por producto ---
  {
    nombre: 'Peluca Lace Front Valentina',
    slug: 'peluca-lace-front-valentina',
    descripcion:
      'Peluca de lace front con encaje transparente en la línea frontal, cabello 100% humano remy.',
    categoriaSlug: 'pelucas',
    precioBase: 420000,
    precioAntes: 480000,
    calificacion: 4.7,
    cantidadResenas: 128,
    destacado: true,
    variantes: [
      {
        sku: 'PLV-NEG-130',
        precio: 420000,
        stockActual: 14,
        stockReservado: 2,
        puntoReorden: 5,
        atributos: {
          'Tipo de base': 'Lace front',
          Longitud: 'Larga',
          'Talla de gorro': 'Mediana',
          Color: 'Negro natural',
          Densidad: '130%',
        },
      },
      {
        sku: 'PLV-CAS-150',
        precio: 440000,
        stockActual: 9,
        stockReservado: 1,
        puntoReorden: 5,
        atributos: {
          'Tipo de base': 'Lace front',
          Longitud: 'Larga',
          'Talla de gorro': 'Mediana',
          Color: 'Castaño oscuro',
          Densidad: '150%',
        },
      },
      {
        sku: 'PLV-CHO-150',
        precio: 440000,
        stockActual: 6,
        stockReservado: 0,
        puntoReorden: 5,
        atributos: {
          'Tipo de base': 'Lace front',
          Longitud: 'Larga',
          'Talla de gorro': 'Mediana',
          Color: 'Chocolate',
          Densidad: '150%',
        },
      },
      {
        // Variante agotada, para probar el estado "sin stock" en el catálogo.
        sku: 'PLV-CAR-180',
        precio: 465000,
        stockActual: 0,
        stockReservado: 0,
        puntoReorden: 4,
        atributos: {
          'Tipo de base': 'Lace front',
          Longitud: 'Larga',
          'Talla de gorro': 'Mediana',
          Color: 'Caramelo',
          Densidad: '180%',
        },
      },
    ],
  },
  {
    nombre: 'Peluca Full Lace Camila',
    slug: 'peluca-full-lace-camila',
    descripcion:
      'Peluca full lace con encaje en toda la base, permite peinados hacia atrás y raya en cualquier dirección.',
    categoriaSlug: 'pelucas',
    precioBase: 520000,
    calificacion: 4.8,
    cantidadResenas: 76,
    destacado: true,
    variantes: [
      {
        sku: 'PFC-MED-MIEL',
        precio: 520000,
        stockActual: 8,
        stockReservado: 1,
        puntoReorden: 3,
        atributos: {
          'Tipo de base': 'Full lace',
          Longitud: 'Media',
          'Talla de gorro': 'Grande',
          Color: 'Miel',
          Densidad: '150%',
        },
      },
      {
        sku: 'PFC-LAR-RUB',
        precio: 545000,
        stockActual: 5,
        stockReservado: 0,
        puntoReorden: 3,
        atributos: {
          'Tipo de base': 'Full lace',
          Longitud: 'Larga',
          'Talla de gorro': 'Grande',
          Color: 'Rubio arena',
          Densidad: '150%',
        },
      },
      {
        sku: 'PFC-EXL-NEG',
        precio: 570000,
        stockActual: 3,
        stockReservado: 1,
        puntoReorden: 3,
        atributos: {
          'Tipo de base': 'Full lace',
          Longitud: 'Extra larga',
          'Talla de gorro': 'Grande',
          Color: 'Negro natural',
          Densidad: '150%',
        },
      },
    ],
  },
  {
    nombre: 'Peluca Bob Cleo',
    slug: 'peluca-bob-cleo',
    descripcion:
      'Peluca corte bob a la altura de la mandíbula, base de monofilamento para un nacimiento natural.',
    categoriaSlug: 'pelucas',
    precioBase: 310000,
    calificacion: 4.5,
    cantidadResenas: 54,
    destacado: false,
    variantes: [
      {
        sku: 'PBC-PEQ-CAS',
        precio: 310000,
        stockActual: 11,
        stockReservado: 0,
        puntoReorden: 4,
        atributos: {
          'Tipo de base': 'Monofilamento',
          Longitud: 'Corta',
          'Talla de gorro': 'Pequeña',
          Color: 'Castaño oscuro',
          Densidad: '130%',
        },
      },
      {
        sku: 'PBC-MED-CHO',
        precio: 310000,
        stockActual: 7,
        stockReservado: 2,
        puntoReorden: 4,
        atributos: {
          'Tipo de base': 'Monofilamento',
          Longitud: 'Corta',
          'Talla de gorro': 'Mediana',
          Color: 'Chocolate',
          Densidad: '130%',
        },
      },
      {
        sku: 'PBC-MED-NEG',
        precio: 310000,
        stockActual: 10,
        stockReservado: 0,
        puntoReorden: 4,
        atributos: {
          'Tipo de base': 'Monofilamento',
          Longitud: 'Corta',
          'Talla de gorro': 'Mediana',
          Color: 'Negro natural',
          Densidad: '130%',
        },
      },
    ],
  },
  {
    nombre: 'Peluca Ondulada Renata',
    slug: 'peluca-ondulada-renata',
    descripcion: 'Peluca de ondas suaves, base tradicional cosida, ideal para uso diario.',
    categoriaSlug: 'pelucas',
    precioBase: 265000,
    calificacion: 4.3,
    cantidadResenas: 41,
    destacado: false,
    variantes: [
      {
        sku: 'POR-D130',
        precio: 265000,
        stockActual: 13,
        stockReservado: 0,
        puntoReorden: 5,
        atributos: {
          'Tipo de base': 'Tradicional',
          Longitud: 'Media',
          'Talla de gorro': 'Mediana',
          Color: 'Caramelo',
          Densidad: '130%',
        },
      },
      {
        sku: 'POR-D150',
        precio: 280000,
        stockActual: 9,
        stockReservado: 1,
        puntoReorden: 5,
        atributos: {
          'Tipo de base': 'Tradicional',
          Longitud: 'Media',
          'Talla de gorro': 'Mediana',
          Color: 'Caramelo',
          Densidad: '150%',
        },
      },
      {
        sku: 'POR-D180',
        precio: 300000,
        stockActual: 4,
        stockReservado: 0,
        puntoReorden: 4,
        atributos: {
          'Tipo de base': 'Tradicional',
          Longitud: 'Media',
          'Talla de gorro': 'Mediana',
          Color: 'Caramelo',
          Densidad: '180%',
        },
      },
    ],
  },
  {
    nombre: 'Peluca Rizada Solange',
    slug: 'peluca-rizada-solange',
    descripcion:
      'Peluca de rizos definidos, densidad alta y encaje lace front para un look voluminoso.',
    categoriaSlug: 'pelucas',
    precioBase: 480000,
    calificacion: 4.9,
    cantidadResenas: 93,
    destacado: true,
    variantes: [
      {
        sku: 'PRS-NEG',
        precio: 480000,
        stockActual: 6,
        stockReservado: 1,
        puntoReorden: 3,
        atributos: {
          'Tipo de base': 'Lace front',
          Longitud: 'Extra larga',
          'Talla de gorro': 'Grande',
          Color: 'Negro natural',
          Densidad: '180%',
        },
      },
      {
        sku: 'PRS-CHO',
        precio: 480000,
        stockActual: 5,
        stockReservado: 0,
        puntoReorden: 3,
        atributos: {
          'Tipo de base': 'Lace front',
          Longitud: 'Extra larga',
          'Talla de gorro': 'Grande',
          Color: 'Chocolate',
          Densidad: '180%',
        },
      },
      {
        sku: 'PRS-MIEL',
        precio: 495000,
        stockActual: 3,
        stockReservado: 0,
        puntoReorden: 3,
        atributos: {
          'Tipo de base': 'Lace front',
          Longitud: 'Extra larga',
          'Talla de gorro': 'Grande',
          Color: 'Miel',
          Densidad: '180%',
        },
      },
      {
        sku: 'PRS-RUB',
        precio: 495000,
        stockActual: 2,
        stockReservado: 1,
        puntoReorden: 3,
        atributos: {
          'Tipo de base': 'Lace front',
          Longitud: 'Extra larga',
          'Talla de gorro': 'Grande',
          Color: 'Rubio arena',
          Densidad: '180%',
        },
      },
    ],
  },

  // --- Cuidado: sin atributos, una sola variante ---
  {
    nombre: 'Shampoo Reparador Keratina',
    slug: 'shampoo-reparador-keratina',
    descripcion:
      'Shampoo sin sulfatos con keratina hidrolizada para cabello natural y pelucas de fibra.',
    categoriaSlug: 'cuidado',
    precioBase: 42000,
    calificacion: 4.6,
    cantidadResenas: 65,
    destacado: false,
    variantes: [
      { sku: 'SRK-250', precio: 42000, stockActual: 40, stockReservado: 3, puntoReorden: 10, atributos: {} },
    ],
  },
  {
    nombre: 'Acondicionador Hidratante Argán',
    slug: 'acondicionador-hidratante-argan',
    descripcion: 'Acondicionador con aceite de argán para sellar la cutícula y dar brillo.',
    categoriaSlug: 'cuidado',
    precioBase: 45000,
    calificacion: 4.5,
    cantidadResenas: 48,
    destacado: false,
    variantes: [
      { sku: 'AHA-250', precio: 45000, stockActual: 35, stockReservado: 2, puntoReorden: 10, atributos: {} },
    ],
  },
  {
    nombre: 'Aceite Capilar Nutritivo',
    slug: 'aceite-capilar-nutritivo',
    descripcion: 'Aceite nutritivo multiusos para puntas abiertas y control del frizz.',
    categoriaSlug: 'cuidado',
    precioBase: 38000,
    calificacion: 4.4,
    cantidadResenas: 30,
    destacado: false,
    variantes: [
      { sku: 'ACN-60', precio: 38000, stockActual: 50, stockReservado: 0, puntoReorden: 12, atributos: {} },
    ],
  },

  // --- Extensiones: varían por color y longitud ---
  {
    nombre: 'Extensiones Clip-in Seda',
    slug: 'extensiones-clip-in-seda',
    descripcion:
      'Set de extensiones clip-in de cabello 100% humano, fácil colocación sin necesidad de calor.',
    categoriaSlug: 'extensiones',
    precioBase: 260000,
    calificacion: 4.6,
    cantidadResenas: 37,
    destacado: true,
    variantes: [
      {
        sku: 'ECS-NEG-MED',
        precio: 260000,
        stockActual: 12,
        stockReservado: 1,
        puntoReorden: 4,
        atributos: { Color: 'Negro natural', Longitud: 'Media' },
      },
      {
        sku: 'ECS-CAS-LAR',
        precio: 280000,
        stockActual: 8,
        stockReservado: 0,
        puntoReorden: 4,
        atributos: { Color: 'Castaño oscuro', Longitud: 'Larga' },
      },
      {
        sku: 'ECS-CHO-LAR',
        precio: 280000,
        stockActual: 6,
        stockReservado: 1,
        puntoReorden: 4,
        atributos: { Color: 'Chocolate', Longitud: 'Larga' },
      },
    ],
  },
  {
    nombre: 'Extensiones Cortina Invisible',
    slug: 'extensiones-cortina-invisible',
    descripcion:
      'Extensiones tipo cortina de trama invisible, distribución uniforme en una sola pieza.',
    categoriaSlug: 'extensiones',
    precioBase: 240000,
    calificacion: 4.5,
    cantidadResenas: 22,
    destacado: false,
    variantes: [
      {
        sku: 'ECI-MIEL-MED',
        precio: 240000,
        stockActual: 9,
        stockReservado: 0,
        puntoReorden: 4,
        atributos: { Color: 'Miel', Longitud: 'Media' },
      },
      {
        sku: 'ECI-RUB-LAR',
        precio: 255000,
        stockActual: 5,
        stockReservado: 1,
        puntoReorden: 4,
        atributos: { Color: 'Rubio arena', Longitud: 'Larga' },
      },
    ],
  },

  // --- Accesorios: sin atributos, una sola variante ---
  {
    nombre: 'Gorro de Malla para Peluca',
    slug: 'gorro-de-malla-para-peluca',
    descripcion: 'Gorro de malla transpirable para usar como base antes de colocar la peluca.',
    categoriaSlug: 'accesorios',
    precioBase: 18000,
    calificacion: 4.2,
    cantidadResenas: 19,
    destacado: false,
    variantes: [
      { sku: 'GMP-UNI', precio: 18000, stockActual: 60, stockReservado: 0, puntoReorden: 15, atributos: {} },
    ],
  },
  {
    nombre: 'Peine Especial para Pelucas',
    slug: 'peine-especial-para-pelucas',
    descripcion:
      'Peine de cerdas anchas y espaciadas, diseñado para desenredar pelucas y extensiones sin dañarlas.',
    categoriaSlug: 'accesorios',
    precioBase: 22000,
    calificacion: 4.3,
    cantidadResenas: 15,
    destacado: false,
    variantes: [
      { sku: 'PEP-UNI', precio: 22000, stockActual: 45, stockReservado: 0, puntoReorden: 10, atributos: {} },
    ],
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

    const registroProducto = await prisma.producto.upsert({
      where: { slug: producto.slug },
      update: {
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        categoriaId,
        precioBase: producto.precioBase,
        precioAntes: producto.precioAntes ?? null,
        calificacion: producto.calificacion,
        cantidadResenas: producto.cantidadResenas,
        destacado: producto.destacado,
        activo: true,
      },
      create: {
        nombre: producto.nombre,
        slug: producto.slug,
        descripcion: producto.descripcion,
        categoriaId,
        precioBase: producto.precioBase,
        precioAntes: producto.precioAntes ?? null,
        calificacion: producto.calificacion,
        cantidadResenas: producto.cantidadResenas,
        destacado: producto.destacado,
        activo: true,
      },
    });

    for (const variante of producto.variantes) {
      const registroVariante = await prisma.varianteProducto.upsert({
        where: { sku: variante.sku },
        update: {
          productoId: registroProducto.id,
          precio: variante.precio,
          stockActual: variante.stockActual,
          stockReservado: variante.stockReservado,
          puntoReorden: variante.puntoReorden,
          activa: true,
        },
        create: {
          productoId: registroProducto.id,
          sku: variante.sku,
          precio: variante.precio,
          stockActual: variante.stockActual,
          stockReservado: variante.stockReservado,
          puntoReorden: variante.puntoReorden,
          activa: true,
        },
      });

      for (const [nombreAtributo, textoValor] of Object.entries(variante.atributos)) {
        const atributo = atributoIds[nombreAtributo];
        const valorAtributoId = atributo?.valores[textoValor];
        if (!valorAtributoId) {
          throw new Error(
            `Valor de atributo no encontrado: "${nombreAtributo}" -> "${textoValor}" (variante ${variante.sku})`,
          );
        }

        await prisma.varianteValorAtributo.upsert({
          where: {
            varianteId_valorAtributoId: {
              varianteId: registroVariante.id,
              valorAtributoId,
            },
          },
          update: {},
          create: { varianteId: registroVariante.id, valorAtributoId },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cupones
// ---------------------------------------------------------------------------

interface CuponSeed {
  codigo: string;
  tipo: TipoCupon;
  valor: number;
  montoMinimo: number;
}

const CUPONES: CuponSeed[] = [
  { codigo: 'INDIAROSA10', tipo: 'porcentaje', valor: 10, montoMinimo: 0 },
  { codigo: 'ROSA20', tipo: 'porcentaje', valor: 20, montoMinimo: 500000 },
  { codigo: 'ENVIOGRATIS', tipo: 'envio', valor: 0, montoMinimo: 150000 },
];

async function seedCupones(): Promise<void> {
  for (const cupon of CUPONES) {
    await prisma.cupon.upsert({
      where: { codigo: cupon.codigo },
      update: {
        tipo: cupon.tipo,
        valor: cupon.valor,
        montoMinimo: cupon.montoMinimo,
        activo: true,
      },
      create: {
        codigo: cupon.codigo,
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
// ---------------------------------------------------------------------------

interface ProveedorSeed {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  correo: string;
  diasEntrega: number;
}

const PROVEEDORES: ProveedorSeed[] = [
  {
    id: 'proveedor-hair-import',
    nombre: 'Hair Import Co.',
    contacto: 'Laura Méndez',
    telefono: '+57 300 555 0101',
    correo: 'ventas@hairimportco.com',
    diasEntrega: 12,
  },
  {
    id: 'proveedor-belleza-natural',
    nombre: 'Belleza Natural SAS',
    contacto: 'Diego Osorio',
    telefono: '+57 301 555 0202',
    correo: 'pedidos@bellezanatural.co',
    diasEntrega: 7,
  },
  {
    id: 'proveedor-cosmeticapital',
    nombre: 'CosméticaPital Distribuciones',
    contacto: 'Marcela Ruiz',
    telefono: '+57 302 555 0303',
    correo: 'compras@cosmeticapital.com',
    diasEntrega: 5,
  },
];

async function seedProveedores(): Promise<void> {
  for (const proveedor of PROVEEDORES) {
    await prisma.proveedor.upsert({
      where: { id: proveedor.id },
      update: {
        nombre: proveedor.nombre,
        contacto: proveedor.contacto,
        telefono: proveedor.telefono,
        correo: proveedor.correo,
        diasEntrega: proveedor.diasEntrega,
        activo: true,
      },
      create: { ...proveedor, activo: true },
    });
  }
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

interface UsuarioSeed {
  nombre: string;
  correo: string;
  telefono: string;
  rol: RolUsuario;
  clave: string;
}

const USUARIOS: UsuarioSeed[] = [
  {
    nombre: 'Administración India Rosa',
    correo: 'admin@indiarosa.co',
    telefono: '+57 300 000 0000',
    rol: 'admin',
    clave: 'IndiaRosaAdmin2026!',
  },
  {
    nombre: 'Cliente de Prueba',
    correo: 'cliente.prueba@indiarosa.co',
    telefono: '+57 310 000 0000',
    rol: 'cliente',
    clave: 'ClientePrueba2026!',
  },
];

async function seedUsuarios(): Promise<void> {
  for (const usuario of USUARIOS) {
    const claveHash = await bcrypt.hash(usuario.clave, RONDAS_BCRYPT);
    await prisma.usuario.upsert({
      where: { correo: usuario.correo },
      update: {
        nombre: usuario.nombre,
        claveHash,
        rol: usuario.rol,
        telefono: usuario.telefono,
        activo: true,
      },
      create: {
        nombre: usuario.nombre,
        correo: usuario.correo,
        claveHash,
        rol: usuario.rol,
        telefono: usuario.telefono,
        activo: true,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const categoriaIds = await seedCategorias();
  const atributoIds = await seedAtributos();
  await seedProductos(categoriaIds, atributoIds);
  await seedCupones();
  await seedProveedores();
  await seedUsuarios();

  console.log('Seed completado.');
  console.log('Usuarios de prueba (correo / clave):');
  for (const usuario of USUARIOS) {
    console.log(`  ${usuario.correo} / ${usuario.clave}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
