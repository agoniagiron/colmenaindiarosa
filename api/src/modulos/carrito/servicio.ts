import { Prisma } from '@prisma/client';
import { calcularTotales } from '../../dominio/calcularTotales.js';
import { extraerAtributosVariante } from '../../lib/atributosVariante.js';
import { obtenerConfigTotales } from '../../lib/configuracion.js';
import { ErrorApi } from '../../lib/errorApi.js';
import { formatearPesos } from '../../lib/formatearPesos.js';
import { calcularPrecioDualConTasa, obtenerTasaUsdVigente } from '../../lib/moneda.js';
import { prisma } from '../../lib/prisma.js';
import type { DatosAgregarItem } from './esquemas.js';

export type Propietario = { usuarioId: string } | { visitanteId: string };

function perteneceAlPropietario(
  carrito: { usuarioId: string | null; visitanteId: string | null },
  propietario: Propietario,
): boolean {
  if ('usuarioId' in propietario) return carrito.usuarioId === propietario.usuarioId;
  return carrito.visitanteId === propietario.visitanteId;
}

// ---------------------------------------------------------------------------
// Selects y mapeo de respuesta
//
// Una línea de carrito es variante XOR combo (ver el check constraint en la
// base). varianteProducto/combo llegan nulos según cuál sea.
// ---------------------------------------------------------------------------

