import re

from fastapi import APIRouter, Depends, HTTPException

from app.database.db import (
    get_paypal_live_order,
    get_paypal_test_order,
    save_paypal_live_order,
    save_paypal_test_order,
    update_paypal_live_order_capture,
    update_paypal_test_order_capture,
)
from app.security import get_authenticated_spotify_user_id
from app.services.paypal_service import (
    PAYPAL_LIVE_TEST_AMOUNT,
    PAYPAL_LIVE_TEST_CURRENCY,
    PAYPAL_TEST_AMOUNT,
    PAYPAL_TEST_CURRENCY,
    PayPalAPIError,
    PayPalConfigurationError,
    capture_live_test_order,
    capture_test_order,
    create_live_test_order,
    create_test_order,
    get_paypal_live_settings,
    get_paypal_settings,
    is_paypal_live_enabled,
)


router = APIRouter(prefix="/payments/paypal")
ORDER_ID_PATTERN = re.compile(r"^[A-Za-z0-9]{5,64}$")


def _configuration_http_error(exc: PayPalConfigurationError) -> HTTPException:
    return HTTPException(status_code=503, detail=str(exc))


def _paypal_http_error(exc: PayPalAPIError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.user_message)


def _require_valid_order_id(order_id: str) -> None:
    if not ORDER_ID_PATTERN.fullmatch(order_id):
        raise HTTPException(
            status_code=400,
            detail="El identificador de la orden no es válido.",
        )


def _require_live_enabled() -> None:
    try:
        enabled = is_paypal_live_enabled()
    except PayPalConfigurationError as exc:
        raise _configuration_http_error(exc) from exc

    if not enabled:
        raise HTTPException(
            status_code=403,
            detail=(
                "La prueba real está desactivada. "
                "PAYPAL_LIVE_ENABLED debe permanecer en false hasta autorizarla."
            ),
        )


@router.get("/config")
def get_paypal_config(
    user_id: str = Depends(get_authenticated_spotify_user_id),
):
    del user_id

    try:
        settings = get_paypal_settings()
    except PayPalConfigurationError as exc:
        raise _configuration_http_error(exc) from exc
    except PayPalAPIError as exc:
        raise _paypal_http_error(exc) from exc

    return {
        "client_id": settings.client_id,
        "environment": settings.environment,
        "sdk_url": settings.sdk_url,
        "amount": PAYPAL_TEST_AMOUNT,
        "currency": PAYPAL_TEST_CURRENCY,
        "is_test": settings.environment == "sandbox",
    }


@router.post("/create-order")
def create_paypal_order(
    user_id: str = Depends(get_authenticated_spotify_user_id),
):
    try:
        order = create_test_order(user_id)
    except PayPalConfigurationError as exc:
        raise _configuration_http_error(exc) from exc
    except PayPalAPIError as exc:
        raise _paypal_http_error(exc) from exc

    save_paypal_test_order(
        spotify_user_id=user_id,
        order_id=order["order_id"],
        amount=order["amount"],
        currency=order["currency"],
        status=order["status"],
    )

    return {
        "order_id": order["order_id"],
        "status": order["status"],
    }


@router.post("/orders/{order_id}/capture")
def capture_paypal_order(
    order_id: str,
    user_id: str = Depends(get_authenticated_spotify_user_id),
):
    _require_valid_order_id(order_id)

    stored_order = get_paypal_test_order(order_id)

    if not stored_order or stored_order["spotify_user_id"] != user_id:
        raise HTTPException(
            status_code=404,
            detail="No encontramos esta orden de prueba para tu sesión.",
        )

    if stored_order["status"] == "COMPLETED" and stored_order.get("capture_id"):
        return {
            "order_id": order_id,
            "capture_id": stored_order["capture_id"],
            "status": "COMPLETED",
            "amount": stored_order["amount"],
            "currency": stored_order["currency"],
            "already_captured": True,
        }

    try:
        capture = capture_test_order(order_id)
    except PayPalConfigurationError as exc:
        raise _configuration_http_error(exc) from exc
    except PayPalAPIError as exc:
        raise _paypal_http_error(exc) from exc

    update_paypal_test_order_capture(
        order_id=order_id,
        status=capture["status"],
        capture_id=capture["capture_id"],
    )

    return {
        **capture,
        "already_captured": False,
    }


@router.get("/live/config")
def get_paypal_live_config(
    user_id: str = Depends(get_authenticated_spotify_user_id),
):
    del user_id

    try:
        enabled = is_paypal_live_enabled()
    except PayPalConfigurationError as exc:
        raise _configuration_http_error(exc) from exc

    if not enabled:
        return {
            "enabled": False,
            "client_id": "",
            "environment": "live",
            "amount": PAYPAL_LIVE_TEST_AMOUNT,
            "currency": PAYPAL_LIVE_TEST_CURRENCY,
            "is_test": False,
        }

    try:
        settings = get_paypal_live_settings()
    except PayPalConfigurationError as exc:
        raise _configuration_http_error(exc) from exc
    except PayPalAPIError as exc:
        raise _paypal_http_error(exc) from exc

    return {
        "enabled": True,
        "client_id": settings.client_id,
        "environment": "live",
        "amount": PAYPAL_LIVE_TEST_AMOUNT,
        "currency": PAYPAL_LIVE_TEST_CURRENCY,
        "is_test": False,
    }


@router.post("/live/create-order")
def create_paypal_live_order(
    user_id: str = Depends(get_authenticated_spotify_user_id),
):
    _require_live_enabled()

    try:
        order = create_live_test_order(user_id)
    except PayPalConfigurationError as exc:
        raise _configuration_http_error(exc) from exc
    except PayPalAPIError as exc:
        raise _paypal_http_error(exc) from exc

    save_paypal_live_order(
        spotify_user_id=user_id,
        order_id=order["order_id"],
        amount=order["amount"],
        currency=order["currency"],
        status=order["status"],
    )

    return {
        "order_id": order["order_id"],
        "status": order["status"],
    }


@router.post("/live/orders/{order_id}/capture")
def capture_paypal_live_order(
    order_id: str,
    user_id: str = Depends(get_authenticated_spotify_user_id),
):
    _require_live_enabled()
    _require_valid_order_id(order_id)

    stored_order = get_paypal_live_order(order_id)

    if not stored_order or stored_order["spotify_user_id"] != user_id:
        raise HTTPException(
            status_code=404,
            detail="No encontramos esta orden real para tu sesión.",
        )

    if stored_order["status"] == "COMPLETED" and stored_order.get("capture_id"):
        return {
            "order_id": order_id,
            "capture_id": stored_order["capture_id"],
            "status": "COMPLETED",
            "amount": stored_order["amount"],
            "currency": stored_order["currency"],
            "paypal_fee": stored_order.get("paypal_fee") or "",
            "net_amount": stored_order.get("net_amount") or "",
            "already_captured": True,
        }

    try:
        capture = capture_live_test_order(order_id)
    except PayPalConfigurationError as exc:
        raise _configuration_http_error(exc) from exc
    except PayPalAPIError as exc:
        raise _paypal_http_error(exc) from exc

    update_paypal_live_order_capture(
        order_id=order_id,
        status=capture["status"],
        capture_id=capture["capture_id"],
        paypal_fee=capture.get("paypal_fee", ""),
        net_amount=capture.get("net_amount", ""),
    )

    return {
        **capture,
        "already_captured": False,
    }
