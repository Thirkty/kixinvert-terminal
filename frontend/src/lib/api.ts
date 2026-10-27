import {
  MarketRates,
  BvcTicker,
  PortfolioData,
  Position,
  TelegramStatus,
  WhatIfSimulationResult,
  NotificationItem,
  InternationalQuote,
} from '@/types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('kix_auth_token') || localStorage.getItem('kix_token') || null;
}

export function setAuthToken(token: string | null | undefined) {
  if (typeof window === 'undefined') return;
  if (token && typeof token === 'string' && token.trim().length > 0) {
    localStorage.setItem('kix_auth_token', token.trim());
    localStorage.setItem('kix_token', token.trim());
  } else {
    localStorage.removeItem('kix_auth_token');
    localStorage.removeItem('kix_token');
  }
}

// Market data throws on failure: callers keep the last real values instead of showing invented prices
export async function fetchRates(): Promise<MarketRates> {
  const res = await fetch(`${API_BASE}/rates`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error al obtener tasas');
  return await res.json();
}

export async function fetchBvcPrices(): Promise<BvcTicker[]> {
  const res = await fetch(`${API_BASE}/quotes`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error al obtener cotizaciones BVC');
  const data = await res.json();
  const rawQuotes = data.quotes;
  let list: any[] = [];
  if (Array.isArray(rawQuotes)) {
    list = rawQuotes;
  } else if (rawQuotes && typeof rawQuotes === 'object') {
    list = Object.values(rawQuotes);
  }
  return list.map((q: any) => ({
    symbol: q.ticker || q.symbol || 'BVC',
    name: q.name || q.ticker || 'Acción BVC',
    price: Number(q.price_ves ?? q.price ?? 0),
    change_pct: Number(q.change_pct ?? 0),
    volume: Number(q.volume ?? 0),
  }));
}

// Only for a signed-in user; returns null when there is no session or the request fails
export async function fetchPortfolio(): Promise<PortfolioData | null> {
  const token = getAuthToken();
  if (!token) return null;
  const headers: HeadersInit = { Authorization: `Bearer ${token}` };

  try {
    const res = await fetch(`${API_BASE}/portfolio`, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error('Error al cargar portafolio');
    const data = await res.json();
    
    // Mapear y normalizar posiciones provenientes de la API de FastAPI
    const rawPositions = data.positions || [];
    const normalizedPositions: Position[] = rawPositions.map((p: any) => {
      const sym = p.symbol || p.ticker || 'BVC';
      const buyPrice = Number(p.avg_cost ?? p.buy_price_ves ?? 0);
      const currPrice = Number(p.current_price ?? p.current_price_ves ?? buyPrice);
      const shares = Number(p.shares ?? 0);
      const changePct = Number(p.change_pct ?? p.change_today_pct ?? 0);

      return {
        id: String(p.id ?? sym),
        symbol: sym,
        name: p.name || sym,
        shares,
        avg_cost: buyPrice,
        current_price: currPrice,
        change_pct: changePct,
      };
    });

    return {
      cash_ves: Number(data.cash_ves ?? 0.0),
      cash_usd: Number(data.cash_usd ?? 0.0),
      positions: normalizedPositions,
    };
  } catch {
    return null;
  }
}

export interface AIChatResponse {
  answer: string;
  limit_reached: boolean;
  upgrade_required?: boolean;
  queries_remaining?: number | string | null;
}

// Throws on failure so the chat shows a real error instead of a made-up diagnosis
export async function askKixInvertAI(prompt: string): Promise<AIChatResponse> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question: prompt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'El asistente de IA no respondió.');
  return {
    answer: data.answer || '',
    limit_reached: Boolean(data.limit_reached),
    upgrade_required: data.upgrade_required,
    queries_remaining: data.queries_remaining,
  };
}

export async function fetchTelegramStatus(): Promise<TelegramStatus> {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/telegram/status`, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error('Error al consultar estado de Telegram');
    return await res.json();
  } catch (err) {
    return {
      linked: false,
      chat_id: '',
      alerts_enabled: false,
      bot_username: 'KixInvert_bot',
      bot_configured: true,
    };
  }
}

export async function sendTelegramTestAlert(): Promise<{ success: boolean; message: string }> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/telegram/test-alert`, {
      method: 'POST',
      headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al enviar alerta');
    return { success: true, message: data.message || 'Alerta enviada a tu Telegram con éxito.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'No se pudo enviar la alerta de prueba.' };
  }
}

export async function toggleTelegramAlerts(enabled?: boolean): Promise<{ alerts_enabled: boolean }> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/telegram/toggle-alerts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error('Error al alternar alertas');
    const data = await res.json();
    return { alerts_enabled: data.alerts_enabled };
  } catch (err) {
    return { alerts_enabled: true };
  }
}

