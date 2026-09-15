import { useEffect, useState } from 'react';

export function useDebounce<T>(valor: T, retardoMs = 300): T {
  const [valorDiferido, setValorDiferido] = useState(valor);

  useEffect(() => {
    const temporizador = setTimeout(() => setValorDiferido(valor), retardoMs);
    return () => clearTimeout(temporizador);
  }, [valor, retardoMs]);

  return valorDiferido;
}
