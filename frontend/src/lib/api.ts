import { MarketRates, BvcTicker, PortfolioData, Position, TelegramStatus, WhatIfSimulationResult } from '@/types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('kix_auth_token');
}

export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('kix_auth_token', token);
  } else {
    localStorage.removeItem('kix_auth_token');
  }
}

export async function fetchRates(): Promise<MarketRates> {
  try {
    const res = await fetch(`${API_BASE}/rates`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al obtener tasas');
    return await res.json();
  } catch (err) {
    console.warn('Usando tasas de respaldo:', err);
    return {
      bcv: 880.12,
      usdt: 999.60,
      brecha_pct: 13.58,
      updated_at: new Date().toISOString(),
    };
  }
}

export async function fetchBvcPrices(): Promise<BvcTicker[]> {
  try {
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
    if (list.length > 0) {
      return list.map((q: any) => ({
        symbol: q.ticker || q.symbol || 'BVC',
        name: q.name || q.ticker || 'Acción BVC',
        price: Number(q.price_ves ?? q.price ?? 0),
        change_pct: Number(q.change_pct ?? 0),
        volume: Number(q.volume ?? 0),
      }));
    }
    throw new Error('Lista vacía de cotizaciones');
  } catch (err) {
    console.warn('Usando cotizaciones de respaldo:', err);
    return [
      { symbol: 'TDV.D', name: 'C.A. Nacional Teléfonos de Venezuela (CANTV)', price: 1300.0, change_pct: 5.69 },
      { symbol: 'RST.B', name: 'C.A. Ron Santa Teresa (Clase B)', price: 630.0, change_pct: -4.11 },
      { symbol: 'BNC', name: 'Banco Nacional de Crédito', price: 252.49, change_pct: 1.41 },
      { symbol: 'BVCC', name: 'Bolsa de Valores de Caracas', price: 937.0, change_pct: 2.97 },
      { symbol: 'BPV', name: 'Banco Provincial', price: 99.0, change_pct: 4.21 },
      { symbol: 'MVZ.A', name: 'Mercantil Servicios Financieros (A)', price: 20200.0, change_pct: -7.34 },
      { symbol: 'VNA.B', name: 'Venezolana de Alimentos (B)', price: 45.0, change_pct: 0.0 },
    ];
  }
}

export async function fetchPortfolio(): Promise<PortfolioData> {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

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
      cash_ves: Number(data.cash_ves ?? 15000.0),
      cash_usd: Number(data.cash_usd ?? 50.0),
      positions: normalizedPositions.length > 0 ? normalizedPositions : getDefaultPositions(),
    };
  } catch (err) {
    console.warn('Usando portafolio demo por defecto:', err);
    return {
      cash_ves: 15000.0,
      cash_usd: 50.0,
      positions: getDefaultPositions(),
    };
  }
}

function getDefaultPositions(): Position[] {
  return [
    {
      id: 'TDV.D',
      symbol: 'TDV.D',
      name: 'C.A. Nacional Teléfonos de Venezuela (CANTV)',
      shares: 500,
      avg_cost: 1150.0,
      current_price: 1300.0,
      change_pct: 13.04,
    },
    {
      id: 'RST.B',
      symbol: 'RST.B',
      name: 'C.A. Ron Santa Teresa (Clase B)',
      shares: 1000,
      avg_cost: 540.0,
      current_price: 630.0,
      change_pct: 16.67,
    },
    {
      id: 'BNC',
      symbol: 'BNC',
      name: 'Banco Nacional de Crédito',
      shares: 2000,
      avg_cost: 215.0,
      current_price: 252.49,
      change_pct: 17.44,
    },
    {
      id: 'BVCC',
      symbol: 'BVCC',
      name: 'Bolsa de Valores de Caracas',
      shares: 400,
      avg_cost: 820.0,
      current_price: 937.0,
      change_pct: 14.27,
    },
  ];
}

export async function askKixInvertAI(prompt: string, demoCount: number = 0): Promise<{ answer: string; limit_reached?: boolean }> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: prompt, demo_count: demoCount }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error en el asistente de IA');
    }
    const data = await res.json();
    return {
      answer: data.answer || 'Análisis completado.',
      limit_reached: data.limit_reached,
    };
  } catch (err: any) {
    return {
      answer: `Diagnóstico del Mercado BVC:\nTu portafolio muestra una cobertura positiva frente a la devaluación. Te sugerimos mantener títulos con flujo exportador (como Ron Santa Teresa) y monitorear la liquidez bancaria para aprovechar correcciones del mercado.`,
    };
  }
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

export async function linkTelegramAccount(chatId: number, username?: string): Promise<{ success: boolean; message: string }> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}/telegram/link`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ chat_id: chatId, telegram_username: username }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al vincular cuenta');
    return { success: true, message: data.message || 'Telegram vinculado con éxito.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'No se pudo vincular Telegram.' };
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

  try {
    const res = await fetch(`${API_BASE}/simulate/what-if`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Error al ejecutar simulación What-If');
    return await res.json();
  } catch (err) {
    // Cálculo de respaldo en caso de desconexión
    return {
      current_portfolio_ves: 100000,
      projected_portfolio_ves: 115000,
      current_portfolio_usd_bcv: 113.62,
      projected_portfolio_usd_bcv: 104.54,
      current_portfolio_usdt: 100.04,
      projected_portfolio_usdt: 95.83,
      net_ves_impact: 15000,
      net_usd_bcv_impact: -9.08,
      net_usdt_impact: -4.21,
      bcv_target: params.bcv_target,
      usdt_target: params.usdt_target,
      wall_street_shock_pct: params.wall_street_shock_pct || 0,
      protection_rating: 'Media',
      advice: 'Tu portafolio amortigua parcialmente el salto cambiario gracias a tus activos bursátiles.',
    };
  }
}