export async function simulateWhatIf(params: {
  bcv_target: number;
  usdt_target: number;
  wall_street_shock_pct?: number;
  bvc_adjustment_rate?: number;
}): Promise<WhatIfSimulationResult> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Sin datos de respaldo inventados: si el backend falla, el simulador muestra el error
  const res = await fetch(`${API_BASE}/portfolio/simulate-what-if`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'No se pudo ejecutar la simulación What-If.');

  // El backend responde agrupado (current_wealth / projected_wealth / impact / verdict)
  const current = data.current_wealth || {};
  const projected = data.projected_wealth || {};
  const ratingByBadge: Record<string, string> = { success: 'Alta', warning: 'Media', critical: 'Baja' };
  return {
    current_portfolio_ves: current.ves ?? 0,
    projected_portfolio_ves: projected.ves ?? 0,
    current_portfolio_usd_bcv: current.usd_bcv ?? 0,
    projected_portfolio_usd_bcv: projected.usd_bcv ?? 0,
    current_portfolio_usdt: current.usdt ?? 0,
    projected_portfolio_usdt: projected.usdt ?? 0,
    net_ves_impact: data.impact?.delta_ves ?? 0,
    net_usd_bcv_impact: (projected.usd_bcv ?? 0) - (current.usd_bcv ?? 0),
    net_usdt_impact: data.impact?.delta_usdt ?? 0,
    bcv_target: data.inputs?.bcv_target ?? params.bcv_target,
    usdt_target: data.inputs?.usdt_target ?? params.usdt_target,
    wall_street_shock_pct: data.inputs?.wall_street_shock_pct ?? params.wall_street_shock_pct ?? 0,
    protection_rating: ratingByBadge[data.verdict?.badge] || 'Media',
    advice: data.verdict?.summary || '',
  };
}

export async function fetchInternationalQuotes(): Promise<InternationalQuote[]> {
  try {
    const res = await fetch(`${API_BASE}/international/popular`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al cargar cotizaciones de Wall Street');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map((item: any) => ({
        symbol: item.ticker || item.symbol,
        name: item.name || item.ticker,
        price: Number(item.price ?? item.current_price ?? 0),
        change_pct: Number(item.change_pct ?? item.change_today_pct ?? 0),
        currency: 'USD',
        category: item.category || 'US Equities',
      }));
    }
    return [];
  } catch {
    throw new Error('Error al cargar cotizaciones de Wall Street');
  }
}

