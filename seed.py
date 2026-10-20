import sys
import asyncio

sys.stdout.reconfigure(encoding='utf-8')
from db import engine, Base, SessionLocal
from models import Portfolio, Asset, Position, MarketQuote
from services.rates_service import fetch_current_rates
from services.bvc_service import fetch_bvc_market_data, BVC_METADATA

def init_db():
    print("🚀 Creando tablas en PostgreSQL...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tablas creadas con éxito.")

async def seed_data():
    init_db()
    db = SessionLocal()

    try:
        # 1. Fetch current live rates
        print("🔄 Consultando tasas en vivo (BCV, USDT, Paralelo)...")
        rates = await fetch_current_rates(db)
        print(f"💰 Tasa BCV: {rates['bcv']} Bs | Tasa USDT: {rates['usdt']} Bs | Brecha: {rates['brecha_pct']}%")

        # 2. Populate assets and live quotes
        print("🔄 Consultando acciones de la Bolsa de Valores de Caracas...")
        quotes = await fetch_bvc_market_data(db, rates['bcv'], rates['usdt'])
        print(f"📈 {len(quotes)} cotizaciones BVC cargadas en PostgreSQL.")

        # 3. Create initial Portfolio if empty
        portfolio = db.query(Portfolio).first()
        if not portfolio:
            portfolio = Portfolio(
                id=1,
                name="Portafolio Inversión BVC",
                cash_ves=12500.0,
                cash_usd=25.0
            )
            db.add(portfolio)
            db.commit()
            db.refresh(portfolio)

        # 4. Create sample positions if none exist
        existing_pos = db.query(Position).filter(Position.portfolio_id == portfolio.id).count()
        if existing_pos == 0:
            print("🌱 Creando posiciones de muestra (BNC, RST.B, MVZ.A, BVCC)...")
            bcv = rates['bcv']
            usdt = rates['usdt']

            sample_positions = [
                # BNC: Comprado a 210 Bs (ahora ronda los 250 Bs)
                {"ticker": "BNC", "shares": 6500, "buy_price": 215.0},
                # RST.B: Ron Santa Teresa B
                {"ticker": "RST.B", "shares": 1500, "buy_price": 540.0},
                # MVZ.A: Mercantil Servicios Financieros A
                {"ticker": "MVZ.A", "shares": 45, "buy_price": 18200.0},
                # BVCC: Bolsa de Valores de Caracas
                {"ticker": "BVCC", "shares": 500, "buy_price": 820.0},
            ]

            for sp in sample_positions:
                pos = Position(
                    portfolio_id=portfolio.id,
                    ticker=sp["ticker"],
                    shares=sp["shares"],
                    avg_buy_price_ves=sp["buy_price"],
                    historic_rate_bcv=bcv * 0.94, # Simular compra hace 2 semanas con tasa menor
                    historic_rate_usdt=usdt * 0.93
                )
                db.add(pos)
            
            db.commit()
            print("✅ 4 posiciones iniciales registradas en PostgreSQL.")

    except Exception as e:
        db.rollback()
        print(f"❌ Error durante el seed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(seed_data())
