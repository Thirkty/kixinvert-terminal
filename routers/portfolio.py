"""Portafolio: posiciones, compras, ventas, efectivo y simulador What-If."""
import datetime
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db import get_db
from models import User, Portfolio, Position, Asset, Transaction, CashMovement
from services.rates_service import fetch_current_rates
from services.portfolio_service import get_portfolio_summary
import services.whatif_service as whatif_service
import security
from deps import limiter, log_audit, get_current_user, get_optional_current_user, get_or_create_portfolio, parse_client_date

logger = logging.getLogger("kixinvert")
router = APIRouter()


class PositionCreate(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=12)
    shares: float = Field(..., gt=0, le=100_000_000)
    buy_price: float = Field(..., gt=0, le=100_000_000_000)
    currency: str = Field("VES", pattern=r"^(VES|USD)$")
    deduct_from_cash: Optional[bool] = Field(True, description="Liquidar automáticamente del saldo disponible en efectivo")
    broker_commission: Optional[float] = Field(0.0, ge=0)
    broker_iva: Optional[float] = Field(0.0, ge=0)
    broker_registry_fee: Optional[float] = Field(0.0, ge=0)
    net_total_amount: Optional[float] = Field(None, ge=0)
    execution_date: Optional[str] = Field(None, max_length=30)
    notes: Optional[str] = Field(None, max_length=200)

class PositionUpdate(BaseModel):
    shares: float = Field(..., gt=0, le=100_000_000)
    buy_price: float = Field(..., gt=0, le=100_000_000_000)
    adjust_cash: Optional[bool] = Field(False, description="Ajustar la diferencia del costo en el saldo en efectivo disponible")
    notes: Optional[str] = Field(None, max_length=200)

class PositionSell(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=12)
    shares_to_sell: float = Field(..., gt=0, le=100_000_000)
    sell_price: float = Field(..., gt=0, le=100_000_000_000)
    currency: str = Field("VES", pattern=r"^(VES|USD)$")
    credit_to_cash: Optional[bool] = Field(True, description="Acreditar automáticamente al saldo de efectivo disponible")
    broker_commission: Optional[float] = Field(0.0, ge=0)
    broker_iva: Optional[float] = Field(0.0, ge=0)
    broker_registry_fee: Optional[float] = Field(0.0, ge=0)
    net_total_amount: Optional[float] = Field(None, ge=0)
    execution_date: Optional[str] = Field(None, max_length=30)
    notes: Optional[str] = Field(None, max_length=200)

class CashDepositRequest(BaseModel):
    amount: float = Field(..., gt=0, le=1_000_000_000_000)
    currency: str = Field("VES", pattern=r"^(VES|USD)$")
    date: Optional[str] = Field(None, max_length=30)
    concept: Optional[str] = Field("Aporte de capital para inversión", max_length=150)
    reference: Optional[str] = Field(None, max_length=100)

class CashUpdate(BaseModel):
    cash_ves: float = Field(..., ge=0, le=1_000_000_000_000)
    cash_usd: float = Field(..., ge=0, le=1_000_000_000)


class WhatIfSimulateRequest(BaseModel):
    bcv_target: float = Field(..., gt=0, le=100_000_000)
    usdt_target: float = Field(..., gt=0, le=100_000_000)
    wall_street_shock_pct: Optional[float] = Field(0.0, ge=-50.0, le=100.0)
    bvc_adjustment_rate: Optional[float] = Field(0.85, ge=0.0, le=1.5)


@router.get("/api/portfolio")
async def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rates = await fetch_current_rates(db)

    # Phase 3: Sync international stocks quotes for active holdings
    try:
        from services.international_service import sync_all_portfolio_international_quotes
        sync_all_portfolio_international_quotes(db, rates["bcv"])
    except Exception as e:
        logger.error(f"Error syncing international quotes: {e}")

    # ANTI-IDOR: strictly isolated by current_user.id
    portfolio = get_or_create_portfolio(db, current_user)
    summary = get_portfolio_summary(db, rates["bcv"], rates["usdt"], portfolio_id=portfolio.id, user_id=current_user.id)

    summary["rates"] = rates
    return summary

