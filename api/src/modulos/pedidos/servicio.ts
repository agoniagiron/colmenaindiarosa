import { Prisma } from '@prisma/client';
import type { MetodoPago } from '@prisma/client';
import { calcularTotales } from '../../dominio/calcularTotales.js';
import { env } from '../../config/env.js';
import { extraerAtributosVariante } from '../../lib/atributosVariante.js';
import { obtenerConfigTotales } from '../../lib/configuracion.js';
import { ErrorApi } from '../../lib/errorApi.js';
import { formatearPesos } from '../../lib/formatearPesos.js';
import { obtenerTasaUsdVigente } from '../../lib/moneda.js';
import { prisma } from '../../lib/prisma.js';
import { generarFirmaIntegridad } from '../../lib/wompi/firma.js';
import { aPesosACentavos } from '../../lib/wompi/montos.js';
import type { DatosIniciarCheckout, MetodoPagoCheckout } from './esquemas.js';

const MONEDA = 'COP';
const MAX_INTENTOS_NUMERO = 3;

const DURACION_RESERVA_MS: Record<MetodoPagoCheckout, number> = {
  tarjeta: 30 * 60 * 1000,
  pse: 24 * 60 * 60 * 1000,
  efectivo: 24 * 60 * 60 * 1000,
};

// El método real (crédito vs. débito, etc.) lo confirma el webhook; esto es
// solo el valor inicial obligatorio al crear el registro de pago.
const METODO_PRISMA_INICIAL: Record<MetodoPagoCheckout, MetodoPago> = {
  tarjeta: 'tarjetaCredito',
  pse: 'pse',
  efectivo: 'efectivo',
};

