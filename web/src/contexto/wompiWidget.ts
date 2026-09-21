// Carga el script del Widget de Wompi (una sola vez) y lo abre con los
// datos que ya calculó y firmó el backend. El frontend nunca calcula firma
// ni monto: solo reenvía lo que vino de POST /api/checkout/iniciar.

export interface DatosWidgetWompi {
  llavePublica: string;
  referencia: string;
  montoEnCentavos: number;
  moneda: string;
  firma: string;
  urlRedireccion: string;
  correoCliente?: string;
}

export interface ResultadoWidgetWompi {
  transaction?: {
    id: string;
    status: string;
  };
}

interface WidgetCheckoutInstancia {
  open: (callback: (resultado: ResultadoWidgetWompi) => void) => void;
}

declare global {
  interface Window {
    WidgetCheckout?: new (config: Record<string, unknown>) => WidgetCheckoutInstancia;
  }
}

const URL_SCRIPT_WIDGET = 'https://checkout.wompi.co/widget.js';

let promesaScript: Promise<void> | null = null;

function cargarScriptWidget(): Promise<void> {
  if (window.WidgetCheckout) return Promise.resolve();
  if (promesaScript) return promesaScript;

  promesaScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = URL_SCRIPT_WIDGET;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No pudimos cargar el widget de pago de Wompi'));
    document.body.appendChild(script);
  });

  return promesaScript;
}

export async function abrirWidgetWompi(datos: DatosWidgetWompi): Promise<ResultadoWidgetWompi> {
  await cargarScriptWidget();

  if (!window.WidgetCheckout) {
    throw new Error('No pudimos cargar el widget de pago de Wompi');
  }

  const widget = new window.WidgetCheckout({
    currency: datos.moneda,
    amountInCents: datos.montoEnCentavos,
    reference: datos.referencia,
    publicKey: datos.llavePublica,
    redirectUrl: datos.urlRedireccion,
    signature: { integrity: datos.firma },
    ...(datos.correoCliente ? { customerData: { email: datos.correoCliente } } : {}),
  });

  return new Promise((resolve) => {
    widget.open((resultado) => resolve(resultado));
  });
}
