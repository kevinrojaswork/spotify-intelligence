import { useEffect, useRef, useState } from "react";
import { loadCoreSdkScript } from "@paypal/paypal-js/sdk-v6";
import type { OnApproveDataOneTimePayments } from "@paypal/paypal-js/sdk-v6";

import "../styles/SupportTest.css";

const API_BASE_URL =
  "https://spotify-intelligence-production.up.railway.app";

type PayPalLiveConfig = {
  enabled: boolean;
  client_id: string;
  environment: "live";
  amount: string;
  currency: string;
  is_test: false;
};

type CaptureResult = {
  order_id: string;
  capture_id: string;
  status: string;
  amount: string;
  currency: string;
  paypal_fee?: string;
  net_amount?: string;
  already_captured: boolean;
};

type PaymentState =
  | "loading"
  | "locked"
  | "confirmation"
  | "ready"
  | "opening"
  | "capturing"
  | "completed"
  | "cancelled"
  | "error";

function getSessionHeaders() {
  const sessionToken = localStorage.getItem("session_token");

  if (!sessionToken) {
    throw new Error("No hay una sesión válida.");
  }

  return {
    Authorization: `Bearer ${sessionToken}`,
    "Content-Type": "application/json",
  };
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as {
    detail?: string;
  } & T;

  if (!response.ok) {
    throw new Error(
      data.detail || "No se pudo completar la operación de PayPal."
    );
  }

  return data;
}

