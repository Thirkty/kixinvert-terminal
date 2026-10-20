'use client';

import React from 'react';
import { TrendingUp, Landmark, Coins, ArrowLeftRight, Volume2, Bell, Bot, LogOut, User, RefreshCw } from 'lucide-react';
import { MarketRates, UserSession } from '@/types';
import { formatVES } from '@/lib/formatters';

interface TopHeaderProps {
  rates: MarketRates;
  session: UserSession | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onOpenAI: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  onGoWelcome?: () => void;
}

const TopHeaderComponent: React.FC<TopHeaderProps> = ({
  rates,
  session,
  isRefreshing = false,
  onRefresh,
  onOpenAI,
  onLogout,
  onOpenAuth,
  onGoWelcome,
}) => {
  return (
    <header className="top-bar">
      <div className="brand" onClick={onGoWelcome} style={{ cursor: 'pointer' }}>
        <div className="brand-logo">
          <TrendingUp size={24} />
        </div>
        <div className="brand-text">
          <span className="brand-name">
            KixInvert<span className="highlight">APP</span>
          </span>
          <span className="brand-tag">Terminal Bursátil BVC Tri-Monetario</span>
        </div>
      </div>

      {/* Live Exchange Rate Chips */}
      <div className="rates-ticker">
        <div className="ticker-chip" title="Tipo de cambio oficial del Banco Central de Venezuela">
          <span className="chip-label">
            <Landmark size={14} /> USD BCV:
          </span>
          <span className="chip-val">{formatVES(rates.bcv)}</span>
        </div>

        <div className="ticker-chip" title="Tipo de cambio mediano real de Binance P2P">
          <span className="chip-label">
            <Coins size={14} /> USDT:
          </span>
          <span className="chip-val">{formatVES(rates.usdt)}</span>
        </div>

        <div className="ticker-chip chip-brecha" title="Brecha porcentual entre el Dólar BCV y el USDT de Binance P2P">
          <span className="chip-label">
            <ArrowLeftRight size={14} /> Brecha:
          </span>
          <span className="chip-val text-amber">+{rates.brecha_pct.toFixed(2)}%</span>
        </div>

        {/* Auto-Sync Live Status & Instant Refresh */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Mercado en vivo: Actualización automática cada 15 segundos. Clic para sincronizar ahora con la BVC y BCV."
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 11px',
            borderRadius: '9999px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.28)',
            color: '#6ee7b7',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: isRefreshing ? 'wait' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span className="pulse-dot" style={{ width: '6px', height: '6px', minWidth: '6px' }}></span>
          <RefreshCw size={12} className={isRefreshing ? 'spin-icon' : ''} />
          <span>{isRefreshing ? 'Sincronizando...' : 'EN VIVO (15s)'}</span>
        </button>

        {/* AI Quick Button */}
        <button
          className="btn-ai-glow"
          onClick={onOpenAI}
          title="Consultar al Analista Bursátil KixInvert AI"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(6, 182, 212, 0.2))',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            color: '#c084fc',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Bot size={15} /> KixInvert AI
        </button>

        {/* User Session / Auth Controls */}
        {session ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                fontSize: '0.82rem',
              }}
            >
              <User size={14} style={{ color: '#10b981' }} />
              <strong>{session.is_demo ? 'Inversionista Demo' : session.username}</strong>
            </div>
            <button
              onClick={onLogout}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#f43f5e',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <LogOut size={14} /> Salir
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            style={{
              padding: '8px 18px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Iniciar Sesión
          </button>
        )}
      </div>
    </header>
  );
};

export const TopHeader = React.memo(TopHeaderComponent);
