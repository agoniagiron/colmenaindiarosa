// Datos simulados, usados solo por las pruebas (ver src/test/setup.ts).
// Nadie fuera de datos/repositorioMemoria.ts debería importar este archivo
// directamente: el acceso pasa siempre por datos/repositorio.ts.
//
// La forma de cada entrada debe coincidir con lo que devuelve la API real
// (ver api/src/modulos/*): precios en {cop,usd}, configuración pública como
// arreglo de {clave,valor,grupo,etiqueta}, etc.

import type {
  Categoria,
  Combo,
  Cupon,
  EdicionLimitada,
  EntradaConfiguracion,
  PrecioDual,
  Producto,
  ValorAtributo,
  VarianteProducto,
} from '../tipos/index.ts';

// Misma tasa que usa la API real (moneda.tasa_usd) para que los USD de
// muestra sean coherentes entre sí.
const TASA_USD_MUESTRA = 4100;

function pd(cop: number): PrecioDual {
  return { cop, usd: Math.round((cop / TASA_USD_MUESTRA) * 100) };
}

export const CATEGORIAS: Categoria[] = [
  { id: 'cat-pelucas', nombre: 'Pelucas', slug: 'pelucas' },
  { id: 'cat-cuidado', nombre: 'Cuidado', slug: 'cuidado' },
  { id: 'cat-extensiones', nombre: 'Extensiones', slug: 'extensiones' },
  { id: 'cat-accesorios', nombre: 'Accesorios', slug: 'accesorios' },
];

const COLORES = {
  negroNatural: { nombre: 'Negro natural', hex: '#1c1412' },
  castanoOscuro: { nombre: 'Castaño oscuro', hex: '#3b2620' },
  chocolate: { nombre: 'Chocolate', hex: '#5a3a2a' },
  caramelo: { nombre: 'Caramelo', hex: '#8a5a34' },
  miel: { nombre: 'Miel', hex: '#a97e4c' },
  rubioArena: { nombre: 'Rubio arena', hex: '#c9a97c' },
} as const satisfies Record<string, ValorAtributo>;

function imagen(slugProducto: string, indice: number, altTexto: string) {
  return {
    id: `img-${slugProducto}-${indice}`,
    url: `/productos/${slugProducto}-${indice}.jpg`,
    altTexto,
  };
}

// Todavía no hay fotos reales: cada entrada es el mismo marcador de
// posición con un desplazamiento de tono distinto, solo para poder ver y
// probar la tira de miniaturas de la ficha de producto.
function imagenesProducto(slugProducto: string, nombre: string) {
  return [
    imagen(slugProducto, 1, `${nombre}, vista principal`),
    imagen(slugProducto, 2, `${nombre}, tono más claro`),
    imagen(slugProducto, 3, `${nombre}, tono más oscuro`),
    imagen(slugProducto, 4, `${nombre}, tono intenso`),
  ];
}

// Variante sin promoción: precioOriginal y precioConDescuento son iguales,
// tal como los devuelve el backend cuando no hay ninguna vigente.
function variante(
  datos: Omit<VarianteProducto, 'precioOriginal' | 'precioConDescuento' | 'precioAntes'> & {
    precioCop: number;
    precioAntesCop?: number;
  },
): VarianteProducto {
  const { precioCop, precioAntesCop, ...resto } = datos;
  return {
    ...resto,
    precioOriginal: pd(precioCop),
    precioConDescuento: pd(precioCop),
    ...(precioAntesCop !== undefined ? { precioAntes: pd(precioAntesCop) } : {}),
  };
}

function precioBaseDesde(variantes: VarianteProducto[]): PrecioDual {
  const minimo = Math.min(...variantes.map((v) => v.precioConDescuento.cop));
  return pd(minimo);
}

