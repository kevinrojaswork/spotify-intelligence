import logging
import os
import uuid
from dataclasses import dataclass
from typing import Any

import httpx


logger = logging.getLogger(__name__)

PAYPAL_TEST_AMOUNT = "1.00"
PAYPAL_TEST_CURRENCY = "USD"
PAYPAL_TIMEOUT_SECONDS = 20.0


class PayPalConfigurationError(RuntimeError):
    pass


class PayPalAPIError(RuntimeError):
    def __init__(self, user_message: str, *, status_code: int = 502):
        super().__init__(user_message)
        self.user_message = user_message
        self.status_code = status_code


@dataclass(frozen=True)
class PayPalSettings:
    client_id: str
    client_secret: str
    environment: str
    api_base_url: str
    sdk_url: str


def get_paypal_settings() -> PayPalSettings:
    client_id = os.getenv("PAYPAL_CLIENT_ID", "").strip()
    client_secret = os.getenv("PAYPAL_CLIENT_SECRET", "").strip()
    environment = os.getenv("PAYPAL_ENV", "sandbox").strip().lower()

    if not client_id or not client_secret:
        raise PayPalConfigurationError(
            "Las credenciales de PayPal no están configuradas en el servidor."
        )

    if environment not in {"sandbox", "live"}:
        raise PayPalConfigurationError(
            "PAYPAL_ENV debe ser 'sandbox' o 'live'."
        )

    if environment == "sandbox":
        api_base_url = "https://api-m.sandbox.paypal.com"
        sdk_url = "https://www.sandbox.paypal.com/web-sdk/v6/core.js"
    else:
        api_base_url = "https://api-m.paypal.com"
        sdk_url = "https://www.paypal.com/web-sdk/v6/core.js"

    return PayPalSettings(
        client_id=client_id,
        client_secret=client_secret,
        environment=environment,
        api_base_url=api_base_url,
        sdk_url=sdk_url,
    )


def _read_json(response: httpx.Response) -> dict[str, Any]:
    try:
        data = response.json()
    except ValueError:
        data = {}

    return data if isinstance(data, dict) else {}


def _raise_paypal_error(
    response: httpx.Response,
    action: str,
) -> None:
    data = _read_json(response)
    debug_id = data.get("debug_id")
    error_name = data.get("name")
    details = data.get("details")

    logger.error(
        "PayPal falló al %s. status=%s name=%s debug_id=%s details=%s",
        action,
        response.status_code,
        error_name,
        debug_id,
        details,
    )

    if response.status_code in {401, 403}:
        message = (
            "PayPal rechazó las credenciales del servidor. "
            "Revisa que Railway use la aplicación y el entorno correctos."
        )
    elif response.status_code == 422:
        message = (
            "PayPal no pudo procesar esta operación de prueba. "
            "Intenta nuevamente o revisa los registros del backend."
        )
    else:
        message = (
            "No pudimos comunicarnos correctamente con PayPal. "
            "Intenta nuevamente en unos minutos."
        )

    raise PayPalAPIError(message)


def get_paypal_access_token(settings: PayPalSettings) -> str:
    token_url = f"{settings.api_base_url}/v1/oauth2/token"

    try:
        response = httpx.post(
            token_url,
            auth=(settings.client_id, settings.client_secret),
            headers={
                "Accept": "application/json",
                "Accept-Language": "en_US",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
            timeout=PAYPAL_TIMEOUT_SECONDS,
        )
    except httpx.RequestError as exc:
        logger.exception("No se pudo solicitar el access token de PayPal.")
        raise PayPalAPIError(
            "No pudimos conectar con PayPal en este momento."
        ) from exc

    if response.status_code != 200:
        _raise_paypal_error(response, "obtener el access token")

    access_token = _read_json(response).get("access_token")

    if not access_token:
        logger.error("PayPal respondió sin access_token.")
        raise PayPalAPIError(
            "PayPal respondió de forma incompleta. Intenta nuevamente."
        )

    return str(access_token)


def generate_browser_safe_client_token() -> str:
    settings = get_paypal_settings()
    access_token = get_paypal_access_token(settings)
    token_url = f"{settings.api_base_url}/v1/identity/generate-token"

    try:
        response = httpx.post(
            token_url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept-Language": "en_US",
                "Content-Type": "application/json",
            },
            json={},
            timeout=PAYPAL_TIMEOUT_SECONDS,
        )
    except httpx.RequestError as exc:
        logger.exception(
            "No se pudo solicitar el client token de navegador de PayPal."
        )
        raise PayPalAPIError(
            "No pudimos preparar el botón seguro de PayPal."
        ) from exc

    if response.status_code not in {200, 201}:
        _raise_paypal_error(response, "generar el client token del navegador")

    client_token = _read_json(response).get("client_token")

    if not client_token:
        logger.error("PayPal respondió sin client_token.")
        raise PayPalAPIError(
            "PayPal respondió de forma incompleta al preparar el botón."
        )

    return str(client_token)


