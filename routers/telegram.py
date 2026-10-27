"""Vinculación y alertas del bot de Telegram."""
import os
import hmac
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db import get_db
from models import User
import services.telegram_service as telegram_service
from deps import get_current_user

router = APIRouter()


class TelegramToggleAlertsRequest(BaseModel):
    enabled: Optional[bool] = None

@router.get("/api/telegram/status")
async def api_get_telegram_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = current_user

    is_linked = bool(user.telegram_chat_id)
    masked_chat_id = ""
    if user.telegram_chat_id:
        cid = str(user.telegram_chat_id)
        masked_chat_id = cid[:3] + "***" + cid[-3:] if len(cid) > 6 else cid

    return {
        "linked": is_linked,
        "chat_id": masked_chat_id,
        "raw_chat_id": user.telegram_chat_id if is_linked else None,
        "telegram_username": user.telegram_username,
        "alerts_enabled": bool(user.telegram_alerts_enabled),
        "link_code": user.telegram_link_code,
        "bot_username": telegram_service.TELEGRAM_BOT_USERNAME,
        "bot_configured": telegram_service.is_telegram_configured()
    }

@router.post("/api/telegram/generate-code")
async def api_generate_telegram_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = current_user

    code = telegram_service.generate_pairing_code(db, user)
    return {
        "status": "ok",
        "link_code": code,
        "bot_username": telegram_service.TELEGRAM_BOT_USERNAME,
        "instruction": f"Envía /start {code} a @{telegram_service.TELEGRAM_BOT_USERNAME} en Telegram."
    }

@router.get("/api/telegram/pairing-url")
def get_telegram_pairing_url(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = current_user

    if not user.telegram_link_code:
        user.telegram_link_code = telegram_service.generate_pairing_code(db, user)

    bot_username = telegram_service.TELEGRAM_BOT_USERNAME
    direct_url = f"https://t.me/{bot_username}?start={user.telegram_link_code}"

    return {
        "bot_username": bot_username,
        "link_code": user.telegram_link_code,
        "direct_url": direct_url,
        "linked": bool(user.telegram_chat_id),
        "telegram_username": user.telegram_username,
        "chat_id": user.telegram_chat_id
    }

@router.post("/api/telegram/unlink")
async def api_unlink_telegram(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = current_user

    telegram_service.unlink_user_telegram(db, user)
    return {
        "status": "ok",
        "message": "Cuenta de Telegram desvinculada exitosamente."
    }

@router.post("/api/telegram/toggle-alerts")
async def api_toggle_telegram_alerts(
    payload: Optional[TelegramToggleAlertsRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = current_user

    enabled = payload.enabled if payload else None
    new_state = telegram_service.toggle_user_telegram_alerts(db, user, enabled)
    return {
        "status": "ok",
        "alerts_enabled": new_state
    }

@router.post("/api/telegram/test-alert")
async def api_test_telegram_alert(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = current_user

    if not user.telegram_chat_id:
        raise HTTPException(status_code=400, detail="Debes vincular tu cuenta de Telegram antes de enviar una alerta de prueba.")

    test_text = (
        "🧪 <b>ALERTA DE PRUEBA EXITOSA | KixInvertAPP</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Hola <b>{user.full_name}</b> (@{user.username}).\n\n"
        "Esta es una alerta de prueba para confirmar que tu canal móvil en Telegram está 100% operativo y conectado a tu cartera de la Bolsa de Valores de Caracas.\n\n"
        "⚡ <i>Recibirás avisos instantáneos de brecha y señales de compra/venta en este chat.</i>"
    )
    result = telegram_service.send_telegram_message(user.telegram_chat_id, test_text)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Error al enviar mensaje a Telegram."))
    return {
        "status": "ok",
        "result": result,
        "message": "Alerta de prueba enviada satisfactoriamente a tu Telegram."
    }

@router.post("/api/telegram/webhook")
async def api_telegram_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    # Only Telegram knows this secret (set via setWebhook secret_token); reject forged updates
    expected = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    received = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not expected or not hmac.compare_digest(received, expected):
        raise HTTPException(status_code=403, detail="Webhook no autorizado.")
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    telegram_service.handle_incoming_telegram_message(db, payload)
    return {"status": "ok"}