const VARIANTES_VALENTINA: VarianteProducto[] = [
  variante({
    id: 'var-PLV-NEG-130',
    sku: 'PLV-NEG-130',
    precioCop: 420000,
    precioAntesCop: 480000,
    stockActual: 14,
    stockReservado: 2,
    tipoBase: 'Lace front',
    longitud: 'Larga',
    talla: 'Mediana',
    densidad: '130%',
    color: COLORES.negroNatural,
  }),
  variante({
    id: 'var-PLV-CAS-150',
    sku: 'PLV-CAS-150',
    precioCop: 440000,
    stockActual: 9,
    stockReservado: 1,
    tipoBase: 'Lace front',
    longitud: 'Larga',
    talla: 'Mediana',
    densidad: '150%',
    color: COLORES.castanoOscuro,
  }),
  variante({
    id: 'var-PLV-CHO-150',
    sku: 'PLV-CHO-150',
    precioCop: 440000,
    stockActual: 6,
    stockReservado: 0,
    tipoBase: 'Lace front',
    longitud: 'Larga',
    talla: 'Mediana',
    densidad: '150%',
    color: COLORES.chocolate,
  }),
  variante({
    // Variante agotada, para probar el estado "sin stock" en el catálogo.
    id: 'var-PLV-CAR-180',
    sku: 'PLV-CAR-180',
    precioCop: 465000,
    stockActual: 0,
    stockReservado: 0,
    tipoBase: 'Lace front',
    longitud: 'Larga',
    talla: 'Mediana',
    densidad: '180%',
    color: COLORES.caramelo,
  }),
];

const VARIANTES_CAMILA: VarianteProducto[] = [
  variante({
    id: 'var-PFC-MED-MIEL',
    sku: 'PFC-MED-MIEL',
    precioCop: 520000,
    stockActual: 8,
    stockReservado: 1,
    tipoBase: 'Full lace',
    longitud: 'Media',
    talla: 'Grande',
    densidad: '150%',
    color: COLORES.miel,
  }),
  variante({
    id: 'var-PFC-LAR-RUB',
    sku: 'PFC-LAR-RUB',
    precioCop: 545000,
    stockActual: 5,
    stockReservado: 0,
    tipoBase: 'Full lace',
    longitud: 'Larga',
    talla: 'Grande',
    densidad: '150%',
    color: COLORES.rubioArena,
  }),
  variante({
    id: 'var-PFC-EXL-NEG',
    sku: 'PFC-EXL-NEG',
    precioCop: 570000,
    stockActual: 3,
    stockReservado: 1,
    tipoBase: 'Full lace',
    longitud: 'Extra larga',
    talla: 'Grande',
    densidad: '150%',
    color: COLORES.negroNatural,
  }),
];

const VARIANTES_BOB_CLEO: VarianteProducto[] = [
  variante({
    id: 'var-PBC-PEQ-CAS',
    sku: 'PBC-PEQ-CAS',
    precioCop: 310000,
    stockActual: 11,
    stockReservado: 0,
    tipoBase: 'Monofilamento',
    longitud: 'Corta',
    talla: 'Pequeña',
    densidad: '130%',
    color: COLORES.castanoOscuro,
  }),
  variante({
    id: 'var-PBC-MED-CHO',
    sku: 'PBC-MED-CHO',
    precioCop: 310000,
    stockActual: 7,
    stockReservado: 2,
    tipoBase: 'Monofilamento',
    longitud: 'Corta',
    talla: 'Mediana',
    densidad: '130%',
    color: COLORES.chocolate,
  }),
  variante({
    id: 'var-PBC-MED-NEG',
    sku: 'PBC-MED-NEG',
    precioCop: 310000,
    stockActual: 10,
    stockReservado: 0,
    tipoBase: 'Monofilamento',
    longitud: 'Corta',
    talla: 'Mediana',
    densidad: '130%',
    color: COLORES.negroNatural,
  }),
];

