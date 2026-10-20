import os
import random
import logging
import datetime
from typing import Optional, Dict, Any, List
import httpx
import asyncio
from sqlalchemy.orm import Session

from models import User, Portfolio, Notification, MarketQuote, ExchangeRate
from services.portfolio_service import get_portfolio_summary

logger = logging.getLogger("telegram_service")

from dotenv import load_dotenv

def get_bot_token() -> str:
    load_dotenv(override=False)
    return os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

def get_bot_username() -> str:
    load_dotenv(override=False)
    return os.getenv("TELEGRAM_BOT_USERNAME", "KixInvert_bot").strip().lstrip("@")

TELEGRAM_BOT_USERNAME = get_bot_username()

def get_api_base() -> str:
    token = get_bot_token()
    return f"https://api.telegram.org/bot{token}" if token else ""

# In-memory storage for test verification and simulated deliveries
MOCK_SENT_MESSAGES: List[Dict[str, Any]] = []

def is_telegram_configured() -> bool:
    """Returns True if a real Telegram Bot token is configured."""
    return bool(get_bot_token())

def generate_pairing_code(db: Session, user: User) -> str:
    """Generates a secure, human-readable 6-character linking code (e.g. KIX-4829)."""
    code = f"KIX-{random.randint(1000, 9999)}"
    user.telegram_link_code = code
    db.commit()
    db.refresh(user)
    return code

def format_alert_html(
    title: str,
    message: str,
    severity: str = "info",
    ticker: Optional[str] = None,
    action_url: Optional[str] = None
) -> str:
    """Formats a message with financial-grade styling and emojis for Telegram."""
    icon_map = {
        "critical": "🚨 <b>ALERTA CRÍTICA</b>",
        "warning": "⚠️ <b>AVISO ESTRATÉGICO</b>",
        "success": "🎯 <b>SEÑAL TÁCTICA EJECUTIVA</b>",
        "info": "📊 <b>NOTIFICACIÓN DE MERCADO</b>"
    }
    header_icon = icon_map.get(severity.lower(), "🔔 <b>KIXINVERT ALERTA</b>")
    ticker_tag = f" · <code>{ticker}</code>" if ticker else ""

    lines = [
        f"{header_icon}{ticker_tag}",
        "━━━━━━━━━━━━━━━━━━━━━━",
        f"<b>{title}</b>",
        "",
        message,
        "",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "<i>💡 Terminal Bursátil BVC Tri-Monetario</i>"
    ]
    if action_url:
        full_url = action_url if action_url.startswith("http") else f"http://127.0.0.1:8000{action_url}"
        lines.append(f'🔗 <a href="{full_url}">Ver detalle en la Plataforma</a>')

    return "\n".join(lines)

def send_telegram_message(chat_id: str, text: str, parse_mode: str = "HTML") -> Dict[str, Any]:
    """
    Dispatches a message to Telegram.
    If no bot token is set or in mock/test mode, records to MOCK_SENT_MESSAGES safely.
    """
    record = {
        "chat_id": str(chat_id),
        "text": text,
        "parse_mode": parse_mode,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "mocked": not is_telegram_configured()
    }
    MOCK_SENT_MESSAGES.append(record)

    if not is_telegram_configured():
        logger.info(f"[Telegram Mock] Sent to {chat_id}:\n{text}")
        return {"success": True, "mocked": True, "chat_id": str(chat_id), "message": "Simulated dispatch"}

    try:
        url = f"{get_api_base()}/sendMessage"
        payload = {
            "chat_id": str(chat_id),
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True
        }
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                return {"success": True, "mocked": False, "data": data}
            else:
                err_text = resp.text
                bot_user = get_bot_username()
                if "chat not found" in err_text:
                    err_msg = f"Debes abrir @{bot_user} en Telegram y presionar 'Iniciar' para activar el envío de alertas a tu teléfono."
                else:
                    err_msg = f"Error de Telegram ({resp.status_code}): {err_text}"
                logger.error(f"Telegram API error {resp.status_code}: {err_text}")
                return {"success": False, "mocked": False, "error": err_msg, "status_code": resp.status_code}
    except Exception as e:
        logger.exception("Failed to dispatch Telegram message")
        return {"success": False, "mocked": False, "error": str(e)}

