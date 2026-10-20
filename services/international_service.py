"""
services/international_service.py
=============================================================================
KixInvertAPP - Phase 3: International & Wall Street Stocks Service
=============================================================================
Provides market data integration for NYSE, NASDAQ, and US ETFs using yfinance.
Maintains full tri-monetary synchronization (USD -> VES at BCV rate -> USDT).
Includes in-memory quote caching, graceful fallback, and popular asset directory.
"""

import time
import logging
import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from models import Asset, MarketQuote

logger = logging.getLogger("kixinvert.international")

# Curated list of popular US stocks & ETFs for fast lookup & catalogue
POPULAR_INTERNATIONAL_ASSETS: Dict[str, Dict[str, Any]] = {
    "AAPL": {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "market": "NASDAQ",
        "currency": "USD",
        "sector": "Tecnología / Hardware",
        "reference_price_usd": 235.00
    },
    "NVDA": {
        "ticker": "NVDA",
        "name": "NVIDIA Corporation",
        "market": "NASDAQ",
        "currency": "USD",
        "sector": "Semiconductores / IA",
        "reference_price_usd": 138.00
    },
    "MSFT": {
        "ticker": "MSFT",
        "name": "Microsoft Corporation",
        "market": "NASDAQ",
        "currency": "USD",
        "sector": "Software & Nube",
        "reference_price_usd": 425.00
    },
    "AMZN": {
        "ticker": "AMZN",
        "name": "Amazon.com Inc.",
        "market": "NASDAQ",
        "currency": "USD",
        "sector": "Comercio & Cloud",
        "reference_price_usd": 188.00
    },
    "GOOGL": {
        "ticker": "GOOGL",
        "name": "Alphabet Inc. (Google)",
        "market": "NASDAQ",
        "currency": "USD",
        "sector": "Servicios Digitales & IA",
        "reference_price_usd": 165.00
    },
    "META": {
        "ticker": "META",
        "name": "Meta Platforms Inc.",
        "market": "NASDAQ",
        "currency": "USD",
        "sector": "Redes Sociales & IA",
        "reference_price_usd": 580.00
    },
    "TSLA": {
        "ticker": "TSLA",
        "name": "Tesla Inc.",
        "market": "NASDAQ",
        "currency": "USD",
        "sector": "Automotriz & Energía",
        "reference_price_usd": 220.00
    },
    "SPY": {
        "ticker": "SPY",
        "name": "SPDR S&P 500 ETF Trust",
        "market": "NYSE",
        "currency": "USD",
        "sector": "Índice Bursátil S&P 500",
        "reference_price_usd": 585.00
    },
    "QQQ": {
        "ticker": "QQQ",
        "name": "Invesco QQQ Trust (Nasdaq 100)",
        "market": "NASDAQ",
        "currency": "USD",
        "sector": "Índice Tecnológico Nasdaq",
        "reference_price_usd": 490.00
    },
    "BRK.B": {
        "ticker": "BRK.B",
        "name": "Berkshire Hathaway Inc.",
        "market": "NYSE",
        "currency": "USD",
        "sector": "Finanzas & Conglomerado",
        "reference_price_usd": 460.00
    },
    "V": {
        "ticker": "V",
        "name": "Visa Inc.",
        "market": "NYSE",
        "currency": "USD",
        "sector": "Servicios Financieros",
        "reference_price_usd": 280.00
    },
    "JNJ": {
        "ticker": "JNJ",
        "name": "Johnson & Johnson",
        "market": "NYSE",
        "currency": "USD",
        "sector": "Salud & Farmacia",
        "reference_price_usd": 162.00
    },
    "WMT": {
        "ticker": "WMT",
        "name": "Walmart Inc.",
        "market": "NYSE",
        "currency": "USD",
        "sector": "Consumo Masivo",
        "reference_price_usd": 80.00
    },
    "JPM": {
        "ticker": "JPM",
        "name": "JPMorgan Chase & Co.",
        "market": "NYSE",
        "currency": "USD",
        "sector": "Banca Global",
        "reference_price_usd": 222.00
    },
    "COIN": {
        "ticker": "COIN",
        "name": "Coinbase Global Inc.",
        "market": "NASDAQ",
        "currency": "USD",
        "sector": "Fintech & Criptoactivos",
        "reference_price_usd": 210.00
    }
}

# In-memory quote cache: { ticker: { "data": dict, "expires_at": timestamp } }
_QUOTE_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes

def is_international_ticker(ticker: str) -> bool:
    """Checks if ticker is a known US / International stock."""
    t_clean = ticker.strip().upper()
    return t_clean in POPULAR_INTERNATIONAL_ASSETS

def get_asset_metadata(ticker: str) -> Dict[str, Any]:
    """Returns metadata for an international ticker or defaults to US equity."""
    t_clean = ticker.strip().upper()
    if t_clean in POPULAR_INTERNATIONAL_ASSETS:
        return POPULAR_INTERNATIONAL_ASSETS[t_clean]
    return {
        "ticker": t_clean,
        "name": f"{t_clean} Corp.",
        "market": "US",
        "currency": "USD",
        "sector": "Internacional / Wall Street",
        "reference_price_usd": 100.00
    }

