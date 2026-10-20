export type CurrencyMode = 'compare' | 'ves' | 'usd_bcv' | 'usdt';

export interface MarketRates {
  bcv: number;
  usdt: number;
  brecha_pct: number;
  updated_at?: string;
  source?: string;
}

export interface BvcTicker {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  volume?: number;
}

export interface Position {
  id?: string;
  symbol: string;
  name: string;
  shares: number;
  avg_cost: number;
  current_price: number;
  change_pct: number;
}

export interface PortfolioData {
  cash_ves: number;
  cash_usd: number;
  positions: Position[];
}

export interface UserSession {
  username: string;
  token?: string;
  is_demo: boolean;
  role?: string;
  has_2fa?: boolean;
}

export interface PnLCalculation {
  value: number;
  cost: number;
  pnl: number;
  pnl_pct: number;
}

export interface TriMonetaryTotals {
  ves: PnLCalculation;
  usd_bcv: PnLCalculation;
  usdt: PnLCalculation;
}