const VARIANTES_RENATA: VarianteProducto[] = [
  variante({
    id: 'var-POR-D130',
    sku: 'POR-D130',
    precioCop: 265000,
    stockActual: 13,
    stockReservado: 0,
    tipoBase: 'Tradicional',
    longitud: 'Media',
    talla: 'Mediana',
    densidad: '130%',
    color: COLORES.caramelo,
  }),
  variante({
    id: 'var-POR-D150',
    sku: 'POR-D150',
    precioCop: 280000,
    stockActual: 9,
    stockReservado: 1,
    tipoBase: 'Tradicional',
    longitud: 'Media',
    talla: 'Mediana',
    densidad: '150%',
    color: COLORES.caramelo,
  }),
  variante({
    id: 'var-POR-D180',
    sku: 'POR-D180',
    precioCop: 300000,
    stockActual: 4,
    stockReservado: 0,
    tipoBase: 'Tradicional',
    longitud: 'Media',
    talla: 'Mediana',
    densidad: '180%',
    color: COLORES.caramelo,
  }),
];

const VARIANTES_SOLANGE: VarianteProducto[] = [
  variante({
    id: 'var-PRS-NEG',
    sku: 'PRS-NEG',
    precioCop: 480000,
    stockActual: 6,
    stockReservado: 1,
    tipoBase: 'Lace front',
    longitud: 'Extra larga',
    talla: 'Grande',
    densidad: '180%',
    color: COLORES.negroNatural,
  }),
  variante({
    id: 'var-PRS-CHO',
    sku: 'PRS-CHO',
    precioCop: 480000,
    stockActual: 5,
    stockReservado: 0,
    tipoBase: 'Lace front',
    longitud: 'Extra larga',
    talla: 'Grande',
    densidad: '180%',
    color: COLORES.chocolate,
  }),
  variante({
    id: 'var-PRS-MIEL',
    sku: 'PRS-MIEL',
    precioCop: 495000,
    stockActual: 3,
    stockReservado: 0,
    tipoBase: 'Lace front',
    longitud: 'Extra larga',
    talla: 'Grande',
    densidad: '180%',
    color: COLORES.miel,
  }),
  variante({
    id: 'var-PRS-RUB',
    sku: 'PRS-RUB',
    precioCop: 495000,
    stockActual: 2,
    stockReservado: 1,
    tipoBase: 'Lace front',
    longitud: 'Extra larga',
    talla: 'Grande',
    densidad: '180%',
    color: COLORES.rubioArena,
  }),
];

const VARIANTES_SHAMPOO: VarianteProducto[] = [
  variante({
    id: 'var-SRK-250',
    sku: 'SRK-250',
    precioCop: 42000,
    stockActual: 40,
    stockReservado: 3,
  }),
];
const VARIANTES_ACONDICIONADOR: VarianteProducto[] = [
  variante({
    id: 'var-AHA-250',
    sku: 'AHA-250',
    precioCop: 45000,
    stockActual: 35,
    stockReservado: 2,
  }),
];
const VARIANTES_ACEITE: VarianteProducto[] = [
  variante({
    id: 'var-ACN-60',
    sku: 'ACN-60',
    precioCop: 38000,
    stockActual: 50,
    stockReservado: 0,
  }),
];
const VARIANTES_EXTENSIONES_SEDA: VarianteProducto[] = [
  variante({
    id: 'var-ECS-NEG-MED',
    sku: 'ECS-NEG-MED',
    precioCop: 260000,
    stockActual: 12,
    stockReservado: 1,
    longitud: 'Media',
    color: COLORES.negroNatural,
  }),
  variante({
    id: 'var-ECS-CAS-LAR',
    sku: 'ECS-CAS-LAR',
    precioCop: 280000,
    stockActual: 8,
    stockReservado: 0,
    longitud: 'Larga',
    color: COLORES.castanoOscuro,
  }),
  variante({
    id: 'var-ECS-CHO-LAR',
    sku: 'ECS-CHO-LAR',
    precioCop: 280000,
    stockActual: 6,
    stockReservado: 1,
    longitud: 'Larga',
    color: COLORES.chocolate,
  }),
];
const VARIANTES_EXTENSIONES_CORTINA: VarianteProducto[] = [
  variante({
    id: 'var-ECI-MIEL-MED',
    sku: 'ECI-MIEL-MED',
    precioCop: 240000,
    stockActual: 9,
    stockReservado: 0,
    longitud: 'Media',
    color: COLORES.miel,
  }),
  variante({
    id: 'var-ECI-RUB-LAR',
    sku: 'ECI-RUB-LAR',
    precioCop: 255000,
    stockActual: 5,
    stockReservado: 1,
    longitud: 'Larga',
    color: COLORES.rubioArena,
  }),
];
const VARIANTES_GORRO: VarianteProducto[] = [
  variante({
    id: 'var-GMP-UNI',
    sku: 'GMP-UNI',
    precioCop: 18000,
    stockActual: 60,
    stockReservado: 0,
  }),
];
const VARIANTES_PEINE: VarianteProducto[] = [
  variante({
    id: 'var-PEP-UNI',
    sku: 'PEP-UNI',
    precioCop: 22000,
    stockActual: 45,
    stockReservado: 0,
  }),
];

