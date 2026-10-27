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
import { EditPositionModal } from '@/components/EditPositionModal';
import { SellPositionModal } from '@/components/SellPositionModal';
import { AdjustCashModal } from '@/components/AdjustCashModal';
import { TelegramModal } from '@/components/TelegramModal';
import { NotificationCenter } from '@/components/NotificationCenter';
import { Sidebar, NavView } from '@/components/Sidebar';
import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import { OnboardingModal } from '@/components/OnboardingModal';
import { InteractiveBackground } from '@/components/InteractiveBackground';
import { runViewTransition } from '@/components/Motion';
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
  updatePositionApi,
  sellPositionApi,
  deletePositionApi,
  updateCashApi,
} from '@/lib/api';
import { isSoundEnabled, setSoundEnabled, playTerminalSound } from '@/lib/audio';

export default function Home() {
  // Navigation & Ecosystem State (Default to Landing for guests, Terminal for logged-in users)
  const [currentView, setCurrentViewRaw] = useState<'terminal' | 'welcome'>('welcome');
  const [currentNav, setCurrentNavRaw] = useState<NavView>('dashboard');
  const [currentEcosystem, setCurrentEcosystemRaw] = useState<Ecosystem>('BVC');
  const [currentMode, setCurrentModeRaw] = useState<CurrencyMode>('compare');

  // Every move between views, modules, markets and currencies is animated with a View Transition
  const setCurrentView = (v: 'terminal' | 'welcome') => {
    if (v === currentView) return;
    runViewTransition(() => setCurrentViewRaw(v));
  };
  const setCurrentNav = (n: NavView) => {
    if (n === currentNav) return;
    runViewTransition(() => setCurrentNavRaw(n));
  };
  const setCurrentEcosystem = (e: Ecosystem) => {
    if (e === currentEcosystem) return;
    runViewTransition(() => setCurrentEcosystemRaw(e));
  };
  const setCurrentMode = (m: CurrencyMode) => {
    if (m === currentMode) return;
    runViewTransition(() => setCurrentModeRaw(m));
  };

  // Market & Portfolio Data State
  // Empty until the backend answers: no placeholder rates that could pass for real ones
  const [rates, setRates] = useState<MarketRates>({
    bcv: 0,
    usdt: 0,
    brecha_pct: 0,
    updated_at: '',
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
  const [isEditPosOpen, setIsEditPosOpen] = useState(false);
  const [isSellPosOpen, setIsSellPosOpen] = useState(false);
  const [selectedPosForEdit, setSelectedPosForEdit] = useState<Position | null>(null);
  const [selectedPosForSell, setSelectedPosForSell] = useState<Position | null>(null);
  const [isAdjustCashOpen, setIsAdjustCashOpen] = useState(false);
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Carga y sincronización de datos
  const refreshAllData = useCallback(async () => {
    setIsRefreshing(true);
    // Each source updates on its own; a failed one keeps its last real value instead of blocking the rest
    const [ratesRes, tickersRes, intlRes, portfolioRes, notifRes] = await Promise.allSettled([
      fetchRates(),
      fetchBvcPrices(),
      fetchInternationalQuotes(),
      fetchPortfolio(),
      fetchNotifications(),
    ]);
    if (ratesRes.status === 'fulfilled') setRates(ratesRes.value);
    if (tickersRes.status === 'fulfilled' && tickersRes.value.length > 0) setBvcTickers(tickersRes.value);
    if (intlRes.status === 'fulfilled' && intlRes.value.length > 0) setIntlTickers(intlRes.value);
    if (portfolioRes.status === 'fulfilled' && portfolioRes.value) setPortfolio(portfolioRes.value);
    if (notifRes.status === 'fulfilled' && notifRes.value) {
      setNotifications(notifRes.value.notifications);
      setUnreadNotifsCount(notifRes.value.unread_count);
    }
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    setSoundActive(isSoundEnabled());

    const token = getAuthToken();
    const savedUser = typeof window !== 'undefined' ? localStorage.getItem('kix_username') : null;
    if (token) {
      setSession({
        username: savedUser || 'Inversionista',
        token,
        is_demo: false,
      });
      // Usuario autenticado entra directo al Terminal en un ecosistema separado
      setCurrentViewRaw('terminal');

      // Validar sesión con el backend
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) {
            setAuthToken(null);
            setSession(null);
            setCurrentViewRaw('welcome');
            return null;
          }
          return res.json();
        })
        .then((userData) => {
          if (userData && userData.username) {
            setSession({
              username: userData.username,
              token,
              is_demo: false,
            });
            if (typeof window !== 'undefined') {
              localStorage.setItem('kix_username', userData.username);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          refreshAllData();
        });
    } else {
      setSession(null);
      setCurrentViewRaw('welcome');
      refreshAllData();
    }

    // Poll every 15 s only while the tab is visible; catch up as soon as it comes back
    const interval = setInterval(() => {
      if (!document.hidden) refreshAllData();
    }, 15000);
    const onVisible = () => {
      if (!document.hidden) refreshAllData();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
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

  // Manejo de Acciones persistente con liquidación de efectivo y comisiones Mercosur
  const handleAddPosition = async (
    newPos: Position,
    deductFromCash: boolean = true,
    execDate?: string,
    fees?: {
      broker_commission?: number;
      broker_iva?: number;
      broker_registry_fee?: number;
      net_total_amount?: number;
    }
  ) => {
    playTerminalSound('success');
    const res = await addPositionApi({
      ticker: newPos.symbol,
      shares: newPos.shares,
      buy_price: newPos.avg_cost,
      currency: 'VES',
      deduct_from_cash: deductFromCash,
      execution_date: execDate,
      broker_commission: fees?.broker_commission,
      broker_iva: fees?.broker_iva,
      broker_registry_fee: fees?.broker_registry_fee,
      net_total_amount: fees?.net_total_amount,
    });
    if (res.cash_ves !== undefined) {
      setPortfolio((prev) => ({ ...prev, cash_ves: res.cash_ves! }));
    }
    await refreshAllData();
  };

  const handleEditPosition = async (
    positionId: string,
    updatedShares: number,
    updatedBuyPrice: number,
    adjustCash: boolean
  ) => {
    playTerminalSound('success');
    const res = await updatePositionApi(positionId, {
      shares: updatedShares,
      buy_price: updatedBuyPrice,
      adjust_cash: adjustCash,
    });
    if (res.cash_ves !== undefined) {
      setPortfolio((prev) => ({ ...prev, cash_ves: res.cash_ves! }));
    }
    await refreshAllData();
  };

  const handleSellPosition = async (payload: {
    ticker: string;
    shares_to_sell: number;
    sell_price: number;
    credit_to_cash: boolean;
    broker_commission?: number;
    broker_iva?: number;
    broker_registry_fee?: number;
    net_total_amount?: number;
    execution_date?: string;
    notes?: string;
  }) => {
    playTerminalSound('success');
    const res = await sellPositionApi(payload);
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

  const handleLogout = () => {
    playTerminalSound('click');
    // Clears the HttpOnly session cookie too; the stored token alone isn't the whole session
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAuthToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kix_username');
    }
    setSession(null);
    setPortfolio({ cash_ves: 0, cash_usd: 0, positions: [] });
    setNotifications([]);
    setUnreadNotifsCount(0);
    setCurrentView('welcome');
  };

  // The terminal is only for signed-in users; guests get the login dialog
  const goToTerminal = () => {
    if (session) {
      setCurrentView('terminal');
    } else {
      setAuthMode('login');
      setIsAuthModalOpen(true);
    }
  };

  return (
    <div className="app-container" style={{ padding: 0, maxWidth: '100%' }}>
      <InteractiveBackground intensity={currentView === 'welcome' ? 1 : 0.6} interactive={currentView === 'welcome'} />

      {/* VISTA 1: LANDING OPCIONAL DE BIENVENIDA (UNIFICADO, SIN DOBLE HEADER NI OVERLAPPING) */}
      {currentView === 'welcome' && (
        <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <WelcomeLanding
            onGoTerminal={goToTerminal}
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
            rates={rates}
          />
        </div>
      )}

      {/* VISTA 2: TERMINAL BURSÁTIL COMPLETO (INICIO POR DEFECTO CON TODAS LAS HERRAMIENTAS) */}
      {currentView === 'terminal' && session && (
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

            {/* Keyed by module so each one re-enters with its staggered animation */}
            <main key={`${currentNav}-${currentEcosystem}`} className="terminal-main-view" style={{ flex: 1, padding: '24px 32px' }}>
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
                      background: currentEcosystem === 'BVC' ? 'rgba(124, 140, 255, 0.12)' : 'rgba(124, 140, 255, 0.12)',
                      border: currentEcosystem === 'BVC' ? '1px solid rgba(124, 140, 255, 0.28)' : '1px solid rgba(124, 140, 255, 0.28)',
                      color: currentEcosystem === 'BVC' ? '#c9cfff' : '#c9cfff',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      marginBottom: '8px',
                    }}
                  >
                    <span>{currentEcosystem === 'BVC' ? 'Mercado Caracas BVC' : 'Mercado Wall Street Global'}</span>
                    <span>•</span>
                    <span>{`Portafolio de ${session?.username || 'Inversionista'}`}</span>
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
                        background: 'rgba(124, 140, 255, 0.15)',
                        color: '#7c8cff',
                        border: '1px solid rgba(124, 140, 255, 0.3)',
                        borderRadius: '6px',
                        fontWeight: 700,
                      }}
                    >
                      EN VIVO
                    </span>
                  </h1>

                  <p className="subtitle" style={{ color: '#9aa3b2', fontSize: '0.9rem', marginTop: '2px' }}>
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
                    onOpenSellPosition={() => {
                      setSelectedPosForSell(null);
                      setIsSellPosOpen(true);
                    }}
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
                    onEditPosition={(pos) => {
                      setSelectedPosForEdit(pos);
                      setIsEditPosOpen(true);
                    }}
                    onSellPosition={(pos) => {
                      setSelectedPosForSell(pos);
                      setIsSellPosOpen(true);
                    }}
                    onOpenAddPosition={() => setIsAddPosOpen(true)}
                    onOpenSellModal={() => {
                      setSelectedPosForSell(null);
                      setIsSellPosOpen(true);
                    }}
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
                  onEditPosition={(pos) => {
                    setSelectedPosForEdit(pos);
                    setIsEditPosOpen(true);
                  }}
                  onSellPosition={(pos) => {
                    setSelectedPosForSell(pos);
                    setIsSellPosOpen(true);
                  }}
                  onOpenAddPosition={() => setIsAddPosOpen(true)}
                  onOpenSellModal={() => {
                    setSelectedPosForSell(null);
                    setIsSellPosOpen(true);
                  }}
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
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authMode}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(sess, isNewRegistration) => {
          setSession(sess);
          if (typeof window !== 'undefined') {
            localStorage.setItem('kix_username', sess.username);
          }
          setCurrentView('terminal');
          // Si el usuario se acaba de registrar, lanzar Onboarding guiado
          if (isNewRegistration || authMode === 'register') {
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

      <EditPositionModal
        isOpen={isEditPosOpen}
        position={selectedPosForEdit}
        onClose={() => {
          setIsEditPosOpen(false);
          setSelectedPosForEdit(null);
        }}
        onSave={handleEditPosition}
      />

      <SellPositionModal
        isOpen={isSellPosOpen}
        positions={portfolio.positions}
        selectedInitialPosition={selectedPosForSell}
        bvcTickers={bvcTickers}
        currentCashVes={portfolio.cash_ves}
        onClose={() => {
          setIsSellPosOpen(false);
          setSelectedPosForSell(null);
        }}
        onSell={handleSellPosition}
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
