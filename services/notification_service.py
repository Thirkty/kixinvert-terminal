import datetime
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models import Notification, User, Portfolio, MarketQuote, ExchangeRate
from services.portfolio_service import get_portfolio_summary


def get_latest_rates(db: Session) -> Dict[str, float]:
    """Retrieve current exchange rates and spread percentage."""
    rate_bcv_rec = db.query(ExchangeRate).filter(ExchangeRate.rate_type == "BCV").order_by(desc(ExchangeRate.recorded_at)).first()
    rate_usdt_rec = db.query(ExchangeRate).filter(ExchangeRate.rate_type == "USDT_BINANCE").order_by(desc(ExchangeRate.recorded_at)).first()

    bcv = float(rate_bcv_rec.rate_value) if rate_bcv_rec else 881.87
    usdt = float(rate_usdt_rec.rate_value) if rate_usdt_rec else 1007.60
    gap = ((usdt - bcv) / bcv) * 100.0 if bcv > 0 else 0.0

    return {
        "bcv": round(bcv, 4),
        "usdt": round(usdt, 4),
        "gap": round(gap, 2)
    }


def get_or_create_notification(
    db: Session,
    user_id: Optional[int],
    n_type: str,
    category: str,
    severity: str,
    title: str,
    message: str,
    ticker: Optional[str] = None,
    action_url: Optional[str] = None,
    dedup_hours: int = 12
) -> Tuple[Notification, bool]:
    """
    Inserts a notification only if an identical notification (by user, type, and ticker)
    has not been created in the last `dedup_hours`.
    Returns (notification, is_newly_created).
    Does NOT reset `created_at` on existing notifications so we never re-trigger Telegram spam.
    """
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=dedup_hours)

    query = db.query(Notification).filter(
        Notification.type == n_type,
        Notification.ticker == ticker,
        Notification.created_at >= cutoff
    )
    if user_id is not None:
        query = query.filter(Notification.user_id == user_id)
    else:
        query = query.filter(Notification.user_id.is_(None))

    existing = query.first()
    if existing:
        return existing, False

    new_notif = Notification(
        user_id=user_id,
        type=n_type,
        category=category,
        severity=severity,
        title=title,
        message=message,
        ticker=ticker,
        action_url=action_url,
        is_read=False,
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_notif)
    db.commit()
    db.refresh(new_notif)
    return new_notif, True


