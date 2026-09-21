import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Boton } from '../componentes/Boton.tsx';
import { registrarEvento } from '../contexto/apiAnalitica.ts';
import { obtenerEstadoPedido } from '../contexto/apiCheckout.ts';
import { useConfiguracion } from '../contexto/ContextoConfiguracion.tsx';
import { useSesion } from '../contexto/ContextoSesion.tsx';

// Wompi puede tardar en confirmar, sobre todo con PSE: se consulta cada 3
// segundos hasta 20 veces (~1 minuto) antes de rendirse. Nunca se confía en
// los query params de la redirección: la verdad viene de esta consulta,
// que refleja lo que ya procesó el webhook.
const INTERVALO_MS = 3000;
const MAX_INTENTOS = 20;

const ESTADOS_APROBADOS = new Set(['pagado']);
const ESTADOS_RECHAZADOS = new Set(['pagoRechazado', 'cancelado']);

type EstadoVista = 'esperando' | 'aprobado' | 'rechazado' | 'agotado';

export function ResultadoPedidoPagina() {
  const [searchParams] = useSearchParams();
  const numero = searchParams.get('numero');
  const { accessToken, restaurando } = useSesion();

  const [estadoVista, setEstadoVista] = useState<EstadoVista>('esperando');
  const [total, setTotal] = useState<number | null>(null);
  const intentosRef = useRef(0);
  const notificadoRef = useRef(false);

  useEffect(() => {
    if (restaurando || !numero) return;

    let vigente = true;
    let idTimeout: ReturnType<typeof setTimeout>;

    async function consultar() {
      intentosRef.current += 1;
      try {
        const resultado = await obtenerEstadoPedido(accessToken, numero as string);
        if (!vigente) return;
        setTotal(resultado.total);

        if (ESTADOS_APROBADOS.has(resultado.estado)) {
          setEstadoVista('aprobado');
          if (!notificadoRef.current) {
            notificadoRef.current = true;
            registrarEvento('pagoAprobado', { metadatos: { numeroPedido: numero } });
          }
          return;
        }
        if (ESTADOS_RECHAZADOS.has(resultado.estado)) {
          setEstadoVista('rechazado');
          if (!notificadoRef.current) {
            notificadoRef.current = true;
            registrarEvento('pagoRechazado', { metadatos: { numeroPedido: numero } });
          }
          return;
        }
      } catch {
        // Sigue en espera: el próximo intento reintenta la consulta.
      }

      if (intentosRef.current >= MAX_INTENTOS) {
        if (vigente) setEstadoVista('agotado');
        return;
      }
      if (vigente) idTimeout = setTimeout(consultar, INTERVALO_MS);
    }

    void consultar();

    return () => {
      vigente = false;
      clearTimeout(idTimeout);
    };
  }, [restaurando, numero, accessToken]);

  if (!numero) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-texto-secundario">Falta el número de pedido en el enlace.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      {estadoVista === 'esperando' ? <VistaEspera numero={numero} /> : null}
      {estadoVista === 'aprobado' ? <VistaAprobado numero={numero} total={total} /> : null}
      {estadoVista === 'rechazado' ? <VistaRechazado numero={numero} /> : null}
      {estadoVista === 'agotado' ? <VistaSigueEnProceso numero={numero} /> : null}
    </div>
  );
}

function VistaEspera({ numero }: { numero: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div
        aria-hidden="true"
        className="h-10 w-10 animate-spin rounded-full border-4 border-rosa-palo border-t-rosa"
      />
      <h1 className="font-serif text-2xl text-tinta">Confirmando tu pago</h1>
      <p className="text-sm text-texto-secundario">
        Pedido {numero}. Esto puede tardar unos segundos, sobre todo con PSE. No cierres esta
        página.
      </p>
    </div>
  );
}

function VistaAprobado({ numero, total }: { numero: string; total: number | null }) {
  const { formatearMonto } = useConfiguracion();
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="font-serif text-2xl text-tinta">¡Pago aprobado!</h1>
      <p className="text-sm text-texto-secundario">
        Pedido {numero}
        {total !== null ? ` · ${formatearMonto(total)}` : ''}. Te contactamos por WhatsApp para
        coordinar el envío.
      </p>
      <Link to="/">
        <Boton type="button" variante="rosa">
          Volver al inicio
        </Boton>
      </Link>
    </div>
  );
}

function VistaRechazado({ numero }: { numero: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="font-serif text-2xl text-tinta">El pago no se pudo procesar</h1>
      <p className="text-sm text-texto-secundario">
        Pedido {numero}. Podés intentar de nuevo con otro método de pago desde el carrito.
      </p>
      <Link to="/carrito">
        <Boton type="button" variante="rosa">
          Volver al carrito
        </Boton>
      </Link>
    </div>
  );
}

function VistaSigueEnProceso({ numero }: { numero: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="font-serif text-2xl text-tinta">Tu pago sigue en proceso</h1>
      <p className="text-sm text-texto-secundario">
        Pedido {numero}. Algunos métodos de pago tardan más en confirmarse. Te avisamos por WhatsApp
        apenas se confirme.
      </p>
      <Link to="/">
        <Boton type="button" variante="fantasma">
          Volver al inicio
        </Boton>
      </Link>
    </div>
  );
}