const SELECT_ITEM = {
  id: true,
  varianteId: true,
  comboId: true,
  cantidad: true,
  varianteProducto: {
    select: {
      id: true,
      sku: true,
      precioActual: true,
      stockActual: true,
      stockReservado: true,
      productoId: true,
      valoresAtributo: {
        select: {
          valorAtributo: {
            select: { valor: true, hex: true, atributo: { select: { slug: true } } },
          },
        },
      },
      producto: {
        select: {
          nombre: true,
          imagenes: {
            where: { varianteId: null },
            orderBy: { orden: 'asc' },
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  },
  combo: {
    select: {
      id: true,
      nombre: true,
      precioCop: true,
      imagenUrl: true,
      items: {
        select: {
          cantidad: true,
          varianteProducto: { select: { stockActual: true, stockReservado: true } },
        },
      },
    },
  },
} satisfies Prisma.CarritoItemSelect;

const SELECT_CARRITO = {
  id: true,
  usuarioId: true,
  visitanteId: true,
  cuponId: true,
  cupon: { select: { codigo: true, tipo: true, valor: true, montoMinimo: true } },
  items: { select: SELECT_ITEM },
} satisfies Prisma.CarritoSelect;

type ItemDeCarrito = Prisma.CarritoItemGetPayload<{ select: typeof SELECT_ITEM }>;
type CarritoConItems = Prisma.CarritoGetPayload<{ select: typeof SELECT_CARRITO }>;

function mapearLineaVariante(
  item: ItemDeCarrito & { varianteProducto: NonNullable<ItemDeCarrito['varianteProducto']> },
) {
  const v = item.varianteProducto;
  const atributos = extraerAtributosVariante(v.valoresAtributo);
  const disponible = v.stockActual - v.stockReservado;

  return {
    tipo: 'variante' as const,
    id: item.id,
    varianteId: v.id,
    productoId: v.productoId,
    nombreProducto: v.producto.nombre,
    ...atributos,
    precioUnitario: v.precioActual,
    cantidad: item.cantidad,
    ...(v.producto.imagenes[0] ? { imagenUrl: v.producto.imagenes[0].url } : {}),
    disponible,
  };
}

function mapearLineaCombo(item: ItemDeCarrito & { combo: NonNullable<ItemDeCarrito['combo']> }) {
  const combo = item.combo;
  // Cuántos combos completos se pueden armar hoy con el stock disponible
  // de la pieza más limitante.
  const disponible = combo.items.reduce((minimo, pieza) => {
    const disponiblePieza =
      pieza.varianteProducto.stockActual - pieza.varianteProducto.stockReservado;
    return Math.min(minimo, Math.floor(disponiblePieza / pieza.cantidad));
  }, Infinity);

  return {
    tipo: 'combo' as const,
    id: item.id,
    comboId: combo.id,
    nombreProducto: combo.nombre,
    precioUnitario: combo.precioCop,
    cantidad: item.cantidad,
    ...(combo.imagenUrl ? { imagenUrl: combo.imagenUrl } : {}),
    disponible: Number.isFinite(disponible) ? disponible : 0,
  };
}

function mapearLinea(item: ItemDeCarrito) {
  if (item.varianteProducto) return mapearLineaVariante(item as never);
  if (item.combo) return mapearLineaCombo(item as never);
  // No debería pasar: la base fuerza variante XOR combo.
  throw ErrorApi.interno('Línea de carrito sin variante ni combo');
}

async function mapearCarrito(carrito: CarritoConItems | null) {
  const lineas = carrito ? carrito.items.map(mapearLinea) : [];
  const cupon = carrito?.cupon ?? null;

  const [config, tasaUsd] = await Promise.all([obtenerConfigTotales(), obtenerTasaUsdVigente()]);
  const totales = calcularTotales(lineas, cupon, config);

  // COP sigue siendo el valor autoritativo (es lo que efectivamente se
  // cobra); acá solo se agrega el equivalente en USD a la tasa vigente.
  const totalesConUsd = {
    ...totales,
    usd: {
      subtotal: calcularPrecioDualConTasa(totales.subtotal, null, tasaUsd).usd,
      descuento: calcularPrecioDualConTasa(totales.descuento, null, tasaUsd).usd,
      envio: calcularPrecioDualConTasa(totales.envio, null, tasaUsd).usd,
      total: calcularPrecioDualConTasa(totales.total, null, tasaUsd).usd,
    },
  };

  return { lineas, cupon, totales: totalesConUsd };
}

export type CarritoRespuesta = Awaited<ReturnType<typeof mapearCarrito>>;

// ---------------------------------------------------------------------------
// Obtener / crear el carrito abierto (convertido_en nulo) del propietario
// ---------------------------------------------------------------------------

async function buscarCarritoAbierto(propietario: Propietario): Promise<CarritoConItems | null> {
  return prisma.carrito.findFirst({
    where: { ...propietario, convertidoEn: null },
    orderBy: { creadoEn: 'desc' },
    select: SELECT_CARRITO,
  });
}

async function obtenerOCrearCarritoAbierto(propietario: Propietario): Promise<CarritoConItems> {
  const existente = await buscarCarritoAbierto(propietario);
  if (existente) return existente;
  return prisma.carrito.create({ data: propietario, select: SELECT_CARRITO });
}

export async function obtenerCarrito(propietario: Propietario): Promise<CarritoRespuesta> {
  const carrito = await buscarCarritoAbierto(propietario);
  return mapearCarrito(carrito);
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

function mensajeDisponibilidad(disponible: number): string {
  return disponible > 0
    ? `Solo quedan ${disponible} unidades disponibles de este producto`
    : 'Este producto ya no tiene disponibilidad';
}

function mensajeDisponibilidadCombo(disponible: number): string {
  return disponible > 0
    ? `Solo se pueden armar ${disponible} combos con el stock disponible de sus piezas`
    : 'Alguna pieza de este combo ya no tiene disponibilidad suficiente';
}

async function agregarItemVariante(
  propietario: Propietario,
  varianteId: string,
  cantidadPedida: number,
  sesionId: string | undefined,
): Promise<CarritoRespuesta> {
  const variante = await prisma.varianteProducto.findUnique({
    where: { id: varianteId },
    select: { id: true, activa: true, stockActual: true, stockReservado: true, productoId: true },
  });
  if (!variante || !variante.activa) {
    throw ErrorApi.noEncontrado('La variante no existe o no está disponible');
  }

  const carrito = await obtenerOCrearCarritoAbierto(propietario);
  const existente = carrito.items.find((item) => item.varianteId === varianteId);
  const cantidadTotal = (existente?.cantidad ?? 0) + cantidadPedida;
  const disponible = variante.stockActual - variante.stockReservado;

  if (cantidadTotal > disponible) {
    throw ErrorApi.peticionInvalida(mensajeDisponibilidad(disponible));
  }

  if (existente) {
    await prisma.carritoItem.update({
      where: { id: existente.id },
      data: { cantidad: cantidadTotal },
    });
  } else {
    await prisma.carritoItem.create({
      data: { carritoId: carrito.id, varianteId, cantidad: cantidadPedida },
    });
  }

  await registrarAgregarCarrito(variante.productoId, varianteId, cantidadPedida, sesionId);

  return mapearCarrito(await buscarCarritoAbierto(propietario));
}

async function agregarItemCombo(
  propietario: Propietario,
  comboId: string,
  cantidadPedida: number,
): Promise<CarritoRespuesta> {
  const combo = await prisma.combo.findUnique({
    where: { id: comboId },
    select: {
      id: true,
      activo: true,
      items: {
        select: {
          cantidad: true,
          varianteProducto: { select: { stockActual: true, stockReservado: true } },
        },
      },
    },
  });
  if (!combo || !combo.activo) {
    throw ErrorApi.noEncontrado('El combo no existe o no está disponible');
  }

  const carrito = await obtenerOCrearCarritoAbierto(propietario);
  const existente = carrito.items.find((item) => item.comboId === comboId);
  const cantidadTotal = (existente?.cantidad ?? 0) + cantidadPedida;

  const disponibleCombos = combo.items.reduce((minimo, pieza) => {
    const disponiblePieza =
      pieza.varianteProducto.stockActual - pieza.varianteProducto.stockReservado;
    return Math.min(minimo, Math.floor(disponiblePieza / pieza.cantidad));
  }, Infinity);
  const disponible = Number.isFinite(disponibleCombos) ? disponibleCombos : 0;

  if (cantidadTotal > disponible) {
    throw ErrorApi.peticionInvalida(mensajeDisponibilidadCombo(disponible));
  }

  if (existente) {
    await prisma.carritoItem.update({
      where: { id: existente.id },
      data: { cantidad: cantidadTotal },
    });
  } else {
    await prisma.carritoItem.create({
      data: { carritoId: carrito.id, comboId, cantidad: cantidadPedida },
    });
  }

  return mapearCarrito(await buscarCarritoAbierto(propietario));
}

export async function agregarItem(
  propietario: Propietario,
  datos: DatosAgregarItem,
  sesionId: string | undefined,
): Promise<CarritoRespuesta> {
  if ('varianteId' in datos) {
    return agregarItemVariante(propietario, datos.varianteId, datos.cantidad, sesionId);
  }
  return agregarItemCombo(propietario, datos.comboId, datos.cantidad);
}

export async function actualizarCantidad(
  propietario: Propietario,
  itemId: string,
  cantidadNueva: number,
): Promise<CarritoRespuesta> {
  const item = await prisma.carritoItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      varianteId: true,
      comboId: true,
      carrito: { select: { usuarioId: true, visitanteId: true } },
    },
  });
  if (!item || !perteneceAlPropietario(item.carrito, propietario)) {
    throw ErrorApi.noEncontrado('La línea del carrito no existe');
  }

  if (cantidadNueva <= 0) {
    await prisma.carritoItem.delete({ where: { id: itemId } });
  } else if (item.varianteId) {
    const variante = await prisma.varianteProducto.findUnique({
      where: { id: item.varianteId },
      select: { stockActual: true, stockReservado: true },
    });
    const disponible = variante ? variante.stockActual - variante.stockReservado : 0;
    if (cantidadNueva > disponible) {
      throw ErrorApi.peticionInvalida(mensajeDisponibilidad(disponible));
    }
    await prisma.carritoItem.update({ where: { id: itemId }, data: { cantidad: cantidadNueva } });
  } else if (item.comboId) {
    const combo = await prisma.combo.findUnique({
      where: { id: item.comboId },
      select: {
        items: {
          select: {
            cantidad: true,
            varianteProducto: { select: { stockActual: true, stockReservado: true } },
          },
        },
      },
    });
    const disponibleCombos = (combo?.items ?? []).reduce((minimo, pieza) => {
      const disponiblePieza =
        pieza.varianteProducto.stockActual - pieza.varianteProducto.stockReservado;
      return Math.min(minimo, Math.floor(disponiblePieza / pieza.cantidad));
    }, Infinity);
    const disponible = Number.isFinite(disponibleCombos) ? disponibleCombos : 0;
    if (cantidadNueva > disponible) {
      throw ErrorApi.peticionInvalida(mensajeDisponibilidadCombo(disponible));
    }
    await prisma.carritoItem.update({ where: { id: itemId }, data: { cantidad: cantidadNueva } });
  }

  return mapearCarrito(await buscarCarritoAbierto(propietario));
}

export async function eliminarItem(
  propietario: Propietario,
  itemId: string,
): Promise<CarritoRespuesta> {
  const item = await prisma.carritoItem.findUnique({
    where: { id: itemId },
    select: { id: true, carrito: { select: { usuarioId: true, visitanteId: true } } },
  });
  if (!item || !perteneceAlPropietario(item.carrito, propietario)) {
    throw ErrorApi.noEncontrado('La línea del carrito no existe');
  }

  await prisma.carritoItem.delete({ where: { id: itemId } });

  return mapearCarrito(await buscarCarritoAbierto(propietario));
}

// ---------------------------------------------------------------------------
// Cupón
// ---------------------------------------------------------------------------

export async function aplicarCupon(
  propietario: Propietario,
  codigoCrudo: string,
  sesionId: string | undefined,
): Promise<CarritoRespuesta> {
  const codigo = codigoCrudo.trim().toUpperCase();
  const carrito = await obtenerOCrearCarritoAbierto(propietario);
  const { totales } = await mapearCarrito(carrito);

  const cupon = await prisma.cupon.findUnique({ where: { codigo } });
  if (!cupon || !cupon.activo) {
    throw ErrorApi.peticionInvalida('Ese cupón no existe o ya no está activo');
  }

  const ahora = new Date();
  if (cupon.vigenteDesde && cupon.vigenteDesde > ahora) {
    throw ErrorApi.peticionInvalida('Ese cupón todavía no está vigente');
  }
  if (cupon.vigenteHasta && cupon.vigenteHasta < ahora) {
    throw ErrorApi.peticionInvalida('Ese cupón ya venció');
  }
  // usos_actuales se incrementa recién al confirmar el pedido (fuera de
  // este alcance: "sin pedidos ni pagos todavía"). Acá solo se valida como
  // disponibilidad; el checkout debe revalidar el cupón al confirmar, ya
  // que puede agotarse entre aplicarlo acá y pagar.
  if (cupon.usosMaximos !== null && cupon.usosActuales >= cupon.usosMaximos) {
    throw ErrorApi.peticionInvalida('Ese cupón ya alcanzó el máximo de usos');
  }
  if (totales.subtotal < cupon.montoMinimo) {
    throw ErrorApi.peticionInvalida(
      `Este cupón requiere un mínimo de ${formatearPesos(cupon.montoMinimo)} en el carrito`,
    );
  }

  await prisma.carrito.update({ where: { id: carrito.id }, data: { cuponId: cupon.id } });
  await registrarAplicarCupon(codigo, totales.descuento, sesionId);

  return mapearCarrito(await buscarCarritoAbierto(propietario));
}

export async function quitarCupon(propietario: Propietario): Promise<CarritoRespuesta> {
  const carrito = await buscarCarritoAbierto(propietario);
  if (carrito) {
    await prisma.carrito.update({ where: { id: carrito.id }, data: { cuponId: null } });
  }
  return mapearCarrito(await buscarCarritoAbierto(propietario));
}

// ---------------------------------------------------------------------------
// Fusión del carrito anónimo al iniciar sesión
// ---------------------------------------------------------------------------

export interface ResultadoFusionCarrito {
  avisos: string[];
}

interface AjusteLinea {
  cantidad: number;
  disponible: number;
  nombre: string;
}

async function calcularAjusteVariante(
  tx: Prisma.TransactionClient,
  varianteId: string,
  cantidadDeseada: number,
): Promise<AjusteLinea> {
  const variante = await tx.varianteProducto.findUnique({
    where: { id: varianteId },
    select: { stockActual: true, stockReservado: true, producto: { select: { nombre: true } } },
  });
  const disponible = variante ? Math.max(0, variante.stockActual - variante.stockReservado) : 0;
  return {
    cantidad: Math.min(cantidadDeseada, disponible),
    disponible,
    nombre: variante?.producto.nombre ?? 'un producto',
  };
}

async function calcularAjusteCombo(
  tx: Prisma.TransactionClient,
  comboId: string,
  cantidadDeseada: number,
): Promise<AjusteLinea> {
  const combo = await tx.combo.findUnique({
    where: { id: comboId },
    select: {
      nombre: true,
      items: {
        select: {
          cantidad: true,
          varianteProducto: { select: { stockActual: true, stockReservado: true } },
        },
      },
    },
  });
  const disponibleCrudo = (combo?.items ?? []).reduce((minimo, pieza) => {
    const disponiblePieza =
      pieza.varianteProducto.stockActual - pieza.varianteProducto.stockReservado;
    return Math.min(minimo, Math.floor(disponiblePieza / pieza.cantidad));
  }, Infinity);
  const disponible = Number.isFinite(disponibleCrudo) ? Math.max(0, disponibleCrudo) : 0;
  return {
    cantidad: Math.min(cantidadDeseada, disponible),
    disponible,
    nombre: combo?.nombre ?? 'un combo',
  };
}

function agregarAvisoSiSeAjusto(
  ajuste: AjusteLinea,
  cantidadOriginal: number,
  avisos: string[],
): void {
  if (cantidadOriginal <= ajuste.disponible) return;
  avisos.push(
    ajuste.disponible > 0
      ? `Ajustamos "${ajuste.nombre}" a ${ajuste.disponible} unidades por disponibilidad.`
      : `Quitamos "${ajuste.nombre}" del carrito: ya no tiene disponibilidad.`,
  );
}

// Al fusionar, si la misma variante o combo está en los dos carritos, se
// suman las cantidades y el resultado se recorta al stock disponible (no
// a la suma bruta), devolviendo un aviso por cada línea que tuvo que
// ajustarse.
export async function fusionarCarritoAnonimo(
  usuarioId: string,
  visitanteId: string | undefined,
): Promise<ResultadoFusionCarrito> {
  if (!visitanteId) return { avisos: [] };

  const carritoAnonimo = await prisma.carrito.findFirst({
    where: { visitanteId, convertidoEn: null },
    select: {
      id: true,
      cuponId: true,
      items: { select: { varianteId: true, comboId: true, cantidad: true } },
    },
  });
  if (!carritoAnonimo) return { avisos: [] };

  if (carritoAnonimo.items.length === 0) {
    await prisma.carrito.delete({ where: { id: carritoAnonimo.id } });
    return { avisos: [] };
  }

  const carritoUsuario = await prisma.carrito.findFirst({
    where: { usuarioId, convertidoEn: null },
    select: {
      id: true,
      cuponId: true,
      items: { select: { id: true, varianteId: true, comboId: true, cantidad: true } },
    },
  });

  const avisos: string[] = [];

  async function calcularAjuste(
    tx: Prisma.TransactionClient,
    item: { varianteId: string | null; comboId: string | null },
    cantidad: number,
  ): Promise<AjusteLinea> {
    if (item.varianteId) return calcularAjusteVariante(tx, item.varianteId, cantidad);
    return calcularAjusteCombo(tx, item.comboId!, cantidad);
  }

  function mismaLinea(
    a: { varianteId: string | null; comboId: string | null },
    b: { varianteId: string | null; comboId: string | null },
  ): boolean {
    return (
      (a.varianteId !== null && a.varianteId === b.varianteId) ||
      (a.comboId !== null && a.comboId === b.comboId)
    );
  }

  if (!carritoUsuario) {
    await prisma.$transaction(async (tx) => {
      for (const item of carritoAnonimo.items) {
        const ajuste = await calcularAjuste(tx, item, item.cantidad);
        agregarAvisoSiSeAjusto(ajuste, item.cantidad, avisos);

        const filtro = item.varianteId
          ? { carritoId: carritoAnonimo.id, varianteId: item.varianteId }
          : { carritoId: carritoAnonimo.id, comboId: item.comboId };

        if (ajuste.cantidad <= 0) {
          await tx.carritoItem.deleteMany({ where: filtro });
        } else if (ajuste.cantidad !== item.cantidad) {
          await tx.carritoItem.updateMany({ where: filtro, data: { cantidad: ajuste.cantidad } });
        }
      }
      await tx.carrito.update({
        where: { id: carritoAnonimo.id },
        data: { usuarioId, visitanteId: null },
      });
    });
    return { avisos };
  }

  await prisma.$transaction(async (tx) => {
    for (const itemAnonimo of carritoAnonimo.items) {
      const itemUsuario = carritoUsuario.items.find((i) => mismaLinea(i, itemAnonimo));
      const cantidadCombinada = (itemUsuario?.cantidad ?? 0) + itemAnonimo.cantidad;

      const ajuste = await calcularAjuste(tx, itemAnonimo, cantidadCombinada);
      agregarAvisoSiSeAjusto(ajuste, cantidadCombinada, avisos);

      if (itemUsuario) {
        if (ajuste.cantidad <= 0) {
          await tx.carritoItem.delete({ where: { id: itemUsuario.id } });
        } else {
          await tx.carritoItem.update({
            where: { id: itemUsuario.id },
            data: { cantidad: ajuste.cantidad },
          });
        }
      } else if (ajuste.cantidad > 0) {
        await tx.carritoItem.create({
          data: {
            carritoId: carritoUsuario.id,
            varianteId: itemAnonimo.varianteId,
            comboId: itemAnonimo.comboId,
            cantidad: ajuste.cantidad,
          },
        });
      }
    }

    if (!carritoUsuario.cuponId && carritoAnonimo.cuponId) {
      await tx.carrito.update({
        where: { id: carritoUsuario.id },
        data: { cuponId: carritoAnonimo.cuponId },
      });
    }

    await tx.carrito.delete({ where: { id: carritoAnonimo.id } });
  });

  return { avisos };
}

// ---------------------------------------------------------------------------
// Analítica: best-effort, nunca bloquea la operación principal.
// ---------------------------------------------------------------------------

async function registrarAgregarCarrito(
  productoId: string,
  varianteId: string,
  cantidad: number,
  sesionId: string | undefined,
): Promise<void> {
  if (!sesionId) return;
  try {
    await prisma.eventoAnalitica.create({
      data: { sesionId, tipo: 'agregarCarrito', productoId, varianteId, valor: cantidad },
    });
  } catch {
    // No bloquea la respuesta del carrito si el registro de analítica falla.
  }
}

async function registrarAplicarCupon(
  codigo: string,
  descuento: number,
  sesionId: string | undefined,
): Promise<void> {
  if (!sesionId) return;
  try {
    await prisma.eventoAnalitica.create({
      data: { sesionId, tipo: 'aplicarCupon', valor: descuento, metadatos: { codigo } },
    });
  } catch {
    // No bloquea la respuesta del carrito si el registro de analítica falla.
  }
}
