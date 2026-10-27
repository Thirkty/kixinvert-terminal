"""Plan PRO pagado con Binance Pay (USDT).

Flujo: el servidor crea la orden en Binance con el precio que él mismo fija, el usuario paga en la
página de Binance, y el PRO se activa solo cuando el servidor le pregunta a Binance por esa orden y
la respuesta dice PAID con el monto completo. El webhook de Binance solo dispara esa misma consulta,
así que un aviso falso nunca activa nada.

Variables en .env: BINANCE_PAY_API_KEY, BINANCE_PAY_SECRET_KEY (y opcional BINANCE_PAY_BASE_URL).
"""
import os
import json
import time
import hmac
import uuid
import hashlib
import secrets
import datetime
import logging
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from models import User, PaymentOrder, AuditLog

logger = logging.getLogger(__name__)

PRO_PRICE_USDT = 5.00
PRO_DAYS = 30
ORDER_MINUTES = 15  # Binance cierra la orden si no se paga en este tiempo


class PaymentError(Exception):
    """Error que se puede mostrar tal cual al usuario."""


def _config():
    return (
        os.getenv("BINANCE_PAY_API_KEY", ""),
        os.getenv("BINANCE_PAY_SECRET_KEY", ""),
        os.getenv("BINANCE_PAY_BASE_URL", "https://bpay.binanceapi.com").rstrip("/"),
    )


def is_configured() -> bool:
    key, secret, _ = _config()
    return bool(key and secret)


def _binance_post(path: str, body: dict) -> dict:
    """Llamada firmada a la API de Binance Pay (HMAC-SHA512 sobre timestamp, nonce y cuerpo)."""
    key, secret, base = _config()
    if not (key and secret):
        raise PaymentError("Los pagos con Binance Pay todavía no están configurados.")
    payload = json.dumps(body, separators=(",", ":"))
    timestamp = str(int(time.time() * 1000))
    nonce = secrets.token_hex(16)
    signature = hmac.new(
        secret.encode(), f"{timestamp}\n{nonce}\n{payload}\n".encode(), hashlib.sha512
    ).hexdigest().upper()
    headers = {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": timestamp,
        "BinancePay-Nonce": nonce,
        "BinancePay-Certificate-SN": key,
        "BinancePay-Signature": signature,
    }
    try:
        res = httpx.post(f"{base}{path}", headers=headers, content=payload, timeout=15.0)
        data = res.json()
    except Exception as e:
        logger.error(f"Binance Pay {path}: {e}")
        raise PaymentError("No se pudo conectar con Binance Pay. Intenta de nuevo en un momento.")
    if data.get("status") != "SUCCESS":
        logger.error(f"Binance Pay {path} rejected: {data.get('code')} {data.get('errorMessage')}")
        raise PaymentError("Binance Pay rechazó la operación. Intenta de nuevo más tarde.")
    return data.get("data") or {}


def create_order(db: Session, user: User) -> dict:
    order_id = f"KIX{datetime.datetime.utcnow():%Y%m%d}{uuid.uuid4().hex[:12].upper()}"
    order = PaymentOrder(order_id=order_id, user_id=user.id, amount_usdt=PRO_PRICE_USDT, plan="pro_monthly",
                         payment_method="binance_pay", status="PENDING")
    db.add(order)
    db.commit()
    try:
        data = _binance_post("/binancepay/openapi/v2/order", {
            "env": {"terminalType": "WEB"},
            "merchantTradeNo": order_id,
            "orderAmount": f"{PRO_PRICE_USDT:.2f}",
            "currency": "USDT",
            "orderExpireTime": int((time.time() + ORDER_MINUTES * 60) * 1000),
            "goods": {
                "goodsType": "02",
                "goodsCategory": "Z000",
                "referenceGoodsId": "kix_pro_monthly",
                "goodsName": f"KixInvert PRO ({PRO_DAYS} días)",
            },
        })
    except PaymentError:
        order.status = "ERROR"
        db.commit()
        raise
    order.binance_prepay_id = data.get("prepayId")
    order.binance_qr_url = data.get("qrcodeLink")
    db.commit()
    return {
        "order_id": order_id,
        "amount_usdt": PRO_PRICE_USDT,
        "checkout_url": data.get("checkoutUrl"),
        "qr_url": data.get("qrcodeLink"),
        "expires_in_minutes": ORDER_MINUTES,
    }


def activate_pro(db: Session, user: User, order: PaymentOrder) -> None:
    """Suma 30 días (sobre lo que quede vigente) y marca la orden como pagada. Idempotente por orden."""
    if order.status == "PAID":
        return
    now = datetime.datetime.utcnow()
    start = user.subscription_expires_at if user.subscription_tier == "pro" and user.subscription_expires_at and user.subscription_expires_at > now else now
    user.subscription_tier = "pro"
    user.subscription_expires_at = start + datetime.timedelta(days=PRO_DAYS)
    order.status = "PAID"
    order.paid_at = now
    db.add(AuditLog(user_id=user.id, action="PRO_ACTIVATED",
                    details=f"PRO hasta {user.subscription_expires_at:%Y-%m-%d} (orden {order.order_id})"))
    db.commit()


def refresh_order(db: Session, order: PaymentOrder) -> str:
    """Pregunta a Binance por la orden y aplica el resultado. Devuelve el estado local."""
    if order.status != "PENDING":
        return order.status
    data = _binance_post("/binancepay/openapi/v2/order/query", {"merchantTradeNo": order.order_id})
    status = data.get("status")
    if status == "PAID":
        paid = float(data.get("orderAmount") or 0)
        if data.get("currency") == "USDT" and paid + 1e-9 >= float(order.amount_usdt):
            activate_pro(db, order.user, order)
        else:
            logger.error(f"Order {order.order_id} paid with wrong amount/currency: {paid} {data.get('currency')}")
            order.status = "ERROR"
            db.commit()
    elif status in ("EXPIRED", "CANCELED", "ERROR"):
        order.status = status
        db.commit()
    return order.status


def order_from_webhook(db: Session, body: dict) -> Optional[PaymentOrder]:
    """Busca la orden que menciona un aviso de Binance (no confía en su estado)."""
    try:
        data = body.get("data")
        data = json.loads(data) if isinstance(data, str) else (data or {})
        trade_no = data.get("merchantTradeNo")
    except Exception:
        return None
    if not trade_no:
        return None
    return db.query(PaymentOrder).filter(PaymentOrder.order_id == trade_no).first()
