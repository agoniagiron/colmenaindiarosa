import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { EsqueletoCarga } from '../../componentes/EsqueletoCarga.tsx';
import { ImagenProducto } from '../../componentes/ImagenProducto.tsx';
import * as api from '../../contexto/apiAnaliticaAdmin.ts';
import type {
  Clientas,
  Comparacion,
  Embudo,
  FilaBusqueda,
  FilaCalificacion,
  FilaOrigen,
  FilaProductoAdmin,
  OrdenProductosAdmin,
  PuntoSerie,
  Resumen,
} from '../../contexto/apiAnaliticaAdmin.ts';
import { useSesionAdmin } from '../../contexto/ContextoSesionAdmin.tsx';
import { hoyBogota, rangoDePeriodo, PERIODOS } from '../../dominio/fechasReporte.ts';
import type { Periodo } from '../../dominio/fechasReporte.ts';
import { formatearPesos } from '../../utilidades/formatearPesos.ts';
import { formatearPesosCompacto } from '../../utilidades/formatearPesosCompacto.ts';

const MINIMO_RESENAS = 5;
const LIMITE_TABLA = 5;

const formateadorEntero = new Intl.NumberFormat('es-CO');
const formateadorPorcentaje = new Intl.NumberFormat('es-CO', {
  style: 'percent',
  maximumFractionDigits: 1,
});