def fetch_international_quote(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Fetches real-time / delayed quote from yfinance with in-memory caching
    and graceful fallback.
    """
    t_clean = ticker.strip().upper()
    now = time.time()

    # 1. Check in-memory cache
    cached = _QUOTE_CACHE.get(t_clean)
    if cached and cached["expires_at"] > now:
        return cached["data"]

    price_usd = None
    prev_close_usd = None
    change_pct = 0.0
    name = t_clean
    sector = "Internacional"
    market = "US"

    try:
        import yfinance as yf
        yticker = yf.Ticker(t_clean)
        
        # fast_info is typically faster and less rate-limited than .info
        fast = yticker.fast_info
        if fast and "lastPrice" in fast and fast["lastPrice"] is not None:
            price_usd = float(fast["lastPrice"])
            prev_close_usd = float(fast.get("previousClose") or price_usd)
            if prev_close_usd > 0:
                change_pct = round(((price_usd - prev_close_usd) / prev_close_usd) * 100, 2)
            
            # Metadata fallback or extract from .info if accessible
            meta = get_asset_metadata(t_clean)
            name = meta["name"]
            sector = meta["sector"]
            market = meta["market"]
    except Exception as exc:
        logger.warning(f"Could not fetch yfinance quote for {t_clean}: {exc}")

    # Fallback to reference price if network failed or symbol is valid
    if price_usd is None or price_usd <= 0:
        meta = get_asset_metadata(t_clean)
        price_usd = meta.get("reference_price_usd", 100.0)
        prev_close_usd = price_usd
        change_pct = 0.0
        name = meta["name"]
        sector = meta["sector"]
        market = meta["market"]

    quote_data = {
        "ticker": t_clean,
        "name": name,
        "market": market,
        "currency": "USD",
        "sector": sector,
        "price_usd": round(price_usd, 2),
        "previous_close_usd": round(prev_close_usd, 2) if prev_close_usd else round(price_usd, 2),
        "change_pct": round(change_pct, 2),
        "is_international": True,
        "updated_at": datetime.datetime.utcnow().isoformat()
    }

    _QUOTE_CACHE[t_clean] = {
        "data": quote_data,
        "expires_at": now + CACHE_TTL_SECONDS
    }

    return quote_data

def sync_international_market_quote(db: Session, ticker: str, bcv_rate: float) -> Optional[MarketQuote]:
    """
    Fetches international quote in USD, converts to VES (price_usd * bcv_rate),
    and updates/creates Asset and MarketQuote in the database.
    """
    t_clean = ticker.strip().upper()
    quote_data = fetch_international_quote(t_clean)
    if not quote_data:
        return None

    # 1. Upsert Asset
    asset = db.query(Asset).filter(Asset.ticker == t_clean).first()
    if not asset:
        asset = Asset(
            ticker=t_clean,
            name=quote_data["name"],
            market=quote_data["market"],
            currency="USD",
            sector=quote_data["sector"]
        )
        db.add(asset)
        db.commit()
    else:
        # Ensure market is set correctly
        if asset.market == "BVC":
            asset.market = quote_data["market"]
            asset.currency = "USD"
            db.commit()

    # 2. Upsert MarketQuote in VES (price_usd * bcv_rate)
    price_ves = round(quote_data["price_usd"] * bcv_rate, 4) if bcv_rate > 0 else 0.0
    mq = db.query(MarketQuote).filter(MarketQuote.ticker == t_clean).first()
    if not mq:
        mq = MarketQuote(
            ticker=t_clean,
            price_ves=price_ves,
            bid_ves=price_ves,
            ask_ves=price_ves,
            volume=1000.0,
            change_pct=quote_data["change_pct"],
            updated_at=datetime.datetime.utcnow()
        )
        db.add(mq)
    else:
        mq.price_ves = price_ves
        mq.change_pct = quote_data["change_pct"]
        mq.updated_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(mq)
    return mq

def sync_all_portfolio_international_quotes(db: Session, bcv_rate: float):
    """
    Checks all assets held in portfolios with market != 'BVC' and refreshes
    their quotes from yfinance into MarketQuote.
    """
    from models import Position
    intl_positions = (
        db.query(Position.ticker)
        .join(Asset, Position.ticker == Asset.ticker)
        .filter(Asset.market != "BVC")
        .distinct()
        .all()
    )

    for (ticker,) in intl_positions:
        try:
            sync_international_market_quote(db, ticker, bcv_rate)
        except Exception as e:
            logger.error(f"Failed to sync intl quote for {ticker}: {e}")

def search_international_assets(query: str = "") -> List[Dict[str, Any]]:
    """Returns matching international assets from catalogue."""
    q = (query or "").strip().upper()
    results = []
    for ticker, info in POPULAR_INTERNATIONAL_ASSETS.items():
        if not q or q in ticker or q in info["name"].upper() or q in info["sector"].upper():
            results.append({
                "ticker": info["ticker"],
                "name": info["name"],
                "market": info["market"],
                "currency": info["currency"],
                "sector": info["sector"],
                "reference_price_usd": info["reference_price_usd"]
            })
    return results
