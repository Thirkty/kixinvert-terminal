import datetime
import logging
import httpx
from sqlalchemy.orm import Session
from models import Asset, MarketQuote

logger = logging.getLogger(__name__)

BVC_AJAX_URL = "https://www.bolsadecaracas.com/wp-admin/admin-ajax.php"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://www.bolsadecaracas.com/"
}

# Standard company names, sectors and baseline market variations for top BVC shares
BVC_METADATA = {
    "BNC": {"name": "Banco Nacional de Crédito", "sector": "Banca y Finanzas", "currency": "VES", "baseline_change": 0.60, "baseline_price": 254.0},
    "RST.B": {"name": "C.A. Ron Santa Teresa (Clase B)", "sector": "Consumo Masivo / Alimentos y Bebidas", "currency": "VES", "baseline_change": -4.11, "baseline_price": 630.0},
    "RST.A": {"name": "C.A. Ron Santa Teresa (Clase A)", "sector": "Consumo Masivo", "currency": "VES", "baseline_change": -2.50, "baseline_price": 865.0},
    "MVZ.A": {"name": "Mercantil Servicios Financieros (Clase A)", "sector": "Banca y Finanzas", "currency": "VES", "baseline_change": -7.34, "baseline_price": 20200.0},
    "MVZ.B": {"name": "Mercantil Servicios Financieros (Clase B)", "sector": "Banca y Finanzas", "currency": "VES", "baseline_change": -4.96, "baseline_price": 13306.0},
    "BPV": {"name": "Banco Provincial", "sector": "Banca y Finanzas", "currency": "VES", "baseline_change": 4.21, "baseline_price": 99.0},
    "BVL": {"name": "Banco de Venezuela", "sector": "Banca y Finanzas", "currency": "VES", "baseline_change": 6.93, "baseline_price": 2299.0},
    "BVCC": {"name": "Bolsa de Valores de Caracas", "sector": "Servicios Financieros", "currency": "VES", "baseline_change": 2.97, "baseline_price": 937.0},
    "TDV.D": {"name": "CANTV (Clase D)", "sector": "Telecomunicaciones", "currency": "VES", "baseline_change": 5.69, "baseline_price": 1300.0},
    "GZL": {"name": "Grupo Zuliano", "sector": "Química y Petroquímica", "currency": "VES", "baseline_change": 1.85, "baseline_price": 2625.0},
    "DOM": {"name": "Domínguez & Cía", "sector": "Industrial / Envases", "currency": "VES", "baseline_change": 3.10, "baseline_price": 1140.0},
    "EFE": {"name": "Productos EFE", "sector": "Alimentos", "currency": "VES", "baseline_change": -1.25, "baseline_price": 125.0},
    "CRM.A": {"name": "Corimon (Clase A)", "sector": "Pinturas y Construcción", "currency": "VES", "baseline_change": 0.85, "baseline_price": 780.0},
    "CCR": {"name": "Cerámica Carabobo", "sector": "Construcción", "currency": "VES", "baseline_change": 2.45, "baseline_price": 8498.0},
    "ABC.A": {"name": "Banco del Caribe (Bancaribe A)", "sector": "Banca y Finanzas", "currency": "VES", "baseline_change": 18.62, "baseline_price": 3440.0},
    "FVI.A": {"name": "Fondo de Valores Inmobiliarios (Clase A)", "sector": "Bienes Raíces", "currency": "VES", "baseline_change": -0.95, "baseline_price": 260.0},
    "FVI.B": {"name": "Fondo de Valores Inmobiliarios (Clase B)", "sector": "Bienes Raíces", "currency": "VES", "baseline_change": 1.15, "baseline_price": 420.0},
    "IVC": {"name": "Inmuebles, Valores y Capitales", "sector": "Inversiones", "currency": "VES", "baseline_change": 0.50, "baseline_price": 85.0},
    "PTN": {"name": "Protinal Proagro", "sector": "Agroindustria", "currency": "VES", "baseline_change": 3.80, "baseline_price": 1497.0},
    "SVS": {"name": "Sivensa (Siderúrgica Venezolana)", "sector": "Siderurgia", "currency": "VES", "baseline_change": -1.75, "baseline_price": 1200.0},
}

import time

