"""Mantiene frescos en segundo plano los datos de mercado que piden todas las pantallas.

Sin esto, cada vez que caducaba la caché (15 s, el mismo ritmo con que la web pide datos)
una petición se quedaba esperando ~4-5 s a DolarApi, CriptoYa y la Bolsa de Caracas.
Ahora las peticiones leen siempre de la caché y este ciclo la renueva.
"""
import asyncio
import logging
import time

from services.rates_service import fetch_current_rates
from services.bvc_service import fetch_bvc_market_data
from services import international_service

logger = logging.getLogger(__name__)

MARKET_EVERY = 15  # segundos: tasas + pizarra BVC
WALL_STREET_EVERY = 300  # segundos: cotizaciones de Wall Street (yfinance es lento)


def _refresh_wall_street(session_factory, bcv_rate: float) -> None:
    # yfinance es síncrono: corre en un hilo aparte para no congelar el servidor
    for ticker in international_service.POPULAR_INTERNATIONAL_ASSETS:
        international_service.fetch_international_quote(ticker)
    db = session_factory()
    try:
        international_service.sync_all_portfolio_international_quotes(db, bcv_rate)
    finally:
        db.close()


async def market_warmer(session_factory) -> None:
    last_wall_street = 0.0
    while True:
        db = session_factory()
        try:
            rates = await fetch_current_rates(db, force_refresh=True)
            await fetch_bvc_market_data(db, rates["bcv"], rates["usdt"], force_refresh=True)
            if time.time() - last_wall_street >= WALL_STREET_EVERY:
                last_wall_street = time.time()
                await asyncio.to_thread(_refresh_wall_street, session_factory, rates["bcv"])
        except Exception as e:
            logger.warning(f"No se pudieron refrescar los datos de mercado: {e}")
        finally:
            db.close()
        await asyncio.sleep(MARKET_EVERY)