export const PRODUCTOS: Producto[] = [
  {
    id: 'prod-peluca-lace-front-valentina',
    nombre: 'Peluca Lace Front Valentina',
    slug: 'peluca-lace-front-valentina',
    descripcion:
      'Peluca de lace front con encaje transparente en la línea frontal, cabello 100% humano remy.',
    categoriaId: 'cat-pelucas',
    precioBase: precioBaseDesde(VARIANTES_VALENTINA),
    calificacion: 4.7,
    cantidadResenas: 128,
    destacado: true,
    imagenes: imagenesProducto('peluca-lace-front-valentina', 'Peluca Lace Front Valentina'),
    variantes: VARIANTES_VALENTINA,
  },
  {
    id: 'prod-peluca-full-lace-camila',
    nombre: 'Peluca Full Lace Camila',
    slug: 'peluca-full-lace-camila',
    descripcion:
      'Peluca full lace con encaje en toda la base, permite peinados hacia atrás y raya en cualquier dirección.',
    categoriaId: 'cat-pelucas',
    precioBase: precioBaseDesde(VARIANTES_CAMILA),
    calificacion: 4.8,
    cantidadResenas: 76,
    destacado: true,
    imagenes: imagenesProducto('peluca-full-lace-camila', 'Peluca Full Lace Camila'),
    variantes: VARIANTES_CAMILA,
  },
  {
    id: 'prod-peluca-bob-cleo',
    nombre: 'Peluca Bob Cleo',
    slug: 'peluca-bob-cleo',
    descripcion:
      'Peluca corte bob a la altura de la mandíbula, base de monofilamento para un nacimiento natural.',
    categoriaId: 'cat-pelucas',
    precioBase: precioBaseDesde(VARIANTES_BOB_CLEO),
    calificacion: 4.5,
    cantidadResenas: 54,
    destacado: false,
    imagenes: imagenesProducto('peluca-bob-cleo', 'Peluca Bob Cleo'),
    variantes: VARIANTES_BOB_CLEO,
  },
  {
    id: 'prod-peluca-ondulada-renata',
    nombre: 'Peluca Ondulada Renata',
    slug: 'peluca-ondulada-renata',
    descripcion: 'Peluca de ondas suaves, base tradicional cosida, ideal para uso diario.',
    categoriaId: 'cat-pelucas',
    precioBase: precioBaseDesde(VARIANTES_RENATA),
    calificacion: 4.3,
    cantidadResenas: 41,
    destacado: false,
    imagenes: imagenesProducto('peluca-ondulada-renata', 'Peluca Ondulada Renata'),
    variantes: VARIANTES_RENATA,
  },
  {
    id: 'prod-peluca-rizada-solange',
    nombre: 'Peluca Rizada Solange',
    slug: 'peluca-rizada-solange',
    descripcion:
      'Peluca de rizos definidos, densidad alta y encaje lace front para un look voluminoso.',
    categoriaId: 'cat-pelucas',
    precioBase: precioBaseDesde(VARIANTES_SOLANGE),
    calificacion: 4.9,
    cantidadResenas: 93,
    destacado: true,
    imagenes: imagenesProducto('peluca-rizada-solange', 'Peluca Rizada Solange'),
    variantes: VARIANTES_SOLANGE,
  },

  // --- Cuidado: sin atributos, una sola variante ---
  {
    id: 'prod-shampoo-reparador-keratina',
    nombre: 'Shampoo Reparador Keratina',
    slug: 'shampoo-reparador-keratina',
    descripcion:
      'Shampoo sin sulfatos con keratina hidrolizada para cabello natural y pelucas de fibra.',
    categoriaId: 'cat-cuidado',
    precioBase: precioBaseDesde(VARIANTES_SHAMPOO),
    calificacion: 4.6,
    cantidadResenas: 65,
    destacado: false,
    imagenes: imagenesProducto('shampoo-reparador-keratina', 'Shampoo Reparador Keratina'),
    variantes: VARIANTES_SHAMPOO,
  },
  {
    id: 'prod-acondicionador-hidratante-argan',
    nombre: 'Acondicionador Hidratante Argán',
    slug: 'acondicionador-hidratante-argan',
    descripcion: 'Acondicionador con aceite de argán para sellar la cutícula y dar brillo.',
    categoriaId: 'cat-cuidado',
    precioBase: precioBaseDesde(VARIANTES_ACONDICIONADOR),
    calificacion: 4.5,
    cantidadResenas: 48,
    destacado: false,
    imagenes: imagenesProducto(
      'acondicionador-hidratante-argan',
      'Acondicionador Hidratante Argán',
    ),
    variantes: VARIANTES_ACONDICIONADOR,
  },
  {
    id: 'prod-aceite-capilar-nutritivo',
    nombre: 'Aceite Capilar Nutritivo',
    slug: 'aceite-capilar-nutritivo',
    descripcion: 'Aceite nutritivo multiusos para puntas abiertas y control del frizz.',
    categoriaId: 'cat-cuidado',
    precioBase: precioBaseDesde(VARIANTES_ACEITE),
    calificacion: 4.4,
    cantidadResenas: 30,
    destacado: false,
    imagenes: imagenesProducto('aceite-capilar-nutritivo', 'Aceite Capilar Nutritivo'),
    variantes: VARIANTES_ACEITE,
  },

  // --- Extensiones: varían por color y longitud ---
  {
    id: 'prod-extensiones-clip-in-seda',
    nombre: 'Extensiones Clip-in Seda',
    slug: 'extensiones-clip-in-seda',
    descripcion:
      'Set de extensiones clip-in de cabello 100% humano, fácil colocación sin necesidad de calor.',
    categoriaId: 'cat-extensiones',
    precioBase: precioBaseDesde(VARIANTES_EXTENSIONES_SEDA),
    calificacion: 4.6,
    cantidadResenas: 37,
    destacado: true,
    imagenes: imagenesProducto('extensiones-clip-in-seda', 'Extensiones Clip-in Seda'),
    variantes: VARIANTES_EXTENSIONES_SEDA,
  },
  {
    id: 'prod-extensiones-cortina-invisible',
    nombre: 'Extensiones Cortina Invisible',
    slug: 'extensiones-cortina-invisible',
    descripcion:
      'Extensiones tipo cortina de trama invisible, distribución uniforme en una sola pieza.',
    categoriaId: 'cat-extensiones',
    precioBase: precioBaseDesde(VARIANTES_EXTENSIONES_CORTINA),
    calificacion: 4.5,
    cantidadResenas: 22,
    destacado: false,
    imagenes: imagenesProducto('extensiones-cortina-invisible', 'Extensiones Cortina Invisible'),
    variantes: VARIANTES_EXTENSIONES_CORTINA,
  },

  // --- Accesorios: sin atributos, una sola variante ---
  {
    id: 'prod-gorro-de-malla-para-peluca',
    nombre: 'Gorro de Malla para Peluca',
    slug: 'gorro-de-malla-para-peluca',
    descripcion: 'Gorro de malla transpirable para usar como base antes de colocar la peluca.',
    categoriaId: 'cat-accesorios',
    precioBase: precioBaseDesde(VARIANTES_GORRO),
    calificacion: 4.2,
    cantidadResenas: 19,
    destacado: false,
    imagenes: imagenesProducto('gorro-de-malla-para-peluca', 'Gorro de Malla para Peluca'),
    variantes: VARIANTES_GORRO,
  },
  {
    id: 'prod-peine-especial-para-pelucas',
    nombre: 'Peine Especial para Pelucas',
    slug: 'peine-especial-para-pelucas',
    descripcion:
      'Peine de cerdas anchas y espaciadas, diseñado para desenredar pelucas y extensiones sin dañarlas.',
    categoriaId: 'cat-accesorios',
    precioBase: precioBaseDesde(VARIANTES_PEINE),
    calificacion: 4.3,
    cantidadResenas: 15,
    destacado: false,
    imagenes: imagenesProducto('peine-especial-para-pelucas', 'Peine Especial para Pelucas'),
    variantes: VARIANTES_PEINE,
  },
];

