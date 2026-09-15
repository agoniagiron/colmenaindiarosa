import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { calcularTotales } from '../dominio/calcularTotales.ts';
import { repositorio } from '../datos/index.ts';
import type { Cupon, LineaCarrito, TotalesCarrito } from '../tipos/index.ts';

interface ContextoCarritoValor {
  lineas: LineaCarrito[];
  cupon: Cupon | null;
  totales: TotalesCarrito;
  cargandoCupon: boolean;
  errorCupon: string | null;
  agregar: (linea: LineaCarrito) => void;
  cambiarCantidad: (varianteId: string, cantidad: number) => void;
  quitar: (varianteId: string) => void;
  aplicarCupon: (codigo: string) => Promise<void>;
  quitarCupon: () => void;
}

const ContextoCarrito = createContext<ContextoCarritoValor | null>(null);

export function ProveedorCarrito({ children }: { children: ReactNode }) {
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [cupon, setCupon] = useState<Cupon | null>(null);
  const [cargandoCupon, setCargandoCupon] = useState(false);
  const [errorCupon, setErrorCupon] = useState<string | null>(null);

  const agregar = useCallback((linea: LineaCarrito) => {
    setLineas((actuales) => {
      const existente = actuales.find((item) => item.varianteId === linea.varianteId);
      if (existente) {
        return actuales.map((item) =>
          item.varianteId === linea.varianteId
            ? { ...item, cantidad: item.cantidad + linea.cantidad }
            : item,
        );
      }
      return [...actuales, linea];
    });
  }, []);

  const cambiarCantidad = useCallback((varianteId: string, cantidad: number) => {
    setLineas((actuales) => {
      if (cantidad <= 0) {
        return actuales.filter((item) => item.varianteId !== varianteId);
      }
      return actuales.map((item) =>
        item.varianteId === varianteId ? { ...item, cantidad } : item,
      );
    });
  }, []);

  const quitar = useCallback((varianteId: string) => {
    setLineas((actuales) => actuales.filter((item) => item.varianteId !== varianteId));
  }, []);

  const aplicarCupon = useCallback(async (codigo: string) => {
    setCargandoCupon(true);
    setErrorCupon(null);
    try {
      const encontrado = await repositorio.buscarCupon(codigo);
      if (!encontrado) {
        setCupon(null);
        setErrorCupon('Ese cupón no existe o ya no está activo.');
        return;
      }
      setCupon(encontrado);
    } finally {
      setCargandoCupon(false);
    }
  }, []);

  const quitarCupon = useCallback(() => {
    setCupon(null);
    setErrorCupon(null);
  }, []);

  const totales = useMemo(() => calcularTotales(lineas, cupon), [lineas, cupon]);

  const valor = useMemo<ContextoCarritoValor>(
    () => ({
      lineas,
      cupon,
      totales,
      cargandoCupon,
      errorCupon,
      agregar,
      cambiarCantidad,
      quitar,
      aplicarCupon,
      quitarCupon,
    }),
    [
      lineas,
      cupon,
      totales,
      cargandoCupon,
      errorCupon,
      agregar,
      cambiarCantidad,
      quitar,
      aplicarCupon,
      quitarCupon,
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