def create_test_order(spotify_user_id: str) -> dict[str, str]:
    settings = get_paypal_settings()
    access_token = get_paypal_access_token(settings)
    create_url = f"{settings.api_base_url}/v2/checkout/orders"

    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": "spotify-intelligence-support-test",
                "description": "Aporte voluntario de prueba",
                "custom_id": f"support-test:{spotify_user_id}",
                "amount": {
                    "currency_code": PAYPAL_TEST_CURRENCY,
                    "value": PAYPAL_TEST_AMOUNT,
                },
            }
        ],
    }

    try:
        response = httpx.post(
            create_url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "PayPal-Request-Id": str(uuid.uuid4()),
                "Prefer": "return=representation",
            },
            json=payload,
            timeout=PAYPAL_TIMEOUT_SECONDS,
        )
    except httpx.RequestError as exc:
        logger.exception("No se pudo crear la orden de PayPal.")
        raise PayPalAPIError(
            "No pudimos crear la orden de prueba en PayPal."
        ) from exc

    if response.status_code not in {200, 201}:
        _raise_paypal_error(response, "crear la orden")

    data = _read_json(response)
    order_id = data.get("id")
    status = data.get("status") or "CREATED"

    if not order_id:
        logger.error("PayPal creó una respuesta sin order id: %s", data)
        raise PayPalAPIError(
            "PayPal no devolvió el identificador de la orden."
        )

    return {
        "order_id": str(order_id),
        "status": str(status),
        "amount": PAYPAL_TEST_AMOUNT,
        "currency": PAYPAL_TEST_CURRENCY,
    }


def capture_test_order(order_id: str) -> dict[str, str]:
    settings = get_paypal_settings()
    access_token = get_paypal_access_token(settings)
    capture_url = (
        f"{settings.api_base_url}/v2/checkout/orders/{order_id}/capture"
    )

    try:
        response = httpx.post(
            capture_url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "PayPal-Request-Id": str(uuid.uuid4()),
                "Prefer": "return=representation",
            },
            json={},
            timeout=PAYPAL_TIMEOUT_SECONDS,
        )
    except httpx.RequestError as exc:
        logger.exception("No se pudo capturar la orden de PayPal %s.", order_id)
        raise PayPalAPIError(
            "No pudimos confirmar el pago de prueba en PayPal."
        ) from exc

    if response.status_code not in {200, 201}:
        _raise_paypal_error(response, "capturar la orden")

    data = _read_json(response)
    status = str(data.get("status") or "")
    purchase_units = data.get("purchase_units") or []
    capture = {}

    if purchase_units:
        payments = purchase_units[0].get("payments") or {}
        captures = payments.get("captures") or []
        if captures:
            capture = captures[0]

    capture_id = str(capture.get("id") or "")
    amount = capture.get("amount") or {}
    captured_value = str(amount.get("value") or "")
    captured_currency = str(amount.get("currency_code") or "")

    if status != "COMPLETED":
        logger.error(
            "La captura de PayPal no terminó como COMPLETED. order=%s status=%s",
            order_id,
            status,
        )
        raise PayPalAPIError(
            "PayPal todavía no confirmó el pago como completado."
        )

    if (
        captured_value != PAYPAL_TEST_AMOUNT
        or captured_currency != PAYPAL_TEST_CURRENCY
    ):
        logger.error(
            "Importe inesperado en PayPal. order=%s value=%s currency=%s",
            order_id,
            captured_value,
            captured_currency,
        )
        raise PayPalAPIError(
            "El importe confirmado por PayPal no coincide con la prueba."
        )

    if not capture_id:
        logger.error("PayPal completó la orden sin capture id. order=%s", order_id)
        raise PayPalAPIError(
            "PayPal completó el pago, pero no devolvió el identificador final."
        )

    return {
        "order_id": order_id,
        "capture_id": capture_id,
        "status": status,
        "amount": captured_value,
        "currency": captured_currency,
    }
