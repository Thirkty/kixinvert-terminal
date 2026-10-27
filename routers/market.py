"""Tasas de cambio, pizarra de la BVC y acciones de Wall Street."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from services.rates_service import fetch_current_rates
from services.bvc_service import fetch_bvc_market_data

router = APIRouter()


@router.get("/api/rates")
async def get_rates(db: Session = Depends(get_db)):
    rates = await fetch_current_rates(db)
    return rates


@router.get("/api/quotes")
async def get_quotes(force: bool = False, db: Session = Depends(get_db)):
    rates = await fetch_current_rates(db, force_refresh=force)
    quotes = await fetch_bvc_market_data(db, rates["bcv"], rates["usdt"], force_refresh=force)
    return {
        "rates": rates,
        "quotes": quotes
    }


@router.get("/api/international/popular")
async def get_popular_international_stocks():
    """Returns curated popular Wall Street stocks and ETFs with real-time quotes."""
    from services.international_service import POPULAR_INTERNATIONAL_ASSETS, fetch_international_quote
    results = []
    for ticker, info in POPULAR_INTERNATIONAL_ASSETS.items():
        q = fetch_international_quote(ticker)
        results.append(q if q else info)
    return results
