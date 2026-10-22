'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TopHeader } from '@/components/TopHeader';
import { TickerTape } from '@/components/TickerTape';
import { CurrencySelector } from '@/components/CurrencySelector';
import { HeroKPIs } from '@/components/HeroKPIs';
import { PortfolioPulse } from '@/components/PortfolioPulse';
import { PositionsTable } from '@/components/PositionsTable';
import { WelcomeLanding } from '@/components/WelcomeLanding';
import { AIModal } from '@/components/AIModal';
import { AuthModal } from '@/components/AuthModal';
import { AddPositionModal } from '@/components/AddPositionModal';
import { AdjustCashModal } from '@/components/AdjustCashModal';
import { TelegramModal } from '@/components/TelegramModal';
import { NotificationCenter } from '@/components/NotificationCenter';
import { Sidebar, NavView } from '@/components/Sidebar';
import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import { OnboardingModal } from '@/components/OnboardingModal';
import {
  CurrencyMode,
  MarketRates,
  BvcTicker,
  PortfolioData,
  Position,
  UserSession,
  TriMonetaryTotals,
  Ecosystem,
  InternationalQuote,
  NotificationItem,
} from '@/types';
import {
  fetchRates,
  fetchBvcPrices,
  fetchInternationalQuotes,
  fetchPortfolio,
  fetchNotifications,
  getAuthToken,
  setAuthToken,
  addPositionApi,
  deletePositionApi,
  updateCashApi,
} from '@/lib/api';
import { isSoundEnabled, setSoundEnabled, playTerminalSound } from '@/lib/audio';

