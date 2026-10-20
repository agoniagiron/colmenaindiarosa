import { Prisma } from '@prisma/client';
import { ErrorApi } from '../../../lib/errorApi.js';
import { prisma } from '../../../lib/prisma.js';
import type {
  BodyConfiguracionCategoria,
  BodyCrearValorAtributo,
  BodyEditarValorAtributo,
} from './esquemas.js';

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

// Atributos universales: la lista de valores es la misma en todas las
// categorías que los usan. La universalidad vive SOLO en la escritura: toda
// categoría que usa el atributo tiene una fila en categoria_valor_atributo
// por cada valor, activo o desactivado (así reactivar uno lo devuelve a todas
// partes). La lectura no distingue: lee la tabla y filtra activo, igual que
// para cualquier otro atributo.
const SLUGS_UNIVERSALES = ['color'];

export function esAtributoUniversal(slug: string): boolean {
  return SLUGS_UNIVERSALES.includes(slug);
}

// Lo que devuelven crear, activar y editar un valor.
const SELECT_VALOR = {
  id: true,
  valor: true,
  hex: true,
  hexSecundario: true,
  codigo: true,
  orden: true,
  activo: true,
  atributoId: true,
} satisfies Prisma.ValorAtributoSelect;

// Un color combinado (dos tonos, esfera partida) sigue siendo UN color: un
// nombre, un código, una opción. hex_secundario solo existe para color y
// siempre con un primario. Igual al primario no es combinado: se guarda
// sólido (null).
function normalizarTonos(
  slug: string,
  hex: string | null,
  hexSecundario: string | null,
): { hex: string | null; hexSecundario: string | null } {
  if (hexSecundario && slug !== 'color') {
    throw ErrorApi.peticionInvalida('Solo un color puede tener un color secundario');
  }
  if (hexSecundario && !hex) {
    throw ErrorApi.peticionInvalida('El color secundario necesita un color primario');
  }
  const mismoTono = hexSecundario && hex && hexSecundario.toLowerCase() === hex.toLowerCase();
  return { hex, hexSecundario: mismoTono ? null : hexSecundario };
}

function normalizarCodigo(slug: string, nombreAtributo: string, codigo: string | null) {
  if (!codigo && SLUGS_CON_CODIGO_OBLIGATORIO.includes(slug)) {
    throw ErrorApi.peticionInvalida(
      `Los valores de ${nombreAtributo} necesitan código: va en el SKU.`,
    );
  }
  if (codigo && !/^[A-Z0-9]{1,10}$/.test(codigo)) {
    throw ErrorApi.peticionInvalida(
      'El código va solo con letras y números, sin guiones ni espacios (hasta 10).',
    );
  }
  return codigo;
}

