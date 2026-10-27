import datetime
import time
import logging
import httpx
from sqlalchemy.orm import Session
from models import ExchangeRate

logger = logging.getLogger(__name__)

# In-memory cache. services/market_warmer.py renews it every 15 s; the 120 s TTL only
# matters if the warmer stops, so requests never wait on the external APIs.
_RATES_CACHE = {
    "data": None,
    "expires_at": 0.0
}
_LAST_DB_WRITE = 0.0

async def fetch_current_rates(db: Session = None, force_refresh: bool = False):
    """
    Fetches live exchange rates with 15s in-memory TTL caching:
    - USD Oficial (BCV)
    - USDT Binance P2P
    - Dólar Paralelo
    Calculates the spread (brecha) between BCV and USDT.
    """
    global _RATES_CACHE, _LAST_DB_WRITE
    now_ts = time.time()

    # Fast path: return cached rates instantly (<0.1ms) if not expired
    if not force_refresh and _RATES_CACHE["data"] and now_ts < _RATES_CACHE["expires_at"]:
        return _RATES_CACHE["data"]

    bcv_rate = None
    paralelo_rate = None
    usdt_rate = None

    async with httpx.AsyncClient(timeout=4.0) as client:
        # 1. Fetch BCV and Paralelo from ve.dolarapi.com
        try:
            res = await client.get("https://ve.dolarapi.com/v1/dolares")
            if res.status_code == 200:
                data = res.json()
                for item in data:
                    if item.get("fuente") == "oficial":
                        bcv_rate = float(item.get("promedio", 0.0))
                    elif item.get("fuente") == "paralelo":
                        paralelo_rate = float(item.get("promedio", 0.0))
        except Exception as e:
            logger.warning(f"Error fetching from DolarApi: {e}")

        # 2. Fetch USDT Binance P2P from CriptoYa
        try:
            res_usdt = await client.get("https://criptoya.com/api/binancep2p/usdt/ves/100")
            if res_usdt.status_code == 200:
                usdt_data = res_usdt.json()
                ask = float(usdt_data.get("ask", 0.0))
                bid = float(usdt_data.get("bid", 0.0))
                if ask > 0 and bid > 0:
                    usdt_rate = round((ask + bid) / 2, 4)
                elif ask > 0:
                    usdt_rate = ask
        except Exception as e:
            logger.warning(f"Error fetching USDT from CriptoYa: {e}")

    # Fallbacks if one is missing
    if not usdt_rate and paralelo_rate:
        usdt_rate = paralelo_rate
    elif not paralelo_rate and usdt_rate:
        paralelo_rate = usdt_rate

    # Ultimate default fallback if offline
    if not bcv_rate:
        bcv_rate = _RATES_CACHE["data"]["bcv"] if _RATES_CACHE["data"] else 879.12
    if not usdt_rate:
        usdt_rate = _RATES_CACHE["data"]["usdt"] if _RATES_CACHE["data"] else 1008.90
    if not paralelo_rate:
        paralelo_rate = _RATES_CACHE["data"]["paralelo"] if _RATES_CACHE["data"] else 1008.16

    # Calculate Brecha (%)
    brecha_pct = round(((usdt_rate - bcv_rate) / bcv_rate) * 100, 2) if bcv_rate > 0 else 0.0

    result = {
        "bcv": bcv_rate,
        "usdt": usdt_rate,
        "paralelo": paralelo_rate,
        "brecha_pct": brecha_pct,
        "updated_at": datetime.datetime.now().strftime("%d/%m/%Y %I:%M %p")
    }

    _RATES_CACHE["data"] = result
    _RATES_CACHE["expires_at"] = now_ts + 120.0

    # Save to PostgreSQL throttled (at most once every 10 minutes to avoid DB bloat)
    if db and (now_ts - _LAST_DB_WRITE > 600.0):
        try:
            now_dt = datetime.datetime.utcnow()
            for r_type, val, src in [
                ("BCV", bcv_rate, "BCV Oficial"),
                ("USDT_BINANCE", usdt_rate, "Binance P2P"),
                ("PARALELO", paralelo_rate, "Mercado Paralelo")
            ]:
                rate_record = ExchangeRate(
                    rate_type=r_type,
                    rate_value=val,
                    source=src,
                    recorded_at=now_dt
                )
                db.add(rate_record)
            db.commit()
            _LAST_DB_WRITE = now_ts
        except Exception as db_err:
            db.rollback()
            logger.error(f"Error saving rates to DB: {db_err}")

    return result