const SELECT_ITEM_CARRITO = {
  id: true,
  cantidad: true,
  varianteProducto: {
    select: {
      id: true,
      sku: true,
      precioActual: true,
      stockActual: true,
      stockReservado: true,
      activa: true,
      productoId: true,
      producto: { select: { nombre: true } },
      valoresAtributo: {
        select: {
          valorAtributo: {
            select: { valor: true, hex: true, atributo: { select: { slug: true } } },
          },
        },
      },
    },
  },
  combo: {
    select: {
      id: true,
      nombre: true,
      slug: true,
      precioCop: true,
      activo: true,
      items: {
        select: {
          cantidad: true,
          varianteProducto: {
            select: {
              id: true,
              sku: true,
              stockActual: true,
              stockReservado: true,
              activa: true,
              producto: { select: { nombre: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CarritoItemSelect;

const SELECT_CUPON = {
  id: true,
  codigo: true,
  tipo: true,
  valor: true,
  montoMinimo: true,
  activo: true,
  vigenteDesde: true,
  vigenteHasta: true,
  usosMaximos: true,
  usosActuales: true,
} satisfies Prisma.CuponSelect;

type ItemCarritoParaCheckout = Prisma.CarritoItemGetPayload<{ select: typeof SELECT_ITEM_CARRITO }>;
type CuponValidable = Prisma.CuponGetPayload<{ select: typeof SELECT_CUPON }>;

interface PiezaCheckout {
  varianteId: string;
  nombreProducto: string;
  sku: string;
  cantidadPorCombo: number;
}

interface LineaCheckoutVariante {
  tipo: 'variante';
  varianteId: string;
  nombreProducto: string;
  sku: string;
  tipoBase?: string;
  longitud?: string;
  color?: { nombre: string; hex?: string };
  talla?: string;
  densidad?: string;
  precioUnitario: number;
  cantidad: number;
}

interface LineaCheckoutCombo {
  tipo: 'combo';
  comboId: string;
  nombreCombo: string;
  sku: string;
  precioUnitario: number;
  cantidad: number;
  piezas: PiezaCheckout[];
}

type LineaCheckout = LineaCheckoutVariante | LineaCheckoutCombo;

function mapearLineasCheckout(items: ItemCarritoParaCheckout[]): LineaCheckout[] {
  return items.map((item): LineaCheckout => {
    if (item.varianteProducto) {
      const v = item.varianteProducto;
      const atributos = extraerAtributosVariante(v.valoresAtributo);
      return {
        tipo: 'variante',
        varianteId: v.id,
        nombreProducto: v.producto.nombre,
        sku: v.sku,
        ...atributos,
        precioUnitario: v.precioActual,
        cantidad: item.cantidad,
      };
    }

    const combo = item.combo!;
    return {
      tipo: 'combo',
      comboId: combo.id,
      nombreCombo: combo.nombre,
      sku: `combo:${combo.slug}`,
      precioUnitario: combo.precioCop,
      cantidad: item.cantidad,
      piezas: combo.items.map((pieza) => ({
        varianteId: pieza.varianteProducto.id,
        nombreProducto: pieza.varianteProducto.producto.nombre,
        sku: pieza.varianteProducto.sku,
        cantidadPorCombo: pieza.cantidad,
      })),
    };
  });
}

function verificarDisponibilidad(items: ItemCarritoParaCheckout[]): void {
  const lineasSinStock: { varianteId: string; nombreProducto: string; disponible: number }[] = [];

  for (const item of items) {
    if (item.varianteProducto) {
      const v = item.varianteProducto;
      const disponible = Math.max(0, v.stockActual - v.stockReservado);
      if (!v.activa || disponible < item.cantidad) {
        lineasSinStock.push({ varianteId: v.id, nombreProducto: v.producto.nombre, disponible });
      }
      continue;
    }

    const combo = item.combo!;
    if (!combo.activo) {
      lineasSinStock.push({ varianteId: combo.id, nombreProducto: combo.nombre, disponible: 0 });
      continue;
    }
    for (const pieza of combo.items) {
      const v = pieza.varianteProducto;
      const disponible = Math.max(0, v.stockActual - v.stockReservado);
      const necesario = pieza.cantidad * item.cantidad;
      if (!v.activa || disponible < necesario) {
        lineasSinStock.push({
          varianteId: v.id,
          nombreProducto: `${combo.nombre} (${v.producto.nombre})`,
          disponible: Math.floor(disponible / pieza.cantidad),
        });
      }
    }
  }

  if (lineasSinStock.length > 0) {
    throw new ErrorApi(409, 'sin_disponibilidad', 'Algunos productos ya no tienen disponibilidad', {
      lineas: lineasSinStock,
    });
  }
}

function validarCupon(
  cupon: CuponValidable,
  subtotal: number,
): { valido: true } | { valido: false; mensaje: string } {
  const ahora = new Date();
  if (!cupon.activo) return { valido: false, mensaje: 'El cupón ya no está activo' };
  if (cupon.vigenteDesde && cupon.vigenteDesde > ahora) {
    return { valido: false, mensaje: 'El cupón todavía no está vigente' };
  }
  if (cupon.vigenteHasta && cupon.vigenteHasta < ahora) {
    return { valido: false, mensaje: 'El cupón ya venció' };
  }
  if (cupon.usosMaximos !== null && cupon.usosActuales >= cupon.usosMaximos) {
    return { valido: false, mensaje: 'El cupón ya alcanzó el máximo de usos' };
  }
  if (subtotal < cupon.montoMinimo) {
    return {
      valido: false,
      mensaje: `Este cupón requiere un mínimo de ${formatearPesos(cupon.montoMinimo)} en el pedido`,
    };
  }
  return { valido: true };
}

function esColisionNumeroPedido(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes('numero')
  );
}

function esColisionClaveIdempotencia(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes('clave_idempotencia')
  );
}

// Reconstruye la respuesta de un pedido ya creado (mismo camino que usa el
// checkout normal), sin tocar stock ni crear nada nuevo: es lo que se
// devuelve cuando la clave de idempotencia ya se usó antes.
async function resultadoDesdePedidoExistente(pedidoId: string): Promise<ResultadoCheckout> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { numero: true },
  });
  const pago = await prisma.pago.findFirst({
    where: { pedidoId },
    orderBy: { creadoEn: 'desc' },
    select: { referenciaInterna: true, monto: true },
  });

  if (!pedido || !pago) {
    throw ErrorApi.interno('El pedido de esta clave de idempotencia quedó en un estado inválido');
  }

  const montoEnCentavos = aPesosACentavos(pago.monto);
  const firma = generarFirmaIntegridad(pago.referenciaInterna, montoEnCentavos, MONEDA);

  return {
    numeroPedido: pedido.numero,
    llavePublica: env.WOMPI_LLAVE_PUBLICA,
    referencia: pago.referenciaInterna,
    montoEnCentavos,
    moneda: MONEDA,
    firma,
    urlRedireccion: `${env.WOMPI_URL_REDIRECCION}?numero=${encodeURIComponent(pedido.numero)}`,
  };
}

async function generarNumeroPedido(tx: Prisma.TransactionClient): Promise<string> {
  const total = await tx.pedido.count();
  return `INR-${String(total + 1).padStart(6, '0')}`;
}

export interface ResultadoCheckout {
  numeroPedido: string;
  llavePublica: string;
  referencia: string;
  montoEnCentavos: number;
  moneda: string;
  firma: string;
  urlRedireccion: string;
}

export async function iniciarCheckout(
  usuarioId: string,
  datos: DatosIniciarCheckout,
): Promise<ResultadoCheckout> {
  // Camino rápido: si esta clave de idempotencia ya generó un pedido (doble
  // clic, recarga de página, reintento de red), se devuelve el mismo
  // resultado sin tocar stock ni crear nada. No importa si el pedido es de
  // otro usuario (no debería pasar nunca con una clave generada por
  // crypto.randomUUID, pero si pasara, no hay nada que reservar de nuevo).
  const existente = await prisma.pedido.findUnique({
    where: { claveIdempotencia: datos.claveIdempotencia },
    select: { id: true },
  });
  if (existente) {
    return resultadoDesdePedidoExistente(existente.id);
  }

  // Se resuelven antes de la transacción: no dependen de nada que la
  // transacción cambie, y no tiene sentido pagar su costo en cada reintento
  // por colisión de número de pedido.
  const [config, tasaUsdUsada] = await Promise.all([
    obtenerConfigTotales(),
    obtenerTasaUsdVigente(),
  ]);

  for (let intento = 1; intento <= MAX_INTENTOS_NUMERO; intento++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const carrito = await tx.carrito.findFirst({
          where: { usuarioId, convertidoEn: null },
          select: {
            id: true,
            cuponId: true,
            cupon: { select: SELECT_CUPON },
            items: { select: SELECT_ITEM_CARRITO },
          },
        });

        if (!carrito || carrito.items.length === 0) {
          throw ErrorApi.peticionInvalida('El carrito está vacío');
        }

        verificarDisponibilidad(carrito.items);

        const lineas = mapearLineasCheckout(carrito.items);
        const subtotalSinCupon = calcularTotales(lineas, null, config).subtotal;

        let cuponAplicado: CuponValidable | null = null;
        if (carrito.cupon) {
          const validacion = validarCupon(carrito.cupon, subtotalSinCupon);
          if (!validacion.valido) {
            throw new ErrorApi(409, 'cupon_invalido', validacion.mensaje, {
              totalSinCupon: calcularTotales(lineas, null, config),
            });
          }
          cuponAplicado = carrito.cupon;
        }

        const totales = calcularTotales(lineas, cuponAplicado, config);
        const numero = await generarNumeroPedido(tx);
        const expiraEn = new Date(Date.now() + DURACION_RESERVA_MS[datos.metodoPago]);

        const pedido = await tx.pedido.create({
          data: {
            numero,
            claveIdempotencia: datos.claveIdempotencia,
            usuarioId,
            nombreContacto: datos.nombreContacto,
            telefonoContacto: datos.telefonoContacto,
            correoContacto: datos.correoContacto,
            envioNombre: datos.envioNombre,
            envioTelefono: datos.envioTelefono,
            envioDepartamento: datos.envioDepartamento,
            envioCiudad: datos.envioCiudad,
            envioDireccion: datos.envioDireccion,
            envioComplemento: datos.envioComplemento,
            envioNotas: datos.envioNotas,
            subtotal: totales.subtotal,
            descuento: totales.descuento,
            envio: totales.envio,
            total: totales.total,
            cuponId: cuponAplicado?.id,
            cuponCodigo: cuponAplicado?.codigo,
            estado: 'esperandoPago',
            monedaMostrada: datos.monedaMostrada,
            tasaUsdUsada,
          },
        });

        for (const linea of lineas) {
          if (linea.tipo === 'variante') {
            await tx.pedidoItem.create({
              data: {
                pedidoId: pedido.id,
                varianteId: linea.varianteId,
                nombreProducto: linea.nombreProducto,
                sku: linea.sku,
                tipoBase: linea.tipoBase,
                longitud: linea.longitud,
                colorNombre: linea.color?.nombre,
                colorHex: linea.color?.hex,
                talla: linea.talla,
                densidad: linea.densidad,
                precioUnitario: linea.precioUnitario,
                cantidad: linea.cantidad,
                subtotal: linea.precioUnitario * linea.cantidad,
              },
            });

            await tx.reservaStock.create({
              data: {
                varianteId: linea.varianteId,
                pedidoId: pedido.id,
                cantidad: linea.cantidad,
                expiraEn,
              },
            });

            await tx.varianteProducto.update({
              where: { id: linea.varianteId },
              data: { stockReservado: { increment: linea.cantidad } },
            });
            continue;
          }

          // Línea de combo: un solo pedido_item resumen (comboId, sin
          // varianteId) más una fila en pedido_item_combo_detalle por
          // pieza, como copia histórica de qué traía el combo en ese
          // momento. cantidad en el detalle es la receta (por un combo),
          // no multiplicada por cuántos combos se compraron — igual que
          // combo_item, del que es una foto.
          const pedidoItem = await tx.pedidoItem.create({
            data: {
              pedidoId: pedido.id,
              nombreProducto: linea.nombreCombo,
              sku: linea.sku,
              comboId: linea.comboId,
              nombreCombo: linea.nombreCombo,
              precioUnitario: linea.precioUnitario,
              cantidad: linea.cantidad,
              subtotal: linea.precioUnitario * linea.cantidad,
            },
          });

          for (const pieza of linea.piezas) {
            await tx.pedidoItemComboDetalle.create({
              data: {
                pedidoItemId: pedidoItem.id,
                varianteId: pieza.varianteId,
                nombreProducto: pieza.nombreProducto,
                sku: pieza.sku,
                cantidad: pieza.cantidadPorCombo,
              },
            });

            const cantidadAReservar = pieza.cantidadPorCombo * linea.cantidad;

            await tx.reservaStock.create({
              data: {
                varianteId: pieza.varianteId,
                pedidoId: pedido.id,
                cantidad: cantidadAReservar,
                expiraEn,
              },
            });

            await tx.varianteProducto.update({
              where: { id: pieza.varianteId },
              data: { stockReservado: { increment: cantidadAReservar } },
            });
          }
        }

        // Wompi no permite reutilizar una referencia: cada intento de pago
        // de este pedido necesita una nueva ({numero}-{intento}).
        const numeroIntentoPago = await tx.pago.count({ where: { pedidoId: pedido.id } });
        const referencia = `${numero}-${numeroIntentoPago + 1}`;
        const montoEnCentavos = aPesosACentavos(totales.total);

        await tx.pago.create({
          data: {
            pedidoId: pedido.id,
            pasarela: 'wompi',
            referenciaInterna: referencia,
            metodo: METODO_PRISMA_INICIAL[datos.metodoPago],
            estado: 'iniciado',
            monto: totales.total,
            expiraEn,
          },
        });

        const firma = generarFirmaIntegridad(referencia, montoEnCentavos, MONEDA);
        const urlRedireccion = `${env.WOMPI_URL_REDIRECCION}?numero=${encodeURIComponent(numero)}`;

        return {
          numeroPedido: numero,
          llavePublica: env.WOMPI_LLAVE_PUBLICA,
          referencia,
          montoEnCentavos,
          moneda: MONEDA,
          firma,
          urlRedireccion,
        };
      });
    } catch (error) {
      // Carrera: otra petición con la misma clave ya creó el pedido entre
      // el chequeo de arriba y este intento. Se devuelve ese pedido en vez
      // de reintentar (reintentar generaría un numero nuevo y reservaría
      // stock por segunda vez).
      if (esColisionClaveIdempotencia(error)) {
        const pedido = await prisma.pedido.findUnique({
          where: { claveIdempotencia: datos.claveIdempotencia },
          select: { id: true },
        });
        if (pedido) return resultadoDesdePedidoExistente(pedido.id);
      }
      if (esColisionNumeroPedido(error) && intento < MAX_INTENTOS_NUMERO) continue;
      throw error;
    }
  }
  throw ErrorApi.interno('No se pudo iniciar el checkout');
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

const SELECT_PEDIDO_RESUMEN = {
  numero: true,
  estado: true,
  subtotal: true,
  descuento: true,
  envio: true,
  total: true,
  creadoEn: true,
} satisfies Prisma.PedidoSelect;

const SELECT_PEDIDO_DETALLE = {
  ...SELECT_PEDIDO_RESUMEN,
  usuarioId: true,
  nombreContacto: true,
  telefonoContacto: true,
  correoContacto: true,
  envioNombre: true,
  envioTelefono: true,
  envioDepartamento: true,
  envioCiudad: true,
  envioDireccion: true,
  envioComplemento: true,
  envioNotas: true,
  cuponCodigo: true,
  monedaMostrada: true,
  tasaUsdUsada: true,
  items: {
    select: {
      id: true,
      nombreProducto: true,
      sku: true,
      tipoBase: true,
      longitud: true,
      colorNombre: true,
      colorHex: true,
      talla: true,
      densidad: true,
      precioUnitario: true,
      cantidad: true,
      subtotal: true,
      comboId: true,
      nombreCombo: true,
      detallesCombo: {
        select: { varianteId: true, nombreProducto: true, sku: true, cantidad: true },
      },
    },
  },
  // Para la línea de tiempo en /cuenta (ver TANDA 3). A propósito sin
  // `nota` ni `usuario`: esos campos de PedidoHistorial son para ojos de
  // admin (notas operativas, quién lo cambió), no para la clienta.
  historial: {
    select: { id: true, estadoAnterior: true, estadoNuevo: true, creadoEn: true },
    orderBy: { creadoEn: 'asc' },
  },
} satisfies Prisma.PedidoSelect;

export async function listarPedidosUsuario(usuarioId: string) {
  return prisma.pedido.findMany({
    where: { usuarioId },
    orderBy: { creadoEn: 'desc' },
    select: SELECT_PEDIDO_RESUMEN,
  });
}

export async function obtenerPedidoDelUsuario(usuarioId: string, numero: string) {
  const pedido = await prisma.pedido.findUnique({
    where: { numero },
    select: SELECT_PEDIDO_DETALLE,
  });
  // Mismo mensaje si no existe o si no es del usuario: no revela que el
  // número de pedido pertenece a otra cuenta.
  if (!pedido || pedido.usuarioId !== usuarioId) {
    throw ErrorApi.noEncontrado('El pedido no existe');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { usuarioId: _usuarioId, ...pedidoSinUsuarioId } = pedido;
  return pedidoSinUsuarioId;
}

export async function obtenerEstadoPedido(usuarioId: string, numero: string) {
  const pedido = await prisma.pedido.findUnique({
    where: { numero },
    select: { usuarioId: true, numero: true, estado: true, total: true },
  });
  if (!pedido || pedido.usuarioId !== usuarioId) {
    throw ErrorApi.noEncontrado('El pedido no existe');
  }
  return { numero: pedido.numero, estado: pedido.estado, total: pedido.total };
}