// Un valor del mismo atributo con ese nombre (sin distinguir mayúsculas) o
// ese código. El 409 dice cuál es y si está desactivado, para que el panel
// ofrezca reactivarlo o editarlo en vez de dejar a la persona trabada.
async function rechazarSiYaExiste(
  atributoId: string,
  nombreAtributo: string,
  valor: string,
  codigo: string | null,
  salvoValorId?: string,
) {
  const existente = await prisma.valorAtributo.findFirst({
    where: {
      atributoId,
      ...(salvoValorId ? { id: { not: salvoValorId } } : {}),
      OR: [{ valor: { equals: valor, mode: 'insensitive' } }, ...(codigo ? [{ codigo }] : [])],
    },
    select: { id: true, valor: true, codigo: true, activo: true },
  });
  if (!existente) return;
  const mismoNombre = existente.valor.toLowerCase() === valor.toLowerCase();
  throw ErrorApi.conflicto(
    existente.activo
      ? mismoNombre
        ? `Ya existe ${existente.valor} en ${nombreAtributo}`
        : `El código ${codigo} ya lo usa ${existente.valor}`
      : `${existente.valor} ya existe pero está desactivado`,
    {
      valorId: existente.id,
      valor: existente.valor,
      activo: existente.activo,
      campo: mismoNombre ? 'valor' : 'codigo',
    },
  );
}

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
          select: {
            id: true,
            valor: true,
            hex: true,
            hexSecundario: true,
            codigo: true,
            orden: true,
            activo: true,
            // Con variantes, el código ya no se puede editar (va en el SKU).
            _count: { select: { variantes: true } },
          },
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
      // Universal: el editor de categorías no ofrece elegir sus valores.
      universal: esAtributoUniversal(a.slug),
      valores: a.valoresAtributo.map(({ _count, ...valor }) => ({
        ...valor,
        variantesQueLoUsan: _count.variantes,
      })),
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
//
// Para un atributo universal, los valorIds del pedido se IGNORAN (no se
// rechazan: un panel viejo durante un deploy todavía los manda). Sus filas
// las maneja el servidor: nunca se borran al guardar, y en cada guardado se
// completan las que falten.
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
    select: {
      id: true,
      slug: true,
      nombre: true,
      valoresAtributo: { select: { id: true, activo: true } },
    },
  });
  if (atributos.length !== atributoIds.length) {
    throw ErrorApi.peticionInvalida('Alguno de los atributos no existe');
  }
  const atributoPorId = new Map(atributos.map((a) => [a.id, a]));

  for (const elegido of datos.atributos) {
    const atributo = atributoPorId.get(elegido.atributoId)!;
    if (esAtributoUniversal(atributo.slug)) {
      // Obligatorio sin ningún valor activo haría imposible crear variantes.
      if (elegido.obligatorio && !atributo.valoresAtributo.some((v) => v.activo)) {
        throw ErrorApi.peticionInvalida(
          `${atributo.nombre} es obligatorio pero no tiene ningún valor activo`,
        );
      }
      continue;
    }
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

  const universales = await prisma.atributo.findMany({
    where: { slug: { in: SLUGS_UNIVERSALES } },
    select: { id: true },
  });
  const idsUniversales = universales.map((a) => a.id);

  await prisma.$transaction(async (tx) => {
    // Quitar un atributo de la categoría borra también sus valores
    // permitidos (ON DELETE CASCADE de la clave hacia categoria_atributo),
    // universales incluidos: deja de usarlo, no hay nada que guardar.
    await tx.categoriaAtributo.deleteMany({
      where: { categoriaId, atributoId: { notIn: atributoIds } },
    });
    // Se reemplazan las filas elegidas a mano. Las de atributos universales
    // NO se tocan: el editor no las manda, y borrarlas acá dejaría a la
    // categoría sin colores la primera vez que alguien guarde.
    await tx.categoriaValorAtributo.deleteMany({
      where: { categoriaId, atributoId: { notIn: idsUniversales } },
    });
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
      data: datos.atributos.flatMap((elegido) => {
        const atributo = atributoPorId.get(elegido.atributoId)!;
        // Universal: todos sus valores, activos y desactivados. Completa
        // las que falten (categoría que recién lo usa, o datos viejos con
        // un subconjunto); las que ya están las salta skipDuplicates.
        const valorIds = esAtributoUniversal(atributo.slug)
          ? atributo.valoresAtributo.map((v) => v.id)
          : elegido.valorIds;
        return valorIds.map((valorId) => ({
          categoriaId,
          atributoId: elegido.atributoId,
          valorId,
        }));
      }),
      skipDuplicates: true,
    });
  });

  return obtenerConfiguracionAtributos();
}

