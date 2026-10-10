import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { Boton } from '../componentes/Boton.tsx';
import { CampoTexto } from '../componentes/CampoTexto.tsx';
import { IndicadorCarga } from '../componentes/IndicadorCarga.tsx';
import { registrarEvento } from '../contexto/apiAnalitica.ts';
import * as apiCheckout from '../contexto/apiCheckout.ts';
import { ErrorCheckout } from '../contexto/apiCheckout.ts';
import type { MetodoPagoCheckout } from '../contexto/apiCheckout.ts';
import { useAvisos } from '../contexto/ContextoAvisos.tsx';
import { listarDirecciones } from '../contexto/apiCuenta.ts';
import type { TotalesCarrito } from '../tipos/index.ts';
import { useCarrito } from '../contexto/ContextoCarrito.tsx';
import { useConfiguracion } from '../contexto/ContextoConfiguracion.tsx';
import { useSesion } from '../contexto/ContextoSesion.tsx';
import { abrirWidgetWompi } from '../contexto/wompiWidget.ts';

type Paso = 1 | 2 | 3;

// Una clave por intento de checkout, generada al entrar a la página y
// guardada en sessionStorage (no solo en estado del componente) para que
// una recarga de página durante el envío reutilice la misma clave en vez
// de generar una nueva: eso es lo que hace que el POST sea idempotente de
// verdad, no solo que el botón esté deshabilitado.
const CLAVE_STORAGE = 'checkout_clave_idempotencia';

function obtenerOCrearClaveIdempotencia(): string {
  const existente = sessionStorage.getItem(CLAVE_STORAGE);
  if (existente) return existente;
  const nueva = crypto.randomUUID();
  sessionStorage.setItem(CLAVE_STORAGE, nueva);
  return nueva;
}

const METODOS: { valor: MetodoPagoCheckout; etiqueta: string; descripcion: string }[] = [
  {
    valor: 'tarjeta',
    etiqueta: 'Tarjeta',
    descripcion: 'Crédito o débito. Reserva el stock por 30 minutos.',
  },
  {
    valor: 'pse',
    etiqueta: 'PSE',
    descripcion: 'Débito desde tu banco. Reserva el stock por 24 horas.',
  },
  {
    valor: 'efectivo',
    etiqueta: 'Efectivo',
    descripcion: 'Punto de pago físico. Reserva el stock por 24 horas.',
  },
];

