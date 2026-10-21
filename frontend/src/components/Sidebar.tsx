'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  Bot,
  Send,
  ChevronLeft,
  ChevronRight,
  Shield,
  Coins,
  LogOut,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import { MarketRates, UserSession } from '@/types';
import { formatVES } from '@/lib/formatters';
import { AnimatedBell, AnimatedPulseBeacon, AnimatedTelegram, AnimatedSparkles } from './AnimatedIcons';

export type NavView = 'dashboard' | 'bvc_live' | 'whatif' | 'ai' | 'telegram';

interface SidebarProps {
  currentNav: NavView;
  onSelectNav: (view: NavView) => void;
  rates: MarketRates;
  session: UserSession | null;
  onOpenAI: () => void;
  onOpenTelegram: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentNav,
  onSelectNav,
  rates,
  session,
  onOpenAI,
  onOpenTelegram,
  onLogout,
  onOpenAuth,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    {
      id: 'dashboard' as NavView,
      label: 'Dashboard General',
      icon: <LayoutDashboard size={18} />,
      badge: 'BVC',
    },
    {
      id: 'bvc_live' as NavView,
      label: 'Pizarra en Vivo',
      icon: <TrendingUp size={18} />,
      badge: 'Live',
    },
    {
      id: 'whatif' as NavView,
      label: 'Simulador What-If',
      icon: <Zap size={18} />,
      badge: 'Stress',
    },
    {
      id: 'ai' as NavView,
      label: 'Diagnóstico IA',
      icon: <AnimatedSparkles size={18} />,
      badge: 'GPT',
      onClick: onOpenAI,
    },
    {
      id: 'telegram' as NavView,
      label: 'Alertas Telegram',
      icon: <AnimatedTelegram size={18} />,
      badge: 'Móvil',
      onClick: onOpenTelegram,
    },
  ];

  return (
    <aside
      className={`sidebar-container ${collapsed ? 'collapsed' : ''}`}
      style={{
        width: collapsed ? '74px' : '260px',
        background: 'rgba(10, 14, 23, 0.94)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 14px',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 50,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Top Section: Brand & Collapse Toggle */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            marginBottom: '28px',
            paddingBottom: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
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
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                  KixInvert<span style={{ color: '#10b981' }}>APP</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                  Terminal Bursátil BVC
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Items (MicroKit Sliding Item Hover) */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {navItems.map((item) => {
            const isActive = currentNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.onClick) {
                    item.onClick();
                  } else {
                    onSelectNav(item.id);
                  }
                }}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'space-between',
                  width: '100%',
                  padding: collapsed ? '12px 0' : '10px 14px',
                  borderRadius: '10px',
                  border: isActive
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : '1px solid transparent',
                  background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  color: isActive ? '#10b981' : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: isActive ? '#10b981' : '#cbd5e1' }}>{item.icon}</span>
                  {!collapsed && (
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{item.label}</span>
                  )}
                </div>

                {!collapsed && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '6px',
                      background: isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: isActive ? '#6ee7b7' : '#64748b',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Telegram Bot Widget & User Session */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Telegram Status Mini-Pill */}
        {!collapsed ? (
          <div
            onClick={onOpenTelegram}
            style={{
              padding: '12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(2, 132, 199, 0.08))',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AnimatedTelegram size={16} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                  Bot Móvil Telegram
                </span>
              </div>
              <AnimatedPulseBeacon color="#10b981" size={5} />
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              @KixInvert_bot conectado. Haz clic para probar alerta.
            </div>
          </div>
        ) : (
          <button
            onClick={onOpenTelegram}
            title="Alertas Telegram (@KixInvert_bot)"
            style={{
              width: '100%',
              padding: '10px 0',
              borderRadius: '10px',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <AnimatedTelegram size={18} />
          </button>
        )}

        {/* User Session Row */}
        {session ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              padding: collapsed ? '8px 0' : '10px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                }}
              >
                <User size={15} />
              </div>
              {!collapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                    {session.is_demo ? 'Demo' : session.username}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#10b981' }}>En línea</div>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={onLogout}
                title="Cerrar sesión"
                style={{
                  color: '#94a3b8',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            style={{
              width: '100%',
              padding: collapsed ? '10px 0' : '9px 12px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            {collapsed ? <User size={16} /> : 'Iniciar Sesión'}
          </button>
        )}
      </div>
    </aside>
  );
};