function SupportLiveTest() {
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const [config, setConfig] = useState<PayPalLiveConfig | null>(null);
  const [hasConfirmedRealCharge, setHasConfirmedRealCharge] =
    useState(false);
  const [paymentState, setPaymentState] =
    useState<PaymentState>("loading");
  const [message, setMessage] = useState(
    "Comprobando si la prueba real está autorizada..."
  );
  const [captureResult, setCaptureResult] =
    useState<CaptureResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/payments/paypal/live/config`,
          { headers: getSessionHeaders() }
        );
        const nextConfig = await readApiResponse<PayPalLiveConfig>(
          response
        );

        if (cancelled) {
          return;
        }

        setConfig(nextConfig);

        if (!nextConfig.enabled) {
          setPaymentState("locked");
          setMessage(
            "La prueba real está bloqueada en Railway. No se puede crear ni capturar una orden con dinero verdadero."
          );
          return;
        }

        setPaymentState("confirmation");
        setMessage(
          "La prueba Live está habilitada, pero todavía requiere tu confirmación explícita."
        );
      } catch (error) {
        console.error("No se pudo comprobar PayPal Live:", error);
        if (!cancelled) {
          setPaymentState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "No se pudo comprobar la configuración Live."
          );
        }
      }
    };

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config?.enabled || !hasConfirmedRealCharge) {
      return;
    }

    let cancelled = false;
    let paypalButton: HTMLElement | null = null;
    let clickHandler: (() => Promise<void>) | null = null;

    const initializePayPal = async () => {
      try {
        setPaymentState("loading");
        setMessage("Preparando PayPal Live con las credenciales de producción...");

        const paypal = await loadCoreSdkScript({
          environment: "production",
          debug: false,
        });

        if (cancelled) {
          return;
        }

        if (!paypal) {
          throw new Error(
            "PayPal no devolvió el cargador oficial del SDK."
          );
        }

        const sdkInstance = await paypal.createInstance({
          clientId: config.client_id,
          components: ["paypal-payments"] as const,
          locale: "es-US",
          pageType: "checkout",
        });

        const eligibility = await sdkInstance.findEligibleMethods({
          currencyCode: config.currency,
        });

        if (!eligibility.isEligible("paypal")) {
          throw new Error(
            "PayPal no está disponible para este navegador o esta operación real."
          );
        }

        const createOrder = async () => {
          setPaymentState("opening");
          setMessage("Creando una orden REAL de USD 1.00...");
          setCaptureResult(null);

          const response = await fetch(
            `${API_BASE_URL}/payments/paypal/live/create-order`,
            {
              method: "POST",
              headers: getSessionHeaders(),
            }
          );
          const data = await readApiResponse<{ order_id: string }>(
            response
          );

          return { orderId: data.order_id };
        };

        const captureOrder = async ({ orderId }: { orderId: string }) => {
          setPaymentState("capturing");
          setMessage("Capturando el pago REAL dentro de PayPal...");

          const response = await fetch(
            `${API_BASE_URL}/payments/paypal/live/orders/${encodeURIComponent(
              orderId
            )}/capture`,
            {
              method: "POST",
              headers: getSessionHeaders(),
            }
          );
          const data = await readApiResponse<CaptureResult>(response);

          if (!cancelled) {
            setCaptureResult(data);
            setPaymentState("completed");
            setMessage(
              "Pago real completado. Revisa el saldo, la comisión y el retiro en tu cuenta Business."
            );
          }

          return data;
        };

        const paymentSession = await Promise.resolve(
          sdkInstance.createPayPalOneTimePaymentSession({
            onApprove: async (data: OnApproveDataOneTimePayments) => {
              await captureOrder({ orderId: data.orderId });
            },
            onCancel: () => {
              if (!cancelled) {
                setPaymentState("cancelled");
                setMessage(
                  "Cancelaste la operación antes de confirmar el cobro real."
                );
              }
            },
            onError: (error) => {
              console.error("Error de PayPal Live:", error);
              if (!cancelled) {
                setPaymentState("error");
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "PayPal no pudo completar la operación real."
                );
              }
            },
          })
        );

        if (cancelled || !buttonContainerRef.current) {
          return;
        }

        buttonContainerRef.current.replaceChildren();
        paypalButton = document.createElement("paypal-button");
        paypalButton.setAttribute("type", "pay");
        paypalButton.setAttribute(
          "aria-label",
          "Pagar USD 1.00 reales con PayPal"
        );

        clickHandler = async () => {
          try {
            const createOrderPromise = createOrder();
            await paymentSession.start(
              { presentationMode: "auto" },
              createOrderPromise
            );
          } catch (error) {
            console.error("No se pudo abrir PayPal Live:", error);
            if (!cancelled) {
              setPaymentState("error");
              setMessage(
                error instanceof Error
                  ? error.message
                  : "No se pudo abrir PayPal Live."
              );
            }
          }
        };

        paypalButton.addEventListener("click", clickHandler);
        buttonContainerRef.current.appendChild(paypalButton);

        setPaymentState("ready");
        setMessage(
          "PayPal Live está listo. El botón siguiente puede cobrar USD 1.00 reales."
        );
      } catch (error) {
        console.error("No se pudo inicializar PayPal Live:", error);
        if (!cancelled) {
          setPaymentState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "No se pudo preparar PayPal Live."
          );
        }
      }
    };

    void initializePayPal();

    return () => {
      cancelled = true;

      if (paypalButton && clickHandler) {
        paypalButton.removeEventListener("click", clickHandler);
      }

      paypalButton?.remove();
    };
  }, [config, hasConfirmedRealCharge]);

  const isBusy =
    paymentState === "loading" ||
    paymentState === "opening" ||
    paymentState === "capturing";

  return (
    <main className="support-test-page support-test-page--live">
      <section className="support-test-card support-test-card--live">
        <header className="support-test-header">
          <a className="support-test-back" href="/">
            ← Volver al dashboard
          </a>

          <span className="support-test-badge support-test-badge--live">
            Prueba privada · PayPal Live
          </span>

          <h1>Comprobar un cobro real</h1>
          <p>
            Esta ruta está preparada para una única prueba controlada de{" "}
            <strong>USD 1.00 reales</strong>. No está enlazada en la
            navegación y permanece bloqueada mientras Railway conserve{" "}
            <strong>PAYPAL_LIVE_ENABLED=false</strong>.
          </p>
        </header>

        <div className="support-test-summary">
          <article>
            <span>Importe fijado por el backend</span>
            <strong>
              {config ? `${config.currency} ${config.amount}` : "USD 1.00"}
            </strong>
          </article>

          <article>
            <span>Entorno</span>
            <strong>Producción · dinero real</strong>
          </article>
        </div>

        <section className="support-live-warning" role="alert">
          <strong>Advertencia</strong>
          <p>
            Cuando esta prueba se habilite, aprobar el checkout generará un
            cobro real. No uses credenciales Sandbox y no continúes sin una
            persona compradora de confianza.
          </p>
        </section>

        <div
          className={`support-test-status support-test-status--${paymentState}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">
            {paymentState === "completed"
              ? "✓"
              : paymentState === "error"
                ? "!"
                : paymentState === "cancelled"
                  ? "↩"
                  : paymentState === "locked"
                    ? "🔒"
                    : "●"}
          </span>
          <p>{message}</p>
        </div>

        {config && !config.enabled && (
          <section className="support-live-locked">
            <h2>Prueba real bloqueada correctamente</h2>
            <p>
              Las rutas Live no crearán órdenes mientras la variable siga en{" "}
              <code>false</code>. Sandbox continúa funcionando por separado en{" "}
              <code>/support-test</code>.
            </p>
          </section>
        )}

        {config?.enabled && (
          <label className="support-live-confirmation">
            <input
              type="checkbox"
              checked={hasConfirmedRealCharge}
              onChange={(event) =>
                setHasConfirmedRealCharge(event.target.checked)
              }
              disabled={isBusy || paymentState === "completed"}
            />
            <span>
              Entiendo que al continuar se puede cobrar{" "}
              <strong>USD 1.00 reales</strong> y autorizo preparar el botón
              Live.
            </span>
          </label>
        )}

        {config?.enabled && hasConfirmedRealCharge && (
          <div
            className={`support-test-paypal ${isBusy ? "is-busy" : ""}`}
            aria-busy={isBusy}
          >
            <div
              className="support-test-paypal-mount"
              ref={buttonContainerRef}
            />

            {paymentState === "loading" && (
              <p>Cargando el botón de PayPal Live...</p>
            )}
          </div>
        )}

        {captureResult && (
          <section className="support-test-success">
            <span aria-hidden="true">✓</span>
            <div>
              <h2>Pago real completado</h2>
              <p>
                PayPal confirmó {captureResult.currency}{" "}
                {captureResult.amount} con estado {captureResult.status}.
              </p>
              <dl>
                <div>
                  <dt>Order ID</dt>
                  <dd>{captureResult.order_id}</dd>
                </div>
                <div>
                  <dt>Capture ID</dt>
                  <dd>{captureResult.capture_id}</dd>
                </div>
                {captureResult.paypal_fee && (
                  <div>
                    <dt>Comisión</dt>
                    <dd>
                      {captureResult.currency} {captureResult.paypal_fee}
                    </dd>
                  </div>
                )}
                {captureResult.net_amount && (
                  <div>
                    <dt>Neto recibido</dt>
                    <dd>
                      {captureResult.currency} {captureResult.net_amount}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </section>
        )}

        <footer className="support-test-footer">
          Ruta privada de validación. No debe publicarse como opción de apoyo
          hasta completar pago, comisión, saldo, retiro y experiencia de
          tarjeta como invitado.
        </footer>
      </section>
    </main>
  );
}

export default SupportLiveTest;