export function CheckoutPagina() {
  const navigate = useNavigate();
  const { lineas, cupon, totales, cargado: carritoCargado, quitarCupon } = useCarrito();
  const { usuario, accessToken, restaurando } = useSesion();
  const { formatearMonto } = useConfiguracion();

  const [paso, setPaso] = useState<Paso>(1);

  const [nombreContacto, setNombreContacto] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('');
  const [correoContacto, setCorreoContacto] = useState('');

  const [envioNombre, setEnvioNombre] = useState('');
  const [envioTelefono, setEnvioTelefono] = useState('');
  const [envioDepartamento, setEnvioDepartamento] = useState('');
  const [envioCiudad, setEnvioCiudad] = useState('');
  const [envioDireccion, setEnvioDireccion] = useState('');
  const [envioComplemento, setEnvioComplemento] = useState('');
  const [envioNotas, setEnvioNotas] = useState('');

  const [metodoPago, setMetodoPago] = useState<MetodoPagoCheckout | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoCupon, setAvisoCupon] = useState<{ mensaje: string; totalSinCupon: number } | null>(
    null,
  );
  const [claveIdempotencia] = useState(obtenerOCrearClaveIdempotencia);
  const { avisarError } = useAvisos();

  // Requiere sesión: el checkout, los pedidos y la pantalla de espera son
  // siempre del usuario logueado. Vuelve a /ingresar con ?regresar=/checkout
  // (no a /cuenta) para que, al terminar de iniciar sesión o de
  // registrarse, la visitante vuelva derecho acá en vez de a /cuenta.
  useEffect(() => {
    if (!restaurando && !usuario) navigate('/ingresar?regresar=/checkout');
  }, [restaurando, usuario, navigate]);

  // Espera a carritoCargado antes de decidir que el carrito está vacío: en
  // una entrada directa a /checkout (link, recarga, pestaña nueva) `lineas`
  // arranca en [] nomás porque ContextoCarrito todavía no trajo el carrito
  // real, no porque esté confirmado vacío. Sin este freno, esa carrera
  // mandaba a /carrito SIEMPRE en una entrada directa, con sesión o sin
  // ella, tapando el redirect a /ingresar de acá arriba.
  useEffect(() => {
    if (carritoCargado && lineas.length === 0) navigate('/carrito');
  }, [carritoCargado, lineas.length, navigate]);

  useEffect(() => {
    registrarEvento('iniciarCheckout');
  }, []);

  // Precarga: contacto con los datos de la cuenta, dirección con la
  // principal guardada si existe.
  useEffect(() => {
    if (usuario) {
      setNombreContacto((actual) => actual || usuario.nombre);
      setCorreoContacto((actual) => actual || usuario.correo);
      if (usuario.telefono) setTelefonoContacto((actual) => actual || usuario.telefono!);
    }
  }, [usuario]);

  useEffect(() => {
    if (!accessToken) return;
    listarDirecciones(accessToken).then((direcciones) => {
      const principal = direcciones.find((d) => d.esPrincipal) ?? direcciones[0];
      if (!principal) return;
      setEnvioNombre((actual) => actual || principal.nombreRecibe);
      setEnvioTelefono((actual) => actual || principal.telefono);
      setEnvioDepartamento((actual) => actual || principal.departamento);
      setEnvioCiudad((actual) => actual || principal.ciudad);
      setEnvioDireccion((actual) => actual || principal.direccion);
      setEnvioComplemento((actual) => actual || principal.complemento || '');
    });
  }, [accessToken]);

  function irAPaso(nuevo: Paso) {
    setPaso(nuevo);
    registrarEvento('pasoCheckout', { metadatos: { paso: nuevo } });
  }

  function alEnviarContacto(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    irAPaso(2);
  }

  function alEnviarDireccion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    irAPaso(3);
  }

  async function confirmarYPagar(
    metodo: MetodoPagoCheckout,
    opciones: { sinCupon?: boolean } = {},
  ) {
    setEnviando(true);
    setError(null);
    setAvisoCupon(null);

    try {
      if (opciones.sinCupon) {
        await quitarCupon();
      }

      const resultado = await apiCheckout.iniciarCheckout(accessToken, {
        claveIdempotencia,
        nombreContacto,
        telefonoContacto,
        correoContacto: correoContacto || undefined,
        envioNombre,
        envioTelefono,
        envioDepartamento,
        envioCiudad,
        envioDireccion,
        envioComplemento: envioComplemento || undefined,
        envioNotas: envioNotas || undefined,
        metodoPago: metodo,
      });

      // El pedido ya está creado: un intento posterior (otra compra) tiene
      // que generar una clave nueva, no reusar esta.
      sessionStorage.removeItem(CLAVE_STORAGE);

      registrarEvento('iniciarPago', {
        metadatos: { numeroPedido: resultado.numeroPedido, metodo },
      });

      abrirWidgetWompi({
        llavePublica: resultado.llavePublica,
        referencia: resultado.referencia,
        montoEnCentavos: resultado.montoEnCentavos,
        moneda: resultado.moneda,
        firma: resultado.firma,
        urlRedireccion: resultado.urlRedireccion,
        correoCliente: correoContacto || undefined,
      }).catch(() => {
        // Si el widget no abre (p. ej. bloqueado), igual vamos a la pantalla
        // de resultado: ahí se consulta el estado real contra el backend.
      });

      // Misma forma de URL que arma el backend para WOMPI_URL_REDIRECCION
      // (?numero=...), para que la pantalla de resultado sea una sola ruta
      // sin importar si se llegó por acá o por la redirección de Wompi.
      navigate(`/pedido/resultado?numero=${encodeURIComponent(resultado.numeroPedido)}`);
    } catch (excepcion) {
      if (excepcion instanceof ErrorCheckout && excepcion.codigo === 'cupon_invalido') {
        const detalles = excepcion.detalles as { totalSinCupon?: { total: number } } | undefined;
        setAvisoCupon({
          mensaje: excepcion.message,
          totalSinCupon: detalles?.totalSinCupon?.total ?? totales.total,
        });
      } else if (excepcion instanceof ErrorCheckout && excepcion.codigo === 'sin_disponibilidad') {
        setError(
          'Algunos productos de tu carrito ya no tienen disponibilidad. Volvé al carrito para ajustarlo.',
        );
      } else {
        const mensaje =
          excepcion instanceof Error ? excepcion.message : 'No pudimos iniciar el pago';
        setError(mensaje);
        avisarError(mensaje);
      }
    } finally {
      setEnviando(false);
    }
  }

  function alElegirMetodo(metodo: MetodoPagoCheckout) {
    setMetodoPago(metodo);
    registrarEvento('seleccionarMetodoPago', { metadatos: { metodo } });
  }

  function alConfirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!metodoPago || enviando) return;
    void confirmarYPagar(metodoPago);
  }

  if (restaurando || !usuario || lineas.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-texto-secundario sm:px-6">
        Cargando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {enviando ? <OverlayCargandoPago /> : null}

      <h1 className="font-serif text-2xl text-tinta">Checkout</h1>

      <IndicadorPasos pasoActual={paso} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div>
          {paso === 1 ? (
            <form onSubmit={alEnviarContacto} className="flex flex-col gap-4">
              <h2 className="font-serif text-lg text-tinta">Datos de contacto</h2>
              <CampoTexto
                etiqueta="Nombre"
                value={nombreContacto}
                onChange={(e) => setNombreContacto(e.target.value)}
                required
              />
              <CampoTexto
                etiqueta="Teléfono"
                type="tel"
                value={telefonoContacto}
                onChange={(e) => setTelefonoContacto(e.target.value)}
                required
              />
              <CampoTexto
                etiqueta="Correo (opcional)"
                type="email"
                value={correoContacto}
                onChange={(e) => setCorreoContacto(e.target.value)}
              />
              <Boton type="submit" variante="rosa" className="mt-2 self-start">
                Continuar a envío
              </Boton>
            </form>
          ) : null}

          {paso === 2 ? (
            <form onSubmit={alEnviarDireccion} className="flex flex-col gap-4">
              <h2 className="font-serif text-lg text-tinta">Dirección de envío</h2>
              <CampoTexto
                etiqueta="Nombre de quien recibe"
                value={envioNombre}
                onChange={(e) => setEnvioNombre(e.target.value)}
                required
              />
              <CampoTexto
                etiqueta="Teléfono"
                type="tel"
                value={envioTelefono}
                onChange={(e) => setEnvioTelefono(e.target.value)}
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoTexto
                  etiqueta="Departamento"
                  value={envioDepartamento}
                  onChange={(e) => setEnvioDepartamento(e.target.value)}
                  required
                />
                <CampoTexto
                  etiqueta="Ciudad"
                  value={envioCiudad}
                  onChange={(e) => setEnvioCiudad(e.target.value)}
                  required
                />
              </div>
              <CampoTexto
                etiqueta="Dirección"
                value={envioDireccion}
                onChange={(e) => setEnvioDireccion(e.target.value)}
                required
              />
              <CampoTexto
                etiqueta="Complemento (opcional)"
                value={envioComplemento}
                onChange={(e) => setEnvioComplemento(e.target.value)}
              />
              <CampoTexto
                etiqueta="Notas para la entrega (opcional)"
                value={envioNotas}
                onChange={(e) => setEnvioNotas(e.target.value)}
              />
              <div className="mt-2 flex gap-3">
                <Boton type="button" variante="fantasma" onClick={() => irAPaso(1)}>
                  Volver
                </Boton>
                <Boton type="submit" variante="rosa">
                  Continuar a pago
                </Boton>
              </div>
            </form>
          ) : null}

          {paso === 3 ? (
            <form onSubmit={alConfirmar} className="flex flex-col gap-4">
              <h2 className="font-serif text-lg text-tinta">Método de pago</h2>
              <div className="flex flex-col gap-3">
                {METODOS.map((opcion) => (
                  <label
                    key={opcion.valor}
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors ${
                      metodoPago === opcion.valor ? 'border-rosa bg-rosa-palo/30' : 'border-linea'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="metodoPago"
                        value={opcion.valor}
                        checked={metodoPago === opcion.valor}
                        onChange={() => alElegirMetodo(opcion.valor)}
                        className="h-4 w-4 text-rosa"
                      />
                      <span className="font-medium text-tinta">{opcion.etiqueta}</span>
                    </span>
                    <span className="text-sm text-texto-secundario">{opcion.descripcion}</span>
                  </label>
                ))}
              </div>

              {avisoCupon ? (
                <div className="rounded-lg border border-rosa-palo bg-rosa-palo/30 p-4 text-sm text-tinta">
                  <p>{avisoCupon.mensaje}</p>
                  <p className="mt-1 font-medium">
                    Total sin el cupón: {formatearMonto(avisoCupon.totalSinCupon)}
                  </p>
                  <Boton
                    type="button"
                    variante="fantasma"
                    className="mt-3"
                    disabled={!metodoPago}
                    cargando={enviando}
                    onClick={() =>
                      metodoPago && void confirmarYPagar(metodoPago, { sinCupon: true })
                    }
                  >
                    Continuar sin el cupón
                  </Boton>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="mt-2 flex gap-3">
                <Boton
                  type="button"
                  variante="fantasma"
                  onClick={() => irAPaso(2)}
                  disabled={enviando}
                >
                  Volver
                </Boton>
                <Boton type="submit" variante="rosa" disabled={!metodoPago} cargando={enviando}>
                  Pagar con Wompi
                </Boton>
              </div>
            </form>
          ) : null}
        </div>

        <ResumenPedido lineas={lineas} cuponCodigo={cupon?.codigo} totales={totales} />
      </div>
    </div>
  );
}

// Pantalla completa, no solo el botón: mientras dura el POST a
// /checkout/iniciar, la clienta tiene que ver claramente que algo está
// pasando (una petición lenta con solo el botón deshabilitado puede leerse
// como que no pasó nada).
function OverlayCargandoPago() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-hueso/95 px-6 text-center"
    >
      <IndicadorCarga className="h-10 w-10 text-rosa" />
      <p className="font-serif text-lg text-tinta">Estamos preparando tu pago…</p>
      <p className="text-sm text-texto-secundario">No cierres ni recargues esta página.</p>
    </div>
  );
}