@router.post("/api/positions")
@limiter.limit("30/minute")
async def add_position(
    item: PositionCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Sanitize ticker symbol
    ticker = security.sanitize_ticker(item.ticker)
    if not ticker:
        raise HTTPException(status_code=400, detail="Símbolo de acción inválido.")

    rates = await fetch_current_rates(db)
    bcv = rates["bcv"]
    usdt = rates["usdt"]

    # Phase 3: Detect if international Wall Street asset
    from services.international_service import (
        is_international_ticker,
        get_asset_metadata,
        sync_international_market_quote
    )
    is_intl = is_international_ticker(ticker) or item.currency.upper() == "USD"
    meta = get_asset_metadata(ticker) if is_intl else None

    # ANTI-IDOR: strictly target current user's portfolio
    portfolio = get_or_create_portfolio(db, current_user)

    buy_price_ves = item.buy_price * bcv if item.currency.upper() == "USD" else item.buy_price

    # Ensure asset exists in catalogue
    asset = db.query(Asset).filter(Asset.ticker == ticker).first()
    if not asset:
        asset = Asset(
            ticker=ticker,
            name=meta["name"] if meta else ticker,
            market=meta["market"] if meta else "BVC",
            currency="USD" if is_intl else "VES",
            sector=meta["sector"] if meta else "Acción BVC"
        )
        db.add(asset)
        db.commit()
    elif is_intl and asset.market == "BVC":
        asset.market = meta["market"] if meta else "US"
        asset.currency = "USD"
        if meta and meta.get("name"):
            asset.name = meta["name"]
        db.commit()

    # Pre-sync market quote for international asset so current price is immediately accurate
    if is_intl:
        try:
            sync_international_market_quote(db, ticker, bcv)
        except Exception as e:
            logger.warning(f"Could not pre-sync international quote for {ticker}: {e}")

    exec_date = parse_client_date(item.execution_date)

    # Reject purchases the available cash can't cover (before touching the position)
    if item.deduct_from_cash:
        pre_fees_ves = float(item.broker_commission or 0.0) + float(item.broker_iva or 0.0) + float(item.broker_registry_fee or 0.0)
        if is_intl or item.currency.upper() == "USD":
            pre_cost = float(item.net_total_amount) if (item.net_total_amount and item.net_total_amount > 0) else (item.shares * item.buy_price + (pre_fees_ves / bcv if bcv > 0 else 0.0))
            available, label = float(portfolio.cash_usd or 0.0), "${:,.2f}"
        else:
            pre_cost = float(item.net_total_amount) if (item.net_total_amount and item.net_total_amount > 0) else (item.shares * buy_price_ves + pre_fees_ves)
            available, label = float(portfolio.cash_ves or 0.0), "Bs {:,.2f}"
        if pre_cost > available + 0.005:
            raise HTTPException(
                status_code=400,
                detail=f"Efectivo insuficiente: la compra cuesta {label.format(pre_cost)} y tu saldo disponible es {label.format(available)}. "
                       "Ajusta tu saldo o desmarca 'Liquidar del efectivo'."
            )

    # Atomicity: add or average down existing position
    existing_pos = db.query(Position).filter(
        Position.portfolio_id == portfolio.id,
        Position.ticker == ticker
    ).first()

    if existing_pos:
        total_shares = float(existing_pos.shares) + item.shares
        avg_price = (
            (float(existing_pos.shares) * float(existing_pos.avg_buy_price_ves)) +
            (item.shares * buy_price_ves)
        ) / total_shares
        existing_pos.shares = total_shares
        existing_pos.avg_buy_price_ves = avg_price
    else:
        new_pos = Position(
            portfolio_id=portfolio.id,
            ticker=ticker,
            shares=item.shares,
            avg_buy_price_ves=buy_price_ves,
            historic_rate_bcv=bcv,
            historic_rate_usdt=usdt,
            created_at=exec_date
        )
        db.add(new_pos)

    # Automatic Cash Liquidation & Cash Ledger Recording
    fees_ves = float(item.broker_commission or 0.0) + float(item.broker_iva or 0.0) + float(item.broker_registry_fee or 0.0)
    if is_intl or item.currency.upper() == "USD":
        fees_currency = fees_ves / bcv if bcv > 0 else 0.0
    else:
        fees_currency = fees_ves

    if item.deduct_from_cash:
        if is_intl or item.currency.upper() == "USD":
            gross_usd = item.shares * item.buy_price
            cost_usd = float(item.net_total_amount) if (item.net_total_amount and item.net_total_amount > 0) else (gross_usd + fees_currency)
            new_cash_usd = max(0.0, float(portfolio.cash_usd) - cost_usd)
            portfolio.cash_usd = new_cash_usd
            cm = CashMovement(
                portfolio_id=portfolio.id,
                movement_type="BUY_STOCK",
                currency="USD",
                amount=cost_usd,
                balance_after=new_cash_usd,
                concept=f"Liquidación compra {item.shares:,.0f} acc {ticker} (Comisiones: ${fees_currency:,.2f})",
                movement_date=exec_date
            )
            db.add(cm)
        else:
            gross_ves = item.shares * buy_price_ves
            cost_ves = float(item.net_total_amount) if (item.net_total_amount and item.net_total_amount > 0) else (gross_ves + fees_ves)
            new_cash_ves = max(0.0, float(portfolio.cash_ves) - cost_ves)
            portfolio.cash_ves = new_cash_ves
            cm = CashMovement(
                portfolio_id=portfolio.id,
                movement_type="BUY_STOCK",
                currency="VES",
                amount=cost_ves,
                balance_after=new_cash_ves,
                concept=f"Liquidación compra {item.shares:,.0f} acc {ticker} (Comisiones/IVA: Bs {fees_ves:,.2f})",
                movement_date=exec_date
            )
            db.add(cm)

    # Record trade in transactions ledger
    tx = Transaction(
        portfolio_id=portfolio.id,
        ticker=ticker,
        tx_type="BUY",
        shares=item.shares,
        price_ves=buy_price_ves,
        fee_ves=fees_ves,
        rate_bcv=bcv,
        rate_usdt=usdt,
        notes=item.notes or f"Compra de {item.shares:,.0f} acc {ticker} (Gastos operacionales: Bs {fees_ves:,.2f})",
        executed_at=exec_date
    )
    db.add(tx)

    db.commit()

    log_audit(
        db,
        "BUY_POSITION",
        user_id=current_user.id,
        request=request,
        details=f"Added {item.shares} shares of {ticker} @ {buy_price_ves:.2f} VES (Fees: {fees_ves:.2f} VES)"
    )

    return {
        "success": True,
        "message": f"Posición {ticker} registrada con éxito. Saldo en efectivo liquidado: Bs {float(portfolio.cash_ves):,.2f}",
        "cash_ves": float(portfolio.cash_ves),
        "cash_usd": float(portfolio.cash_usd)
    }

@router.put("/api/positions/{position_id}")
@limiter.limit("30/minute")
def update_position(
    position_id: int,
    item: PositionUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # STRICT ANTI-IDOR: verify ownership
    pos = db.query(Position).join(Portfolio).filter(
        Position.id == position_id,
        Portfolio.user_id == current_user.id
    ).first()

    if not pos:
        raise HTTPException(
            status_code=404,
            detail="Posición no encontrada o no pertenece a tu portafolio."
        )

    portfolio = pos.portfolio
    old_shares = float(pos.shares)
    old_price = float(pos.avg_buy_price_ves)
    old_total_cost = old_shares * old_price

    new_shares = float(item.shares)
    new_price = float(item.buy_price)
    new_total_cost = new_shares * new_price

    # Optional cash balance adjustment (e.g., if user added 150 shares too many and wants cash refunded)
    if item.adjust_cash and portfolio:
        diff = old_total_cost - new_total_cost
        available = float(portfolio.cash_ves or 0.0)
        if diff < 0 and -diff > available + 0.005:
            raise HTTPException(
                status_code=400,
                detail=f"Efectivo insuficiente: el ajuste cuesta Bs {-diff:,.2f} y tu saldo disponible es Bs {available:,.2f}."
            )
        if abs(diff) > 0.0001:
            new_cash = available + diff
            portfolio.cash_ves = new_cash
            cm = CashMovement(
                portfolio_id=portfolio.id,
                movement_type="DEPOSIT" if diff > 0 else "BUY_STOCK",
                currency="VES",
                amount=abs(diff),
                balance_after=new_cash,
                concept=f"Ajuste por edición de {pos.ticker} ({old_shares:,.0f} -> {new_shares:,.0f} acc)",
                movement_date=datetime.datetime.utcnow()
            )
            db.add(cm)

    pos.shares = new_shares
    pos.avg_buy_price_ves = new_price
    db.commit()

    log_audit(
        db,
        "UPDATE_POSITION",
        user_id=current_user.id,
        request=request,
        details=f"Updated {pos.ticker}: {old_shares} -> {new_shares} shares, price {old_price:.2f} -> {new_price:.2f} VES"
    )

    return {
        "success": True,
        "message": f"Posición en {pos.ticker} actualizada correctamente ({new_shares:,.0f} acciones a Bs {new_price:,.2f})",
        "cash_ves": float(portfolio.cash_ves) if portfolio else 0.0,
        "cash_usd": float(portfolio.cash_usd) if portfolio else 0.0
    }

@router.post("/api/positions/sell")
@limiter.limit("30/minute")
async def sell_position(
    item: PositionSell,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticker = security.sanitize_ticker(item.ticker)
    if not ticker:
        raise HTTPException(status_code=400, detail="Símbolo de acción inválido.")

    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portafolio no encontrado.")

    pos = db.query(Position).filter(
        Position.portfolio_id == portfolio.id,
        Position.ticker == ticker
    ).first()

    if not pos:
        raise HTTPException(status_code=404, detail=f"No posees acciones de {ticker} en tu portafolio.")

    current_shares = float(pos.shares)
    if item.shares_to_sell > current_shares + 0.0001:
        raise HTTPException(
            status_code=400,
            detail=f"No puedes vender {item.shares_to_sell:,.0f} acciones. Tu saldo disponible es de {current_shares:,.0f} acciones."
        )

    rates = await fetch_current_rates(db)
    bcv = rates["bcv"]
    usdt = rates["usdt"]

    is_usd = item.currency.upper() == "USD"
    sell_price_ves = item.sell_price * bcv if is_usd else item.sell_price
    gross_ves = item.shares_to_sell * sell_price_ves

    # Mercosur / Broker commissions breakdown
    comm_ves = float(item.broker_commission or 0.0) * (bcv if is_usd else 1.0)
    iva_ves = float(item.broker_iva or 0.0) * (bcv if is_usd else 1.0)
    fees_other_ves = float(item.broker_registry_fee or 0.0) * (bcv if is_usd else 1.0)
    total_fees_ves = comm_ves + iva_ves + fees_other_ves

    if item.net_total_amount is not None and item.net_total_amount > 0:
        net_ves = float(item.net_total_amount) * (bcv if is_usd else 1.0)
    else:
        net_ves = max(0.0, gross_ves - total_fees_ves)

    # Realized PnL vs average purchase price
    cost_basis_unit = float(pos.avg_buy_price_ves)
    cost_basis_sold = item.shares_to_sell * cost_basis_unit
    realized_pnl_ves = net_ves - cost_basis_sold

    # Update or close position
    remaining_shares = max(0.0, current_shares - item.shares_to_sell)
    if remaining_shares <= 0.0001:
        db.delete(pos)
    else:
        pos.shares = remaining_shares

    exec_date = parse_client_date(item.execution_date)

    # Credit proceeds to cash balance if requested
    if item.credit_to_cash:
        if is_usd:
            net_usd = net_ves / bcv if bcv > 0 else 0.0
            new_cash_usd = float(portfolio.cash_usd or 0.0) + net_usd
            portfolio.cash_usd = new_cash_usd
            cm = CashMovement(
                portfolio_id=portfolio.id,
                movement_type="SELL_STOCK",
                currency="USD",
                amount=net_usd,
                balance_after=new_cash_usd,
                concept=f"Liquidación venta {item.shares_to_sell:,.0f} acc {ticker} (Neto: ${net_usd:,.2f})",
                movement_date=exec_date
            )
            db.add(cm)
        else:
            new_cash_ves = float(portfolio.cash_ves or 0.0) + net_ves
            portfolio.cash_ves = new_cash_ves
            cm = CashMovement(
                portfolio_id=portfolio.id,
                movement_type="SELL_STOCK",
                currency="VES",
                amount=net_ves,
                balance_after=new_cash_ves,
                concept=f"Liquidación venta {item.shares_to_sell:,.0f} acc {ticker} (Neto: Bs {net_ves:,.2f})",
                movement_date=exec_date
            )
            db.add(cm)

    # Record trade in transactions table
    tx = Transaction(
        portfolio_id=portfolio.id,
        ticker=ticker,
        tx_type="SELL",
        shares=item.shares_to_sell,
        price_ves=sell_price_ves,
        fee_ves=total_fees_ves,
        rate_bcv=bcv,
        rate_usdt=usdt,
        notes=item.notes or f"Venta de {item.shares_to_sell:,.0f} acc {ticker} (Neto: Bs {net_ves:,.2f}, PnL: Bs {realized_pnl_ves:,.2f})",
        executed_at=exec_date
    )
    db.add(tx)
    db.commit()

    log_audit(
        db,
        "SELL_POSITION",
        user_id=current_user.id,
        request=request,
        details=f"Sold {item.shares_to_sell} shares of {ticker} @ {sell_price_ves:.2f} VES (Net: {net_ves:.2f} VES, PnL: {realized_pnl_ves:.2f} VES)"
    )

    return {
        "success": True,
        "message": f"Venta de {item.shares_to_sell:,.0f} {ticker} ejecutada con éxito. Monto neto acreditado: Bs {net_ves:,.2f}",
        "remaining_shares": remaining_shares,
        "gross_ves": round(gross_ves, 2),
        "total_fees_ves": round(total_fees_ves, 2),
        "net_ves": round(net_ves, 2),
        "realized_pnl_ves": round(realized_pnl_ves, 2),
        "cash_ves": float(portfolio.cash_ves or 0.0),
        "cash_usd": float(portfolio.cash_usd or 0.0)
    }


@router.delete("/api/positions/{position_id}")
@limiter.limit("30/minute")
def delete_position(
    position_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # STRICT ANTI-IDOR: Joins Portfolio and asserts ownership by current_user
    pos = db.query(Position).join(Portfolio).filter(
        Position.id == position_id,
        Portfolio.user_id == current_user.id
    ).first()

    if not pos:
        raise HTTPException(
            status_code=404,
            detail="Posición no encontrada o no pertenece a tu portafolio."
        )

    ticker = pos.ticker
    shares = float(pos.shares)
    db.delete(pos)
    db.commit()

    log_audit(
        db,
        "CLOSE_POSITION",
        user_id=current_user.id,
        request=request,
        details=f"Deleted position {ticker} ({shares} shares)"
    )

    return {"success": True, "message": f"Posición {ticker} eliminada con éxito de tu portafolio"}

@router.put("/api/portfolio/cash")
@limiter.limit("20/minute")
def update_cash(
    item: CashUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ANTI-IDOR: Always target current_user's portfolio
    port = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not port:
        raise HTTPException(status_code=404, detail="Portafolio no encontrado.")

    port.cash_ves = item.cash_ves
    port.cash_usd = item.cash_usd
    db.commit()

    log_audit(
        db,
        "CASH_UPDATE",
        user_id=current_user.id,
        request=request,
        details=f"Updated cash balance: VES {item.cash_ves:,.2f} | USD {item.cash_usd:,.2f}"
    )

    return {"success": True, "message": "Saldos de efectivo actualizados con éxito"}

@router.post("/api/portfolio/deposit")
@limiter.limit("30/minute")
async def deposit_cash(
    item: CashDepositRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    portfolio = get_or_create_portfolio(db, current_user)

    dep_date = parse_client_date(item.date)

    if item.currency.upper() == "USD":
        portfolio.cash_usd = float(portfolio.cash_usd) + item.amount
        bal_after = float(portfolio.cash_usd)
    else:
        portfolio.cash_ves = float(portfolio.cash_ves) + item.amount
        bal_after = float(portfolio.cash_ves)

    cm = CashMovement(
        portfolio_id=portfolio.id,
        movement_type="DEPOSIT",
        currency=item.currency.upper(),
        amount=item.amount,
        balance_after=bal_after,
        concept=item.concept or "Depósito de liquidez para inversión",
        reference=item.reference,
        movement_date=dep_date
    )
    db.add(cm)
    db.commit()

    log_audit(
        db,
        "CASH_DEPOSIT",
        user_id=current_user.id,
        request=request,
        details=f"Deposit of {item.amount:,.2f} {item.currency.upper()}"
    )

    return {
        "success": True,
        "message": f"Depósito de {item.amount:,.2f} {item.currency.upper()} registrado con éxito.",
        "cash_ves": float(portfolio.cash_ves),
        "cash_usd": float(portfolio.cash_usd),
        "movement": {
            "id": cm.id,
            "movement_type": cm.movement_type,
            "currency": cm.currency,
            "amount": float(cm.amount),
            "balance_after": float(cm.balance_after),
            "concept": cm.concept,
            "date": cm.movement_date.isoformat()
        }
    }

@router.get("/api/portfolio/cash-movements")
def get_cash_movements(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        return {"movements": [], "cash_ves": 0.0, "cash_usd": 0.0}

    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not portfolio:
        return {"movements": [], "cash_ves": 0.0, "cash_usd": 0.0}

    movements = db.query(CashMovement).filter(
        CashMovement.portfolio_id == portfolio.id
    ).order_by(CashMovement.movement_date.desc(), CashMovement.id.desc()).limit(100).all()

    return {
        "cash_ves": float(portfolio.cash_ves),
        "cash_usd": float(portfolio.cash_usd),
        "movements": [
            {
                "id": m.id,
                "movement_type": m.movement_type,
                "currency": m.currency,
                "amount": float(m.amount),
                "balance_after": float(m.balance_after),
                "concept": m.concept,
                "reference": m.reference,
                "movement_date": m.movement_date.isoformat(),
                "created_at": m.created_at.isoformat()
            }
            for m in movements
        ]
    }


@router.post("/api/portfolio/simulate-what-if")
async def api_simulate_what_if(
    payload: WhatIfSimulateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="No hay portafolio disponible para simular.")

    rates = await fetch_current_rates(db)
    bcv = float(rates.get("bcv", 881.87))
    usdt = float(rates.get("usdt", 1007.60))
    summary = get_portfolio_summary(db=db, bcv_rate=bcv, usdt_rate=usdt, portfolio_id=portfolio.id)

    result = whatif_service.simulate_financial_stress_scenario(
        portfolio_summary=summary,
        bcv_target=payload.bcv_target,
        usdt_target=payload.usdt_target,
        wall_street_shock_pct=payload.wall_street_shock_pct or 0.0,
        bvc_adjustment_rate=payload.bvc_adjustment_rate if payload.bvc_adjustment_rate is not None else 0.85
    )
    return result
