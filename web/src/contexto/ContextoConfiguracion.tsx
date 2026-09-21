// Trae GET /api/configuracion una sola vez para toda la app (cinta
// superior, barra de entrega, umbral de descuento, tasa de dólar) y guarda
// el selector de moneda COP/USD, persistido en localStorage. Ningún valor
// de estos se escribe a mano en el código: todos salen de acá.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { repositorio } from '../datos/index.ts';
import { formatearPesos } from '../utilidades/formatearPesos.ts';
import type { EntradaConfiguracion, PrecioDual } from '../tipos/index.ts';

export type Moneda = 'COP' | 'USD';

const CLAVE_LOCALSTORAGE = 'india-rosa:moneda';

function leerMonedaGuardada(): Moneda {
  try {
    const valor = window.localStorage.getItem(CLAVE_LOCALSTORAGE);
    return valor === 'USD' ? 'USD' : 'COP';
  } catch {
    return 'COP';
  }
}

function guardarMoneda(moneda: Moneda): void {
  try {
    window.localStorage.setItem(CLAVE_LOCALSTORAGE, moneda);
  } catch {
    // Sin acceso a localStorage (privado, cuota llena): la preferencia solo
    // dura la sesión de pestaña, no rompe la selección de moneda en sí.
  }
}

function formatearUsd(centavos: number): string {
  return 'US$' + (centavos / 100).toFixed(2);
}

interface ContextoConfiguracionValor {
  cargando: boolean;
  moneda: Moneda;
  setMoneda: (moneda: Moneda) => void;
  mostrarSelectorMoneda: boolean;
  avisoUsd: string;
  obtenerNumero: (clave: string) => number | undefined;
  obtenerTexto: (clave: string) => string | undefined;
  obtenerBooleano: (clave: string) => boolean | undefined;
  // Formatea un monto en COP (con su equivalente en USD ya calculado por el
  // backend, cuando se tiene) según la moneda elegida.
  formatearMonto: (cop: number, usdPrecomputado?: number) => string;
  formatearDual: (precio: PrecioDual) => string;
}

const ContextoConfiguracion = createContext<ContextoConfiguracionValor | null>(null);

export function ProveedorConfiguracion({ children }: { children: ReactNode }) {
  const [entradas, setEntradas] = useState<EntradaConfiguracion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [moneda, setMonedaState] = useState<Moneda>(leerMonedaGuardada);

  useEffect(() => {
    let vigente = true;

    repositorio
      .obtenerConfiguracionPublica()
      .then((datos) => {
        if (vigente) setEntradas(datos);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  const porClave = useMemo(() => new Map(entradas.map((e) => [e.clave, e.valor])), [entradas]);

  const obtenerNumero = useCallback(
    (clave: string): number | undefined => {
      const valor = porClave.get(clave);
      return typeof valor === 'number' ? valor : undefined;
    },
    [porClave],
  );

  const obtenerTexto = useCallback(
    (clave: string): string | undefined => {
      const valor = porClave.get(clave);
      return typeof valor === 'string' ? valor : undefined;
    },
    [porClave],
  );

  const obtenerBooleano = useCallback(
    (clave: string): boolean | undefined => {
      const valor = porClave.get(clave);
      return typeof valor === 'boolean' ? valor : undefined;
    },
    [porClave],
  );

  const tasaUsd = obtenerNumero('moneda.tasa_usd');
  // Antes de que cargue la configuración (o si el admin la apaga) no se
  // ofrece el selector: mostrarlo con una tasa todavía desconocida
  // convertiría mal cualquier precio.
  const mostrarSelectorMoneda = !cargando && obtenerBooleano('moneda.mostrar_usd') === true;
  const monedaEfectiva: Moneda = mostrarSelectorMoneda ? moneda : 'COP';

  const setMoneda = useCallback((nueva: Moneda) => {
    setMonedaState(nueva);
    guardarMoneda(nueva);
  }, []);

  const formatearMonto = useCallback(
    (cop: number, usdPrecomputado?: number): string => {
      if (monedaEfectiva === 'COP') return formatearPesos(cop);
      if (usdPrecomputado !== undefined) return formatearUsd(usdPrecomputado);
      if (!tasaUsd) return formatearPesos(cop);
      return formatearUsd(Math.round((cop / tasaUsd) * 100));
    },
    [monedaEfectiva, tasaUsd],
  );

  const formatearDual = useCallback(
    (precio: PrecioDual): string => formatearMonto(precio.cop, precio.usd),
    [formatearMonto],
  );

  const valor = useMemo<ContextoConfiguracionValor>(
    () => ({
      cargando,
      moneda: monedaEfectiva,
      setMoneda,
      mostrarSelectorMoneda,
      avisoUsd: obtenerTexto('moneda.aviso_usd') ?? '',
      obtenerNumero,
      obtenerTexto,
      obtenerBooleano,
      formatearMonto,
      formatearDual,
    }),
    [
      cargando,
      monedaEfectiva,
      setMoneda,
      mostrarSelectorMoneda,
      obtenerTexto,
      obtenerNumero,
      obtenerBooleano,
      formatearMonto,
      formatearDual,
    ],
  );

  return <ContextoConfiguracion.Provider value={valor}>{children}</ContextoConfiguracion.Provider>;
}

export function useConfiguracion(): ContextoConfiguracionValor {
  const contexto = useContext(ContextoConfiguracion);
  if (!contexto) {
    throw new Error('useConfiguracion debe usarse dentro de ProveedorConfiguracion');
  }
  return contexto;
}
