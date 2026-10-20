import datetime
import uuid
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    password_hash = Column(String(256), nullable=False)
    broker = Column(String(100), default="KixBroker BVC")
    risk_profile = Column(String(50), default="Moderado")
    role = Column(String(20), default="investor", nullable=False) # investor, admin
    is_active = Column(Boolean, default=True, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    two_factor_secret = Column(String(256), nullable=True)
    two_factor_enabled = Column(Boolean, default=False, nullable=False)
    subscription_tier = Column(String(20), default="free", nullable=False) # 'free', 'pro'
    subscription_expires_at = Column(DateTime, nullable=True)
    ai_queries_used_this_month = Column(Integer, default=0, nullable=False)
    ai_queries_reset_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    telegram_chat_id = Column(String(50), nullable=True, index=True)
    telegram_username = Column(String(100), nullable=True)
    telegram_alerts_enabled = Column(Boolean, default=True, nullable=False)
    telegram_link_code = Column(String(20), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    portfolios = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    payment_orders = relationship("PaymentOrder", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(100), default="Mi Portafolio BVC", nullable=False)
    description = Column(Text, nullable=True)
    cash_ves = Column(Numeric(18, 4), default=0.0)
    cash_usd = Column(Numeric(18, 4), default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="portfolios")
    positions = relationship("Position", back_populates="portfolio", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="portfolio", cascade="all, delete-orphan")

class Asset(Base):
    __tablename__ = "assets"

    ticker = Column(String(20), primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    market = Column(String(50), default="BVC")  # BVC, NYSE, NASDAQ, CRYPTO
    currency = Column(String(10), default="VES") # VES, USD, USDT
    sector = Column(String(100), nullable=True)
    icon_url = Column(String(500), nullable=True)

    positions = relationship("Position", back_populates="asset")
    quotes = relationship("MarketQuote", back_populates="asset", uselist=False)

class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    ticker = Column(String(20), ForeignKey("assets.ticker"), nullable=False)
    shares = Column(Numeric(18, 4), nullable=False, default=0.0)
    avg_buy_price_ves = Column(Numeric(18, 4), nullable=False, default=0.0)
    # Historic rates at purchase time to calculate exact historical cost in USD & USDT
    historic_rate_bcv = Column(Numeric(18, 4), nullable=True)
    historic_rate_usdt = Column(Numeric(18, 4), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    portfolio = relationship("Portfolio", back_populates="positions")
    asset = relationship("Asset", back_populates="positions")

class MarketQuote(Base):
    __tablename__ = "market_quotes"

    ticker = Column(String(20), ForeignKey("assets.ticker"), primary_key=True)
    price_ves = Column(Numeric(18, 4), nullable=False, default=0.0)
    bid_ves = Column(Numeric(18, 4), nullable=True)
    ask_ves = Column(Numeric(18, 4), nullable=True)
    volume = Column(Numeric(18, 2), default=0.0)
    change_pct = Column(Numeric(10, 4), default=0.0)
    high_ves = Column(Numeric(18, 4), nullable=True)
    low_ves = Column(Numeric(18, 4), nullable=True)
    previous_close_ves = Column(Numeric(18, 4), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    asset = relationship("Asset", back_populates="quotes")

class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    id = Column(Integer, primary_key=True, index=True)
    rate_type = Column(String(50), nullable=False, index=True) # BCV, USDT_BINANCE, PARALELO
    rate_value = Column(Numeric(18, 4), nullable=False)
    source = Column(String(100), default="Oficial")
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    ticker = Column(String(20), ForeignKey("assets.ticker"), nullable=False)
    tx_type = Column(String(10), nullable=False) # BUY, SELL, DIVIDEND
    shares = Column(Numeric(18, 4), nullable=False)
    price_ves = Column(Numeric(18, 4), nullable=False)
    fee_ves = Column(Numeric(18, 4), default=0.0)
    rate_bcv = Column(Numeric(18, 4), nullable=True)
    rate_usdt = Column(Numeric(18, 4), nullable=True)
    notes = Column(Text, nullable=True)
    executed_at = Column(DateTime, default=datetime.datetime.utcnow)

    portfolio = relationship("Portfolio", back_populates="transactions")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(50), nullable=False, index=True) # LOGIN, LOGOUT, FAILED_LOGIN, LOCKOUT, REGISTER, BUY, SELL, CASH_UPDATE, 2FA_ENABLE, 2FA_DISABLE, BOT_BLOCKED
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    user = relationship("User")

class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(String(64), unique=True, index=True, default=lambda: f"KIX-{uuid.uuid4().hex[:12].upper()}")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount_usdt = Column(Numeric(18, 4), default=5.0000, nullable=False)
    plan = Column(String(30), default="pro_monthly", nullable=False)
    payment_method = Column(String(30), default="binance_pay", nullable=False)
    status = Column(String(20), default="PENDING", nullable=False) # PENDING, PAID, CANCELLED, EXPIRED
    binance_prepay_id = Column(String(100), nullable=True)
    binance_qr_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    paid_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="payment_orders")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    type = Column(String(50), nullable=False, index=True) # gap_warning, tactical_sell, tactical_buy, tactical_rotate, market_move, bcv_rate, system
    category = Column(String(30), default="market", nullable=False, index=True) # tactical, market, system
    severity = Column(String(20), default="info", nullable=False) # critical, warning, success, info
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    ticker = Column(String(20), nullable=True, index=True)
    action_url = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="notifications")

