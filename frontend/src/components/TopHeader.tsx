'use client';

import React from 'react';
import { TrendingUp, Landmark, Coins, ArrowLeftRight, Bot, LogOut, User, RefreshCw, Cpu, DollarSign } from 'lucide-react';
import { MarketRates, UserSession, Ecosystem } from '@/types';
import { formatVES } from '@/lib/formatters';
import { playTerminalSound } from '@/lib/audio';
import { AnimatedBell, AnimatedPulseBeacon, AnimatedTelegram, AnimatedSparkles } from './AnimatedIcons';

interface TopHeaderProps {
  rates: MarketRates;
  session: UserSession | null;
  currentView?: 'terminal' | 'welcome';
  onSelectView?: (view: 'terminal' | 'welcome') => void;
  currentEcosystem?: Ecosystem;
  onSelectEcosystem?: (eco: Ecosystem) => void;
  unreadNotifsCount?: number;
  onOpenNotifs?: () => void;
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
  currentView = 'terminal',
  onSelectView,
  currentEcosystem = 'BVC',
  onSelectEcosystem,
  unreadNotifsCount = 0,
  onOpenNotifs,
  isRefreshing = false,
  onRefresh,
  onOpenAI,
  onOpenTelegram,
  onLogout,
  onOpenAuth,
  onGoWelcome,
}) => {
  return (
    <header
      className="top-bar"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(10, 14, 23, 0.9)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Brand & Market Open Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          className="brand"
          onClick={() => {
            playTerminalSound('click');
            if (onGoWelcome) onGoWelcome();
          }}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          <div
            className="brand-logo"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
            }}
          >
            <TrendingUp size={20} />
          </div>
          <div className="brand-text">
            <span className="brand-name" style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
              KixInvert<span style={{ color: '#10b981' }}>APP</span>
            </span>
            <span className="brand-tag" style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
              Terminal Bursátil
            </span>
          </div>
        </div>

        {/* View Switcher: ONLY for guest users exploring Inicio vs Demo Terminal */}
        {onSelectView && !session && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '3px',
              gap: '4px',
            }}
          >
            <button
              onClick={() => {
                playTerminalSound('toggle');
                onSelectView('welcome');
              }}
              title="Ir a la Página de Inicio (Historia, Funciones, Precios, FAQ)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '9px',
                background: currentView === 'welcome' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                border: currentView === 'welcome' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                color: currentView === 'welcome' ? '#38bdf8' : '#94a3b8',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span>🏠</span>
              <span>Inicio</span>
            </button>

            <button
              onClick={() => {
                playTerminalSound('toggle');
                onSelectView('terminal');
              }}
              title="Abrir Terminal Bursátil en Vivo"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '9px',
                background: currentView === 'terminal' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                border: currentView === 'terminal' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                color: currentView === 'terminal' ? '#a7f3d0' : '#94a3b8',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span>📊</span>
              <span>Terminal</span>
            </button>
          </div>
        )}

        {/* Private Workspace Badge for Logged In Users */}
        {session && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#34d399',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            <AnimatedPulseBeacon color="#10b981" />
            <span>Terminal Privada</span>
          </div>
        )}

        {/* Live Ecosystem Market Switcher (In Header when in Terminal) */}
        {onSelectEcosystem && currentView === 'terminal' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '3px',
              gap: '4px',
            }}
          >
            <button
              onClick={() => {
                playTerminalSound('toggle');
                onSelectEcosystem('BVC');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '8px',
                background: currentEcosystem === 'BVC' ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                border: currentEcosystem === 'BVC' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid transparent',
                color: currentEcosystem === 'BVC' ? '#a7f3d0' : '#94a3b8',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span>🇻🇪</span>
              <span>Caracas BVC</span>
            </button>

            <button
              onClick={() => {
                playTerminalSound('toggle');
                onSelectEcosystem('US');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '8px',
                background: currentEcosystem === 'US' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                border: currentEcosystem === 'US' ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid transparent',
                color: currentEcosystem === 'US' ? '#93c5fd' : '#94a3b8',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span>🇺🇸</span>
              <span>Wall Street</span>
            </button>
          </div>
        )}
      </div>

      {/* Live Exchange Rate Chips & Actions */}
      <div className="rates-ticker" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {currentEcosystem === 'BVC' ? (
          <>
            {/* USD BCV */}
            <div className="ticker-chip" title="Tipo de cambio oficial del Banco Central de Venezuela">
              <span className="chip-label">
                <Landmark size={13} /> USD BCV:
              </span>
              <span className="chip-val">{formatVES(rates.bcv)}</span>
            </div>

            {/* USDT Binance */}
            <div className="ticker-chip" title="Tipo de cambio mediano real de Binance P2P">
              <span className="chip-label">
                <Coins size={13} /> USDT:
              </span>
              <span className="chip-val">{formatVES(rates.usdt)}</span>
            </div>

            {/* Brecha Cambiaria */}
            <div className="ticker-chip chip-brecha" title="Brecha porcentual entre el Dólar BCV y el USDT de Binance P2P">
              <span className="chip-label">
                <ArrowLeftRight size={13} /> Brecha:
              </span>
              <span className="chip-val text-amber">+{rates.brecha_pct.toFixed(2)}%</span>
            </div>
          </>
        ) : (
          <>
            {/* Wall Street Global Chips */}
            <div className="ticker-chip" title="SPDR S&P 500 ETF Trust">
              <span className="chip-label">
                <TrendingUp size={13} /> S&P 500:
              </span>
              <span className="chip-val text-green">$585.40</span>
            </div>
            <div className="ticker-chip" title="Invesco QQQ Trust (Nasdaq 100)">
              <span className="chip-label">
                <Cpu size={13} /> Nasdaq:
              </span>
              <span className="chip-val text-green">$492.15</span>
            </div>
          </>
        )}

        {/* Auto-Sync Live Status & Instant Refresh */}
        <button
          onClick={() => {
            playTerminalSound('click');
            if (onRefresh) onRefresh();
          }}
          disabled={isRefreshing}
          title="Mercado en vivo: Actualización automática cada 15 segundos. Clic para sincronizar ahora."
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
          <AnimatedPulseBeacon color="#10b981" size={5} />
          <RefreshCw size={12} className={isRefreshing ? 'spin-icon' : ''} />
          <span>{isRefreshing ? 'Sincronizando...' : 'EN VIVO'}</span>
        </button>

        {/* Notifications Center Bell with Hugeicons Animated Motion */}
        {onOpenNotifs && (
          <button
            onClick={() => {
              playTerminalSound('click');
              onOpenNotifs();
            }}
            title="Centro de Alertas y Señales Financieras"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: unreadNotifsCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.05)',
              border: unreadNotifsCount > 0 ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: unreadNotifsCount > 0 ? '#f87171' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <AnimatedBell size={17} active={unreadNotifsCount > 0} hasUnread={unreadNotifsCount > 0} />
          </button>
        )}

        {/* Telegram Quick Alerts Button */}
        {onOpenTelegram && (
          <button
            onClick={() => {
              playTerminalSound('click');
              onOpenTelegram();
            }}
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
            <AnimatedTelegram size={15} />
            <span>Telegram Bot</span>
          </button>
        )}

        {/* AI Quick Button */}
        <button
          className="btn-ai-glow btn-shimmer"
          onClick={() => {
            playTerminalSound('click');
            onOpenAI();
          }}
          title="Consultar al Analista Bursátil KixInvert AI"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 13px',
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
                padding: '6px 11px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                fontSize: '0.82rem',
              }}
            >
              <User size={14} style={{ color: '#10b981' }} />
              <strong>{session.is_demo ? 'Inversionista' : session.username}</strong>
            </div>
            <button
              onClick={() => {
                playTerminalSound('click');
                onLogout();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 11px',
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
            onClick={() => {
              playTerminalSound('click');
              onOpenAuth();
            }}
            style={{
              padding: '7px 16px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.84rem',
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