function entero(n: number): string {
  return formateadorEntero.format(n);
}
function porcentaje(fraccion: number): string {
  return formateadorPorcentaje.format(fraccion);
}
function formatearFechaCorta(fecha: string): string {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

export function AdminAnalitica() {
  const { usuarioAdmin, accessToken } = useSesionAdmin();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!usuarioAdmin || !accessToken) return null;

  // El backend igual lo exige en cada endpoint; esto solo evita mostrar un
  // panel que de todas formas va a fallar con 403 en cada llamada.
  if (!usuarioAdmin.permisos.includes('reportes.ver')) {
    return <Navigate to="/admin" replace />;
  }

  const periodoCrudo = searchParams.get('periodo');
  const periodo: Periodo = PERIODOS.some((p) => p.valor === periodoCrudo)
    ? (periodoCrudo as Periodo)
    : 'mes';
  const { desde, hasta } = rangoDePeriodo(periodo, hoyBogota());

  function cambiarPeriodo(nuevo: Periodo) {
    setSearchParams({ periodo: nuevo });
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-serif text-[28px] text-tinta">Analítica</h1>
          <p className="mt-1.5 text-sm text-texto-secundario">
            Del {formatearFechaCorta(desde)} al {formatearFechaCorta(hasta)}, comparado contra el
            período anterior
          </p>
        </div>
        <div
          role="group"
          aria-label="Período"
          className="flex gap-1.5 rounded-full border border-linea bg-arena p-1"
        >
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              aria-pressed={p.valor === periodo}
              onClick={() => cambiarPeriodo(p.valor)}
              className={`rounded-full px-4 py-1.5 text-[13px] transition-colors ${
                p.valor === periodo
                  ? 'bg-negro text-hueso'
                  : 'text-texto-secundario hover:text-tinta'
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <SeccionKpis accessToken={accessToken} desde={desde} hasta={hasta} />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <SeccionEmbudo accessToken={accessToken} desde={desde} hasta={hasta} />
        <SeccionSerie accessToken={accessToken} hasta={hasta} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <TablaMasVistos accessToken={accessToken} desde={desde} hasta={hasta} />
        <TablaMasAgregados accessToken={accessToken} desde={desde} hasta={hasta} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <TablaMasVendidos accessToken={accessToken} desde={desde} hasta={hasta} />
        <TablaMenosVendidos accessToken={accessToken} desde={desde} hasta={hasta} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <TablaCalificaciones accessToken={accessToken} orden="mejor" />
        <TablaCalificaciones accessToken={accessToken} orden="peor" />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <CajaOrigen accessToken={accessToken} desde={desde} hasta={hasta} />
        <CajaBusquedas accessToken={accessToken} desde={desde} hasta={hasta} />
        <CajaClientas accessToken={accessToken} desde={desde} hasta={hasta} />
      </div>
    </div>
  );
}

// --- Caja contenedora compartida ------------------------------------------

function Caja({
  titulo,
  sub,
  children,
  nota,
}: {
  titulo: string;
  sub?: string;
  children: ReactNode;
  nota?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-linea bg-arena p-5">
      <h2 className="font-serif text-lg text-tinta">{titulo}</h2>
      {sub ? <p className="mt-0.5 mb-4 text-[13px] text-texto-secundario">{sub}</p> : null}
      {children}
      {nota ? (
        <p className="mt-3.5 rounded-r-lg border-l-[3px] border-ambar bg-ambar-luz px-3.5 py-2.5 text-[12.5px] text-texto-secundario">
          {nota}
        </p>
      ) : null}
    </section>
  );
}

function MensajeVacio({
  texto = 'Todavía no hay datos suficientes para esta tabla.',
}: {
  texto?: string;
}) {
  return <p className="py-6 text-center text-sm text-texto-secundario">{texto}</p>;
}

function EsqueletoFilas({ n = LIMITE_TABLA }: { n?: number }) {
  return (
    <div className="flex flex-col gap-2.5 py-1">
      {Array.from({ length: n }).map((_, i) => (
        <EsqueletoCarga key={i} alto="h-8" />
      ))}
    </div>
  );
}

// --- KPIs -------------------------------------------------------------------

const CAMPOS_KPI: {
  clave: keyof Resumen;
  etiqueta: string;
  tipo: 'entero' | 'dinero' | 'conversion';
}[] = [
  { clave: 'visitantesUnicos', etiqueta: 'Visitantes únicos', tipo: 'entero' },
  { clave: 'registros', etiqueta: 'Registros nuevos', tipo: 'entero' },
  { clave: 'pedidosPagados', etiqueta: 'Pedidos pagados', tipo: 'entero' },
  { clave: 'ingresos', etiqueta: 'Ingresos', tipo: 'dinero' },
  { clave: 'conversion', etiqueta: 'Conversión', tipo: 'conversion' },
];

function formatearValorKpi(valor: number, tipo: 'entero' | 'dinero' | 'conversion'): string {
  if (tipo === 'dinero') return formatearPesosCompacto(valor);
  if (tipo === 'conversion') return porcentaje(valor);
  return entero(valor);
}

function Delta({ comparacion, esPuntos }: { comparacion: Comparacion; esPuntos: boolean }) {
  if (comparacion.variacion === null) {
    return <span className="text-[11.5px] text-texto-secundario">sin período previo</span>;
  }
  const sube = comparacion.variacion > 0;
  const igual = comparacion.variacion === 0;
  const texto = esPuntos
    ? `${Math.abs(comparacion.variacion * 100)
        .toFixed(1)
        .replace('.', ',')} pp`
    : porcentaje(Math.abs(comparacion.variacion));

  return (
    <>
      {!igual ? (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
            sube ? 'bg-verde-luz text-verde' : 'bg-rosa-palo text-rosa'
          }`}
        >
          {sube ? '▲' : '▼'} {texto}
        </span>
      ) : (
        <span className="text-[11.5px] text-texto-secundario">sin cambio</span>
      )}
      <span className="ml-1 text-[11.5px] text-texto-secundario">
        vs {formatearValorKpi(comparacion.anterior, esPuntos ? 'conversion' : 'entero')}
      </span>
    </>
  );
}