def generate_smart_notifications(
    db: Session,
    user_id: Optional[int] = None,
    allow_telegram_dispatch: bool = False
) -> List[Notification]:
    """
    Evaluates real-time financial triggers:
    1. FX Gap between BCV and USDT (antidevaluation alert)
    2. Tactical Portfolio Signals (Take Profit with exact share counts, Stop-loss, Concentration)
    3. Market Rallies & Dips (BVC assets)

    Only dispatches to Telegram when `allow_telegram_dispatch=True`, `user_id` is an authenticated user,
    AND genuinely new notifications were created (further protected by Telegram's 6-hour cooldown).
    """
    rates = get_latest_rates(db)
    gap = rates["gap"]
    bcv = rates["bcv"]
    usdt = rates["usdt"]

    newly_created: List[Notification] = []

    # 1. Exchange Rate Gap Alert
    if gap >= 18.0:
        notif, is_new = get_or_create_notification(
            db=db,
            user_id=user_id,
            n_type="gap_warning_critical",
            category="market",
            severity="critical",
            title=f"⚠️ Brecha Cambiaria Crítica (+{gap:.1f}%)",
            message=f"El dólar USDT cotiza a Bs. {usdt:,.2f} vs BCV Bs. {bcv:,.2f} (brecha de {gap:.1f}%). Tus acciones BVC sirven de escudo frente al ajuste cambiario.",
            action_url="#tab-board"
        )
        if is_new:
            newly_created.append(notif)
    elif gap >= 12.0:
        notif, is_new = get_or_create_notification(
            db=db,
            user_id=user_id,
            n_type="gap_warning_moderate",
            category="market",
            severity="warning",
            title=f"⚡ Alerta de Brecha Cambiaria (+{gap:.1f}%)",
            message=f"La brecha entre USDT (Bs. {usdt:,.2f}) y BCV (Bs. {bcv:,.2f}) se ubica en +{gap:.1f}%. Buen momento para revisar acciones rezagadas.",
            action_url="#tab-board"
        )
        if is_new:
            newly_created.append(notif)

    # 2. Tactical Portfolio Signals (Only for the specific user's portfolio)
    portfolio = None
    if user_id is not None:
        portfolio = db.query(Portfolio).filter(Portfolio.user_id == user_id).first()
    else:
        portfolio = db.query(Portfolio).filter(Portfolio.id == 999).first()

    if portfolio:
        summary = get_portfolio_summary(db=db, bcv_rate=bcv, usdt_rate=usdt, portfolio_id=portfolio.id, user_id=user_id)
        positions = summary.get("positions", [])
        for pos in positions:
            ticker = pos.get("ticker")
            tac_sig = pos.get("tactical_signal", {})
            action = tac_sig.get("action")
            rule = tac_sig.get("signal")
            ret_usdt = float(pos.get("pnl_pct_usdt", 0.0))
            weight_pct = float(pos.get("weight_pct", 0.0))
            shares = int(round(float(pos.get("shares", 0))))
            to_sell = tac_sig.get("shares_to_sell", 1)
            to_keep = tac_sig.get("shares_to_keep", max(0, shares - to_sell))
            curr_p = float(pos.get("current_price_ves", 0.0))
            cash_gen = to_sell * curr_p
            sell_word = "acción" if to_sell == 1 else "acciones"
            keep_word = "acción" if to_keep == 1 else "acciones"

            if action in ("VENDER", "REDUCIR") and rule in ("SELL_STRONG", "SELL_PARTIAL"):
                notif, is_new = get_or_create_notification(
                    db=db,
                    user_id=user_id,
                    n_type=f"tactical_sell_{ticker}",
                    category="tactical",
                    severity="success",
                    title=f"🎯 Toma de Ganancia en {ticker}: Vender {to_sell} {sell_word}",
                    message=(
                        f"Tienes {shares} acciones en {ticker} ganando +{ret_usdt:.1f}% en USDT. "
                        f"Te sugerimos vender {to_sell} {sell_word} (cobras Bs. {cash_gen:,.2f}) y conservar {to_keep} {keep_word}."
                    ),
                    ticker=ticker,
                    action_url="#tab-positions"
                )
                if is_new:
                    newly_created.append(notif)
            elif action == "ROTAR":
                notif, is_new = get_or_create_notification(
                    db=db,
                    user_id=user_id,
                    n_type=f"tactical_rotate_{ticker}",
                    category="tactical",
                    severity="critical",
                    title=f"🔴 Evaluar Rotación: {ticker}",
                    message=f"{ticker} presenta un rezago de {ret_usdt:+.1f}% en USDT. Evalúa rotar hacia títulos con mayor volumen como BNC o RST.B.",
                    ticker=ticker,
                    action_url="#tab-positions"
                )
                if is_new:
                    newly_created.append(notif)
            elif rule == "REDUCE_CONCENTRATION":
                notif, is_new = get_or_create_notification(
                    db=db,
                    user_id=user_id,
                    n_type=f"tactical_concentration_{ticker}",
                    category="tactical",
                    severity="warning",
                    title=f"⚖️ Concentración Alta en {ticker} ({weight_pct:.1f}%)",
                    message=f"{ticker} representa el {weight_pct:.1f}% de tu cartera. Vender {to_sell} {sell_word} te ayuda a diversificar.",
                    ticker=ticker,
                    action_url="#tab-positions"
                )
                if is_new:
                    newly_created.append(notif)

    # 3. Market Movers (Only for significant moves >= +5.0% or <= -5.0%)
    quotes = db.query(MarketQuote).all()
    for q in quotes:
        chg = float(q.change_pct or 0.0)
        if chg >= 5.0:
            notif, is_new = get_or_create_notification(
                db=db,
                user_id=user_id,
                n_type=f"market_rally_{q.ticker}",
                category="market",
                severity="success",
                title=f"🚀 Subida Fuerte en BVC: {q.ticker} (+{chg:.1f}%)",
                message=f"{q.ticker} sube +{chg:.1f}% hoy y cotiza en Bs. {float(q.price_ves):,.2f}.",
                ticker=q.ticker,
                action_url="#tab-board"
            )
            if is_new:
                newly_created.append(notif)
        elif chg <= -5.0:
            notif, is_new = get_or_create_notification(
                db=db,
                user_id=user_id,
                n_type=f"market_dip_{q.ticker}",
                category="market",
                severity="warning",
                title=f"📉 Retroceso en BVC: {q.ticker} ({chg:.1f}%)",
                message=f"{q.ticker} baja {chg:.1f}% hoy (Bs. {float(q.price_ves):,.2f}). Oportunidad si buscas comprar más barato.",
                ticker=q.ticker,
                action_url="#tab-board"
            )
            if is_new:
                newly_created.append(notif)

    # IMPORTANT: Never dispatch Telegram messages automatically on routine frontend polling!
    # Only dispatch if explicitly requested AND user is authenticated AND there are genuinely new alerts.
    if allow_telegram_dispatch and user_id is not None and newly_created:
        try:
            from services.telegram_service import dispatch_consolidated_digest
            dispatch_consolidated_digest(db, newly_created, user_id=user_id)
        except Exception:
            pass

    return newly_created


