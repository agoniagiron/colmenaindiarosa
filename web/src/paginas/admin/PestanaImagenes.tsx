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
  principal: 'Principal',
  galeria: 'Galería',
  detalle: 'Detalle',
  modelo: 'Modelo',
  medida: 'Medida',
};

const TIPOS_SELECCIONABLES = Object.keys(ETIQUETAS_TIPO) as Exclude<TipoImagenProducto, 'video'>[];

interface ItemCola {
  id: string;
  archivo: File;
  blob: Blob;
  previewUrl: string;
  ancho: number;
  alto: number;
  altTexto: string;
  tipo: TipoImagenProducto;
  varianteId: string;
  subiendo: boolean;
  error: string | null;
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
  const [arrastrandoZona, setArrastrandoZona] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  // Los object URL de preview solo viven en memoria del navegador: hay
  // que liberarlos al desmontar para no acumular blobs.
  useEffect(() => {
    return () => {
      for (const item of cola) URL.revokeObjectURL(item.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!puedeGestionar) {
    return (
      <section className="rounded-lg border border-linea bg-arena p-5">
        <p className="text-sm text-texto-secundario">
          No tienes permiso para gestionar las imágenes de este producto.
        </p>
      </section>
    );
  }

  async function agregarArchivos(archivos: FileList | File[]) {
    const yaHayPrincipal =
      producto.imagenes.some((i) => i.tipo === 'principal') ||
      cola.some((i) => i.tipo === 'principal');

    let asignoPrincipal = yaHayPrincipal;
    for (const archivo of Array.from(archivos)) {
      if (!archivo.type.startsWith('image/')) continue;
      try {
        const { blob, ancho, alto } = await redimensionarAWebp(archivo);
        const previewUrl = URL.createObjectURL(blob);
        const esPrincipal = !asignoPrincipal;
        asignoPrincipal = true;
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
            tipo: esPrincipal ? 'principal' : 'galeria',
            varianteId: '',
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

  function quitarDeCola(id: string) {
    setCola((actual) => {
      const item = actual.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return actual.filter((i) => i.id !== id);
    });
  }

  async function subirItem(item: ItemCola) {
    if (!item.altTexto.trim()) return;
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
        orden: producto.imagenes.length,
        ancho: item.ancho,
        alto: item.alto,
        varianteId: item.varianteId || undefined,
      });
      quitarDeCola(item.id);
      onCambiado();
    } catch (e) {
      actualizarItemCola(item.id, {
        subiendo: false,
        error: e instanceof Error ? e.message : 'No se pudo subir la imagen',
      });
    }
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

  return (
    <div className="flex flex-col gap-5">
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
                  <select
                    value={item.varianteId}
                    onChange={(e) => actualizarItemCola(item.id, { varianteId: e.target.value })}
                    className="rounded-lg border border-linea bg-white px-2 py-1.5 text-[13px]"
                  >
                    <option value="">Sin variante</option>
                    {producto.variantes.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.sku}
                      </option>
                    ))}
                  </select>
                </div>
                {item.error ? <p className="text-[12.5px] text-rosa">{item.error}</p> : null}
                <div className="flex gap-2">
                  <Boton
                    type="button"
                    onClick={() => void subirItem(item)}
                    disabled={!item.altTexto.trim() || item.subiendo}
                  >
                    {item.subiendo ? 'Subiendo…' : 'Subir'}
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
          producto.imagenes.map((imagen, indice) => (
            <TarjetaImagenGuardada
              key={imagen.id}
              imagen={imagen}
              esPrimera={indice === 0}
              variantes={producto.variantes}
              accessToken={accessToken}
              onGuardar={onCambiado}
              onEliminar={() => void eliminar(imagen.id)}
              onSoltar={(idArrastrado) => void reordenar(idArrastrado, imagen.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function TarjetaImagenGuardada({
  imagen,
  esPrimera,
  variantes,
  accessToken,
  onGuardar,
  onEliminar,
  onSoltar,
}: {
  imagen: ImagenProductoDetalle;
  esPrimera: boolean;
  variantes: ProductoDetalle['variantes'];
  accessToken: string;
  onGuardar: () => void;
  onEliminar: () => void;
  onSoltar: (idArrastrado: string) => void;
}) {
  const [altTexto, setAltTexto] = useState(imagen.altTexto);
  const [tipo, setTipo] = useState<TipoImagenProducto>(imagen.tipo);
  const [varianteId, setVarianteId] = useState(imagen.varianteId ?? '');
  const [guardando, setGuardando] = useState(false);
  const [sobreZona, setSobreZona] = useState(false);

  useEffect(() => {
    setAltTexto(imagen.altTexto);
    setTipo(imagen.tipo);
    setVarianteId(imagen.varianteId ?? '');
  }, [imagen]);

  async function guardar() {
    setGuardando(true);
    try {
      await api.editarImagen(accessToken, imagen.id, {
        altTexto,
        tipo,
        varianteId: varianteId || null,
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
        sobreZona ? 'border-rosa bg-rosa-palo/30' : 'border-linea bg-hueso'
      }`}
    >
      <div className="relative h-28 w-24 shrink-0">
        <img
          src={imagen.url}
          alt={imagen.altTexto}
          className="h-full w-full rounded-lg object-cover"
        />
        {esPrimera ? (
          <span className="absolute top-1 left-1 rounded-full bg-negro/80 px-2 py-0.5 text-[10px] text-hueso">
            Principal
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2">
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
          <select
            value={varianteId}
            onChange={(e) => setVarianteId(e.target.value)}
            className="rounded-lg border border-linea bg-white px-2 py-1.5 text-[13px]"
          >
            <option value="">Sin variante</option>
            {variantes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.sku}
              </option>
            ))}
          </select>
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
