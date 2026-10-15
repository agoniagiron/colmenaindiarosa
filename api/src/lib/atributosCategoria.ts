import type { Prisma } from '@prisma/client';
import { ErrorApi } from './errorApi.js';

// Qué atributos usa una categoría (categoria_atributo), en qué orden, si son
// obligatorios, y qué valores de cada uno permite (categoria_valor_atributo).
// Única fuente para: el modal de variante y el asistente en lote (qué se
// muestra), la validación al crear variantes (qué se acepta), y el orden del
// selector de la ficha (qué ve la clienta y en qué jerarquía).
//
// "Longitud" es UN atributo con todos sus valores; cada categoría declara
// cuáles ofrece. Así el filtro del catálogo por 24" encuentra pelucas,
// frontales y extensiones a la vez.

export interface ValorPermitido {
  id: string;
  valor: string;
  hex: string | null;
  codigo: string | null;
  orden: number;
}

export interface AtributoDeCategoria {
  id: string;
  slug: string;
  nombre: string;
  orden: number;
  obligatorio: boolean;
  valores: ValorPermitido[];
}

type Cliente = Pick<Prisma.TransactionClient, 'categoriaAtributo'>;

export async function atributosDeCategoria(
  cliente: Cliente,
  categoriaId: string,
): Promise<AtributoDeCategoria[]> {
  const filas = await cliente.categoriaAtributo.findMany({
    where: { categoriaId },
    orderBy: { orden: 'asc' },
    select: {
      orden: true,
      obligatorio: true,
      atributo: { select: { id: true, slug: true, nombre: true } },
      valoresPermitidos: {
        select: {
          valorAtributo: {
            select: { id: true, valor: true, hex: true, codigo: true, orden: true },
          },
        },
      },
    },
  });
  return filas.map((fila) => ({
    id: fila.atributo.id,
    slug: fila.atributo.slug,
    nombre: fila.atributo.nombre,
    orden: fila.orden,
    obligatorio: fila.obligatorio,
    valores: fila.valoresPermitidos
      .map((p) => p.valorAtributo)
      .sort((a, b) => a.orden - b.orden),
  }));
}

// Valida los valores de UNA variante nueva contra la configuración de su
// categoría: cada valor tiene que estar permitido, y cada atributo
// obligatorio tiene que tener uno. Las variantes que ya existen no pasan por
// acá: si usan un valor que la categoría ya no permite, se quedan como están.
export function validarValoresParaCategoria(
  atributos: AtributoDeCategoria[],
  valorIds: string[],
  nombreDeValor: (id: string) => string,
): void {
  const atributoPorValor = new Map<string, AtributoDeCategoria>();
  for (const atributo of atributos) {
    for (const valor of atributo.valores) atributoPorValor.set(valor.id, atributo);
  }

  const noPermitidos = valorIds.filter((id) => !atributoPorValor.has(id));
  if (noPermitidos.length > 0) {
    throw ErrorApi.peticionInvalida(
      `La categoría de este producto no permite: ${noPermitidos.map(nombreDeValor).join(', ')}`,
    );
  }

  const presentes = new Set(valorIds.map((id) => atributoPorValor.get(id)!.id));
  const faltantes = atributos.filter((a) => a.obligatorio && !presentes.has(a.id));
  if (faltantes.length > 0) {
    throw ErrorApi.peticionInvalida(
      `Falta elegir: ${faltantes.map((a) => a.nombre.toLowerCase()).join(', ')}`,
    );
  }
}
