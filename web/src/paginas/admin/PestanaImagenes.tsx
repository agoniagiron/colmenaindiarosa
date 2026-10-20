import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Boton } from '../../componentes/Boton.tsx';
import { CampoTexto } from '../../componentes/CampoTexto.tsx';
import * as api from '../../contexto/apiProductosAdmin.ts';
import type {
  ImagenProductoDetalle,
  ProductoDetalle,
  TipoImagenProducto,
} from '../../contexto/apiProductosAdmin.ts';
import { subirArchivoFirmado } from '../../contexto/supabaseClient.ts';
import { redimensionarAWebp } from '../../utilidades/redimensionarImagen.ts';

const BUCKET = 'productos';

const ETIQUETAS_TIPO: Record<Exclude<TipoImagenProducto, 'video'>, string> = {
  galeria: 'Galería',
  detalle: 'Detalle',
  modelo: 'Modelo',
  medida: 'Medida',
};

const TIPOS_SELECCIONABLES = Object.keys(ETIQUETAS_TIPO) as Exclude<TipoImagenProducto, 'video'>[];

// Valor del <select> de color para "foto genérica" (valorAtributoId null).
const GENERICA = '';

interface ColorProducto {
  id: string;
  valor: string;
  hex: string | null;
}

interface ItemCola {
  id: string;
  archivo: File;
  blob: Blob;
  previewUrl: string;
  ancho: number;
  alto: number;
  altTexto: string;
  tipo: TipoImagenProducto;
  valorAtributoId: string;
  subiendo: boolean;
  error: string | null;
}

// Los colores que usa alguna variante del producto, en el orden en que
// aparecen: son los únicos a los que el backend deja asociar una foto.
function coloresDelProducto(producto: ProductoDetalle): ColorProducto[] {
  const colores = new Map<string, ColorProducto>();
  for (const variante of producto.variantes) {
    for (const { valorAtributo } of variante.valoresAtributo) {
      if (valorAtributo.atributo.slug !== 'color' || colores.has(valorAtributo.id)) continue;
      colores.set(valorAtributo.id, {
        id: valorAtributo.id,
        valor: valorAtributo.valor,
        hex: valorAtributo.hex,
      });
    }
  }
  return [...colores.values()];
}

