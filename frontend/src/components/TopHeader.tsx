'use client';

import React from 'react';
import { TrendingUp, Landmark, Coins, ArrowLeftRight, Bot, LogOut, User, RefreshCw } from 'lucide-react';
import { MarketRates, UserSession } from '@/types';
import { formatVES } from '@/lib/formatters';
import { AnimatedBell, AnimatedPulseBeacon, AnimatedTelegram, AnimatedSparkles } from './AnimatedIcons';

interface TopHeaderProps {
  rates: MarketRates;
  session: UserSession | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onOpenAI: () => void;
  onOpenTelegram?: () => void;
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
  onOpenTelegram,
  onLogout,
  onOpenAuth,
  onGoWelcome,
}) => {
  return (
    <header className="top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 28px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(10, 14, 23, 0.85)', backdropFilter: 'blur(16px)' }}>
      <div className="brand" onClick={onGoWelcome} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          className="brand-logo"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
          }}
        >
          <TrendingUp size={22} />
        </div>
        <div className="brand-text">
          <span className="brand-name" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
            KixInvert<span style={{ color: '#10b981' }}>APP</span>
          </span>
          <span className="brand-tag" style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
            Terminal Bursátil BVC Tri-Monetario
          </span>
        </div>
      </div>

      {/* Live Exchange Rate Chips & Actions */}
      <div className="rates-ticker" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* USD BCV */}
        <div className="ticker-chip" title="Tipo de cambio oficial del Banco Central de Venezuela">
          <span className="chip-label">
            <Landmark size={14} /> USD BCV:
          </span>
          <span className="chip-val">{formatVES(rates.bcv)}</span>
        </div>

        {/* USDT Binance */}
        <div className="ticker-chip" title="Tipo de cambio mediano real de Binance P2P">
          <span className="chip-label">
            <Coins size={14} /> USDT:
          </span>
          <span className="chip-val">{formatVES(rates.usdt)}</span>
        </div>

        {/* Brecha Cambiaria */}
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
            padding: '6px 12px',
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
          <AnimatedPulseBeacon color="#10b981" size={5} />
          <RefreshCw size={12} className={isRefreshing ? 'spin-icon' : ''} />
          <span>{isRefreshing ? 'Sincronizando...' : 'EN VIVO'}</span>
        </button>

        {/* Telegram Quick Alerts Button (Hugeicons Animated Bell) */}
        {onOpenTelegram && (
          <button
            onClick={onOpenTelegram}
            className="btn-shimmer"
            title="Centro de Alertas Móviles de Telegram (@KixInvert_bot)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '9999px',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              color: '#38bdf8',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <AnimatedBell size={15} hasUnread={true} />
            <span>Telegram Bot</span>
          </button>
        )}

        {/* AI Quick Button */}
        <button
          className="btn-ai-glow btn-shimmer"
          onClick={onOpenAI}
          title="Consultar al Analista Bursátil KixInvert AI"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(6, 182, 212, 0.2))',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            color: '#c084fc',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <AnimatedSparkles size={15} /> KixInvert AI
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