export const CUPONES: Cupon[] = [
  { codigo: 'INDIAROSA10', tipo: 'porcentaje', valor: 10, montoMinimo: 0 },
  { codigo: 'ROSA20', tipo: 'porcentaje', valor: 20, montoMinimo: 500000 },
  { codigo: 'ENVIOGRATIS', tipo: 'envio', valor: 0, montoMinimo: 0 },
];

// --- Configuración pública, ediciones limitadas y kits ---------------------
// Mismas claves y valores reales que trae hoy la tabla `configuracion` en
// Supabase (grupos envio, descuento, moneda, tienda, catalogo).

export const CONFIGURACION_PUBLICA: EntradaConfiguracion[] = [
  { clave: 'envio.costo', valor: 15000, grupo: 'envio', etiqueta: 'Costo de envío' },
  {
    clave: 'descuento.umbral',
    valor: 400000,
    grupo: 'descuento',
    etiqueta: 'Compra mínima para descuento',
  },
  {
    clave: 'descuento.porcentaje',
    valor: 10,
    grupo: 'descuento',
    etiqueta: 'Porcentaje de descuento',
  },
  {
    clave: 'descuento.activo',
    valor: true,
    grupo: 'descuento',
    etiqueta: 'Descuento por monto activo',
  },
  { clave: 'tienda.whatsapp', valor: '', grupo: 'tienda', etiqueta: 'WhatsApp de la tienda' },
  {
    clave: 'tienda.correo',
    valor: 'hola@indiarosa.co',
    grupo: 'tienda',
    etiqueta: 'Correo de contacto',
  },
  {
    clave: 'tienda.aviso_superior',
    valor: '10% de descuento en compras desde $400.000',
    grupo: 'tienda',
    etiqueta: 'Aviso de la barra superior',
  },
  { clave: 'catalogo.por_pagina', valor: 24, grupo: 'catalogo', etiqueta: 'Productos por página' },
  {
    clave: 'moneda.mostrar_usd',
    valor: true,
    grupo: 'moneda',
    etiqueta: 'Mostrar precios en dólares',
  },
  {
    clave: 'moneda.tasa_usd',
    valor: TASA_USD_MUESTRA,
    grupo: 'moneda',
    etiqueta: 'Tasa de cambio',
  },
  {
    clave: 'moneda.aviso_usd',
    valor: 'Precio de referencia. El cobro se realiza en pesos colombianos.',
    grupo: 'moneda',
    etiqueta: 'Aviso del precio en dólares',
  },
  { clave: 'entrega.dias_cali', valor: 1, grupo: 'envio', etiqueta: 'Días de entrega en Cali' },
  {
    clave: 'entrega.dias_principales',
    valor: 2,
    grupo: 'envio',
    etiqueta: 'Días en ciudades principales',
  },
  { clave: 'entrega.dias_resto', valor: 4, grupo: 'envio', etiqueta: 'Días en el resto del país' },
  {
    clave: 'entrega.ciudades_principales',
    valor: 'Bogotá,Medellín,Barranquilla,Cartagena,Bucaramanga,Pereira',
    grupo: 'envio',
    etiqueta: 'Ciudades principales',
  },
];

