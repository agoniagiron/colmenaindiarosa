import { Prisma } from '@prisma/client';
import { ErrorApi } from '../../../lib/errorApi.js';
import { prisma } from '../../../lib/prisma.js';
import type { BodyConfiguracionCategoria, BodyCrearValorAtributo } from './esquemas.js';

// Pantalla de atributos del panel: administra categoria_atributo (qué
// atributos usa cada categoría, en qué orden, si son obligatorios) y
// categoria_valor_atributo (qué valores permite), y crea valores nuevos
// habilitándolos en las categorías en el MISMO paso, para que un color nuevo
// nunca quede creado pero sin aparecer en ningún lado.
//
// Cambiar esta configuración no toca variantes existentes: solo limita lo
// que se ofrece al crear variantes nuevas (ver lib/atributosCategoria.ts).

// Atributos que van en el SKU: sus valores necesitan código (sku.ts).
const SLUGS_CON_CODIGO_OBLIGATORIO = ['longitud', 'color'];

export async function obtenerConfiguracionAtributos() {
  const [atributos, categorias] = await Promise.all([
    prisma.atributo.findMany({
      orderBy: { orden: 'asc' },
      select: {
        id: true,
        slug: true,
        nombre: true,
        valoresAtributo: {
          orderBy: { orden: 'asc' },
          select: { id: true, valor: true, hex: true, codigo: true, orden: true },
        },
      },
    }),
    prisma.categoria.findMany({
      orderBy: { orden: 'asc' },
      select: {
        id: true,
        slug: true,
        nombre: true,
        atributos: {
          orderBy: { orden: 'asc' },
          select: {
            atributoId: true,
            obligatorio: true,
            valoresPermitidos: { select: { valorId: true } },
          },
        },
      },
    }),
  ]);

  return {
    atributos: atributos.map((a) => ({
      id: a.id,
      slug: a.slug,
      nombre: a.nombre,
      valores: a.valoresAtributo,
    })),
    categorias: categorias.map((c) => ({
      id: c.id,
      slug: c.slug,
      nombre: c.nombre,
      // En el orden en que se muestran (el índice es el orden).
      atributos: c.atributos.map((ca) => ({
        atributoId: ca.atributoId,
        obligatorio: ca.obligatorio,
        valorIds: ca.valoresPermitidos.map((p) => p.valorId),
      })),
    })),
  };
}

// Reemplaza la configuración completa de una categoría: los atributos que
// usa (el orden de la lista es el orden en que se muestran), si son
// obligatorios y qué valores permite cada uno. Todo en una transacción.
export async function guardarConfiguracionCategoria(
  categoriaId: string,
  datos: BodyConfiguracionCategoria,
) {
  const categoria = await prisma.categoria.findUnique({
    where: { id: categoriaId },
    select: { id: true },
  });
  if (!categoria) throw ErrorApi.noEncontrado('La categoría no existe');

  const atributoIds = datos.atributos.map((a) => a.atributoId);
  if (new Set(atributoIds).size !== atributoIds.length) {
    throw ErrorApi.peticionInvalida('Hay un atributo repetido');
  }

  const atributos = await prisma.atributo.findMany({
    where: { id: { in: atributoIds } },
    select: { id: true, nombre: true, valoresAtributo: { select: { id: true } } },
  });
  if (atributos.length !== atributoIds.length) {
    throw ErrorApi.peticionInvalida('Alguno de los atributos no existe');
  }
  const atributoPorId = new Map(atributos.map((a) => [a.id, a]));

  for (const elegido of datos.atributos) {
    const atributo = atributoPorId.get(elegido.atributoId)!;
    const propios = new Set(atributo.valoresAtributo.map((v) => v.id));
    if (elegido.valorIds.some((id) => !propios.has(id))) {
      throw ErrorApi.peticionInvalida(`Hay valores que no son de ${atributo.nombre}`);
    }
    // Obligatorio sin ningún valor permitido haría imposible crear
    // variantes en esta categoría.
    if (elegido.obligatorio && elegido.valorIds.length === 0) {
      throw ErrorApi.peticionInvalida(
        `${atributo.nombre} es obligatorio pero no tiene ningún valor permitido`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.categoriaAtributo.deleteMany({
      where: { categoriaId, atributoId: { notIn: atributoIds } },
    });
    await tx.categoriaValorAtributo.deleteMany({ where: { categoriaId } });
    for (const [indice, elegido] of datos.atributos.entries()) {
      await tx.categoriaAtributo.upsert({
        where: { categoriaId_atributoId: { categoriaId, atributoId: elegido.atributoId } },
        create: {
          categoriaId,
          atributoId: elegido.atributoId,
          orden: indice + 1,
          obligatorio: elegido.obligatorio,
        },
        update: { orden: indice + 1, obligatorio: elegido.obligatorio },
      });
    }
    await tx.categoriaValorAtributo.createMany({
      data: datos.atributos.flatMap((elegido) =>
        elegido.valorIds.map((valorId) => ({
          categoriaId,
          atributoId: elegido.atributoId,
          valorId,
        })),
      ),
    });
  });

  return obtenerConfiguracionAtributos();
}

function esColisionUnica(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// Crea un valor y lo habilita en las categorías elegidas, en una sola
// transacción: el valor no puede quedar creado sin aparecer en ningún lado.
export async function crearValorAtributo(datos: BodyCrearValorAtributo) {
  const atributo = await prisma.atributo.findUnique({
    where: { id: datos.atributoId },
    select: {
      id: true,
      slug: true,
      nombre: true,
      categoriasQueLoUsan: { select: { categoriaId: true } },
      valoresAtributo: { orderBy: { orden: 'desc' }, take: 1, select: { orden: true } },
    },
  });
  if (!atributo) throw ErrorApi.noEncontrado('El atributo no existe');

  const codigo = datos.codigo ? datos.codigo.trim().toUpperCase() : null;
  if (!codigo && SLUGS_CON_CODIGO_OBLIGATORIO.includes(atributo.slug)) {
    throw ErrorApi.peticionInvalida(
      `Los valores de ${atributo.nombre.toLowerCase()} necesitan código: va en el SKU.`,
    );
  }
  if (codigo && !/^[A-Z0-9]{1,10}$/.test(codigo)) {
    throw ErrorApi.peticionInvalida(
      'El código va solo con letras y números, sin guiones ni espacios (hasta 10).',
    );
  }

  const usan = new Set(atributo.categoriasQueLoUsan.map((c) => c.categoriaId));
  const ajenas = datos.categoriaIds.filter((id) => !usan.has(id));
  if (ajenas.length > 0) {
    throw ErrorApi.peticionInvalida(
      `Hay categorías elegidas que no usan ${atributo.nombre.toLowerCase()}: agregá el atributo a la categoría primero.`,
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const valor = await tx.valorAtributo.create({
        data: {
          atributoId: atributo.id,
          valor: datos.valor,
          hex: datos.hex ?? null,
          codigo,
          orden: (atributo.valoresAtributo[0]?.orden ?? -1) + 1,
        },
        select: { id: true, valor: true, hex: true, codigo: true, orden: true, atributoId: true },
      });
      await tx.categoriaValorAtributo.createMany({
        data: datos.categoriaIds.map((categoriaId) => ({
          categoriaId,
          atributoId: atributo.id,
          valorId: valor.id,
        })),
      });
      return valor;
    });
  } catch (error) {
    if (esColisionUnica(error)) {
      throw ErrorApi.conflicto(
        `Ya existe un valor de ${atributo.nombre.toLowerCase()} con ese nombre o ese código`,
      );
    }
    throw error;
  }
}