export function PestanaImagenes({
  producto,
  accessToken,
  puedeGestionar,
  onCambiado,
}: {
  producto: ProductoDetalle;
  accessToken: string;
  puedeGestionar: boolean;
  onCambiado: () => void;
}) {
  const [cola, setCola] = useState<ItemCola[]>([]);
  const [colorCola, setColorCola] = useState(GENERICA);
  const [arrastrandoZona, setArrastrandoZona] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [colorSeleccion, setColorSeleccion] = useState(GENERICA);
  const [asignando, setAsignando] = useState(false);
  const [errorAsignacion, setErrorAsignacion] = useState<string | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const colores = coloresDelProducto(producto);
  const colorPorId = new Map(colores.map((c) => [c.id, c]));

  // Los object URL de preview solo viven en memoria del navegador: hay
  // que liberarlos al desmontar para no acumular blobs.
  useEffect(() => {
    return () => {
      for (const item of cola) URL.revokeObjectURL(item.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si una foto seleccionada desaparece (se borró), sale de la selección.
  useEffect(() => {
    const ids = new Set(producto.imagenes.map((i) => i.id));
    setSeleccionadas((actual) => {
      const filtrada = new Set([...actual].filter((id) => ids.has(id)));
      return filtrada.size === actual.size ? actual : filtrada;
    });
  }, [producto.imagenes]);

  if (!puedeGestionar) {
    return (
      <section className="rounded-lg border border-linea bg-arena p-5">
        <p className="text-sm text-texto-secundario">
          No tienes permiso para gestionar las imágenes de este producto.
        </p>
      </section>
    );
  }

  // La portada es la primera foto de la galería de la variante que muestra
  // la tienda (la marca el backend): toda foto nueva entra como 'galeria' y
  // al final de la lista — ver subirItem, orden: producto.imagenes.length.
  async function agregarArchivos(archivos: FileList | File[]) {
    for (const archivo of Array.from(archivos)) {
      if (!archivo.type.startsWith('image/')) continue;
      try {
        const { blob, ancho, alto } = await redimensionarAWebp(archivo);
        const previewUrl = URL.createObjectURL(blob);
        setCola((actual) => [
          ...actual,
          {
            id: crypto.randomUUID(),
            archivo,
            blob,
            previewUrl,
            ancho,
            alto,
            altTexto: '',
            tipo: 'galeria',
            valorAtributoId: colorCola,
            subiendo: false,
            error: null,
          },
        ]);
      } catch {
        // Archivo no decodificable como imagen (corrupto, formato raro):
        // se ignora en vez de romper el resto de la selección.
      }
    }
  }

  function actualizarItemCola(id: string, cambios: Partial<ItemCola>) {
    setCola((actual) => actual.map((item) => (item.id === id ? { ...item, ...cambios } : item)));
  }

  // El color de la tanda se aplica a todo lo que está en la cola; cada foto
  // se puede cambiar después por su cuenta.
  function cambiarColorCola(valorAtributoId: string) {
    setColorCola(valorAtributoId);
    setCola((actual) => actual.map((item) => ({ ...item, valorAtributoId })));
  }

  function quitarDeCola(id: string) {
    setCola((actual) => {
      const item = actual.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return actual.filter((i) => i.id !== id);
    });
  }

  async function subirItem(item: ItemCola, orden: number): Promise<boolean> {
    if (!item.altTexto.trim()) return false;
    actualizarItemCola(item.id, { subiendo: true, error: null });
    try {
      const firmada = await api.firmarSubidaImagen(
        accessToken,
        producto.id,
        'image/webp',
        item.blob.size,
      );
      await subirArchivoFirmado(BUCKET, firmada.ruta, firmada.token, item.blob);
      await api.crearImagen(accessToken, producto.id, {
        url: firmada.urlPublica,
        altTexto: item.altTexto.trim(),
        tipo: item.tipo,
        orden,
        ancho: item.ancho,
        alto: item.alto,
        valorAtributoId: item.valorAtributoId || undefined,
      });
      quitarDeCola(item.id);
      return true;
    } catch (e) {
      actualizarItemCola(item.id, {
        subiendo: false,
        error: e instanceof Error ? e.message : 'No se pudo subir la imagen',
      });
      return false;
    }
  }

  async function subirUna(item: ItemCola) {
    if (await subirItem(item, producto.imagenes.length)) onCambiado();
  }

  // En orden de la cola, una tras otra, para que el `orden` quede como se
  // ven acá. Las que no tienen texto alternativo se quedan en la cola.
  async function subirTodas() {
    let orden = producto.imagenes.length;
    let subidas = 0;
    for (const item of cola) {
      if (!item.altTexto.trim() || item.subiendo) continue;
      if (await subirItem(item, orden)) {
        orden += 1;
        subidas += 1;
      }
    }
    if (subidas > 0) onCambiado();
  }

  async function reordenar(idArrastrado: string, idDestino: string) {
    if (idArrastrado === idDestino) return;
    const ids = producto.imagenes.map((i) => i.id);
    const desde = ids.indexOf(idArrastrado);
    const hasta = ids.indexOf(idDestino);
    if (desde === -1 || hasta === -1) return;
    ids.splice(desde, 1);
    ids.splice(hasta, 0, idArrastrado);
    await api.reordenarImagenes(accessToken, producto.id, ids);
    onCambiado();
  }

  async function eliminar(id: string) {
    await api.eliminarImagen(accessToken, id);
    onCambiado();
  }

  function alternarSeleccion(id: string) {
    setSeleccionadas((actual) => {
      const nueva = new Set(actual);
      if (nueva.has(id)) nueva.delete(id);
      else nueva.add(id);
      return nueva;
    });
  }

  async function asignarColorASeleccion() {
    setAsignando(true);
    setErrorAsignacion(null);
    try {
      await api.asignarValorImagenes(
        accessToken,
        producto.id,
        [...seleccionadas],
        colorSeleccion || null,
      );
      setSeleccionadas(new Set());
      onCambiado();
    } catch (e) {
      setErrorAsignacion(e instanceof Error ? e.message : 'No se pudo asignar el color');
    } finally {
      setAsignando(false);
    }
  }

  const todasSeleccionadas =
    producto.imagenes.length > 0 && seleccionadas.size === producto.imagenes.length;
  const listasParaSubir = cola.filter((i) => i.altTexto.trim() && !i.subiendo).length;

  return (
    <div className="flex flex-col gap-5">
      {producto.coloresSinFotos.length > 0 ? (
        <section className="rounded-lg border border-rosa/40 bg-rosa-palo/30 p-4">
          <p className="text-sm font-medium text-tinta">
            {producto.coloresSinFotos.length === 1
              ? 'Hay un color sin fotos'
              : `Hay ${producto.coloresSinFotos.length} colores sin fotos`}
          </p>
          <p className="mt-1 text-[12.5px] text-texto-secundario">
            Quien elija estos colores en la tienda ve solo las fotos genéricas. Seleccioná las fotos
            de cada color abajo y asignáselo.
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {producto.coloresSinFotos.map((color) => (
              <li key={color.id}>
                <PastillaColor color={color} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrandoZona(true);
        }}
        onDragLeave={() => setArrastrandoZona(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrandoZona(false);
          void agregarArchivos(e.dataTransfer.files);
        }}
        onClick={() => inputArchivoRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          arrastrandoZona ? 'border-rosa bg-rosa-palo/40' : 'border-linea bg-arena'
        }`}
      >
        <p className="text-sm text-tinta">Arrastrá imágenes acá, o hacé clic para elegirlas</p>
        <p className="text-[12.5px] text-texto-secundario">
          Se redimensionan a 1600px y se convierten a WebP antes de subir
        </p>
        <input
          ref={inputArchivoRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void agregarArchivos(e.target.files);
            e.target.value = '';
          }}
        />
      </section>

      {cola.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg bg-arena p-3.5">
            {colores.length > 0 ? (
              <SelectorColor
                etiqueta="Color de estas fotos"
                colores={colores}
                value={colorCola}
                onChange={cambiarColorCola}
              />
            ) : (
              <span />
            )}
            <Boton type="button" onClick={() => void subirTodas()} disabled={listasParaSubir === 0}>
              {listasParaSubir > 1 ? `Subir las ${listasParaSubir}` : 'Subir'}
            </Boton>
          </div>
          {cola.map((item) => (
            <div key={item.id} className="flex gap-4 rounded-lg border border-linea bg-hueso p-3.5">
              <img
                src={item.previewUrl}
                alt=""
                className="h-28 w-24 shrink-0 rounded-lg object-cover"
              />
              <div className="flex flex-1 flex-col gap-2">
                <CampoTexto
                  etiqueta="Texto alternativo"
                  value={item.altTexto}
                  onChange={(e) => actualizarItemCola(item.id, { altTexto: e.target.value })}
                  required
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    value={item.tipo}
                    onChange={(e) =>
                      actualizarItemCola(item.id, { tipo: e.target.value as TipoImagenProducto })
                    }
                    className="rounded-lg border border-linea bg-white px-2 py-1.5 text-[13px]"
                  >
                    {TIPOS_SELECCIONABLES.map((t) => (
                      <option key={t} value={t}>
                        {ETIQUETAS_TIPO[t]}
                      </option>
                    ))}
                  </select>
                  {colores.length > 0 ? (
                    <SelectorColor
                      colores={colores}
                      value={item.valorAtributoId}
                      onChange={(valorAtributoId) =>
                        actualizarItemCola(item.id, { valorAtributoId })
                      }
                    />
                  ) : null}
                </div>
                {item.error ? <p className="text-[12.5px] text-rosa">{item.error}</p> : null}
                <div className="flex gap-2">
                  <Boton
                    type="button"
                    variante="fantasma"
                    onClick={() => void subirUna(item)}
                    disabled={!item.altTexto.trim() || item.subiendo}
                  >
                    {item.subiendo ? 'Subiendo…' : 'Subir esta'}
                  </Boton>
                  <Boton type="button" variante="fantasma" onClick={() => quitarDeCola(item.id)}>
                    Quitar
                  </Boton>
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        {producto.imagenes.length === 0 ? (
          <p className="text-sm text-texto-secundario">Todavía no hay imágenes subidas.</p>
        ) : (
          <>
            {colores.length > 0 ? (
              <div className="sticky top-0 z-10 flex flex-wrap items-end gap-3 rounded-lg border border-linea bg-hueso p-3.5">
                <label className="flex items-center gap-2 self-center text-[13px] text-tinta">
                  <input
                    type="checkbox"
                    checked={todasSeleccionadas}
                    onChange={() =>
                      setSeleccionadas(
                        todasSeleccionadas
                          ? new Set()
                          : new Set(producto.imagenes.map((i) => i.id)),
                      )
                    }
                    className="h-4 w-4 accent-rosa"
                  />
                  {seleccionadas.size > 0
                    ? `${seleccionadas.size} seleccionada${seleccionadas.size === 1 ? '' : 's'}`
                    : 'Seleccionar todas'}
                </label>
                {seleccionadas.size > 0 ? (
                  <>
                    <SelectorColor
                      etiqueta="Asignar a"
                      colores={colores}
                      value={colorSeleccion}
                      onChange={setColorSeleccion}
                    />
                    <Boton
                      type="button"
                      onClick={() => void asignarColorASeleccion()}
                      disabled={asignando}
                    >
                      {asignando ? 'Asignando…' : 'Asignar'}
                    </Boton>
                  </>
                ) : null}
                {errorAsignacion ? (
                  <p className="w-full text-[12.5px] text-rosa">{errorAsignacion}</p>
                ) : null}
              </div>
            ) : null}
            {producto.imagenes.map((imagen) => (
              <TarjetaImagenGuardada
                key={imagen.id}
                imagen={imagen}
                esPortada={imagen.id === producto.imagenPortadaId}
                colores={colores}
                color={imagen.valorAtributoId ? colorPorId.get(imagen.valorAtributoId) : undefined}
                seleccionada={seleccionadas.has(imagen.id)}
                onAlternarSeleccion={() => alternarSeleccion(imagen.id)}
                accessToken={accessToken}
                onGuardar={onCambiado}
                onEliminar={() => void eliminar(imagen.id)}
                onSoltar={(idArrastrado) => void reordenar(idArrastrado, imagen.id)}
              />
            ))}
          </>
        )}
      </section>
    </div>
  );
}

function SelectorColor({
  etiqueta,
  colores,
  value,
  onChange,
}: {
  etiqueta?: string;
  colores: ColorProducto[];
  value: string;
  onChange: (valorAtributoId: string) => void;
}) {
  const select = (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-linea bg-white px-2 py-1.5 text-[13px]"
    >
      <option value={GENERICA}>Genérica (todos los colores)</option>
      {colores.map((c) => (
        <option key={c.id} value={c.id}>
          {c.valor}
        </option>
      ))}
    </select>
  );
  if (!etiqueta) return select;
  return (
    <label className="flex flex-col gap-1 text-[12.5px] text-texto-secundario">
      {etiqueta}
      {select}
    </label>
  );
}

function PastillaColor({ color }: { color: { valor: string; hex: string | null } | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-linea bg-white px-2.5 py-0.5 text-[12px] text-tinta">
      {color ? (
        <>
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full border border-linea"
            style={{ backgroundColor: color.hex ?? 'transparent' }}
          />
          {color.valor}
        </>
      ) : (
        'Genérica'
      )}
    </span>
  );
}

function TarjetaImagenGuardada({
  imagen,
  esPortada,
  colores,
  color,
  seleccionada,
  onAlternarSeleccion,
  accessToken,
  onGuardar,
  onEliminar,
  onSoltar,
}: {
  imagen: ImagenProductoDetalle;
  esPortada: boolean;
  colores: ColorProducto[];
  color: ColorProducto | undefined;
  seleccionada: boolean;
  onAlternarSeleccion: () => void;
  accessToken: string;
  onGuardar: () => void;
  onEliminar: () => void;
  onSoltar: (idArrastrado: string) => void;
}) {
  const [altTexto, setAltTexto] = useState(imagen.altTexto);
  const [tipo, setTipo] = useState<TipoImagenProducto>(imagen.tipo);
  const [valorAtributoId, setValorAtributoId] = useState(imagen.valorAtributoId ?? GENERICA);
  const [guardando, setGuardando] = useState(false);
  const [sobreZona, setSobreZona] = useState(false);

  useEffect(() => {
    setAltTexto(imagen.altTexto);
    setTipo(imagen.tipo);
    setValorAtributoId(imagen.valorAtributoId ?? GENERICA);
  }, [imagen]);

  async function guardar() {
    setGuardando(true);
    try {
      await api.editarImagen(accessToken, imagen.id, {
        altTexto,
        tipo,
        valorAtributoId: valorAtributoId || null,
      });
      onGuardar();
    } finally {
      setGuardando(false);
    }
  }

  function alSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setSobreZona(false);
    const idArrastrado = e.dataTransfer.getData('text/plain');
    if (idArrastrado) onSoltar(idArrastrado);
  }

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', imagen.id)}
      onDragOver={(e) => {
        e.preventDefault();
        setSobreZona(true);
      }}
      onDragLeave={() => setSobreZona(false)}
      onDrop={alSoltar}
      className={`flex cursor-grab gap-4 rounded-lg border p-3.5 ${
        sobreZona || seleccionada ? 'border-rosa bg-rosa-palo/30' : 'border-linea bg-hueso'
      }`}
    >
      {colores.length > 0 ? (
        <input
          type="checkbox"
          checked={seleccionada}
          onChange={onAlternarSeleccion}
          aria-label={`Seleccionar ${imagen.altTexto}`}
          className="mt-1 h-4 w-4 shrink-0 accent-rosa"
        />
      ) : null}
      <div className="relative h-28 w-24 shrink-0">
        <img
          src={imagen.url}
          alt={imagen.altTexto}
          className="h-full w-full rounded-lg object-cover"
        />
        {esPortada ? (
          <span
            title="La que muestra hoy la tarjeta del catálogo"
            className="absolute top-1 left-1 rounded-full bg-negro/80 px-2 py-0.5 text-[10px] text-hueso"
          >
            Portada
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {colores.length > 0 ? (
          <div>
            <PastillaColor color={color} />
          </div>
        ) : null}
        <CampoTexto
          etiqueta="Texto alternativo"
          value={altTexto}
          onChange={(e) => setAltTexto(e.target.value)}
          required
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoImagenProducto)}
            className="rounded-lg border border-linea bg-white px-2 py-1.5 text-[13px]"
          >
            {TIPOS_SELECCIONABLES.map((t) => (
              <option key={t} value={t}>
                {ETIQUETAS_TIPO[t]}
              </option>
            ))}
          </select>
          {colores.length > 0 ? (
            <SelectorColor
              colores={colores}
              value={valorAtributoId}
              onChange={setValorAtributoId}
            />
          ) : null}
        </div>
        <div className="flex gap-2">
          <Boton
            type="button"
            variante="fantasma"
            onClick={() => void guardar()}
            disabled={guardando}
          >
            Guardar
          </Boton>
          <Boton type="button" variante="fantasma" onClick={onEliminar}>
            Eliminar
          </Boton>
        </div>
      </div>
    </div>
  );
}
