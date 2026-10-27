"""Tasas de cambio, pizarra de la BVC y acciones de Wall Street."""
import asyncio
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

    def collect():
        return [fetch_international_quote(t) or info for t, info in POPULAR_INTERNATIONAL_ASSETS.items()]

    # yfinance is synchronous; usually this is a cache hit kept warm by market_warmer
    return await asyncio.to_thread(collect)
