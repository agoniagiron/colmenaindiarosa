// Vista de detalle de un kit, solo del panel (punto 2): sirve para
// verificar que las fotos propias del kit quedaron bien y en orden, ver
// los productos que lo componen y el precio. No tiene página pública
// equivalente — eso se evalúa aparte, como tarea propia.

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { EsqueletoCarga } from '../../componentes/EsqueletoCarga.tsx';
import { MiniaturaGaleria } from '../../componentes/MiniaturaGaleria.tsx';
import * as api from '../../contexto/apiCombosAdmin.ts';
import type { KitDetalle } from '../../contexto/apiCombosAdmin.ts';
import { useSesionAdmin } from '../../contexto/ContextoSesionAdmin.tsx';
import { formatearPesos } from '../../utilidades/formatearPesos.ts';
import { PestanaImagenesCombo } from './PestanaImagenesCombo.tsx';

function Seccion({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-linea bg-arena p-5">
      {titulo ? <h2 className="mb-3 font-serif text-lg text-tinta">{titulo}</h2> : null}
      {children}
    </section>
  );
}

export function AdminKitDetalle() {
  const { id } = useParams<{ id: string }>();
  const { usuarioAdmin, accessToken } = useSesionAdmin();

  const [kit, setKit] = useState<KitDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  function recargar() {
    if (!accessToken || !id) return;
    api
      .obtenerDetalleKit(accessToken, id)
      .then((r) => {
        setKit(r);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof api.ErrorKitsAdmin ? e.message : 'No se pudo cargar el kit');
      });
  }

  useEffect(recargar, [accessToken, id]);

  if (!usuarioAdmin || !accessToken) return null;
  if (!usuarioAdmin.permisos.includes('combos.ver')) {
    return <Navigate to="/admin" replace />;
  }
  const puedeGestionar = usuarioAdmin.permisos.includes('combos.gestionar');

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <Link to="/admin/kits" className="text-sm text-rosa hover:underline">
          ← Volver a kits
        </Link>
        <p className="text-sm text-texto-secundario">{error}</p>
      </div>
    );
  }

  if (!kit) {
    return (
      <div className="flex flex-col gap-3">
        <EsqueletoCarga alto="h-8" ancho="w-1/3" />
        <EsqueletoCarga alto="h-64" />
      </div>
    );
  }

  // La portada es la primera foto por orden, no el tipo — kit.imagenes ya
  // viene ordenado por el backend (ver SELECT_DETALLE en servicio.ts).
  const imagenPrincipal = kit.imagenes[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/kits" className="text-sm text-rosa hover:underline">
          ← Volver a kits
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-serif text-[28px] text-tinta">{kit.nombre}</h1>
          <span className="rounded-full bg-hueso px-2.5 py-0.5 text-[12px] text-texto-secundario">
            {kit.activo ? 'Activo' : 'Inactivo'}
          </span>
          {kit.disponible ? (
            <span className="rounded-full bg-verde-luz px-2.5 py-0.5 text-[12px] text-verde">
              Disponible
            </span>
          ) : (
            <span className="rounded-full bg-ambar-luz px-2.5 py-0.5 text-[12px] text-ambar">
              Sin stock: {kit.piezaSinStock}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.4fr_0.6fr]">
        <div className="w-full max-w-[220px]">
          <MiniaturaGaleria
            nombre={kit.nombre}
            className="rounded-lg"
            imagenPrincipal={imagenPrincipal}
            cantidadImagenes={kit.imagenes.length}
            cargarGaleria={() => Promise.resolve(kit.imagenes)}
          />
        </div>

        <Seccion titulo="Kit">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-texto-secundario">Precio del kit</dt>
              <dd className="text-tinta">{formatearPesos(kit.precioCop)}</dd>
            </div>
            <div>
              <dt className="text-texto-secundario">Precio suelto</dt>
              <dd className="text-tinta">{formatearPesos(kit.precioSueltoCop)}</dd>
            </div>
            <div>
              <dt className="text-texto-secundario">Ahorro</dt>
              <dd className="text-verde">
                {formatearPesos(kit.ahorroCop)} ({kit.ahorroPorcentaje}%)
              </dd>
            </div>
            <div>
              <dt className="text-texto-secundario">Vigencia</dt>
              <dd className="text-tinta">
                desde {new Date(kit.vigenteDesde).toLocaleDateString('es-CO')}
                {kit.vigenteHasta
                  ? ` hasta ${new Date(kit.vigenteHasta).toLocaleDateString('es-CO')}`
                  : ''}
              </dd>
            </div>
          </dl>
          {kit.descripcion ? (
            <p className="mt-3 text-sm text-texto-secundario">{kit.descripcion}</p>
          ) : null}
        </Seccion>
      </div>

      <Seccion titulo="Productos que lo componen">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-texto-secundario uppercase">
              <th className="py-2 pr-3">Producto</th>
              <th className="py-2 pr-3">SKU</th>
              <th className="py-2 pr-3 text-right">Cantidad</th>
              <th className="py-2 text-right">Precio unitario</th>
            </tr>
          </thead>
          <tbody>
            {kit.items.map((item) => (
              <tr key={item.varianteId} className="border-t border-linea">
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-2">
                    {item.color?.hex ? (
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 rounded-sm"
                        style={{ backgroundColor: item.color.hex }}
                      />
                    ) : null}
                    {item.nombreProducto}
                    {item.color?.nombre ? ` · ${item.color.nombre}` : ''}
                  </span>
                </td>
                <td className="py-2 pr-3 text-texto-secundario">{item.sku}</td>
                <td className="py-2 pr-3 text-right">{item.cantidad}</td>
                <td className="py-2 text-right">{formatearPesos(item.precioUnitario)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>

      <div>
        <h2 className="mb-3 font-serif text-lg text-tinta">Fotos del kit</h2>
        <PestanaImagenesCombo
          kit={kit}
          accessToken={accessToken}
          puedeGestionar={puedeGestionar}
          onCambiado={recargar}
        />
      </div>
    </div>
  );
}