def link_user_by_chat_id(
    db: Session,
    user: User,
    chat_id: str,
    telegram_username: Optional[str] = None
) -> bool:
    """Directly links a user's account with a Telegram Chat ID."""
    user.telegram_chat_id = str(chat_id).strip()
    if telegram_username:
        user.telegram_username = telegram_username.strip().lstrip("@")
    user.telegram_alerts_enabled = True
    user.telegram_link_code = None
    db.commit()
    db.refresh(user)

    # Send Welcome confirmation message to Telegram
    welcome_msg = (
        "✅ <b>¡Conexión Exitosa con KixInvertAPP!</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Hola <b>{user.full_name}</b> (@{user.username}).\n\n"
        "Tu cuenta ha sido vinculada correctamente con <b>@KixInvertAlertsBot</b>.\n\n"
        "📱 A partir de ahora recibirás en tiempo real:\n"
        "• Alertas de salto en la Brecha Cambiaria (BCV vs USDT).\n"
        "• Señales tácticas (Toma de Ganancias & Freno Stop-Loss).\n"
        "• Cierres diarios de tipo de cambio oficial.\n\n"
        "<b>Comandos rápidos disponibles:</b>\n"
        "/balance - Ver balance consolidado de tu cartera\n"
        "/alertas - Estado de brecha y alertas vigentes\n"
        "/ayuda - Lista de comandos\n\n"
        "<i>Terminal Bursátil BVC Tri-Monetario</i>"
    )
    send_telegram_message(user.telegram_chat_id, welcome_msg)
    return True

def link_user_by_code(
    db: Session,
    code: str,
    chat_id: str,
    telegram_username: Optional[str] = None
) -> Optional[User]:
    """Links user account via pairing code sent to bot (e.g. /start KIX-1234)."""
    clean_code = code.strip().upper()
    user = db.query(User).filter(User.telegram_link_code == clean_code).first()
    if not user:
        return None

    link_user_by_chat_id(db, user, chat_id, telegram_username)
    return user

def unlink_user_telegram(db: Session, user: User) -> bool:
    """Disconnects Telegram from user account."""
    if user.telegram_chat_id:
        farewell = (
            "ℹ️ <b>KixInvertAPP - Alertas Desvinculadas</b>\n"
            "Tu cuenta de Telegram ha sido desconectada de KixInvertAPP. Ya no recibirás alertas automáticas en este chat.\n"
            "Puedes reconectar en cualquier momento desde la web."
        )
        send_telegram_message(user.telegram_chat_id, farewell)

    user.telegram_chat_id = None
    user.telegram_username = None
    user.telegram_link_code = None
    user.telegram_alerts_enabled = False
    db.commit()
    db.refresh(user)
    return True

def toggle_user_telegram_alerts(db: Session, user: User, enabled: Optional[bool] = None) -> bool:
    """Toggles or explicitly sets Telegram alerts enabled state."""
    if enabled is not None:
        user.telegram_alerts_enabled = bool(enabled)
    else:
        user.telegram_alerts_enabled = not user.telegram_alerts_enabled
    db.commit()
    db.refresh(user)
    return user.telegram_alerts_enabled

def get_user_portfolio_summary_text(db: Session, user: User) -> str:
    """Compiles a quick, beautiful Telegram summary of the user's portfolio."""
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == user.id).first()
    if not portfolio:
        portfolio = db.query(Portfolio).first()

    if not portfolio:
        return "⚠️ No tienes ningún portafolio registrado aún en KixInvertAPP."

    rate_bcv_rec = db.query(ExchangeRate).filter(ExchangeRate.rate_type == "BCV").order_by(ExchangeRate.recorded_at.desc()).first()
    rate_usdt_rec = db.query(ExchangeRate).filter(ExchangeRate.rate_type == "USDT_BINANCE").order_by(ExchangeRate.recorded_at.desc()).first()
    bcv = float(rate_bcv_rec.rate_value) if rate_bcv_rec else 881.87
    usdt = float(rate_usdt_rec.rate_value) if rate_usdt_rec else 1007.60
    gap = ((usdt - bcv) / bcv) * 100.0 if bcv > 0 else 0.0

    summary = get_portfolio_summary(db=db, bcv_rate=bcv, usdt_rate=usdt, portfolio_id=portfolio.id)
    total_ves = summary.get("total_portfolio_ves", 0.0)
    total_usd = summary.get("total_portfolio_usd", 0.0)
    total_usdt = summary.get("total_portfolio_usdt", 0.0)
    positions = summary.get("positions", [])

    lines = [
        "💼 <b>ESTADO DE TU PORTAFOLIO | KixInvertAPP</b>",
        f"Titular: <b>{user.full_name}</b>",
        "━━━━━━━━━━━━━━━━━━━━━━",
        f"💵 <b>Total USDT:</b> ${total_usdt:,.2f} USDT",
        f"🏛️ <b>Total USD (BCV):</b> ${total_usd:,.2f} USD",
        f"🇻🇪 <b>Total VES:</b> Bs {total_ves:,.2f}",
        "",
        f"📈 <b>Tasas:</b> BCV {bcv:,.2f} | USDT {usdt:,.2f} (Brecha: <b>{gap:.2f}%</b>)",
        "",
        "<b>Top Posiciones:</b>"
    ]

    for pos in positions[:5]:
        ticker = pos.get("ticker", "")
        qty = pos.get("quantity", 0)
        perf = pos.get("performance_usdt_pct", 0.0)
        perf_sign = "+" if perf >= 0 else ""
        icon = "🟢" if perf >= 0 else "🔴"
        action = pos.get("tactical_action", "MANTENER")
        lines.append(f"{icon} <b>{ticker}</b> ({qty:,} acc): {perf_sign}{perf:.1f}% USDT [{action}]")

    if len(positions) > 5:
        lines.append(f"<i>... y {len(positions) - 5} activos más.</i>")

    lines.append("")
    lines.append("<i>💡 Consulta completa en https://kixinvertapp.com</i>")
    return "\n".join(lines)

