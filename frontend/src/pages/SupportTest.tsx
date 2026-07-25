import { useEffect, useRef, useState } from "react";
import { loadCoreSdkScript } from "@paypal/paypal-js/sdk-v6";
import type { OnApproveDataOneTimePayments } from "@paypal/paypal-js/sdk-v6";

import "../styles/SupportTest.css";

const API_BASE_URL =
  "https://spotify-intelligence-production.up.railway.app";
type PayPalConfig = {
  client_token: string;
  environment: "sandbox" | "live";
  amount: string;
  currency: string;
  is_test: boolean;
};

type CaptureResult = {
  order_id: string;
  capture_id: string;
  status: string;
  amount: string;
  currency: string;
  already_captured: boolean;
};

type PaymentState =
  | "loading"
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

function SupportTest() {
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const [config, setConfig] = useState<PayPalConfig | null>(null);
  const [paymentState, setPaymentState] =
    useState<PaymentState>("loading");
  const [message, setMessage] = useState(
    "Preparando el entorno seguro de PayPal..."
  );
  const [captureResult, setCaptureResult] =
    useState<CaptureResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    let paypalButton: HTMLElement | null = null;
    let clickHandler: (() => Promise<void>) | null = null;

    const initializePayPal = async () => {
      try {
        setPaymentState("loading");
        setMessage("Comprobando la configuración de PayPal Sandbox...");

        const configResponse = await fetch(
          `${API_BASE_URL}/payments/paypal/config`,
          { headers: getSessionHeaders() }
        );
        const nextConfig = await readApiResponse<PayPalConfig>(
          configResponse
        );

        if (cancelled) {
          return;
        }

        setConfig(nextConfig);

        const paypal = await loadCoreSdkScript({
          environment:
            nextConfig.environment === "sandbox"
              ? "sandbox"
              : "production",
          debug: nextConfig.is_test,
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
          clientToken: nextConfig.client_token,
          components: ["paypal-payments"] as const,
          locale: "es-US",
          pageType: "checkout",
        });

        const eligibility = await sdkInstance.findEligibleMethods({
          currencyCode: nextConfig.currency,
        });

        if (!eligibility.isEligible("paypal")) {
          throw new Error(
            "PayPal no está disponible para este navegador de prueba."
          );
        }

        const createOrder = async () => {
          setPaymentState("opening");
          setMessage("Creando una orden segura de USD 1.00...");
          setCaptureResult(null);

          const response = await fetch(
            `${API_BASE_URL}/payments/paypal/create-order`,
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
          setMessage("Confirmando el pago dentro de PayPal Sandbox...");

          const response = await fetch(
            `${API_BASE_URL}/payments/paypal/orders/${encodeURIComponent(
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
              "Pago Sandbox completado. No se utilizó dinero real."
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
                  "Cancelaste la prueba antes de confirmar el pago."
                );
              }
            },
            onError: (error) => {
              console.error("Error de PayPal:", error);
              if (!cancelled) {
                setPaymentState("error");
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "PayPal no pudo completar la prueba."
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
        paypalButton.setAttribute("aria-label", "Pagar USD 1.00 con PayPal");

        clickHandler = async () => {
          try {
            const createOrderPromise = createOrder();
            await paymentSession.start(
              { presentationMode: "auto" },
              createOrderPromise
            );
          } catch (error) {
            console.error("No se pudo abrir PayPal:", error);
            if (!cancelled) {
              setPaymentState("error");
              setMessage(
                error instanceof Error
                  ? error.message
                  : "No se pudo abrir PayPal."
              );
            }
          }
        };

        paypalButton.addEventListener("click", clickHandler);
        buttonContainerRef.current.appendChild(paypalButton);

        setPaymentState("ready");
        setMessage(
          nextConfig.is_test
            ? "PayPal Sandbox está listo. Usa la cuenta Personal — US de prueba."
            : "PayPal está listo para procesar un pago real."
        );
      } catch (error) {
        console.error("No se pudo inicializar PayPal:", error);
        if (!cancelled) {
          setPaymentState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "No se pudo preparar PayPal."
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

      buttonContainerRef.current?.replaceChildren();
    };
  }, []);

  const isBusy =
    paymentState === "loading" ||
    paymentState === "opening" ||
    paymentState === "capturing";

  return (
    <main className="support-test-page">
      <section className="support-test-card">
        <header className="support-test-header">
          <a className="support-test-back" href="/">
            ← Volver al dashboard
          </a>

          <span className="support-test-badge">
            Prueba privada · PayPal Sandbox
          </span>

          <h1>Comprobar pagos internacionales</h1>
          <p>
            Esta página crea un aporte ficticio de <strong>USD 1.00</strong>
            para verificar la conexión entre Spotify Intelligence, Railway y
            PayPal. No utiliza dinero real.
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
            <strong>
              {config?.environment === "live" ? "Producción" : "Sandbox"}
            </strong>
          </article>
        </div>

        <div className="support-test-instructions">
          <h2>Cómo realizar la prueba</h2>
          <p>
            Pulsa el botón de PayPal e inicia sesión con las credenciales de la
            cuenta ficticia <strong>Personal — US</strong> que guardaste en el
            panel de desarrolladores. No uses tu cuenta PayPal real.
          </p>
        </div>

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
                  : "●"}
          </span>
          <p>{message}</p>
        </div>

        <div
          className={`support-test-paypal ${isBusy ? "is-busy" : ""}`}
          ref={buttonContainerRef}
          aria-busy={isBusy}
        >
          {paymentState === "loading" && (
            <p>Cargando el botón seguro de PayPal...</p>
          )}
        </div>

        {captureResult && (
          <section className="support-test-success">
            <span aria-hidden="true">✓</span>
            <div>
              <h2>Prueba completada correctamente</h2>
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
              </dl>
            </div>
          </section>
        )}

        <footer className="support-test-footer">
          Esta pantalla no está enlazada en la navegación normal. Solo se usa
          para validar la integración antes de aceptar aportes reales.
        </footer>
      </section>
    </main>
  );
}

export default SupportTest;
