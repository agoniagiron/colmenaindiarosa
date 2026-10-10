import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as apiCarrito from './apiCarrito.ts';
import { ErrorCarrito } from './apiCarrito.ts';
import { useAvisos } from './ContextoAvisos.tsx';
import { useSesion } from './ContextoSesion.tsx';
import type { CarritoApi } from './apiCarrito.ts';
import type { Cupon, LineaCarrito, TotalesCarrito } from '../tipos/index.ts';

const TOTALES_VACIOS: TotalesCarrito = {
  subtotal: 0,
  descuento: 0,
  envio: 0,
  total: 0,
  descuentoAplicado: 'ninguno',
  descuentoDescartado: null,
  usd: { subtotal: 0, descuento: 0, envio: 0, total: 0 },
};

interface ContextoCarritoValor {
  lineas: LineaCarrito[];
  cupon: Cupon | null;
  totales: TotalesCarrito;
  // true recién después de la primera respuesta (o error) de
  // obtenerCarrito. Antes de eso, lineas vale [] solo porque todavía no se
  // sabe qué hay en el carrito — nunca porque esté confirmado vacío. Quien
  // decida "el carrito está vacío, redirigir" (CheckoutPagina) tiene que
  // esperar a que esto sea true, o una entrada directa a /checkout
  // redirige por las dudas antes de que el fetch alcance a responder.
  cargado: boolean;
  cargandoCupon: boolean;
  errorCupon: string | null;
  agregar: (varianteId: string, cantidad: number) => Promise<void>;
  agregarCombo: (comboId: string, cantidad: number) => Promise<void>;
  // Las dos toman el id de la línea (carrito_item), no el de la variante o
  // el combo: es lo único que identifica una línea sin ambigüedad para
  // ambos tipos.
  cambiarCantidad: (itemId: string, cantidad: number) => Promise<void>;
  quitar: (itemId: string) => Promise<void>;
  aplicarCupon: (codigo: string) => Promise<void>;
  quitarCupon: () => Promise<void>;
}

const ContextoCarrito = createContext<ContextoCarritoValor | null>(null);

export function ProveedorCarrito({ children }: { children: ReactNode }) {
  const { accessToken } = useSesion();
  const { avisarExito, avisarError } = useAvisos();

  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [cupon, setCupon] = useState<Cupon | null>(null);
  const [totales, setTotales] = useState<TotalesCarrito>(TOTALES_VACIOS);
  const [cargado, setCargado] = useState(false);
  // Cubre tanto aplicar como quitar: son la misma sección de la UI y no
  // tiene sentido permitir una mientras la otra está en curso.
  const [cargandoCupon, setCargandoCupon] = useState(false);
  const [errorCupon, setErrorCupon] = useState<string | null>(null);

  const aplicarRespuesta = useCallback((carrito: CarritoApi) => {
    setLineas(carrito.lineas);
    setCupon(carrito.cupon);
    setTotales(carrito.totales);
  }, []);

  // Se vuelve a pedir cada vez que cambia el access token: al loguearse, el
  // backend ya fusionó el carrito anónimo con el del usuario, así que esto
  // trae el resultado ya fusionado.
  useEffect(() => {
    let vigente = true;

    apiCarrito
      .obtenerCarrito(accessToken)
      .then((carrito) => {
        if (vigente) aplicarRespuesta(carrito);
      })
      .catch(() => {
        // Sin carrito todavía (o error de red): se queda vacío.
      })
      .finally(() => {
        if (vigente) setCargado(true);
      });

    return () => {
      vigente = false;
    };
  }, [accessToken, aplicarRespuesta]);

  const agregar = useCallback(
    async (varianteId: string, cantidad: number) => {
      const carrito = await apiCarrito.agregarItem(accessToken, varianteId, cantidad);
      aplicarRespuesta(carrito);
    },
    [accessToken, aplicarRespuesta],
  );

  const agregarCombo = useCallback(
    async (comboId: string, cantidad: number) => {
      const carrito = await apiCarrito.agregarCombo(accessToken, comboId, cantidad);
      aplicarRespuesta(carrito);
    },
    [accessToken, aplicarRespuesta],
  );

  const cambiarCantidad = useCallback(
    async (itemId: string, cantidad: number) => {
      try {
        const carrito = await apiCarrito.actualizarCantidad(accessToken, itemId, cantidad);
        aplicarRespuesta(carrito);
      } catch {
        // El cambio no se pudo aplicar (p. ej. sin stock): resincroniza con el servidor.
        apiCarrito
          .obtenerCarrito(accessToken)
          .then(aplicarRespuesta)
          .catch(() => {});
      }
    },
    [accessToken, aplicarRespuesta],
  );

  const quitar = useCallback(
    async (itemId: string) => {
      const carrito = await apiCarrito.eliminarItem(accessToken, itemId);
      aplicarRespuesta(carrito);
    },
    [accessToken, aplicarRespuesta],
  );

  const aplicarCuponFn = useCallback(
    async (codigo: string) => {
      setCargandoCupon(true);
      setErrorCupon(null);
      try {
        const carrito = await apiCarrito.aplicarCupon(accessToken, codigo);
        aplicarRespuesta(carrito);
        avisarExito('Cupón aplicado');
      } catch (error) {
        const mensaje =
          error instanceof ErrorCarrito ? error.message : 'No pudimos aplicar el cupón';
        setErrorCupon(mensaje);
        avisarError(mensaje);
      } finally {
        setCargandoCupon(false);
      }
    },
    [accessToken, aplicarRespuesta, avisarExito, avisarError],
  );

  const quitarCuponFn = useCallback(async () => {
    setCargandoCupon(true);
    setErrorCupon(null);
    try {
      const carrito = await apiCarrito.quitarCupon(accessToken);
      aplicarRespuesta(carrito);
      avisarExito('Cupón quitado');
    } catch (error) {
      avisarError(error instanceof ErrorCarrito ? error.message : 'No pudimos quitar el cupón');
    } finally {
      setCargandoCupon(false);
    }
  }, [accessToken, aplicarRespuesta, avisarExito, avisarError]);

  const valor = useMemo<ContextoCarritoValor>(
    () => ({
      lineas,
      cupon,
      totales,
      cargado,
      cargandoCupon,
      errorCupon,
      agregar,
      agregarCombo,
      cambiarCantidad,
      quitar,
      aplicarCupon: aplicarCuponFn,
      quitarCupon: quitarCuponFn,
    }),
    [
      lineas,
      cupon,
      totales,
      cargado,
      cargandoCupon,
      errorCupon,
      agregar,
      agregarCombo,
      cambiarCantidad,
      quitar,
      aplicarCuponFn,
      quitarCuponFn,
    ],
  );

  return <ContextoCarrito.Provider value={valor}>{children}</ContextoCarrito.Provider>;
}

export function useCarrito(): ContextoCarritoValor {
  const contexto = useContext(ContextoCarrito);
  if (!contexto) {
    throw new Error('useCarrito debe usarse dentro de ProveedorCarrito');
  }
  return contexto;
}