def send_notification_to_telegram(db: Session, notif: Notification) -> int:
    """
    Dispatches a created Notification object to relevant users via Telegram.
    Returns the number of messages successfully dispatched.
    """
    recipients = []
    if notif.user_id:
        user = db.query(User).filter(User.id == notif.user_id).first()
        if user and user.telegram_chat_id and user.telegram_alerts_enabled:
            recipients.append(user)
    else:
        # Broadcast notification (e.g. Critical FX Gap)
        recipients = db.query(User).filter(
            User.telegram_chat_id.isnot(None),
            User.telegram_alerts_enabled == True
        ).all()

    dispatched = 0
    formatted_text = format_alert_html(
        title=notif.title,
        message=notif.message,
        severity=notif.severity,
        ticker=notif.ticker,
        action_url=notif.action_url
    )

    for recipient in recipients:
        res = send_telegram_message(recipient.telegram_chat_id, formatted_text)
        if res.get("success"):
            dispatched += 1

    return dispatched

def handle_incoming_telegram_message(db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Processes incoming Telegram Webhook payloads from the Telegram Bot API.
    Handles /start, /balance, /alertas, /ayuda, and pairing commands.
    """
    message = payload.get("message", {})
    if not message:
        # Callback query or other update type
        return {"status": "ignored", "reason": "No message field in payload"}

    chat = message.get("chat", {})
    chat_id = str(chat.get("id", ""))
    from_user = message.get("from", {})
    tg_username = from_user.get("username", "")
    first_name = from_user.get("first_name", "Inversionista")
    text = (message.get("text") or "").strip()

    if not chat_id or not text:
        return {"status": "ignored", "reason": "Missing chat_id or text"}

    parts = text.split()
    cmd = parts[0].lower() if parts else ""

    # 1. /start command
    if cmd == "/start":
        if len(parts) > 1:
            # Code provided: /start KIX-1234
            code = parts[1].upper().strip()
            linked_user = link_user_by_code(db, code=code, chat_id=chat_id, telegram_username=tg_username)
            if linked_user:
                return {
                    "status": "linked",
                    "user_id": linked_user.id,
                    "username": linked_user.username,
                    "chat_id": chat_id
                }
            else:
                err_msg = (
                    "❌ <b>Código de vinculación inválido o expirado</b>\n\n"
                    f"El código <code>{code}</code> no coincide con ninguna sesión activa de KixInvertAPP.\n"
                    "Por favor genera un código nuevo en el panel de la aplicación web."
                )
                send_telegram_message(chat_id, err_msg)
                return {"status": "error", "reason": "Invalid pairing code"}
        else:
            # Simple /start
            user = db.query(User).filter(User.telegram_chat_id == chat_id).first()
            if user:
                reply = (
                    f"👋 ¡Hola de nuevo, <b>{user.full_name}</b>!\n\n"
                    "Tu cuenta ya está vinculada a <b>KixInvertAPP</b>.\n"
                    "Usa /balance para ver tus saldos o /alertas para revisar las condiciones de mercado."
                )
            else:
                reply = (
                    f"👋 ¡Hola {first_name}! Bienvenido al bot oficial de <b>KixInvertAPP</b>.\n"
                    "━━━━━━━━━━━━━━━━━━━━━━\n"
                    "Para vincular tu cuenta y recibir alertas bursátiles instantáneas:\n\n"
                    "1️⃣ Inicia sesión en tu terminal web de KixInvertAPP.\n"
                    "2️⃣ Haz clic en el botón <b>Bot Telegram</b> en el menú superior.\n"
                    "3️⃣ Envía el comando con tu código aquí, por ejemplo:\n"
                    "<code>/start KIX-1234</code>\n\n"
                    "¡O ingresa directamente tu ID de chat (<code>" + chat_id + "</code>) en el panel web!"
                )
            send_telegram_message(chat_id, reply)
            return {"status": "ok", "command": "/start"}

    # Find linked user for subsequent commands
    user = db.query(User).filter(User.telegram_chat_id == chat_id).first()

    # 2. /balance or /portafolio command
    if cmd in ["/balance", "/portafolio", "/cartera"]:
        if not user:
            send_telegram_message(
                chat_id,
                "⚠️ <b>Cuenta no vinculada</b>\nDebes vincular tu cuenta con <code>/start CODIGO</code> antes de consultar tu portafolio."
            )
            return {"status": "unlinked"}
        summary_text = get_user_portfolio_summary_text(db, user)
        send_telegram_message(chat_id, summary_text)
        return {"status": "ok", "command": cmd}

    # 3. /alertas command
    if cmd in ["/alertas", "/mercado", "/rates"]:
        rates_bcv = db.query(ExchangeRate).filter(ExchangeRate.rate_type == "BCV").order_by(ExchangeRate.recorded_at.desc()).first()
        rates_usdt = db.query(ExchangeRate).filter(ExchangeRate.rate_type == "USDT_BINANCE").order_by(ExchangeRate.recorded_at.desc()).first()
        bcv_val = float(rates_bcv.rate_value) if rates_bcv else 881.87
        usdt_val = float(rates_usdt.rate_value) if rates_usdt else 1007.60
        gap_val = ((usdt_val - bcv_val) / bcv_val) * 100.0 if bcv_val > 0 else 0.0

        gap_status = "🔴 Brecha Crítica" if gap_val >= 18.0 else ("🟡 Brecha Elevada" if gap_val >= 12.0 else "🟢 Brecha Controlada")

        alert_msg = (
            "📊 <b>ESTADO DE MERCADO & BRECHA | KixInvertAPP</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🏛️ <b>Dólar Oficial BCV:</b> Bs {bcv_val:,.2f}\n"
            f"💵 <b>Dólar Binance USDT:</b> Bs {usdt_val:,.2f}\n"
            f"⚡ <b>Brecha Cambiaria:</b> <b>{gap_val:.2f}%</b> ({gap_status})\n\n"
            f"🔔 Estado de tus alertas móviles: <b>{'Activadas ✅' if (user and user.telegram_alerts_enabled) else 'Desactivadas ⏸️'}</b>"
        )
        send_telegram_message(chat_id, alert_msg)
        return {"status": "ok", "command": "/alertas"}

    # 4. /desvincular command
    if cmd in ["/desvincular", "/unlink", "/stop"]:
        if user:
            unlink_user_telegram(db, user)
            return {"status": "unlinked_success"}
        else:
            send_telegram_message(chat_id, "ℹ️ Tu chat no estaba vinculado a ninguna cuenta.")
            return {"status": "not_linked"}

    # 5. /ayuda or /help command
    bot_name = get_bot_username()
    reply_help = (
        f"📖 <b>COMANDOS DISPONIBLES | @{bot_name}</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "• /balance - Consulta saldo consolidado (VES, USD, USDT) y posiciones\n"
        "• /alertas - Consulta la brecha cambiaria actual y estado de mercado\n"
        "• /start KIX-XXXX - Vincula tu cuenta con el código de la web\n"
        "• /desvincular - Desconecta este chat de tu cuenta\n"
        "• /ayuda - Muestra esta ayuda\n\n"
        f"Tu ID de Telegram: <code>{chat_id}</code>"
    )
    send_telegram_message(chat_id, reply_help)
    return {"status": "ok", "command": "/ayuda"}

async def telegram_polling_worker(db_session_factory):
    """
    Background worker that continuously polls Telegram getUpdates API.
    Enables instant automatic pairing when users click 'Iniciar' on t.me/KixInvert_bot?start=KIX-XXXX.
    """
    offset = None
    logger.info("Telegram background polling worker started.")
    while True:
        try:
            token = get_bot_token()
            if not token:
                await asyncio.sleep(5)
                continue

            url = f"https://api.telegram.org/bot{token}/getUpdates"
            params = {"timeout": 10}
            if offset is not None:
                params["offset"] = offset

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    updates = data.get("result", [])
                    for update in updates:
                        offset = update["update_id"] + 1
                        db = db_session_factory()
                        try:
                            handle_incoming_telegram_message(db, update)
                        except Exception as e:
                            logger.error(f"Error handling Telegram update: {e}")
                        finally:
                            db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            await asyncio.sleep(3)
        await asyncio.sleep(1)