export const LIMITADAS: EdicionLimitada[] = [
  {
    id: 'lim-balayage-miel',
    nombre: 'Peluca balayage miel',
    descripcion: 'Colección de octubre',
    unidadesLote: 8,
    unidadesRestantes: 3,
    desde: '2026-09-01T00:00:00.000Z',
    hasta: null,
    producto: {
      id: 'prod-peluca-lace-front-valentina',
      nombre: 'Peluca Lace Front Valentina',
      slug: 'peluca-lace-front-valentina',
      imagen: {
        url: '/productos/peluca-lace-front-valentina-1.jpg',
        altTexto: 'Peluca balayage miel',
      },
    },
    precio: pd(610000),
  },
  {
    id: 'lim-360-ondas',
    nombre: 'Peluca 360 ondas naturales',
    descripcion: 'Lote único',
    unidadesLote: 6,
    unidadesRestantes: 5,
    desde: '2026-09-01T00:00:00.000Z',
    hasta: null,
    producto: {
      id: 'prod-peluca-full-lace-camila',
      nombre: 'Peluca Full Lace Camila',
      slug: 'peluca-full-lace-camila',
      imagen: {
        url: '/productos/peluca-full-lace-camila-1.jpg',
        altTexto: 'Peluca 360 ondas naturales',
      },
    },
    precio: pd(520000),
  },
];

