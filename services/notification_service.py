import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_

from models import Notification, User, Portfolio, Position, MarketQuote, ExchangeRate
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
    dedup_hours: int = 4
) -> Optional[Notification]:
    """
    Inserts a notification only if an identical notification (by user, type, and ticker)
    has not been created in the last `dedup_hours`.
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
        # Update existing content and timestamp if message updated
        existing.title = title
        existing.message = message
        existing.severity = severity
        existing.created_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

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

    try:
        from services.telegram_service import send_notification_to_telegram
        send_notification_to_telegram(db, new_notif)
    except Exception:
        pass

    return new_notif

def generate_smart_notifications(db: Session, user_id: Optional[int] = None) -> List[Notification]:
    """
    Evaluates real-time financial triggers:
    1. FX Gap between BCV and USDT (antidevaluation alert)
    2. Tactical Portfolio Signals (Take Profit, Stop-loss, Concentration)
    3. Market Rallies & Dips (BVC and Popular Wall Street assets)
    """
    rates = get_latest_rates(db)
    gap = rates["gap"]
    bcv = rates["bcv"]
    usdt = rates["usdt"]

    notifications_generated = []

    # 1. Exchange Rate Gap Alert
    if gap >= 18.0:
        notif = get_or_create_notification(
            db=db,
            user_id=user_id,
            n_type="gap_warning_critical",
            category="market",
            severity="critical",
            title=f"⚠️ Brecha Cambiaria Crítica (+{gap:.1f}%)",
            message=f"El dólar paralelo/USDT cotiza a {usdt:,.2f} Bs vs BCV {bcv:,.2f} Bs (brecha de {gap:.1f}%). Se sugiere cobertura inmediata en renta variable o títulos dolarizados para evitar pérdida patrimonial.",
            action_url="#tab-board"
        )
        if notif:
            notifications_generated.append(notif)
    elif gap >= 12.0:
        notif = get_or_create_notification(
            db=db,
            user_id=user_id,
            n_type="gap_warning_moderate",
            category="market",
            severity="warning",
            title=f"⚡ Alerta de Brecha Cambiaria (+{gap:.1f}%)",
            message=f"La brecha entre USDT ({usdt:,.2f} Bs) y BCV ({bcv:,.2f} Bs) se ubica en +{gap:.1f}%. El mercado accionario local suele demorar 24h a 72h en ajustar precios, generando oportunidades de compra en descuento en dólares.",
            action_url="#tab-board"
        )
        if notif:
            notifications_generated.append(notif)

    # 2. Tactical Portfolio Signals (If user_id is provided or demo portfolio exists)
    portfolio = None
    if user_id is not None:
        portfolio = db.query(Portfolio).filter(Portfolio.user_id == user_id).first()
    else:
        portfolio = db.query(Portfolio).first()

    if portfolio:
        summary = get_portfolio_summary(db=db, bcv_rate=bcv, usdt_rate=usdt, portfolio_id=portfolio.id)
        positions = summary.get("positions", [])
        for pos in positions:
            ticker = pos.get("ticker")
            tac_sig = pos.get("tactical_signal", {})
            action = tac_sig.get("action")
            rule = tac_sig.get("signal")
            ret_usdt = float(pos.get("pnl_pct_usdt", 0.0))
            weight_pct = float(pos.get("weight_pct", 0.0))

            if action in ("VENDER", "REDUCIR") and rule in ("SELL_STRONG", "SELL_PARTIAL"):
                notif = get_or_create_notification(
                    db=db,
                    user_id=user_id,
                    n_type=f"tactical_sell_{ticker}",
                    category="tactical",
                    severity="success",
                    title=f"🎯 Toma de Ganancias Sugerida: {ticker}",
                    message=f"Tu posición en {ticker} alcanzó un rendimiento acumulado de {ret_usdt:+.1f}% en USDT. Se recomienda ejecutar venta parcial (30%-50%) para asegurar ganancias en moneda dura.",
                    ticker=ticker,
                    action_url="#tab-positions"
                )
                if notif:
                    notifications_generated.append(notif)
            elif action == "ROTAR":
                notif = get_or_create_notification(
                    db=db,
                    user_id=user_id,
                    n_type=f"tactical_rotate_{ticker}",
                    category="tactical",
                    severity="critical",
                    title=f"🔴 Alerta Stop-Loss / Rotación: {ticker}",
                    message=f"{ticker} acumula un desfase de {ret_usdt:+.1f}% frente a la devaluación. Se aconseja evaluar rotación hacia títulos con mayor liquidez o instrumentos de cobertura directa.",
                    ticker=ticker,
                    action_url="#tab-positions"
                )
                if notif:
                    notifications_generated.append(notif)
            elif rule == "REDUCE_CONCENTRATION":
                notif = get_or_create_notification(
                    db=db,
                    user_id=user_id,
                    n_type=f"tactical_concentration_{ticker}",
                    category="tactical",
                    severity="warning",
                    title=f"⚖️ Concentración Elevada: {ticker}",
                    message=f"{ticker} representa el {weight_pct:.1f}% de tu portafolio total. Considera redistribuir capital hacia otros sectores o Wall Street para mitigar riesgo específico.",
                    ticker=ticker,
                    action_url="#tab-positions"
                )
                if notif:
                    notifications_generated.append(notif)

    # 3. Market Movers (Quotes with strong intraday moves >= +4.0% or <= -4.0%)
    quotes = db.query(MarketQuote).all()
    for q in quotes:
        chg = float(q.change_pct or 0.0)
        if chg >= 4.0:
            notif = get_or_create_notification(
                db=db,
                user_id=user_id,
                n_type=f"market_rally_{q.ticker}",
                category="market",
                severity="success",
                title=f"🚀 Impulso Fuerte en Rueda: {q.ticker} (+{chg:.1f}%)",
                message=f"{q.ticker} cotiza en alza con +{chg:.1f}% hoy a {float(q.price_ves):,.2f} Bs.",
                ticker=q.ticker,
                action_url="#tab-board"
            )
            if notif:
                notifications_generated.append(notif)
        elif chg <= -4.0:
            notif = get_or_create_notification(
                db=db,
                user_id=user_id,
                n_type=f"market_dip_{q.ticker}",
                category="market",
                severity="warning",
                title=f"📉 Corrección Intradía: {q.ticker} ({chg:.1f}%)",
                message=f"{q.ticker} retrocede {chg:.1f}% en la rueda actual. Ventana táctica para acumulación escalonada si tus objetivos son a mediano plazo.",
                ticker=q.ticker,
                action_url="#tab-board"
            )
            if notif:
                notifications_generated.append(notif)

    return notifications_generated

def get_user_notifications(
    db: Session,
    user_id: Optional[int] = None,
    category: Optional[str] = None,
    limit: int = 30
) -> List[Dict[str, Any]]:
    """
    Fetches notifications for user (or public/demo if user_id is None).
    Automatically triggers smart notification generation first to ensure data is always fresh.
    """
    generate_smart_notifications(db, user_id)

    query = db.query(Notification)
    if user_id is not None:
        query = query.filter((Notification.user_id == user_id) | (Notification.user_id.is_(None)))
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
        query = query.filter((Notification.user_id == user_id) | (Notification.user_id.is_(None)))
    else:
        query = query.filter(Notification.user_id.is_(None))
    return query.count()

def mark_notification_read(db: Session, notification_id: int, user_id: Optional[int] = None) -> bool:
    """Marks a single notification as read."""
    query = db.query(Notification).filter(Notification.id == notification_id)
    if user_id is not None:
        query = query.filter((Notification.user_id == user_id) | (Notification.user_id.is_(None)))
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
        query = query.filter((Notification.user_id == user_id) | (Notification.user_id.is_(None)))
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
