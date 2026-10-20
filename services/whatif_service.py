import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from models import Portfolio, Position, Asset, MarketQuote, ExchangeRate
from services.portfolio_service import get_portfolio_summary

def simulate_financial_stress_scenario(
    portfolio_summary: Dict[str, Any],
    bcv_target: float,
    usdt_target: float,
    wall_street_shock_pct: float = 0.0,
    bvc_adjustment_rate: float = 0.85
) -> Dict[str, Any]:
    """
    Simulates portfolio behavior under severe exchange rate devaluation and/or global market shocks.
    
    Parameters:
    - portfolio_summary: Current computed portfolio dictionary
    - bcv_target: Projected Official BCV exchange rate (in Bs.)
    - usdt_target: Projected Parallel/USDT exchange rate (in Bs.)
    - wall_street_shock_pct: Projected price movement in US stocks (-20% to +20%)
    - bvc_adjustment_rate: How much Venezuelan stocks adjust to the dollar jump (0.0 = lag total, 0.85 = typical 85% adjustment, 1.0 = perfect 1:1 coverage)
    """
    current_bcv = float(portfolio_summary.get("exchange_rates", {}).get("bcv", 881.87))
    current_usdt = float(portfolio_summary.get("exchange_rates", {}).get("usdt", 1007.60))

    if current_bcv <= 0: current_bcv = 881.87
    if current_usdt <= 0: current_usdt = 1007.60

    # Calculate delta devaluations
    bcv_deval_pct = ((bcv_target - current_bcv) / current_bcv) * 100.0
    usdt_deval_pct = ((usdt_target - current_usdt) / current_usdt) * 100.0
    projected_gap_pct = ((usdt_target - bcv_target) / bcv_target) * 100.0 if bcv_target > 0 else 0.0

    current_totals = portfolio_summary.get("totals", {})
    curr_ves = float(current_totals.get("ves", {}).get("value", 0.0))
    curr_usd_bcv = float(current_totals.get("usd_bcv", {}).get("value", 0.0))
    curr_usdt = float(current_totals.get("usdt", {}).get("value", 0.0))

    cash_ves = float(portfolio_summary.get("cash_ves", 0.0))
    cash_usd = float(portfolio_summary.get("cash_usd", 0.0))

    # Project cash in new rates
    proj_cash_ves = cash_ves
    proj_cash_usd = cash_usd
    proj_cash_in_usdt = (cash_usd) + (cash_ves / usdt_target if usdt_target > 0 else 0.0)

    # What happens to raw bolívares without stocks?
    bank_cash_loss_usdt = (cash_ves / current_usdt) - (cash_ves / usdt_target) if usdt_target > 0 and current_usdt > 0 else 0.0
    bank_cash_loss_pct = (( (1 / usdt_target) - (1 / current_usdt) ) / (1 / current_usdt)) * 100.0 if current_usdt > 0 and usdt_target > 0 else 0.0

    positions = portfolio_summary.get("positions", [])
    simulated_positions = []

    proj_stocks_val_ves = 0.0
    proj_stocks_val_usd = 0.0
    proj_stocks_val_usdt = 0.0

    for pos in positions:
        ticker = pos.get("ticker")
        is_intl = pos.get("is_international", False)
        shares = float(pos.get("shares", 0.0))
        curr_price_ves = float(pos.get("current_price_ves", 0.0))
        curr_price_usd = float(pos.get("current_price_usd_bcv", 0.0))

        if is_intl:
            # Wall Street assets are priced in USD natively
            # Shock applies directly to USD price
            proj_price_usd = curr_price_usd * (1.0 + (wall_street_shock_pct / 100.0))
            proj_price_ves = proj_price_usd * bcv_target
            proj_price_usdt = (proj_price_ves / usdt_target) if usdt_target > 0 else proj_price_usd

            val_ves = shares * proj_price_ves
            val_usd = shares * proj_price_usd
            val_usdt = shares * proj_price_usdt
            
            coverage_behavior = "Preservación plena en USD (+ shock bursátil)"
        else:
            # Venezuelan stocks adjust partially or fully to the dollar jump
            # Price in Bs increases by (bcv_deval_pct * bvc_adjustment_rate)
            adjustment_multiplier = 1.0 + ((bcv_deval_pct / 100.0) * bvc_adjustment_rate)
            proj_price_ves = curr_price_ves * max(0.5, adjustment_multiplier)
            proj_price_usd = proj_price_ves / bcv_target if bcv_target > 0 else 0.0
            proj_price_usdt = proj_price_ves / usdt_target if usdt_target > 0 else 0.0

            val_ves = shares * proj_price_ves
            val_usd = shares * proj_price_usd
            val_usdt = shares * proj_price_usdt

            if bvc_adjustment_rate >= 0.95:
                coverage_behavior = "Cobertura casi total (1:1 con devaluación)"
            elif bvc_adjustment_rate >= 0.70:
                coverage_behavior = "Ajuste retardado a 72h (lag cambiario típico)"
            else:
                coverage_behavior = "Rezago severo (descuento temporal en dólares)"

        proj_stocks_val_ves += val_ves
        proj_stocks_val_usd += val_usd
        proj_stocks_val_usdt += val_usdt

        simulated_positions.append({
            "ticker": ticker,
            "name": pos.get("name"),
            "is_international": is_intl,
            "shares": shares,
            "current_price_ves": curr_price_ves,
            "projected_price_ves": round(proj_price_ves, 2),
            "projected_price_usd": round(proj_price_usd, 4),
            "projected_price_usdt": round(proj_price_usdt, 4),
            "projected_val_ves": round(val_ves, 2),
            "projected_val_usdt": round(val_usdt, 2),
            "coverage_behavior": coverage_behavior
        })

    # Total Projected Wealth
    total_proj_ves = proj_stocks_val_ves + proj_cash_ves
    total_proj_usd_bcv = proj_stocks_val_usd + proj_cash_usd + (proj_cash_ves / bcv_target if bcv_target > 0 else 0.0)
    total_proj_usdt = proj_stocks_val_usdt + proj_cash_in_usdt

    # Delta impacts
    delta_usdt = total_proj_usdt - curr_usdt
    delta_usdt_pct = ((total_proj_usdt - curr_usdt) / curr_usdt * 100.0) if curr_usdt > 0 else 0.0
    delta_ves = total_proj_ves - curr_ves
    delta_ves_pct = ((total_proj_ves - curr_ves) / curr_ves * 100.0) if curr_ves > 0 else 0.0

    # Protection Metric: How much purchasing power was preserved vs leaving everything in bank bolivares
    if curr_ves > 0:
        unprotected_scenario_usdt = curr_ves / usdt_target if usdt_target > 0 else 0.0
        protection_saved_usdt = total_proj_usdt - unprotected_scenario_usdt
    else:
        protection_saved_usdt = 0.0

    # Executive Verdict & AI Recommendation
    if delta_usdt >= 0:
        verdict_badge = "success"
        verdict_title = "🛡️ Cobertura Blindada: Patrimonio Preservado"
        verdict_summary = (
            f"Ante un salto del dólar a {bcv_target:,.2f} Bs (+{bcv_deval_pct:.1f}%), tu portafolio no solo "
            f"evita la devaluación sino que proyecta un valor de {total_proj_usdt:,.2f} USDT (+{delta_usdt_pct:+.2f}%). "
            f"Tus activos en renta variable y Wall Street absorberán el choque cambiario con alta eficiencia."
        )
    elif delta_usdt >= -5.0:
        verdict_badge = "warning"
        verdict_title = "⚡ Cobertura Parcial (Rezago Temporal)"
        verdict_summary = (
            f"El portafolio sufrirá una leve compresión transitoria de {delta_usdt_pct:.2f}% en USDT ({delta_usdt:,.2f} USDT) "
            f"debido al tiempo que demora la Bolsa de Caracas en reajustar precios en bolívares. No obstante, "
            f"logras salvar más de ${protection_saved_usdt:,.2f} USD que habrías perdido por completo dejando efectivo en el banco."
        )
    else:
        verdict_badge = "critical"
        verdict_title = "⚠️ Riesgo de Desfase por Rezago Cambiario"
        verdict_summary = (
            f"La combinación de alta devaluación (+{bcv_deval_pct:.1f}%) con ajuste lento de la BVC comprime tu patrimonio en "
            f"{delta_usdt_pct:.2f}% en moneda dura. Se recomienda balancear con mayor ponderación en activos de Wall Street "
            f"o empresas exportadoras con flujo directo en divisas."
        )

    return {
        "inputs": {
            "bcv_target": round(bcv_target, 2),
            "usdt_target": round(usdt_target, 2),
            "bcv_deval_pct": round(bcv_deval_pct, 2),
            "usdt_deval_pct": round(usdt_deval_pct, 2),
            "projected_gap_pct": round(projected_gap_pct, 2),
            "wall_street_shock_pct": round(wall_street_shock_pct, 2),
            "bvc_adjustment_rate": round(bvc_adjustment_rate, 2)
        },
        "current_wealth": {
            "ves": round(curr_ves, 2),
            "usd_bcv": round(curr_usd_bcv, 2),
            "usdt": round(curr_usdt, 2)
        },
        "projected_wealth": {
            "ves": round(total_proj_ves, 2),
            "usd_bcv": round(total_proj_usd_bcv, 2),
            "usdt": round(total_proj_usdt, 2)
        },
        "impact": {
            "delta_usdt": round(delta_usdt, 2),
            "delta_usdt_pct": round(delta_usdt_pct, 2),
            "delta_ves": round(delta_ves, 2),
            "delta_ves_pct": round(delta_ves_pct, 2),
            "protection_saved_usdt": round(protection_saved_usdt, 2),
            "bank_cash_loss_pct": round(bank_cash_loss_pct, 2)
        },
        "verdict": {
            "badge": verdict_badge,
            "title": verdict_title,
            "summary": verdict_summary
        },
        "simulated_positions": simulated_positions
    }