function esColisionUnica(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// Crea un valor y lo habilita en categorías, en una sola transacción: el
// valor no puede quedar creado sin aparecer en ningún lado. Un atributo
// universal se habilita en TODAS las categorías que lo usan (categoriaIds se
// ignora); los demás, en las categorías elegidas.
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
  const nombreAtributo = atributo.nombre.toLowerCase();

  const codigo = normalizarCodigo(
    atributo.slug,
    nombreAtributo,
    datos.codigo ? datos.codigo.trim().toUpperCase() : null,
  );
  const tonos = normalizarTonos(atributo.slug, datos.hex ?? null, datos.hexSecundario ?? null);

  const usan = atributo.categoriasQueLoUsan.map((c) => c.categoriaId);
  let categoriaIds: string[];
  if (esAtributoUniversal(atributo.slug)) {
    categoriaIds = usan;
  } else {
    categoriaIds = datos.categoriaIds ?? [];
    if (categoriaIds.length === 0) {
      throw ErrorApi.peticionInvalida('Elegí al menos una categoría donde habilitarlo');
    }
    const ajenas = categoriaIds.filter((id) => !usan.includes(id));
    if (ajenas.length > 0) {
      throw ErrorApi.peticionInvalida(
        `Hay categorías elegidas que no usan ${nombreAtributo}: agregá el atributo a la categoría primero.`,
      );
    }
  }

  const valor = datos.valor.trim();
  await rechazarSiYaExiste(atributo.id, nombreAtributo, valor, codigo);

  try {
    return await prisma.$transaction(async (tx) => {
      const creado = await tx.valorAtributo.create({
        data: {
          atributoId: atributo.id,
          valor,
          ...tonos,
          codigo,
          orden: (atributo.valoresAtributo[0]?.orden ?? -1) + 1,
        },
        select: SELECT_VALOR,
      });
      await tx.categoriaValorAtributo.createMany({
        data: categoriaIds.map((categoriaId) => ({
          categoriaId,
          atributoId: atributo.id,
          valorId: creado.id,
        })),
      });
      return creado;
    });
  } catch (error) {
    // Dos pedidos al mismo tiempo: el control de arriba no lo ve.
    if (esColisionUnica(error)) {
      throw ErrorApi.conflicto(
        `Ya existe un valor de ${nombreAtributo} con ese nombre o ese código`,
      );
    }
    throw error;
  }
}

// Desactivar esconde el valor de lo que se ofrece al crear variantes nuevas
// (lib/atributosCategoria.ts filtra activo); no toca sus filas de
// categoria_valor_atributo ni las variantes que ya lo usan, que siguen
// visibles y vendibles. Reactivar lo devuelve tal cual estaba.
export async function cambiarActivoValor(valorId: string, activo: boolean) {
  const existe = await prisma.valorAtributo.findUnique({
    where: { id: valorId },
    select: { id: true },
  });
  if (!existe) throw ErrorApi.noEncontrado('El valor no existe');
  return prisma.valorAtributo.update({
    where: { id: valorId },
    data: { activo },
    select: SELECT_VALOR,
  });
}

// Editar un valor ya creado: el nombre y los tonos, siempre. El código, solo
// mientras ninguna variante lo use: el SKU se guarda en la variante
// (variante_producto.sku) con el código adentro, así que cambiarlo después
// dejaría los SKU existentes sin correspondencia con su color.
//
// Lo vendido no cambia: pedido_item congela nombre, color y tonos al comprar
// (lib/lineaPedido.ts). Sí cambia lo vivo: catálogo, ficha y carrito.
export async function editarValorAtributo(valorId: string, datos: BodyEditarValorAtributo) {
  const actual = await prisma.valorAtributo.findUnique({
    where: { id: valorId },
    select: {
      id: true,
      valor: true,
      hex: true,
      hexSecundario: true,
      codigo: true,
      atributo: { select: { id: true, slug: true, nombre: true } },
      _count: { select: { variantes: true } },
    },
  });
  if (!actual) throw ErrorApi.noEncontrado('El valor no existe');
  const { atributo } = actual;
  const nombreAtributo = atributo.nombre.toLowerCase();

  const valor = datos.valor !== undefined ? datos.valor.trim() : actual.valor;

  let codigo = actual.codigo;
  if (datos.codigo !== undefined) {
    const nuevo = datos.codigo.trim().toUpperCase();
    if (nuevo !== actual.codigo) {
      if (actual._count.variantes > 0) {
        throw ErrorApi.conflicto(
          `El código de ${actual.valor} no se puede cambiar: ya lo usan ${actual._count.variantes} variantes en su SKU.`,
        );
      }
      codigo = normalizarCodigo(atributo.slug, nombreAtributo, nuevo);
    }
  }

  const tonos = normalizarTonos(
    atributo.slug,
    datos.hex !== undefined ? datos.hex : actual.hex,
    datos.hexSecundario !== undefined ? datos.hexSecundario : actual.hexSecundario,
  );

  await rechazarSiYaExiste(atributo.id, nombreAtributo, valor, codigo, actual.id);

  try {
    return await prisma.valorAtributo.update({
      where: { id: valorId },
      data: { valor, codigo, ...tonos },
      select: SELECT_VALOR,
    });
  } catch (error) {
    if (esColisionUnica(error)) {
      throw ErrorApi.conflicto(
        `Ya existe un valor de ${nombreAtributo} con ese nombre o ese código`,
      );
    }
    throw error;
  }
}
