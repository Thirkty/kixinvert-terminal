from typing import Dict, Any, List
from sqlalchemy.orm import Session
from models import Portfolio, Position, Asset, MarketQuote

def compute_tactical_signal(
    pnl_pct_usdt: float,
    pnl_pct_ves: float,
    weight_pct: float,
    change_today_pct: float,
    brecha_pct: float,
    cash_weight_pct: float = 0.0
) -> Dict[str, Any]:
    """
    Computes actionable tactical signals (Cuándo Vender / Cuándo Comprar Más / Mantener / Rotar).
    """
    # 1. Take Profit Strong (P&L in real USDT >= +40%)
    if pnl_pct_usdt >= 40.0:
        return {
            "signal": "SELL_STRONG",
            "action": "VENDER",
            "type": "profit_strong",
            "label": f"Venta Fuerte (+{pnl_pct_usdt}% USDT)",
            "badge_color": "green",
            "badge_class": "badge-signal-sell-strong",
            "icon": "arrow-up-right",
            "recommendation": "Toma de Ganancias Fuerte",
            "action_text": "Vender 40% a 50% de la posición",
            "rationale": f"Rendimiento real sobresaliente (+{pnl_pct_usdt}% en USDT). Recomendado asegurar entre 40% y 60% de la ganancia vendiendo títulos para fondear liquidez o USDT."
        }

    # 2. Take Profit Moderate (P&L in real USDT >= +20%)
    if pnl_pct_usdt >= 20.0:
        return {
            "signal": "SELL_PARTIAL",
            "action": "VENDER",
            "type": "profit",
            "label": f"Toma de Ganancias (+{pnl_pct_usdt}% USDT)",
            "badge_color": "green",
            "badge_class": "badge-signal-sell",
            "icon": "dollar-sign",
            "recommendation": "Toma de Ganancias Parcial",
            "action_text": "Vender 25% a 35% de la posición",
            "rationale": f"Ganancia real neta de +{pnl_pct_usdt}% en dólares. Sugerido tomar beneficio parcial para rebalancear cartera o asegurar dólares."
        }

    # 3. High Concentration Alert (Asset represents >= 35% of total portfolio)
    if weight_pct >= 35.0:
        return {
            "signal": "REDUCE_CONCENTRATION",
            "action": "REDUCIR",
            "type": "warning",
            "label": f"Reducir por Concentración ({weight_pct}%)",
            "badge_color": "amber",
            "badge_class": "badge-signal-rebalance",
            "icon": "pie-chart",
            "recommendation": "Reducir Exposición",
            "action_text": "Podar posición para diversificar",
            "rationale": f"Este activo abarca el {weight_pct}% de tu capital total. Sobrepasa el límite sugerido de concentración prudencial (30%). Conviene diversificar."
        }

    # 4. Buy More / Currency Lag (Exchange rate gap >= 10% and Stock lag behind in Bs)
    if brecha_pct >= 10.0 and pnl_pct_ves <= 8.0 and pnl_pct_usdt >= -18.0:
        return {
            "signal": "BUY_LAG",
            "action": "COMPRAR",
            "type": "buy_lag",
            "label": "Invertir Más (Rezago Cambiario)",
            "badge_color": "blue",
            "badge_class": "badge-signal-buy-lag",
            "icon": "plus-circle",
            "recommendation": "Oportunidad de Compra (Rezago)",
            "action_text": "Acumular títulos a precio rezagado",
            "rationale": f"El precio en Bolívares muestra rezago ante el salto cambiario (brecha {brecha_pct}%). Oportunidad táctica antes del ajuste de mercado."
        }

    # 5. Buy More / Dip Opportunity (Intraday dip <= -3.0% on healthy asset)
    if change_today_pct <= -3.0 and pnl_pct_usdt >= -15.0:
        return {
            "signal": "BUY_DIP",
            "action": "COMPRAR",
            "type": "buy_dip",
            "label": f"Invertir Más (Retroceso {change_today_pct}%)",
            "badge_color": "blue",
            "badge_class": "badge-signal-buy-dip",
            "icon": "trending-down",
            "recommendation": "Comprar en Retroceso",
            "action_text": "Aprovechar caída para promediar costo",
            "rationale": f"Retroceso intradía ({change_today_pct}%). Si cuentas con liquidez disponible, permite mejorar tu precio promedio de compra."
        }

    # 6. Rotate / Severe Real Loss (P&L in USDT <= -22%)
    if pnl_pct_usdt <= -22.0:
        return {
            "signal": "ROTATE",
            "action": "ROTAR",
            "type": "danger",
            "label": f"Rotar / Stop-Loss ({pnl_pct_usdt}%)",
            "badge_color": "red",
            "badge_class": "badge-signal-rotate",
            "icon": "alert-triangle",
            "recommendation": "Rotar Posición",
            "action_text": "Evaluar rotación hacia títulos líquidos",
            "rationale": f"La devaluación cambiaria ha superado la apreciación del título ({pnl_pct_usdt}% en USDT). Evalúa rotar capital hacia emisores con mayor dinamismo."
        }

    # 7. Default: Hold (Healthy protection)
    return {
        "signal": "HOLD",
        "action": "MANTENER",
        "type": "neutral",
        "label": "Mantener (Hold Cobertura)",
        "badge_color": "neutral",
        "badge_class": "badge-signal-hold",
        "icon": "shield-check",
        "recommendation": "Mantener Posición",
        "action_text": "Continuar en cartera",
        "rationale": f"Posición en balance (+{pnl_pct_ves}% Bs / {pnl_pct_usdt}% USDT). Cumple su propósito de preservación de valor y cobertura."
    }

