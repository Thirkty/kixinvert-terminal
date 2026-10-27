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

export interface TelegramStatus {
  linked: boolean;
  chat_id: string;
  raw_chat_id?: number | null;
  telegram_username?: string | null;
  alerts_enabled: boolean;
  link_code?: string | null;
  bot_username?: string;
  bot_configured: boolean;
}

export interface WhatIfSimulationResult {
  current_portfolio_ves: number;
  projected_portfolio_ves: number;
  current_portfolio_usd_bcv: number;
  projected_portfolio_usd_bcv: number;
  current_portfolio_usdt: number;
  projected_portfolio_usdt: number;
  net_ves_impact: number;
  net_usd_bcv_impact: number;
  net_usdt_impact: number;
  bcv_target: number;
  usdt_target: number;
  wall_street_shock_pct: number;
  protection_rating: string;
  advice: string;
}

export type Ecosystem = 'BVC' | 'US';

export interface NotificationItem {
  id: number;
  category?: string;
  type?: string;
  title: string;
  message?: string;
  desc?: string;
  is_read: boolean;
  action_url?: string;
  created_at?: string;
  time?: string;
}

export interface InternationalQuote {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  currency?: string;
  category?: string;
}

export interface MercosurFeeDetails {
  grossAmount: number;
  commissionPct: number;
  commissionAmount: number;
  ivaAmount: number;
  marketFeesPct: number;
  marketFeesAmount: number;
  totalFees: number;
  netAmountBuy: number;
  netAmountSell: number;
}