function IndicadorPasos({ pasoActual }: { pasoActual: Paso }) {
  const pasos: { numero: Paso; etiqueta: string }[] = [
    { numero: 1, etiqueta: 'Contacto' },
    { numero: 2, etiqueta: 'Envío' },
    { numero: 3, etiqueta: 'Pago' },
  ];

  return (
    <ol className="mt-6 flex items-center gap-4 text-sm">
      {pasos.map((paso, indice) => (
        <li key={paso.numero} className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                paso.numero <= pasoActual ? 'bg-rosa text-hueso' : 'bg-arena text-texto-secundario'
              }`}
            >
              {paso.numero}
            </span>
            <span
              className={
                paso.numero === pasoActual ? 'font-medium text-tinta' : 'text-texto-secundario'
              }
            >
              {paso.etiqueta}
            </span>
          </span>
          {indice < pasos.length - 1 ? (
            <span className="h-px w-8 bg-linea" aria-hidden="true" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function ResumenPedido({
  lineas,
  cuponCodigo,
  totales,
}: {
  lineas: { id?: string; nombreProducto: string; cantidad: number; precioUnitario: number }[];
  cuponCodigo?: string;
  totales: TotalesCarrito;
}) {
  const { formatearMonto } = useConfiguracion();

  return (
    <div className="lg:sticky lg:top-8 lg:self-start">
      <div className="flex flex-col gap-4 rounded-lg border border-linea bg-white p-6">
        <h2 className="font-serif text-lg text-tinta">Resumen</h2>
        <ul className="flex flex-col gap-2 text-sm text-tinta">
          {lineas.map((linea) => (
            <li key={linea.id ?? linea.nombreProducto} className="flex justify-between gap-2">
              <span className="text-texto-secundario">
                {linea.cantidad} × {linea.nombreProducto}
              </span>
              <span>{formatearMonto(linea.precioUnitario * linea.cantidad)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2 border-t border-linea pt-3 text-sm">
          <div className="flex justify-between text-tinta">
            <dt className="text-texto-secundario">Subtotal</dt>
            <dd>{formatearMonto(totales.subtotal, totales.usd.subtotal)}</dd>
          </div>
          {totales.descuento > 0 ? (
            <div className="flex justify-between text-whatsapp">
              <dt>Descuento{cuponCodigo ? ` (${cuponCodigo})` : ''}</dt>
              <dd>-{formatearMonto(totales.descuento, totales.usd.descuento)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-tinta">
            <dt className="text-texto-secundario">Envío</dt>
            <dd>{formatearMonto(totales.envio, totales.usd.envio)}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-linea pt-2 text-base font-semibold text-tinta">
            <dt>Total</dt>
            <dd>{formatearMonto(totales.total, totales.usd.total)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