export const COMBOS: Combo[] = [
  {
    id: 'combo-primera-peluca',
    nombre: 'Kit primera peluca',
    slug: 'kit-primera-peluca',
    descripcion: null,
    imagenUrl: null,
    precio: pd(420000),
    precioPiezasPorSeparado: pd(487000),
    disponible: true,
    items: [
      {
        varianteId: 'var-PLV-NEG-130',
        sku: 'PLV-NEG-130',
        nombreProducto: 'Peluca Lace Front Valentina',
        cantidad: 1,
        precioUnitario: pd(420000),
      },
      {
        varianteId: 'var-SRK-250',
        sku: 'SRK-250',
        nombreProducto: 'Shampoo Reparador Keratina',
        cantidad: 1,
        precioUnitario: pd(42000),
      },
    ],
  },
  {
    id: 'combo-cuidado-completo',
    nombre: 'Kit cuidado completo',
    slug: 'kit-cuidado-completo',
    descripcion: null,
    imagenUrl: null,
    precio: pd(70000),
    precioPiezasPorSeparado: pd(87000),
    // Sin stock suficiente de una de las piezas: prueba la tarjeta de kit
    // agotado (con el botón deshabilitado, no oculta).
    disponible: false,
    items: [
      {
        varianteId: 'var-SRK-250',
        sku: 'SRK-250',
        nombreProducto: 'Shampoo Reparador Keratina',
        cantidad: 1,
        precioUnitario: pd(42000),
      },
      {
        varianteId: 'var-AHA-250',
        sku: 'AHA-250',
        nombreProducto: 'Acondicionador Hidratante Argán',
        cantidad: 1,
        precioUnitario: pd(45000),
      },
    ],
  },
];