function SeccionKpis({
  accessToken,
  desde,
  hasta,
}: {
  accessToken: string;
  desde: string;
  hasta: string;
}) {
  const [resumen, setResumen] = useState<Resumen | null>(null);

  useEffect(() => {
    let vigente = true;
    setResumen(null);
    api
      .obtenerResumen(accessToken, desde, hasta)
      .then((r) => {
        if (vigente) setResumen(r);
      })
      .catch(() => {
        if (vigente) setResumen(null);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, desde, hasta]);

  return (
    <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
      {CAMPOS_KPI.map((campo) => {
        const comparacion = resumen?.[campo.clave] as Comparacion | undefined;
        return (
          <div key={campo.clave} className="rounded-lg border border-linea bg-arena p-4">
            <div className="text-[12.5px] text-texto-secundario">{campo.etiqueta}</div>
            {!comparacion ? (
              <div className="mt-2 flex flex-col gap-2">
                <EsqueletoCarga alto="h-7" ancho="w-2/3" />
                <EsqueletoCarga alto="h-3" ancho="w-1/2" />
              </div>
            ) : (
              <>
                <div className="my-1.5 font-serif text-[27px] tracking-tight text-tinta">
                  {formatearValorKpi(comparacion.actual, campo.tipo)}
                </div>
                <Delta comparacion={comparacion} esPuntos={campo.tipo === 'conversion'} />
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}

// --- Embudo ------------------------------------------------------------------

const ETIQUETAS_PASO: Record<string, string> = {
  visitaron: 'Visitaron la tienda',
  vieron_producto: 'Vieron un producto',
  agregaron: 'Agregaron al carrito',
  iniciaron_pago: 'Iniciaron el pago',
  pagaron: 'Pagaron',
};

const TONOS_BARRA = ['bg-rosa', 'bg-rosa', 'bg-[#C98098]', 'bg-[#C98098]', 'bg-[#E0B0BF]'];

function SeccionEmbudo({
  accessToken,
  desde,
  hasta,
}: {
  accessToken: string;
  desde: string;
  hasta: string;
}) {
  const [embudo, setEmbudo] = useState<Embudo | null>(null);

  useEffect(() => {
    let vigente = true;
    setEmbudo(null);
    api
      .obtenerEmbudo(accessToken, desde, hasta)
      .then((r) => {
        if (vigente) setEmbudo(r);
      })
      .catch(() => {
        if (vigente) setEmbudo(null);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, desde, hasta]);

  if (!embudo) {
    return (
      <Caja
        titulo="Dónde se cae la gente"
        sub="De cada 100 visitas, cuántas llegan al siguiente paso"
      >
        <EsqueletoFilas />
      </Caja>
    );
  }

  if (embudo.pasos.length === 0 || embudo.pasos[0]!.sesiones === 0) {
    return (
      <Caja
        titulo="Dónde se cae la gente"
        sub="De cada 100 visitas, cuántas llegan al siguiente paso"
      >
        <MensajeVacio texto="No hubo sesiones en este período." />
      </Caja>
    );
  }

  const total = embudo.pasos[0]!.sesiones;

  // Nota calculada: la transición con mayor fuga proporcional, no un texto fijo.
  let peorFuga = embudo.fuga[0]!;
  for (const f of embudo.fuga) {
    if (f.porcentajeFuga > peorFuga.porcentajeFuga) peorFuga = f;
  }
  const pasoDe = embudo.pasos.find((p) => p.paso === peorFuga.de);
  const pasoA = embudo.pasos.find((p) => p.paso === peorFuga.a);

  return (
    <Caja
      titulo="Dónde se cae la gente"
      sub="De cada 100 visitas, cuántas llegan al siguiente paso"
      nota={
        pasoDe && pasoA && peorFuga.perdieron > 0 ? (
          <>
            La caída más grande está entre "{ETIQUETAS_PASO[peorFuga.de]}" y "
            {ETIQUETAS_PASO[peorFuga.a]}
            ": de {entero(pasoDe.sesiones)} pasaron a {entero(pasoA.sesiones)} (
            {porcentaje(peorFuga.porcentajeFuga)} se perdieron ahí).
          </>
        ) : null
      }
    >
      <div className="flex flex-col gap-1">
        {embudo.pasos.map((paso, indice) => {
          const anterior = indice === 0 ? null : embudo.pasos[indice - 1]!;
          const anchoBarra = total > 0 ? Math.max(4, (paso.sesiones / total) * 100) : 0;
          const pctDelAnterior =
            anterior && anterior.sesiones > 0 ? paso.sesiones / anterior.sesiones : null;
          const fugaSiguiente = embudo.fuga[indice];

          return (
            <div key={paso.paso}>
              <div className="grid grid-cols-[1fr_auto] items-center gap-3.5 py-1">
                <div
                  className={`flex h-[34px] min-w-[120px] items-center rounded-md px-3 text-[13px] text-hueso ${TONOS_BARRA[indice]}`}
                  style={{ width: `${anchoBarra}%` }}
                >
                  {ETIQUETAS_PASO[paso.paso] ?? paso.paso}
                </div>
                <div className="min-w-[92px] text-right">
                  <b className="block text-base font-medium text-tinta">{entero(paso.sesiones)}</b>
                  <span className="text-[11.5px] text-texto-secundario">
                    {pctDelAnterior === null ? 'sesiones' : porcentaje(pctDelAnterior)}
                  </span>
                </div>
              </div>
              {fugaSiguiente && fugaSiguiente.perdieron > 0 ? (
                <p className="mx-0 my-0.5 border-l-2 border-rosa-palo pl-3 text-xs text-rosa">
                  {entero(fugaSiguiente.perdieron)} no llegaron a "{ETIQUETAS_PASO[fugaSiguiente.a]}
                  "
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Caja>
  );
}

// --- Serie de 6 meses ---------------------------------------------------------

function nombreMes(mes: string): string {
  const [anio, m] = mes.split('-').map(Number);
  // 'mes' es una etiqueta de mes calendario (YYYY-MM), no un instante real:
  // se arma a medianoche UTC y hay que formatearlo también en UTC. Sin
  // timeZone:'UTC', toLocaleDateString usa el huso del navegador — si está
  // detrás de UTC, corre la fecha al mes anterior (el bug real detrás del
  // desfase que parecía un problema de reloj servidor/navegador).
  return new Date(Date.UTC(anio!, m! - 1, 1)).toLocaleDateString('es-CO', {
    month: 'short',
    timeZone: 'UTC',
  });
}

function SeccionSerie({ accessToken, hasta }: { accessToken: string; hasta: string }) {
  const [serie, setSerie] = useState<PuntoSerie[] | null>(null);

  useEffect(() => {
    let vigente = true;
    api
      .obtenerSerie(accessToken, 6, hasta)
      .then((r) => {
        if (vigente) setSerie(r);
      })
      .catch(() => {
        if (vigente) setSerie([]);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, hasta]);

  if (!serie) {
    return (
      <Caja titulo="Últimos seis meses" sub="Visitas contra pedidos pagados">
        <EsqueletoCarga alto="h-56" />
      </Caja>
    );
  }

  const sinDatos = serie.every((m) => m.sesiones === 0 && m.pedidosPagados === 0);
  if (sinDatos) {
    return (
      <Caja titulo="Últimos seis meses" sub="Visitas contra pedidos pagados">
        <MensajeVacio texto="Todavía no hay seis meses de historia para graficar." />
      </Caja>
    );
  }

  const maxSesiones = Math.max(...serie.map((m) => m.sesiones), 1);
  const topSesiones = Math.max(10, Math.ceil(maxSesiones / 10) * 10);
  const maxPedidos = Math.max(...serie.map((m) => m.pedidosPagados), 1);

  const xInicio = 46;
  const espacio = 56;
  const anchoBarra = 34;
  const yBase = 200;
  const yTope = 20;
  const alturaDisponible = yBase - yTope;

  function yDeBarra(v: number): number {
    return yBase - (v / topSesiones) * alturaDisponible;
  }
  function yDeLinea(v: number): number {
    return yBase - (v / maxPedidos) * alturaDisponible;
  }

  const puntosLinea = serie.map((m, i) => ({
    x: xInicio + i * espacio + anchoBarra / 2,
    y: yDeLinea(m.pedidosPagados),
  }));

  return (
    <Caja titulo="Últimos seis meses" sub="Visitas contra pedidos pagados">
      <svg
        viewBox="0 0 380 260"
        style={{ width: '100%', height: 'auto' }}
        role="img"
        aria-label="Gráfico de sesiones y pedidos pagados por mes"
      >
        <g stroke="var(--color-linea)" strokeWidth="1">
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1={xInicio}
              y1={yTope + (i * alturaDisponible) / 4}
              x2="370"
              y2={yTope + (i * alturaDisponible) / 4}
            />
          ))}
        </g>
        <g fill="var(--color-texto-secundario)" fontSize="9" fontFamily="Jost,sans-serif">
          {[0, 1, 2, 3, 4].map((i) => (
            <text key={i} x="0" y={yTope + (i * alturaDisponible) / 4 + 3}>
              {entero(Math.round(topSesiones - (i * topSesiones) / 4))}
            </text>
          ))}
        </g>
        <g fill="#E0B0BF">
          {serie.map((m, i) => {
            const altura = yBase - yDeBarra(m.sesiones);
            return (
              <rect
                key={m.mes}
                x={xInicio + i * espacio}
                y={yDeBarra(m.sesiones)}
                width={anchoBarra}
                height={Math.max(0, altura)}
                rx="3"
              />
            );
          })}
        </g>
        <polyline
          points={puntosLinea.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="var(--color-rosa)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g fill="var(--color-rosa)">
          {puntosLinea.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3.5" />
          ))}
        </g>
        <g
          fill="var(--color-texto-secundario)"
          fontSize="10"
          fontFamily="Jost,sans-serif"
          textAnchor="middle"
        >
          {serie.map((m, i) => (
            <text key={m.mes} x={xInicio + i * espacio + anchoBarra / 2} y="216">
              {nombreMes(m.mes)}
            </text>
          ))}
        </g>
        <g fontSize="10" fontFamily="Jost,sans-serif">
          <rect x={xInicio} y="236" width="11" height="11" rx="2" fill="#E0B0BF" />
          <text x={xInicio + 17} y="245" fill="var(--color-texto-secundario)">
            Visitas
          </text>
          <rect x={xInicio + 84} y="236" width="11" height="11" rx="2" fill="var(--color-rosa)" />
          <text x={xInicio + 101} y="245" fill="var(--color-texto-secundario)">
            Pedidos pagados
          </text>
        </g>
      </svg>
    </Caja>
  );
}

// --- Tablas de producto --------------------------------------------------------

function useProductosAdmin(
  accessToken: string,
  desde: string,
  hasta: string,
  orden: OrdenProductosAdmin,
): FilaProductoAdmin[] | null {
  const [datos, setDatos] = useState<FilaProductoAdmin[] | null>(null);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    api
      .obtenerProductos(accessToken, desde, hasta, orden, LIMITE_TABLA)
      .then((r) => {
        if (vigente) setDatos(r);
      })
      .catch(() => {
        if (vigente) setDatos([]);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, desde, hasta, orden]);

  return datos;
}

function MiniProducto({ nombre }: { nombre: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-[34px] shrink-0">
        <ImagenProducto nombre={nombre} className="rounded-[5px]" />
      </div>
      <span className="text-tinta">{nombre}</span>
    </div>
  );
}

// Rosa cuando está claramente baja, verde cuando está claramente alta;
// nada en el medio (evita pintar de color cada celda de la tabla).
function PillPorcentaje({
  valor,
  umbralBajo,
  umbralAlto,
  invertido = false,
}: {
  valor: number;
  umbralBajo: number;
  umbralAlto: number;
  invertido?: boolean;
}) {
  const bajo = invertido ? valor > umbralAlto : valor < umbralBajo;
  const alto = invertido ? valor < umbralBajo : valor > umbralAlto;
  if (!bajo && !alto) return <span>{porcentaje(valor)}</span>;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11.5px] ${bajo ? 'bg-rosa-palo text-rosa' : 'bg-verde-luz text-verde'}`}
    >
      {porcentaje(valor)}
    </span>
  );
}

function CabeceraTabla({ columnas }: { columnas: string[] }) {
  return (
    <thead>
      <tr>
        <th
          colSpan={2}
          className="border-b border-linea pb-2.5 text-left text-[11.5px] tracking-wide text-texto-secundario uppercase"
        >
          Producto
        </th>
        {columnas.map((c) => (
          <th
            key={c}
            className="border-b border-linea pb-2.5 text-right text-[11.5px] tracking-wide text-texto-secundario uppercase"
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TablaMasVistos({
  accessToken,
  desde,
  hasta,
}: {
  accessToken: string;
  desde: string;
  hasta: string;
}) {
  const datos = useProductosAdmin(accessToken, desde, hasta, 'vistos');

  const peorConversion =
    datos && datos.length > 1
      ? datos
          .filter((p) => p.vistas > 0)
          .map((p) => ({ p, conv: p.agregadosCarrito / p.vistas }))
          .sort((a, b) => a.conv - b.conv)[0]
      : undefined;

  return (
    <Caja
      titulo="Más vistos"
      sub="Clics en la ficha del producto"
      nota={
        peorConversion && peorConversion.conv < 0.1 ? (
          <>
            "{peorConversion.p.nombre}" se ve mucho ({entero(peorConversion.p.vistas)} vistas) y se
            agrega poco ({porcentaje(peorConversion.conv)}). Suele ser precio o fotos: es el primero
            que conviene revisar.
          </>
        ) : null
      }
    >
      {datos === null ? (
        <EsqueletoFilas />
      ) : datos.length === 0 ? (
        <MensajeVacio />
      ) : (
        <table className="w-full">
          <CabeceraTabla columnas={['Vistas', 'Al carrito', 'Conversión']} />
          <tbody>
            {datos.map((p, i) => {
              const conv = p.vistas > 0 ? p.agregadosCarrito / p.vistas : 0;
              return (
                <tr key={p.productoId} className="border-b border-linea last:border-0">
                  <td className="w-5 py-2.5 text-[13px] text-texto-secundario">{i + 1}</td>
                  <td className="py-2.5">
                    <MiniProducto nombre={p.nombre} />
                  </td>
                  <td className="py-2.5 text-right">{entero(p.vistas)}</td>
                  <td className="py-2.5 text-right">{entero(p.agregadosCarrito)}</td>
                  <td className="py-2.5 text-right">
                    <PillPorcentaje valor={conv} umbralBajo={0.1} umbralAlto={0.2} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Caja>
  );
}

function TablaMasAgregados({
  accessToken,
  desde,
  hasta,
}: {
  accessToken: string;
  desde: string;
  hasta: string;
}) {
  const datos = useProductosAdmin(accessToken, desde, hasta, 'agregados');

  return (
    <Caja titulo="Más agregados al carrito" sub="Intención de compra, se haya completado o no">
      {datos === null ? (
        <EsqueletoFilas />
      ) : datos.length === 0 ? (
        <MensajeVacio />
      ) : (
        <table className="w-full">
          <CabeceraTabla columnas={['Al carrito', 'Comprados', 'Abandono']} />
          <tbody>
            {datos.map((p, i) => {
              const abandono =
                p.agregadosCarrito > 0
                  ? Math.max(0, 1 - p.unidadesDirectas / p.agregadosCarrito)
                  : 0;
              return (
                <tr key={p.productoId} className="border-b border-linea last:border-0">
                  <td className="w-5 py-2.5 text-[13px] text-texto-secundario">{i + 1}</td>
                  <td className="py-2.5">
                    <MiniProducto nombre={p.nombre} />
                  </td>
                  <td className="py-2.5 text-right">{entero(p.agregadosCarrito)}</td>
                  <td className="py-2.5 text-right">{entero(p.unidadesDirectas)}</td>
                  <td className="py-2.5 text-right">
                    <PillPorcentaje valor={abandono} umbralBajo={0.4} umbralAlto={0.7} invertido />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Caja>
  );
}

function TablaMasVendidos({
  accessToken,
  desde,
  hasta,
}: {
  accessToken: string;
  desde: string;
  hasta: string;
}) {
  const datos = useProductosAdmin(accessToken, desde, hasta, 'vendidos');
  const hayVentasEnCombo = datos?.some((p) => p.unidadesEnCombo > 0) ?? false;

  return (
    <Caja
      titulo="Más vendidos"
      sub="Unidades de pedidos pagados"
      nota={
        hayVentasEnCombo ? (
          <>
            Los ingresos de esta tabla son solo de venta directa: lo vendido dentro de un kit suma a
            las unidades pero no reparte ingresos entre sus piezas (repartir el precio de un kit
            entre sus piezas sería arbitrario).
          </>
        ) : null
      }
    >
      {datos === null ? (
        <EsqueletoFilas />
      ) : datos.length === 0 ? (
        <MensajeVacio />
      ) : (
        <table className="w-full">
          <CabeceraTabla columnas={['Unidades', 'Ingresos', 'Margen']} />
          <tbody>
            {datos.map((p, i) => {
              const margenPct = p.ingresos > 0 ? p.margen / p.ingresos : 0;
              return (
                <tr key={p.productoId} className="border-b border-linea last:border-0">
                  <td className="w-5 py-2.5 text-[13px] text-texto-secundario">{i + 1}</td>
                  <td className="py-2.5">
                    <MiniProducto nombre={p.nombre} />
                  </td>
                  <td className="py-2.5 text-right">
                    {entero(p.unidadesVendidas)}
                    {p.unidadesEnCombo > 0 ? (
                      <span className="ml-1 text-[11px] text-texto-secundario">
                        ({entero(p.unidadesEnCombo)} en kits)
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 text-right">{formatearPesosCompacto(p.ingresos)}</td>
                  <td className="py-2.5 text-right">{porcentaje(margenPct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Caja>
  );
}

function TablaMenosVendidos({
  accessToken,
  desde,
  hasta,
}: {
  accessToken: string;
  desde: string;
  hasta: string;
}) {
  const datos = useProductosAdmin(accessToken, desde, hasta, 'menos_vendidos');

  return (
    <Caja
      titulo="Menos vendidos"
      sub="Incluye los que no vendieron ni una unidad"
      nota="Esta tabla parte de todos los productos publicados y les pega las ventas por fuera: si partiera de las ventas, los que vendieron cero no tendrían fila y quedarían invisibles, que son justo los que interesa ver."
    >
      {datos === null ? (
        <EsqueletoFilas />
      ) : datos.length === 0 ? (
        <MensajeVacio />
      ) : (
        <table className="w-full">
          <CabeceraTabla columnas={['Unidades', 'Vistas', 'Stock']} />
          <tbody>
            {datos.map((p, i) => (
              <tr key={p.productoId} className="border-b border-linea last:border-0">
                <td className="w-5 py-2.5 text-[13px] text-texto-secundario">{i + 1}</td>
                <td className="py-2.5">
                  <MiniProducto nombre={p.nombre} />
                </td>
                <td className="py-2.5 text-right">
                  {p.unidadesVendidas === 0 ? (
                    <span className="rounded-full bg-ambar-luz px-2.5 py-0.5 text-[11.5px] text-ambar">
                      0
                    </span>
                  ) : (
                    entero(p.unidadesVendidas)
                  )}
                </td>
                <td className="py-2.5 text-right">{entero(p.vistas)}</td>
                <td className="py-2.5 text-right">{entero(p.stockDisponible)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Caja>
  );
}

// --- Calificaciones -------------------------------------------------------------

function Estrellitas({ calificacion }: { calificacion: number }) {
  const llenas = Math.round(calificacion);
  return (
    <span className="text-rosa" aria-hidden="true">
      {'★'.repeat(llenas)}
    </span>
  );
}

function TablaCalificaciones({
  accessToken,
  orden,
}: {
  accessToken: string;
  orden: 'mejor' | 'peor';
}) {
  const [datos, setDatos] = useState<FilaCalificacion[] | null>(null);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    api
      .obtenerCalificaciones(accessToken, orden, MINIMO_RESENAS)
      .then((r) => {
        if (vigente) setDatos(r.slice(0, LIMITE_TABLA));
      })
      .catch(() => {
        if (vigente) setDatos([]);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, orden]);

  return (
    <Caja
      titulo={orden === 'mejor' ? 'Mejor calificados' : 'Peor calificados'}
      sub={`Mínimo ${MINIMO_RESENAS} reseñas aprobadas`}
      nota={
        orden === 'peor' ? (
          <>
            El mínimo de {MINIMO_RESENAS} reseñas evita que un producto con una sola reseña de 2
            estrellas encabece esta lista. Sin ese filtro, la tabla no sirve para decidir nada.
          </>
        ) : null
      }
    >
      {datos === null ? (
        <EsqueletoFilas />
      ) : datos.length === 0 ? (
        <MensajeVacio texto={`Todavía no hay productos con ${MINIMO_RESENAS} reseñas o más.`} />
      ) : (
        <table className="w-full">
          <CabeceraTabla columnas={['Nota', 'Reseñas']} />
          <tbody>
            {datos.map((p, i) => (
              <tr key={p.productoId} className="border-b border-linea last:border-0">
                <td className="w-5 py-2.5 text-[13px] text-texto-secundario">{i + 1}</td>
                <td className="py-2.5">
                  <MiniProducto nombre={p.nombre} />
                </td>
                <td className="py-2.5 text-right">
                  <Estrellitas calificacion={p.calificacionPromedio} />{' '}
                  {p.calificacionPromedio.toFixed(1).replace('.', ',')}
                </td>
                <td className="py-2.5 text-right">{entero(p.cantidadResenas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Caja>
  );
}

// --- Cajas inferiores -------------------------------------------------------------

function CajaOrigen({
  accessToken,
  desde,
  hasta,
}: {
  accessToken: string;
  desde: string;
  hasta: string;
}) {
  const [datos, setDatos] = useState<FilaOrigen[] | null>(null);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    api
      .obtenerOrigen(accessToken, desde, hasta)
      .then((r) => {
        if (vigente) setDatos(r);
      })
      .catch(() => {
        if (vigente) setDatos([]);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, desde, hasta]);

  return (
    <Caja titulo="De dónde llegan" sub="Origen de las sesiones">
      {datos === null ? (
        <EsqueletoFilas n={4} />
      ) : datos.length === 0 ? (
        <MensajeVacio texto="No hubo sesiones en este período." />
      ) : (
        <table className="w-full">
          <tbody>
            {datos.map((f) => (
              <tr key={f.origen} className="border-b border-linea last:border-0">
                <td className="py-2.5">{f.origen}</td>
                <td className="py-2.5 text-right">{entero(f.sesiones)}</td>
                <td className="py-2.5 text-right text-texto-secundario">
                  {porcentaje(f.porcentaje)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Caja>
  );
}

function CajaBusquedas({
  accessToken,
  desde,
  hasta,
}: {
  accessToken: string;
  desde: string;
  hasta: string;
}) {
  const [datos, setDatos] = useState<FilaBusqueda[] | null>(null);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    api
      .obtenerBusquedas(accessToken, desde, hasta)
      .then((r) => {
        if (vigente) setDatos(r.slice(0, LIMITE_TABLA));
      })
      .catch(() => {
        if (vigente) setDatos([]);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, desde, hasta]);

  return (
    <Caja
      titulo="Buscaron y no encontraron"
      sub="Búsquedas con cero resultados"
      nota={datos && datos.length > 0 ? 'Esta es tu lista de compras del próximo mes.' : undefined}
    >
      {datos === null ? (
        <EsqueletoFilas n={4} />
      ) : datos.length === 0 ? (
        <MensajeVacio texto="Nadie buscó algo que no existiera en este período." />
      ) : (
        <table className="w-full">
          <tbody>
            {datos.map((f) => (
              <tr key={f.termino} className="border-b border-linea last:border-0">
                <td className="py-2.5">{f.termino}</td>
                <td className="py-2.5 text-right">{entero(f.veces)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Caja>
  );
}

function CajaClientas({
  accessToken,
  desde,
  hasta,
}: {
  accessToken: string;
  desde: string;
  hasta: string;
}) {
  const [datos, setDatos] = useState<Clientas | null>(null);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    api
      .obtenerClientas(accessToken, desde, hasta)
      .then((r) => {
        if (vigente) setDatos(r);
      })
      .catch(() => {
        if (vigente) setDatos(null);
      });
    return () => {
      vigente = false;
    };
  }, [accessToken, desde, hasta]);

  if (!datos) {
    return (
      <Caja titulo="Clientas" sub="Nuevas contra recurrentes">
        <EsqueletoFilas n={5} />
      </Caja>
    );
  }

  const totalCompradoras = datos.compraronPorPrimeraVez + datos.compraronDeNuevo;
  const pctPrimeraVez = totalCompradoras > 0 ? datos.compraronPorPrimeraVez / totalCompradoras : 0;
  const pctDeNuevo = totalCompradoras > 0 ? datos.compraronDeNuevo / totalCompradoras : 0;

  return (
    <Caja titulo="Clientas" sub="Nuevas contra recurrentes">
      <table className="w-full">
        <tbody>
          <tr className="border-b border-linea">
            <td className="py-2.5">Compraron por primera vez</td>
            <td className="py-2.5 text-right">{entero(datos.compraronPorPrimeraVez)}</td>
            <td className="py-2.5 text-right text-texto-secundario">
              {totalCompradoras > 0 ? porcentaje(pctPrimeraVez) : '—'}
            </td>
          </tr>
          <tr className="border-b border-linea">
            <td className="py-2.5">Compraron de nuevo</td>
            <td className="py-2.5 text-right">{entero(datos.compraronDeNuevo)}</td>
            <td className="py-2.5 text-right text-texto-secundario">
              {totalCompradoras > 0 ? porcentaje(pctDeNuevo) : '—'}
            </td>
          </tr>
          <tr className="border-b border-linea">
            <td className="py-2.5">Se registraron sin comprar</td>
            <td className="py-2.5 text-right" colSpan={2}>
              {entero(datos.registradosSinComprar)}
            </td>
          </tr>
          <tr className="border-b border-linea">
            <td className="py-2.5">Ticket promedio</td>
            <td className="py-2.5 text-right" colSpan={2}>
              {formatearPesos(datos.ticketPromedio)}
            </td>
          </tr>
          <tr>
            <td className="py-2.5">Carritos abandonados</td>
            <td className="py-2.5 text-right" colSpan={2}>
              {entero(datos.carritosAbandonados)}
            </td>
          </tr>
        </tbody>
      </table>
    </Caja>
  );
}