export default function Home() {
  // Navigation & Ecosystem State (Default to Landing for guests, Terminal for logged-in users)
  const [currentView, setCurrentView] = useState<'terminal' | 'welcome'>('welcome');
  const [currentNav, setCurrentNav] = useState<NavView>('dashboard');
  const [currentEcosystem, setCurrentEcosystem] = useState<Ecosystem>('BVC');
  const [currentMode, setCurrentMode] = useState<CurrencyMode>('compare');

  // Market & Portfolio Data State
  const [rates, setRates] = useState<MarketRates>({
    bcv: 880.12,
    usdt: 999.6,
    brecha_pct: 13.58,
    updated_at: new Date().toISOString(),
  });

  const [bvcTickers, setBvcTickers] = useState<BvcTicker[]>([]);
  const [intlTickers, setIntlTickers] = useState<InternationalQuote[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData>({
    cash_ves: 0.0,
    cash_usd: 0.0,
    positions: [],
  });

  // Notifications & Sound State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const [isNotifsOpen, setIsNotifsOpen] = useState(false);
  const [soundActive, setSoundActive] = useState<boolean>(true);

  // Session & Modals State (Starts cleanly as null for guests)
  const [session, setSession] = useState<UserSession | null>(null);

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isAddPosOpen, setIsAddPosOpen] = useState(false);
  const [isAdjustCashOpen, setIsAdjustCashOpen] = useState(false);
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Carga y sincronización de datos
  const refreshAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [fetchedRates, fetchedTickers, fetchedIntl, fetchedPortfolio, notifData] = await Promise.all([
        fetchRates(),
        fetchBvcPrices(),
        fetchInternationalQuotes(),
        fetchPortfolio(),
        fetchNotifications(),
      ]);
      setRates(fetchedRates);
      setBvcTickers(fetchedTickers);
      setIntlTickers(fetchedIntl);
      if (fetchedPortfolio) {
        setPortfolio(fetchedPortfolio);
      }
      if (notifData) {
        setNotifications(notifData.notifications);
        setUnreadNotifsCount(notifData.unread_count);
      }
    } catch (err) {
      console.warn('Error sincronizando datos de mercado:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setSoundActive(isSoundEnabled());
    refreshAllData();

    const token = getAuthToken();
    const savedUser = typeof window !== 'undefined' ? localStorage.getItem('kix_username') : null;
    if (token) {
      setSession({
        username: savedUser || 'Inversionista',
        token,
        is_demo: false,
        has_2fa: true,
      });
      // Usuario autenticado entra directo al Terminal en un ecosistema separado
      setCurrentView('terminal');
    } else {
      setSession(null);
      setCurrentView('welcome');
    }

    const interval = setInterval(() => {
      refreshAllData();
    }, 15000);

    return () => clearInterval(interval);
  }, [refreshAllData]);

  const toggleSound = () => {
    const newState = !soundActive;
    setSoundActive(newState);
    setSoundEnabled(newState);
    if (newState) {
      playTerminalSound('success');
    }
  };

  // CÁLCULOS TRI-MONETARIOS PRECISOS (VES, USD BCV, USDT BINANCE P2P)
  const totals: TriMonetaryTotals = useMemo(() => {
    let costVes = 0;
    let valueVes = 0;

    portfolio.positions.forEach((p) => {
      costVes += p.shares * p.avg_cost;
      valueVes += p.shares * p.current_price;
    });

    const totalPortfolioVes = valueVes + portfolio.cash_ves;
    const pnlVes = valueVes - costVes;
    const pnlVesPct = costVes > 0 ? (pnlVes / costVes) * 100 : 0;

    // Conversión a Dólar BCV
    const bcvRate = rates.bcv || 1;
    const costUsdBcv = costVes / bcvRate;
    const valueStockUsdBcv = valueVes / bcvRate;
    const totalPortfolioUsdBcv = totalPortfolioVes / bcvRate;
    const pnlUsdBcv = valueStockUsdBcv - costUsdBcv;
    const pnlUsdBcvPct = costUsdBcv > 0 ? (pnlUsdBcv / costUsdBcv) * 100 : 0;

    // Conversión a USDT Binance P2P
    const usdtRate = rates.usdt || 1;
    const costUsdt = costVes / usdtRate;
    const valueStockUsdt = valueVes / usdtRate;
    const totalPortfolioUsdt = totalPortfolioVes / usdtRate;
    const pnlUsdt = valueStockUsdt - costUsdt;
    const pnlUsdtPct = costUsdt > 0 ? (pnlUsdt / costUsdt) * 100 : 0;

    return {
      ves: { value: totalPortfolioVes, cost: costVes, pnl: pnlVes, pnl_pct: pnlVesPct },
      usd_bcv: { value: totalPortfolioUsdBcv, cost: costUsdBcv, pnl: pnlUsdBcv, pnl_pct: pnlUsdBcvPct },
      usdt: { value: totalPortfolioUsdt, cost: costUsdt, pnl: pnlUsdt, pnl_pct: pnlUsdtPct },
    };
  }, [portfolio, rates]);

  // Manejo de Acciones persistente con liquidación de efectivo
  const handleAddPosition = async (newPos: Position, deductFromCash: boolean = true, execDate?: string) => {
    playTerminalSound('success');
    const res = await addPositionApi({
      ticker: newPos.symbol,
      shares: newPos.shares,
      buy_price: newPos.avg_cost,
      currency: 'VES',
      deduct_from_cash: deductFromCash,
      execution_date: execDate,
    });
    if (res.cash_ves !== undefined) {
      setPortfolio((prev) => ({ ...prev, cash_ves: res.cash_ves! }));
    }
    await refreshAllData();
  };

  const handleDeletePosition = async (symbol: string) => {
    playTerminalSound('click');
    const existing = portfolio.positions.find((p) => p.symbol === symbol);
    if (existing && existing.id) {
      await deletePositionApi(existing.id);
    }
    await refreshAllData();
  };

  const handleSaveCash = async (cashVes: number, cashUsd: number) => {
    playTerminalSound('success');
    await updateCashApi(cashVes, cashUsd);
    setPortfolio((prev) => ({
      ...prev,
      cash_ves: cashVes,
      cash_usd: cashUsd,
    }));
    await refreshAllData();
  };

  const handleDemoLogin = () => {
    playTerminalSound('success');
    setSession({
      username: 'Inversionista Demo',
      is_demo: true,
      has_2fa: false,
    });
    setCurrentView('terminal');
  };

  const handleLogout = () => {
    playTerminalSound('click');
    setAuthToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kix_username');
    }
    setSession(null);
    setCurrentView('welcome');
  };

  return (
    <div className="app-container" style={{ padding: 0, maxWidth: '100%' }}>
      {/* VISTA 1: LANDING OPCIONAL DE BIENVENIDA (UNIFICADO, SIN DOBLE HEADER NI OVERLAPPING) */}
      {currentView === 'welcome' && (
        <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <WelcomeLanding
            onEnterDemo={handleDemoLogin}
            onGoTerminal={() => setCurrentView('terminal')}
            session={session}
            onLogout={handleLogout}
            onOpenRegister={() => {
              setAuthMode('register');
              setIsAuthModalOpen(true);
            }}
            onOpenLogin={() => {
              setAuthMode('login');
              setIsAuthModalOpen(true);
            }}
            bvcTickers={bvcTickers}
            intlTickers={intlTickers}
            currentEcosystem={currentEcosystem}
          />
        </div>
      )}

      {/* VISTA 2: TERMINAL BURSÁTIL COMPLETO (INICIO POR DEFECTO CON TODAS LAS HERRAMIENTAS) */}
      {currentView === 'terminal' && (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
          {/* Barra Lateral Colapsable (Studio Admin Style con Ecosistemas y Sonido) */}
          <Sidebar
            currentNav={currentNav}
            onSelectNav={setCurrentNav}
            currentEcosystem={currentEcosystem}
            onSelectEcosystem={setCurrentEcosystem}
            rates={rates}
            session={session}
            unreadNotifsCount={unreadNotifsCount}
            soundEnabled={soundActive}
            onToggleSound={toggleSound}
            onOpenNotifs={() => setIsNotifsOpen((prev) => !prev)}
            onOpenAI={() => setIsAIModalOpen(true)}
            onOpenTelegram={() => setIsTelegramOpen(true)}
            onOpenAddPosition={() => setIsAddPosOpen(true)}
            onLogout={handleLogout}
            onOpenAuth={() => {
              setAuthMode('login');
              setIsAuthModalOpen(true);
            }}
            onRefreshAll={refreshAllData}
            onGoWelcome={() => setCurrentView('welcome')}
          />

          {/* Área Principal de Contenido del Dashboard */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <TopHeader
              rates={rates}
              session={session}
              currentView={currentView}
              onSelectView={setCurrentView}
              currentEcosystem={currentEcosystem}
              onSelectEcosystem={setCurrentEcosystem}
              unreadNotifsCount={unreadNotifsCount}
              onOpenNotifs={() => setIsNotifsOpen((prev) => !prev)}
              isRefreshing={isRefreshing}
              onRefresh={refreshAllData}
              onOpenAI={() => setIsAIModalOpen(true)}
              onOpenTelegram={() => setIsTelegramOpen(true)}
              onLogout={handleLogout}
              onOpenAuth={() => {
                setAuthMode('login');
                setIsAuthModalOpen(true);
              }}
              onGoWelcome={() => setCurrentView('welcome')}
            />

            {/* Ticker Tape en Tiempo Real para Caracas BVC o Wall Street */}
            <TickerTape
              tickers={bvcTickers}
              intlTickers={intlTickers}
              currentEcosystem={currentEcosystem}
              onSelectTicker={() => {
                setCurrentNav('bvc_live');
              }}
            />

            <main className="terminal-main-view" style={{ flex: 1, padding: '24px 32px' }}>
              {/* Header de controles y selector de divisa */}
              <div
                className="controls-section"
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  marginBottom: '24px',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div className="section-heading">
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: currentEcosystem === 'BVC' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                      border: currentEcosystem === 'BVC' ? '1px solid rgba(16, 185, 129, 0.28)' : '1px solid rgba(59, 130, 246, 0.28)',
                      color: currentEcosystem === 'BVC' ? '#a7f3d0' : '#bfdbfe',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      marginBottom: '8px',
                    }}
                  >
                    <span>{currentEcosystem === 'BVC' ? '🇻🇪 Mercado Caracas BVC' : '🇺🇸 Mercado Wall Street Global'}</span>
                    <span>•</span>
                    <span>{session?.is_demo ? 'Cuenta Demo' : `Portafolio de ${session?.username || 'Inversionista'}`}</span>
                  </div>

                  <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                    {currentNav === 'dashboard' && 'Resumen Patrimonial y Cartera'}
                    {currentNav === 'bvc_live' && (currentEcosystem === 'BVC' ? 'Pizarra de Acciones BVC' : 'Pizarra Global Wall Street')}
                    {currentNav === 'whatif' && 'Simulador What-If de Devaluación'}
                    <span
                      className="tag-version"
                      style={{
                        marginLeft: '12px',
                        fontSize: '0.72rem',
                        padding: '3px 8px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '6px',
                        fontWeight: 700,
                      }}
                    >
                      EN VIVO
                    </span>
                  </h1>

                  <p className="subtitle" style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '2px' }}>
                    Monitoreo en tiempo real, microinteracciones con halo spotlight y cobertura cambiaria tri-monetaria
                  </p>
                </div>

                {/* Selector de Divisa Segmentado */}
                <CurrencySelector currentMode={currentMode} onChangeMode={setCurrentMode} />
              </div>

              {/* VISTA A: DASHBOARD PRINCIPAL */}
              {currentNav === 'dashboard' && (
                <>
                  {/* Tarjetas Principales de KPI con Spotlight Cursor Glow (MicroKit) */}
                  <HeroKPIs
                    currentMode={currentMode}
                    rates={rates}
                    portfolio={portfolio}
                    totals={totals}
                    onOpenAddPosition={() => setIsAddPosOpen(true)}
                    onOpenAdjustCash={() => setIsAdjustCashOpen(true)}
                  />

                  {/* Gráfico de Dona y Distribución */}
                  <PortfolioPulse portfolio={portfolio} rates={rates} />

                  {/* Tabla de Posiciones y Pizarra */}
                  <PositionsTable
                    positions={portfolio.positions}
                    bvcTickers={bvcTickers}
                    intlQuotes={intlTickers}
                    currentEcosystem={currentEcosystem}
                    rates={rates}
                    currentMode={currentMode}
                    totalPortfolioVes={totals.ves.value}
                    onDeletePosition={handleDeletePosition}
                    onOpenAI={() => setIsAIModalOpen(true)}
                  />
                </>
              )}

              {/* VISTA B: PIZARRA EN VIVO (BVC / WALL STREET) */}
              {currentNav === 'bvc_live' && (
                <PositionsTable
                  positions={portfolio.positions}
                  bvcTickers={bvcTickers}
                  intlQuotes={intlTickers}
                  currentEcosystem={currentEcosystem}
                  rates={rates}
                  currentMode={currentMode}
                  totalPortfolioVes={totals.ves.value}
                  onDeletePosition={handleDeletePosition}
                  onOpenAI={() => setIsAIModalOpen(true)}
                />
              )}

              {/* VISTA C: SIMULADOR WHAT-IF */}
              {currentNav === 'whatif' && (
                <WhatIfSimulator rates={rates} portfolio={portfolio} />
              )}
            </main>
          </div>
        </div>
      )}

      {/* NOTIFICATION CENTER FLOTANTE */}
      <NotificationCenter
        isOpen={isNotifsOpen}
        onClose={() => setIsNotifsOpen(false)}
        notifications={notifications}
        unreadCount={unreadNotifsCount}
        onRefresh={refreshAllData}
        onOpenTelegram={() => {
          setIsNotifsOpen(false);
          setIsTelegramOpen(true);
        }}
      />

      {/* MODALES DEL SISTEMA */}
      <AIModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        session={session}
        onOpenRegister={() => {
          setAuthMode('register');
          setIsAuthModalOpen(true);
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authMode}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(sess) => {
          setSession(sess);
          if (typeof window !== 'undefined') {
            localStorage.setItem('kix_username', sess.username);
          }
          setCurrentView('terminal');
          // Si el usuario se acaba de registrar, lanzar Onboarding guiado
          if (authMode === 'register') {
            setIsOnboardingOpen(true);
          }
          refreshAllData();
        }}
      />

      <AddPositionModal
        isOpen={isAddPosOpen}
        bvcTickers={bvcTickers}
        currentCashVes={portfolio.cash_ves}
        onClose={() => setIsAddPosOpen(false)}
        onAdd={handleAddPosition}
      />

      <AdjustCashModal
        isOpen={isAdjustCashOpen}
        currentCashVes={portfolio.cash_ves}
        currentCashUsd={portfolio.cash_usd}
        onClose={() => setIsAdjustCashOpen(false)}
        onSave={handleSaveCash}
      />

      <TelegramModal
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        session={session}
        bvcTickers={bvcTickers}
        onComplete={() => {
          setIsOnboardingOpen(false);
          refreshAllData();
        }}
      />
    </div>
  );
}