// Notifications are per user: null without a session or on failure (no sample alerts)
export async function fetchNotifications(category?: string): Promise<{ unread_count: number; notifications: NotificationItem[] } | null> {
  const token = getAuthToken();
  if (!token) return null;
  const headers: HeadersInit = { Authorization: `Bearer ${token}` };

  try {
    const query = category && category !== 'all' ? `?category=${category}` : '';
    const res = await fetch(`${API_BASE}/notifications${query}`, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error('Error al consultar notificaciones');
    const data = await res.json();
    return {
      unread_count: Number(data.unread_count || 0),
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
    };
  } catch {
    return null;
  }
}

export async function markNotificationRead(id: number): Promise<boolean> {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, { method: 'POST', headers });
    return res.ok;
  } catch {
    return false;
  }
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/notifications/read-all`, { method: 'POST', headers });
    return res.ok;
  } catch {
    return false;
  }
}

export async function addPositionApi(pos: {
  ticker: string;
  shares: number;
  buy_price: number;
  currency?: string;
  deduct_from_cash?: boolean;
  broker_commission?: number;
  broker_iva?: number;
  broker_registry_fee?: number;
  net_total_amount?: number;
  execution_date?: string;
  notes?: string;
}): Promise<{ success: boolean; message: string; cash_ves?: number; cash_usd?: number }> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/positions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ticker: pos.ticker,
        shares: pos.shares,
        buy_price: pos.buy_price,
        currency: pos.currency || 'VES',
        deduct_from_cash: pos.deduct_from_cash !== false,
        broker_commission: pos.broker_commission || 0,
        broker_iva: pos.broker_iva || 0,
        broker_registry_fee: pos.broker_registry_fee || 0,
        net_total_amount: pos.net_total_amount,
        execution_date: pos.execution_date,
        notes: pos.notes,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al agregar posición');
    return data;
  } catch (err: any) {
    return { success: false, message: err.message || 'Error al registrar posición' };
  }
}

export async function updatePositionApi(
  positionId: string | number,
  payload: {
    shares: number;
    buy_price: number;
    adjust_cash?: boolean;
    notes?: string;
  }
): Promise<{ success: boolean; message: string; cash_ves?: number; cash_usd?: number }> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/positions/${positionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al actualizar posición');
    return data;
  } catch (err: any) {
    return { success: false, message: err.message || 'Error al actualizar posición' };
  }
}

export async function sellPositionApi(payload: {
  ticker: string;
  shares_to_sell: number;
  sell_price: number;
  currency?: string;
  credit_to_cash?: boolean;
  broker_commission?: number;
  broker_iva?: number;
  broker_registry_fee?: number;
  net_total_amount?: number;
  execution_date?: string;
  notes?: string;
}): Promise<{
  success: boolean;
  message: string;
  remaining_shares?: number;
  realized_pnl_ves?: number;
  net_ves?: number;
  cash_ves?: number;
  cash_usd?: number;
}> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/positions/sell`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al registrar venta');
    return data;
  } catch (err: any) {
    return { success: false, message: err.message || 'Error al registrar venta' };
  }
}

export async function deletePositionApi(positionId: string | number): Promise<boolean> {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/positions/${positionId}`, {
      method: 'DELETE',
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateCashApi(cashVes: number, cashUsd: number): Promise<boolean> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/portfolio/cash`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ cash_ves: cashVes, cash_usd: cashUsd }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function depositCashApi(deposit: {
  amount: number;
  currency?: string;
  date?: string;
  concept?: string;
  reference?: string;
}): Promise<{ success: boolean; message: string; cash_ves?: number; cash_usd?: number }> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/portfolio/deposit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        amount: deposit.amount,
        currency: deposit.currency || 'VES',
        date: deposit.date,
        concept: deposit.concept || 'Aporte de capital para inversión',
        reference: deposit.reference,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al registrar depósito');
    return data;
  } catch (err: any) {
    return { success: false, message: err.message || 'No se pudo registrar el depósito' };
  }
}

export async function fetchCashMovementsApi(): Promise<{
  cash_ves: number;
  cash_usd: number;
  movements: Array<{
    id: number;
    movement_type: string;
    currency: string;
    amount: number;
    balance_after: number;
    concept: string;
    reference?: string;
    movement_date: string;
    created_at: string;
  }>;
}> {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/portfolio/cash-movements`, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error('Error al obtener movimientos');
    return await res.json();
  } catch {
    return { cash_ves: 0, cash_usd: 0, movements: [] };
  }
}

export async function fetchTelegramPairingUrl(): Promise<{
  bot_username: string;
  link_code: string;
  direct_url: string;
  linked: boolean;
  telegram_username?: string;
  chat_id?: string;
}> {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/telegram/pairing-url`, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error('Error al obtener enlace de Telegram');
    return await res.json();
  } catch {
    return {
      bot_username: 'KixInvert_bot',
      link_code: 'KIX-DEMO',
      direct_url: 'https://t.me/KixInvert_bot?start=KIX-DEMO',
      linked: false,
    };
  }
}