def generate_executive_report_data(
    db: Session,
    user_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Builds structured, comprehensive data for the printable Executive Wealth Statement.
    """
    rate_bcv_rec = db.query(ExchangeRate).filter(ExchangeRate.rate_type == "BCV").order_by(ExchangeRate.recorded_at.desc()).first()
    rate_usdt_rec = db.query(ExchangeRate).filter(ExchangeRate.rate_type == "USDT_BINANCE").order_by(ExchangeRate.recorded_at.desc()).first()

    bcv = float(rate_bcv_rec.rate_value) if rate_bcv_rec else 881.87
    usdt = float(rate_usdt_rec.rate_value) if rate_usdt_rec else 1007.60

    portfolio = None
    if user_id is not None:
        portfolio = db.query(Portfolio).filter(Portfolio.user_id == user_id).first()
    else:
        portfolio = db.query(Portfolio).first()

    if not portfolio:
        return {}

    summary = get_portfolio_summary(db=db, bcv_rate=bcv, usdt_rate=usdt, portfolio_id=portfolio.id)
    now = datetime.datetime.utcnow()

    # User identification
    user_name = "Inversionista KixInvert"
    user_broker = "KixBroker BVC"
    user_tier = "Plan Free"
    if user_id:
        from models import User
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user_name = user.full_name
            user_broker = user.broker or "KixBroker BVC"
            user_tier = "Plan PRO 👑" if user.subscription_tier == "pro" else "Plan Free"

    return {
        "statement_id": f"KIX-REP-{now.strftime('%Y%m%d')}-{portfolio.id:04d}",
        "generated_at": now.strftime("%d/%m/%Y %I:%M %p"),
        "investor": {
            "name": user_name,
            "broker": user_broker,
            "tier": user_tier
        },
        "rates": {
            "bcv": round(bcv, 4),
            "usdt": round(usdt, 4),
            "gap_pct": round(((usdt - bcv) / bcv) * 100, 2) if bcv > 0 else 0.0
        },
        "summary": summary
    }