def get_user_notifications(
    db: Session,
    user_id: Optional[int] = None,
    category: Optional[str] = None,
    limit: int = 30
) -> List[Dict[str, Any]]:
    """
    Fetches notifications for user (or public/demo if user_id is None).
    Updates in-app notifications silently WITHOUT triggering Telegram spam on every poll.
    """
    generate_smart_notifications(db, user_id, allow_telegram_dispatch=False)

    query = db.query(Notification)
    if user_id is not None:
        query = query.filter(Notification.user_id == user_id)
    else:
        query = query.filter(Notification.user_id.is_(None))

    if category and category != "all":
        query = query.filter(Notification.category == category)

    notifs = query.order_by(desc(Notification.created_at)).limit(limit).all()

    results = []
    for n in notifs:
        results.append({
            "id": n.id,
            "type": n.type,
            "category": n.category,
            "severity": n.severity,
            "title": n.title,
            "message": n.message,
            "ticker": n.ticker,
            "action_url": n.action_url,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "time_ago": format_time_ago(n.created_at)
        })

    return results


def get_unread_count(db: Session, user_id: Optional[int] = None) -> int:
    """Returns number of unread notifications for the given user."""
    query = db.query(Notification).filter(Notification.is_read == False)
    if user_id is not None:
        query = query.filter(Notification.user_id == user_id)
    else:
        query = query.filter(Notification.user_id.is_(None))
    return query.count()


def mark_notification_read(db: Session, notification_id: int, user_id: Optional[int] = None) -> bool:
    """Marks a single notification as read."""
    # Always scoped to the owner, so one user can never mark another user's notification
    query = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user_id)
    notif = query.first()
    if not notif:
        return False
    notif.is_read = True
    db.commit()
    return True


def mark_all_notifications_read(db: Session, user_id: Optional[int] = None) -> int:
    """Marks all notifications as read for the user."""
    query = db.query(Notification).filter(Notification.is_read == False)
    if user_id is not None:
        query = query.filter(Notification.user_id == user_id)
    else:
        query = query.filter(Notification.user_id.is_(None))
    count = query.update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return count


def format_time_ago(dt: Optional[datetime.datetime]) -> str:
    """Returns a friendly human-readable time ago string in Spanish."""
    if not dt:
        return "Recién"
    now = datetime.datetime.utcnow()
    diff = now - dt
    seconds = int(diff.total_seconds())

    if seconds < 60:
        return "Hace un momento"
    elif seconds < 3600:
        mins = seconds // 60
        return f"Hace {mins}m"
    elif seconds < 86400:
        hours = seconds // 3600
        return f"Hace {hours}h"
    else:
        days = seconds // 86400
        return f"Hace {days}d"
