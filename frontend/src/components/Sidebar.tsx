'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  PlusCircle,
  Volume2,
  VolumeX,
  RefreshCw,
  House,
} from 'lucide-react';
import { MarketCode } from './Motion';
import { MarketRates, UserSession, Ecosystem } from '@/types';

import { playTerminalSound } from '@/lib/audio';
import { AnimatedBell, AnimatedPulseBeacon, AnimatedTelegram, AnimatedSparkles } from './AnimatedIcons';

export type NavView = 'dashboard' | 'bvc_live' | 'whatif' | 'ai' | 'telegram';

interface SidebarProps {
  currentNav: NavView;
  onSelectNav: (view: NavView) => void;
  currentEcosystem: Ecosystem;
  onSelectEcosystem: (eco: Ecosystem) => void;
  rates: MarketRates;
  session: UserSession | null;
  unreadNotifsCount?: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenNotifs: () => void;
  onOpenAI: () => void;
  onOpenTelegram: () => void;
  onOpenAddPosition?: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  onRefreshAll?: () => void;
  onGoWelcome?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentNav,
  onSelectNav,
  currentEcosystem,
  onSelectEcosystem,
  rates,
  session,
  unreadNotifsCount = 0,
  soundEnabled,
  onToggleSound,
  onOpenNotifs,
  onOpenAI,
  onOpenTelegram,
  onOpenAddPosition,
  onLogout,
  onOpenAuth,
  onRefreshAll,
  onGoWelcome,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sidebar-container ${collapsed ? 'collapsed' : ''}`}
      style={{
        width: collapsed ? '74px' : '260px',
        background: 'rgba(12, 15, 20, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '18px 12px',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 50,
        transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Top Section: Brand & Collapse Toggle */}
      <div style={{ overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            marginBottom: '20px',
            paddingBottom: '14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--on-accent)',
                  boxShadow: 'none',
                }}
              >
                <TrendingUp size={18} />
              </div>
              <div>
                <div style={{ fontSize: '1.02rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                  KixInvert<span style={{ color: '#7c8cff' }}>APP</span>
                </div>
                <div style={{ fontSize: '0.66rem', color: '#9aa3b2', fontWeight: 600 }}>
                  Terminal Tri-Monetario
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              playTerminalSound('click');
              setCollapsed(!collapsed);
            }}
            title={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#9aa3b2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* QUICK LINK: INICIO / LANDING */}
        {onGoWelcome && (
          <div style={{ marginBottom: '14px' }}>
            <button
              onClick={() => {
                playTerminalSound('click');
                onGoWelcome();
              }}
              title="Volver a la Página de Inicio (Historia, Precios, FAQ)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: '10px',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(124, 140, 255, 0.25)',
                background: 'rgba(124, 140, 255, 0.08)',
                color: '#9aa6ff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%',
                fontWeight: 700,
                fontSize: '0.84rem',
              }}
            >
              <House size={16} />
              {!collapsed && <span>Página de Inicio</span>}
            </button>
          </div>
        )}

        {/* SECTION 1: MERCADOS & ECOSISTEMAS */}
        <div style={{ marginBottom: '16px' }}>
          {!collapsed && (
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#667085', letterSpacing: '0.08em', marginBottom: '8px', paddingLeft: '6px' }}>
              MERCADOS
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Caracas BVC */}
            <button
              onClick={() => {
                playTerminalSound('toggle');
                onSelectEcosystem('BVC');
              }}
              title="Bolsa de Valores de Caracas (BVC)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: '10px',
                border: currentEcosystem === 'BVC' ? '1px solid rgba(124, 140, 255, 0.35)' : '1px solid transparent',
                background: currentEcosystem === 'BVC' ? 'rgba(124, 140, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                color: currentEcosystem === 'BVC' ? '#7c8cff' : '#9aa3b2',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MarketCode code="VE" />
                {!collapsed && <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Caracas BVC</span>}
              </div>
              {!collapsed && (
                <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(124, 140, 255, 0.2)', color: '#c9cfff', fontWeight: 700 }}>
                  Activo
                </span>
              )}
            </button>

            {/* Wall Street Global */}
            <button
              onClick={() => {
                playTerminalSound('toggle');
                onSelectEcosystem('US');
              }}
              title="Wall Street Global (S&P 500, Nasdaq, NYSE)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: '10px',
                border: currentEcosystem === 'US' ? '1px solid rgba(124, 140, 255, 0.35)' : '1px solid transparent',
                background: currentEcosystem === 'US' ? 'rgba(124, 140, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                color: currentEcosystem === 'US' ? '#9aa6ff' : '#9aa3b2',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MarketCode code="US" />
                {!collapsed && <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Wall Street</span>}
              </div>
              {!collapsed && (
                <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(124, 140, 255, 0.2)', color: '#b4bcff', fontWeight: 700 }}>
                  Global
                </span>
              )}
            </button>
          </div>
        </div>

        {/* SECTION 2: VISTAS DEL TERMINAL */}
        <div style={{ marginBottom: '16px' }}>
          {!collapsed && (
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#667085', letterSpacing: '0.08em', marginBottom: '8px', paddingLeft: '6px' }}>
              TERMINAL
            </div>
          )}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Dashboard General */}
            <button
              onClick={() => {
                playTerminalSound('click');
                onSelectNav('dashboard');
              }}
              className={`sidebar-nav-item ${currentNav === 'dashboard' ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                width: '100%',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: '10px',
                border: currentNav === 'dashboard' ? '1px solid rgba(124, 140, 255, 0.3)' : '1px solid transparent',
                background: currentNav === 'dashboard' ? 'rgba(124, 140, 255, 0.12)' : 'transparent',
                color: currentNav === 'dashboard' ? '#7c8cff' : '#9aa3b2',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <LayoutDashboard size={17} />
                {!collapsed && <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>Mi Portafolio</span>}
              </div>
            </button>

            {/* Pizarra en Vivo */}
            <button
              onClick={() => {
                playTerminalSound('click');
                onSelectNav('bvc_live');
              }}
              className={`sidebar-nav-item ${currentNav === 'bvc_live' ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                width: '100%',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: '10px',
                border: currentNav === 'bvc_live' ? '1px solid rgba(124, 140, 255, 0.3)' : '1px solid transparent',
                background: currentNav === 'bvc_live' ? 'rgba(124, 140, 255, 0.12)' : 'transparent',
                color: currentNav === 'bvc_live' ? '#7c8cff' : '#9aa3b2',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TrendingUp size={17} />
                {!collapsed && <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>Pizarra en Vivo</span>}
              </div>
              {!collapsed && <AnimatedPulseBeacon color="#7c8cff" size={5} />}
            </button>

            {/* AI Analista */}
            <button
              onClick={() => {
                playTerminalSound('click');
                onOpenAI();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                width: '100%',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: '10px',
                background: 'rgba(124, 140, 255, 0.08)',
                border: '1px solid rgba(124, 140, 255, 0.25)',
                color: '#9aa6ff',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AnimatedSparkles size={17} />
                {!collapsed && <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>AI Analista</span>}
              </div>
              {!collapsed && (
                <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(124, 140, 255, 0.25)', color: '#dfe2ff', fontWeight: 800 }}>
                  PRO
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* SECTION 3: OPERACIONES & HERRAMIENTAS */}
        <div>
          {!collapsed && (
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#667085', letterSpacing: '0.08em', marginBottom: '8px', paddingLeft: '6px' }}>
              HERRAMIENTAS
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Botón Operar */}
            {onOpenAddPosition && (
              <button
                onClick={() => {
                  playTerminalSound('click');
                  onOpenAddPosition();
                }}
                className="btn-shimmer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: collapsed ? '10px 0' : '9px 12px',
                  borderRadius: '10px',
                  background: 'var(--accent)',
                  color: 'var(--on-accent)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: 'none',
                  marginBottom: '6px',
                }}
              >
                <PlusCircle size={17} />
                {!collapsed && <span>+ Operar Acción</span>}
              </button>
            )}

            {/* Simulador What-If */}
            <button
              onClick={() => {
                playTerminalSound('click');
                onSelectNav('whatif');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: '10px',
                width: '100%',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: '10px',
                border: currentNav === 'whatif' ? '1px solid rgba(124, 140, 255, 0.35)' : '1px solid transparent',
                background: currentNav === 'whatif' ? 'rgba(124, 140, 255, 0.12)' : 'transparent',
                color: currentNav === 'whatif' ? '#9aa6ff' : '#9aa3b2',
                cursor: 'pointer',
              }}
            >
              <Zap size={17} />
              {!collapsed && <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>Simulador What-If</span>}
            </button>

            {/* Alertas & Notificaciones (Con campana animada y badge) */}
            <button
              onClick={() => {
                playTerminalSound('click');
                onOpenNotifs();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                width: '100%',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: '10px',
                background: 'transparent',
                border: '1px solid transparent',
                color: '#9aa3b2',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AnimatedBell size={17} active={unreadNotifsCount > 0} hasUnread={unreadNotifsCount > 0} />
                {!collapsed && <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>Alertas & Señales</span>}
              </div>
              {!collapsed && unreadNotifsCount > 0 && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '9999px',
                    background: '#e5616e',
                    color: '#fff',
                    boxShadow: 'none',
                  }}
                >
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {/* Bot Telegram */}
            <button
              onClick={() => {
                playTerminalSound('click');
                onOpenTelegram();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                width: '100%',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: '10px',
                background: 'rgba(124, 140, 255, 0.08)',
                border: '1px solid rgba(124, 140, 255, 0.25)',
                color: '#9aa6ff',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AnimatedTelegram size={17} />
                {!collapsed && <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Bot Telegram</span>}
              </div>
              {!collapsed && <AnimatedPulseBeacon color="#7c8cff" size={5} />}
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER: CONTROLES DEL SISTEMA, AUDIO Y USUARIO */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
        {/* Quick System Action Icons (Sound, Sync, Refresh) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Sonido activado (clic para silenciar)' : 'Sonido silenciado (clic para activar)'}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 0',
              borderRadius: '8px',
              background: soundEnabled ? 'rgba(124, 140, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
              border: soundEnabled ? '1px solid rgba(124, 140, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: soundEnabled ? '#7c8cff' : '#667085',
              cursor: 'pointer',
            }}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          {onRefreshAll && (
            <button
              onClick={() => {
                playTerminalSound('click');
                onRefreshAll();
              }}
              title="Sincronizar ahora con la BVC y Wall Street"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 0',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#9aa3b2',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {/* User Profile Card */}
        {session ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              padding: collapsed ? '8px 0' : '8px 10px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'rgba(124, 140, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#7c8cff',
                }}
              >
                <User size={14} />
              </div>
              {!collapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                    {session.is_demo ? 'Inversionista' : session.username}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#7c8cff' }}>KixBroker BVC</div>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={() => {
                  playTerminalSound('click');
                  onLogout();
                }}
                title="Cerrar sesión"
                style={{
                  color: '#9aa3b2',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              playTerminalSound('click');
              onOpenAuth();
            }}
            style={{
              width: '100%',
              padding: collapsed ? '9px 0' : '8px 12px',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            {collapsed ? <User size={15} /> : 'Iniciar Sesión'}
          </button>
        )}
      </div>
    </aside>
  );
};