def get_portfolio_summary(db: Session, bcv_rate: float, usdt_rate: float, portfolio_id: int = None, user_id: int = None):
    """
    Computes full tri-monetary portfolio metrics:
    - Values in Bs (VES), USD (BCV), and USDT (Binance)
    - Profit & Loss (Nominal vs. Real)
    - Asset allocation weights (%)
    """
    portfolio = None
    if user_id is not None:
        portfolio = db.query(Portfolio).filter(Portfolio.user_id == user_id).first()
        if not portfolio:
            from models import User
            user = db.query(User).filter(User.id == user_id).first()
            p_name = f"Portafolio de {user.full_name}" if user else f"Portafolio #{user_id}"
            portfolio = Portfolio(
                user_id=user_id,
                name=p_name,
                cash_ves=10000.0,
                cash_usd=20.0
            )
            db.add(portfolio)
            db.commit()
            db.refresh(portfolio)
    elif portfolio_id is not None:
        portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()

    if not portfolio:
        portfolio = db.query(Portfolio).first()
        if not portfolio:
            # Create default portfolio if none exists
            portfolio = Portfolio(
                name="Portafolio Principal BVC",
                cash_ves=5000.0,
                cash_usd=10.0
            )
            db.add(portfolio)
            db.commit()
            db.refresh(portfolio)

    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    
    # Pre-fetch quotes and assets
    quotes_map = {q.ticker: q for q in db.query(MarketQuote).all()}
    assets_map = {a.ticker: a for a in db.query(Asset).all()}

    processed_positions = []
    total_val_ves = float(portfolio.cash_ves or 0.0)
    total_val_usd_bcv = float(portfolio.cash_usd or 0.0) + (float(portfolio.cash_ves or 0.0) / bcv_rate if bcv_rate > 0 else 0.0)
    total_val_usdt = float(portfolio.cash_usd or 0.0) + (float(portfolio.cash_ves or 0.0) / usdt_rate if usdt_rate > 0 else 0.0)

    total_cost_ves = 0.0
    total_cost_usd_bcv = 0.0
    total_cost_usdt = 0.0

    invested_val_ves = 0.0

    # First pass: calculate values and costs
    for pos in positions:
        shares = float(pos.shares)
        if shares <= 0:
            continue

        buy_price_ves = float(pos.avg_buy_price_ves)
        quote = quotes_map.get(pos.ticker)
        current_price_ves = float(quote.price_ves) if quote and float(quote.price_ves) > 0 else buy_price_ves

        # Historic exchange rates when bought (if saved, otherwise use current as fallback)
        h_bcv = float(pos.historic_rate_bcv) if pos.historic_rate_bcv else bcv_rate
        h_usdt = float(pos.historic_rate_usdt) if pos.historic_rate_usdt else usdt_rate

        # Tri-monetary prices
        current_price_usd_bcv = round(current_price_ves / bcv_rate, 4) if bcv_rate > 0 else 0.0
        current_price_usdt = round(current_price_ves / usdt_rate, 4) if usdt_rate > 0 else 0.0
        
        buy_price_usd_bcv = round(buy_price_ves / h_bcv, 4) if h_bcv > 0 else 0.0
        buy_price_usdt = round(buy_price_ves / h_usdt, 4) if h_usdt > 0 else 0.0

        # Totals for this position
        val_ves = shares * current_price_ves
        val_usd_bcv = shares * current_price_usd_bcv
        val_usdt = shares * current_price_usdt

        cost_ves = shares * buy_price_ves
        cost_usd_bcv = shares * buy_price_usd_bcv
        cost_usdt = shares * buy_price_usdt

        # P&L calculations
        pnl_ves = val_ves - cost_ves
        pnl_pct_ves = round((pnl_ves / cost_ves) * 100, 2) if cost_ves > 0 else 0.0

        pnl_usd_bcv = val_usd_bcv - cost_usd_bcv
        pnl_pct_usd_bcv = round((pnl_usd_bcv / cost_usd_bcv) * 100, 2) if cost_usd_bcv > 0 else 0.0

        pnl_usdt = val_usdt - cost_usdt
        pnl_pct_usdt = round((pnl_usdt / cost_usdt) * 100, 2) if cost_usdt > 0 else 0.0

        # Accumulate
        total_val_ves += val_ves
        total_val_usd_bcv += val_usd_bcv
        total_val_usdt += val_usdt
        invested_val_ves += val_ves

        total_cost_ves += cost_ves
        total_cost_usd_bcv += cost_usd_bcv
        total_cost_usdt += cost_usdt

        asset_info = assets_map.get(pos.ticker)
        market = (asset_info.market if asset_info and asset_info.market else "BVC").upper()
        is_intl = (market != "BVC")
        curr = (asset_info.currency if asset_info and asset_info.currency else ("USD" if is_intl else "VES")).upper()

        processed_positions.append({
            "id": pos.id,
            "ticker": pos.ticker,
            "name": asset_info.name if asset_info else pos.ticker,
            "sector": asset_info.sector if asset_info else ("Internacional / Wall Street" if is_intl else "Acción BVC"),
            "market": market,
            "currency": curr,
            "is_international": is_intl,
            "shares": shares,
            # Prices
            "current_price_ves": round(current_price_ves, 2),
            "current_price_usd_bcv": round(current_price_usd_bcv, 4),
            "current_price_usdt": round(current_price_usdt, 4),
            "buy_price_ves": round(buy_price_ves, 2),
            "buy_price_usd_bcv": round(buy_price_usd_bcv, 4),
            "buy_price_usdt": round(buy_price_usdt, 4),
            # Values
            "val_ves": round(val_ves, 2),
            "val_usd_bcv": round(val_usd_bcv, 2),
            "val_usdt": round(val_usdt, 2),
            # P&L
            "pnl_ves": round(pnl_ves, 2),
            "pnl_pct_ves": pnl_pct_ves,
            "pnl_usd_bcv": round(pnl_usd_bcv, 2),
            "pnl_pct_usd_bcv": pnl_pct_usd_bcv,
            "pnl_usdt": round(pnl_usdt, 2),
            "pnl_pct_usdt": pnl_pct_usdt,
            "change_today_pct": float(quote.change_pct) if quote else 0.0,
            "weight_pct": 0.0 # Will compute in second pass
        })

    # Cash weights
    cash_ves = float(portfolio.cash_ves or 0.0)
    cash_usd = float(portfolio.cash_usd or 0.0)
    cash_weight_pct = round((cash_ves / total_val_ves) * 100, 2) if total_val_ves > 0 else 0.0

    # Second pass: calculate percentage weights & tactical buy/sell signals
    brecha_pct = round(((usdt_rate - bcv_rate) / bcv_rate) * 100, 2) if bcv_rate > 0 else 0.0

    sell_signals_count = 0
    buy_signals_count = 0
    hold_signals_count = 0
    rotate_signals_count = 0

    for item in processed_positions:
        item["weight_pct"] = round((item["val_ves"] / total_val_ves) * 100, 2) if total_val_ves > 0 else 0.0
        signal = compute_tactical_signal(
            pnl_pct_usdt=item["pnl_pct_usdt"],
            pnl_pct_ves=item["pnl_pct_ves"],
            weight_pct=item["weight_pct"],
            change_today_pct=item.get("change_today_pct", 0.0),
            brecha_pct=brecha_pct,
            cash_weight_pct=cash_weight_pct
        )
        item["tactical_signal"] = signal
        
        if signal["action"] in ("VENDER", "REDUCIR"):
            sell_signals_count += 1
        elif signal["action"] == "COMPRAR":
            buy_signals_count += 1
        elif signal["action"] == "ROTAR":
            rotate_signals_count += 1
        else:
            hold_signals_count += 1

    tactical_summary = {
        "sell_signals_count": sell_signals_count,
        "buy_signals_count": buy_signals_count,
        "hold_signals_count": hold_signals_count,
        "rotate_signals_count": rotate_signals_count,
        "brecha_pct": brecha_pct,
        "has_urgent_action": (sell_signals_count > 0 or buy_signals_count > 0 or rotate_signals_count > 0)
    }

    # Sort by value descending
    processed_positions.sort(key=lambda x: x["val_ves"], reverse=True)

    # Global Portfolio P&L
    pnl_total_ves = total_val_ves - (total_cost_ves + cash_ves)
    pnl_total_pct_ves = round((pnl_total_ves / total_cost_ves) * 100, 2) if total_cost_ves > 0 else 0.0

    pnl_total_usd_bcv = total_val_usd_bcv - (total_cost_usd_bcv + cash_usd + (cash_ves / bcv_rate if bcv_rate > 0 else 0.0))
    pnl_total_pct_usd_bcv = round((pnl_total_usd_bcv / total_cost_usd_bcv) * 100, 2) if total_cost_usd_bcv > 0 else 0.0

    pnl_total_usdt = total_val_usdt - (total_cost_usdt + cash_usd + (cash_ves / usdt_rate if usdt_rate > 0 else 0.0))
    pnl_total_pct_usdt = round((pnl_total_usdt / total_cost_usdt) * 100, 2) if total_cost_usdt > 0 else 0.0

    # Best and worst performers by USDT (real return)
    best_asset = max(processed_positions, key=lambda x: x["pnl_pct_usdt"]) if processed_positions else None
    worst_asset = min(processed_positions, key=lambda x: x["pnl_pct_usdt"]) if processed_positions else None

    invested_val_usd_bcv = round(invested_val_ves / bcv_rate, 2) if bcv_rate > 0 else 0.0
    invested_val_usdt = round(invested_val_ves / usdt_rate, 2) if usdt_rate > 0 else 0.0

    # Market breakdown (BVC Caracas vs Wall Street / International)
    bvc_positions = [p for p in processed_positions if p.get("market") == "BVC"]
    intl_positions = [p for p in processed_positions if p.get("market") != "BVC"]

    bvc_cost_ves = sum(p["shares"] * p["buy_price_ves"] for p in bvc_positions)
    bvc_val_ves = sum(p["val_ves"] for p in bvc_positions)
    bvc_pnl_ves = bvc_val_ves - bvc_cost_ves
    bvc_pnl_pct_ves = round((bvc_pnl_ves / bvc_cost_ves) * 100, 2) if bvc_cost_ves > 0 else 0.0

    bvc_cost_usd = sum(p["shares"] * p["buy_price_usd_bcv"] for p in bvc_positions)
    bvc_val_usd = round(bvc_val_ves / bcv_rate, 2) if bcv_rate > 0 else 0.0
    bvc_pnl_usd = bvc_val_usd - bvc_cost_usd
    bvc_pnl_pct_usd = round((bvc_pnl_usd / bvc_cost_usd) * 100, 2) if bvc_cost_usd > 0 else 0.0

    bvc_cost_usdt = sum(p["shares"] * p["buy_price_usdt"] for p in bvc_positions)
    bvc_val_usdt = round(bvc_val_ves / usdt_rate, 2) if usdt_rate > 0 else 0.0
    bvc_pnl_usdt = bvc_val_usdt - bvc_cost_usdt
    bvc_pnl_pct_usdt = round((bvc_pnl_usdt / bvc_cost_usdt) * 100, 2) if bvc_cost_usdt > 0 else 0.0

    # International (Wall Street) Sub-Totals (Natively evaluated in USD)
    intl_cost_usd = sum(p["shares"] * p["buy_price_usd_bcv"] for p in intl_positions)
    intl_val_usd = sum(p["val_usd_bcv"] for p in intl_positions)
    intl_pnl_usd = intl_val_usd - intl_cost_usd
    intl_pnl_pct_usd = round((intl_pnl_usd / intl_cost_usd) * 100, 2) if intl_cost_usd > 0 else 0.0

    intl_cost_ves = sum(p["shares"] * p["buy_price_ves"] for p in intl_positions)
    intl_val_ves = sum(p["val_ves"] for p in intl_positions)
    intl_pnl_ves = intl_val_ves - intl_cost_ves
    intl_pnl_pct_ves = round((intl_pnl_ves / intl_cost_ves) * 100, 2) if intl_cost_ves > 0 else 0.0

    intl_cost_usdt = sum(p["shares"] * p["buy_price_usdt"] for p in intl_positions)
    intl_val_usdt = sum(p["val_usdt"] for p in intl_positions)
    intl_pnl_usdt = intl_val_usdt - intl_cost_usdt
    intl_pnl_pct_usdt = round((intl_pnl_usdt / intl_cost_usdt) * 100, 2) if intl_cost_usdt > 0 else 0.0

    total_stocks_ves = bvc_val_ves + intl_val_ves
    bvc_count = len(bvc_positions)
    intl_count = len(intl_positions)

    market_breakdown = {
        "bvc_val_ves": round(bvc_val_ves, 2),
        "intl_val_ves": round(intl_val_ves, 2),
        "bvc_val_usd": bvc_val_usd,
        "intl_val_usd": round(intl_val_usd, 2),
        "bvc_pct": round((bvc_val_ves / total_stocks_ves) * 100, 2) if total_stocks_ves > 0 else 0.0,
        "intl_pct": round((intl_val_ves / total_stocks_ves) * 100, 2) if total_stocks_ves > 0 else 0.0,
        "bvc_count": bvc_count,
        "intl_count": intl_count,
        "has_international": (intl_count > 0)
    }

    bvc_summary = {
        "positions": bvc_positions,
        "count": bvc_count,
        "totals": {
            "ves": {"value": round(bvc_val_ves, 2), "cost": round(bvc_cost_ves, 2), "pnl": round(bvc_pnl_ves, 2), "pnl_pct": bvc_pnl_pct_ves},
            "usd_bcv": {"value": round(bvc_val_usd, 2), "cost": round(bvc_cost_usd, 2), "pnl": round(bvc_pnl_usd, 2), "pnl_pct": bvc_pnl_pct_usd},
            "usdt": {"value": round(bvc_val_usdt, 2), "cost": round(bvc_cost_usdt, 2), "pnl": round(bvc_pnl_usdt, 2), "pnl_pct": bvc_pnl_pct_usdt}
        }
    }

    intl_summary = {
        "positions": intl_positions,
        "count": intl_count,
        "totals": {
            "usd": {"value": round(intl_val_usd, 2), "cost": round(intl_cost_usd, 2), "pnl": round(intl_pnl_usd, 2), "pnl_pct": intl_pnl_pct_usd},
            "ves": {"value": round(intl_val_ves, 2), "cost": round(intl_cost_ves, 2), "pnl": round(intl_pnl_ves, 2), "pnl_pct": intl_pnl_pct_ves},
            "usdt": {"value": round(intl_val_usdt, 2), "cost": round(intl_cost_usdt, 2), "pnl": round(intl_pnl_usdt, 2), "pnl_pct": intl_pnl_pct_usdt}
        }
    }

    return {
        "portfolio_id": portfolio.id,
        "portfolio_name": portfolio.name,
        "cash_ves": round(cash_ves, 2),
        "cash_usd": round(cash_usd, 2),
        "cash_weight_pct": cash_weight_pct,
        "totals": {
            "ves": {
                "value": round(total_val_ves, 2),
                "stocks_value": round(invested_val_ves, 2),
                "cost": round(total_cost_ves, 2),
                "pnl": round(pnl_total_ves, 2),
                "pnl_pct": pnl_total_pct_ves
            },
            "usd_bcv": {
                "value": round(total_val_usd_bcv, 2),
                "stocks_value": invested_val_usd_bcv,
                "cost": round(total_cost_usd_bcv, 2),
                "pnl": round(pnl_total_usd_bcv, 2),
                "pnl_pct": pnl_total_pct_usd_bcv
            },
            "usdt": {
                "value": round(total_val_usdt, 2),
                "stocks_value": invested_val_usdt,
                "cost": round(total_cost_usdt, 2),
                "pnl": round(pnl_total_usdt, 2),
                "pnl_pct": pnl_total_pct_usdt
            }
        },
        "tactical_summary": tactical_summary,
        "market_breakdown": market_breakdown,
        "bvc_summary": bvc_summary,
        "intl_summary": intl_summary,
        "best_asset": best_asset,
        "worst_asset": worst_asset,
        "positions": processed_positions
    }