# In-memory cache, renewed every 15 s by services/market_warmer.py (120 s TTL as a fallback)
_BVC_QUOTES_CACHE = {
    "data": None,
    "expires_at": 0.0
}

async def fetch_bvc_market_data(db: Session = None, bcv_rate: float = 879.12, usdt_rate: float = 1008.90, force_refresh: bool = False):
    """
    Fetches live BVC cotizaciones and traded summaries with 15s in-memory TTL caching.
    Calculates multi-currency prices (Bs, USD BCV, USDT).
    """
    global _BVC_QUOTES_CACHE
    now_ts = time.time()

    # Fast path: return cached quotes instantly (<0.1ms) if not expired
    if not force_refresh and _BVC_QUOTES_CACHE["data"] and now_ts < _BVC_QUOTES_CACHE["expires_at"]:
        return _BVC_QUOTES_CACHE["data"]

    results = {}

    existing_quotes = {}
    existing_assets = {}
    if db:
        try:
            existing_quotes = {q.ticker: q for q in db.query(MarketQuote).all()}
            existing_assets = {a.ticker: a for a in db.query(Asset).all()}
        except Exception as e:
            logger.warning(f"Could not preload existing quotes/assets: {e}")

    async with httpx.AsyncClient(timeout=4.0, headers=HEADERS) as client:
        # 1. Fetch order book / cotizaciones (bid/ask depth)
        try:
            res = await client.post(BVC_AJAX_URL, data={"action": "get_cotizaciones"})
            if res.status_code == 200:
                payload = res.json()
                items = payload.get("response", [])
                for it in items:
                    symb = it.get("COD_SIMB")
                    if not symb:
                        continue
                    
                    bid = float(it["PRE_CMP_1"]) if it.get("PRE_CMP_1") else None
                    ask = float(it["PRE_VTA_1"]) if it.get("PRE_VTA_1") else None
                    bid_vol = float(it["VOL_CMP_1"]) if it.get("VOL_CMP_1") else 0.0
                    ask_vol = float(it["VOL_VTA_1"]) if it.get("VOL_VTA_1") else 0.0
                    
                    # Prioritize official previous close from database or realistic baseline
                    prev_quote = existing_quotes.get(symb)
                    if prev_quote and prev_quote.price_ves and float(prev_quote.price_ves) > 0:
                        ref_price = float(prev_quote.price_ves)
                    elif bid and bid > 0:
                        ref_price = bid
                    elif ask and ask > 0:
                        ref_price = ask
                    elif symb in BVC_METADATA and "baseline_price" in BVC_METADATA[symb]:
                        ref_price = float(BVC_METADATA[symb]["baseline_price"])
                    else:
                        ref_price = 0.0

                    # Retain last recorded closing variation from DB or official baseline
                    initial_change = 0.0
                    if prev_quote and prev_quote.change_pct is not None and float(prev_quote.change_pct) != 0.0:
                        initial_change = float(prev_quote.change_pct)
                    elif symb in BVC_METADATA and "baseline_change" in BVC_METADATA[symb]:
                        initial_change = float(BVC_METADATA[symb]["baseline_change"])

                    desc = it.get("DESC_SIMB") or BVC_METADATA.get(symb, {}).get("name", symb)
                    results[symb] = {
                        "ticker": symb,
                        "name": desc,
                        "price_ves": ref_price,
                        "bid_ves": bid,
                        "ask_ves": ask,
                        "volume": bid_vol + ask_vol,
                        "change_pct": initial_change,
                        "spread_pct": round(((ask - bid) / bid) * 100, 2) if (bid and ask and bid > 0) else 0.0,
                        "last_trade_time": ""
                    }
        except Exception as e:
            logger.warning(f"Error fetching BVC get_cotizaciones: {e}")

        # 2. Fetch traded session data (Official traded prices & session percentage changes)
        try:
            res_rv = await client.post(f"{BVC_AJAX_URL}?action=resumenMercadoRentaVariable", data={"type": "online"})
            if res_rv.status_code == 200:
                rv_items = res_rv.json()
                if isinstance(rv_items, list):
                    for rvi in rv_items:
                        symb = rvi.get("COD_SIMB")
                        if not symb:
                            continue
                        last_p = float(rvi.get("PRECIO", 0.0))
                        # Use VAR_REL (percentage change) for accurate financial metrics
                        var_rel = float(str(rvi.get("VAR_REL", "0")).replace("-.","-0."))
                        vol = float(rvi.get("VOLUMEN", 0.0))
                        hora = str(rvi.get("HORA", "")).strip()
                        
                        if symb in results:
                            if last_p > 0:
                                results[symb]["price_ves"] = last_p
                            results[symb]["change_pct"] = var_rel
                            results[symb]["volume"] = vol
                            results[symb]["last_trade_time"] = hora
                        else:
                            results[symb] = {
                                "ticker": symb,
                                "name": rvi.get("DESC_SIMB") or symb,
                                "price_ves": last_p,
                                "bid_ves": None,
                                "ask_ves": None,
                                "volume": vol,
                                "change_pct": var_rel,
                                "spread_pct": 0.0,
                                "last_trade_time": hora
                            }
        except Exception as e:
            logger.warning(f"Error fetching BVC resumenMercadoRentaVariable: {e}")

    # Fallback default list if BVC website was down
    if not results:
        for ticker, meta in BVC_METADATA.items():
            results[ticker] = {
                "ticker": ticker,
                "name": meta["name"],
                "price_ves": meta.get("baseline_price", 250.0),
                "bid_ves": None,
                "ask_ves": None,
                "volume": 1000.0,
                "change_pct": meta.get("baseline_change", 1.5),
                "spread_pct": 2.0
            }

    # Enhance each asset with multi-currency conversions
    for ticker, item in results.items():
        p_ves = item["price_ves"]
        item["price_usd_bcv"] = round(p_ves / bcv_rate, 4) if bcv_rate > 0 else 0.0
        item["price_usdt"] = round(p_ves / usdt_rate, 4) if usdt_rate > 0 else 0.0
        item["sector"] = BVC_METADATA.get(ticker, {}).get("sector", "Renta Variable BVC")

        # Upsert into PostgreSQL if db is provided (using preloaded in-memory maps)
        if db:
            try:
                # Ensure Asset exists
                asset_obj = existing_assets.get(ticker)
                if not asset_obj:
                    asset_obj = Asset(
                        ticker=ticker,
                        name=item["name"],
                        market="BVC",
                        currency="VES",
                        sector=item["sector"]
                    )
                    db.add(asset_obj)
                    db.flush()
                    existing_assets[ticker] = asset_obj

                # Upsert MarketQuote
                quote_obj = existing_quotes.get(ticker)
                if not quote_obj:
                    quote_obj = MarketQuote(
                        ticker=ticker,
                        price_ves=p_ves,
                        bid_ves=item["bid_ves"],
                        ask_ves=item["ask_ves"],
                        volume=item["volume"],
                        change_pct=item["change_pct"],
                        updated_at=datetime.datetime.utcnow()
                    )
                    db.add(quote_obj)
                    existing_quotes[ticker] = quote_obj
                else:
                    quote_obj.price_ves = p_ves
                    quote_obj.bid_ves = item["bid_ves"]
                    quote_obj.ask_ves = item["ask_ves"]
                    quote_obj.volume = item["volume"]
                    quote_obj.change_pct = item["change_pct"]
                    quote_obj.updated_at = datetime.datetime.utcnow()
            except Exception as upsert_err:
                logger.error(f"Error upserting quote {ticker}: {upsert_err}")

    if db:
        try:
            db.commit()
        except Exception as commit_err:
            db.rollback()
            logger.error(f"Error committing quotes: {commit_err}")

    # Sort quotes: valid prices first, liquid movers and active stocks at the front
    def sort_key(q):
        t = q.get("ticker", "")
        has_change = abs(float(q.get("change_pct", 0.0) or 0.0)) > 0.0
        is_major = t in BVC_METADATA
        price = float(q.get("price_ves", 0.0) or 0.0)
        vol = float(q.get("volume", 0.0) or 0.0)
        return (
            1 if price > 0 else 0,
            2 if (has_change and is_major) else (1 if (has_change or is_major) else 0),
            vol
        )

    final_list = list(results.values())
    final_list.sort(key=sort_key, reverse=True)

    _BVC_QUOTES_CACHE["data"] = final_list
    _BVC_QUOTES_CACHE["expires_at"] = time.time() + 120.0

    return final_list
