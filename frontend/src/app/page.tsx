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
import { Sidebar, NavView } from '@/components/Sidebar';
import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import {
  CurrencyMode,
  MarketRates,
  BvcTicker,
  PortfolioData,
  Position,
  UserSession,
  TriMonetaryTotals,
} from '@/types';
import { fetchRates, fetchBvcPrices, fetchPortfolio, getAuthToken, setAuthToken } from '@/lib/api';

export default function Home() {
  // Navigation View State
  const [currentView, setCurrentView] = useState<'welcome' | 'terminal'>('welcome');
  const [currentNav, setCurrentNav] = useState<NavView>('dashboard');
  const [currentMode, setCurrentMode] = useState<CurrencyMode>('compare');

  // Market & Portfolio Data State
  const [rates, setRates] = useState<MarketRates>({
    bcv: 880.12,
    usdt: 999.6,
    brecha_pct: 13.58,
    updated_at: new Date().toISOString(),
  });

  const [bvcTickers, setBvcTickers] = useState<BvcTicker[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData>({
    cash_ves: 15000.0,
    cash_usd: 50.0,
    positions: [],
  });

  // Session & Modals State
  const [session, setSession] = useState<UserSession | null>(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isAddPosOpen, setIsAddPosOpen] = useState(false);
  const [isAdjustCashOpen, setIsAdjustCashOpen] = useState(false);
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Carga y sincronización integral de datos (Tasas BCV/USDT, Cotizaciones BVC y Portafolio)
  const refreshAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [fetchedRates, fetchedTickers, fetchedPortfolio] = await Promise.all([
        fetchRates(),
        fetchBvcPrices(),
        fetchPortfolio(),
      ]);
      setRates(fetchedRates);
      setBvcTickers(fetchedTickers);
      if (fetchedPortfolio && fetchedPortfolio.positions) {
        setPortfolio(fetchedPortfolio);
      }
    } catch (err) {
      console.warn('Error sincronizando datos de mercado:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();

    // Comprobar token previo
    const token = getAuthToken();
    if (token) {
      setSession({
        username: 'Inversionista',
        token,
        is_demo: false,
      });
      setCurrentView('terminal');
    }

    // Intervalo de auto-sincronización en vivo cada 15 segundos
    const interval = setInterval(() => {
      refreshAllData();
    }, 15000);

    return () => clearInterval(interval);
  }, [refreshAllData]);

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

    // Conversión a USDT Binance P2P (Poder adquisitivo real)
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

  // Manejo de Acciones
  const handleAddPosition = (newPos: Position) => {
    setPortfolio((prev) => {
      const existingIdx = prev.positions.findIndex((p) => p.symbol === newPos.symbol);
      let updatedPositions: Position[];

      if (existingIdx >= 0) {
        const existing = prev.positions[existingIdx];
        const totalShares = existing.shares + newPos.shares;
        const totalCost = (existing.shares * existing.avg_cost) + (newPos.shares * newPos.avg_cost);
        const avgCost = totalCost / totalShares;

        updatedPositions = [...prev.positions];
        updatedPositions[existingIdx] = {
          ...existing,
          shares: totalShares,
          avg_cost: avgCost,
          current_price: newPos.current_price,
        };
      } else {
        updatedPositions = [...prev.positions, newPos];
      }

      return { ...prev, positions: updatedPositions };
    });
  };

  const handleDeletePosition = (symbol: string) => {
    setPortfolio((prev) => ({
      ...prev,
      positions: prev.positions.filter((p) => p.symbol !== symbol),
    }));
  };

  const handleSaveCash = (cashVes: number, cashUsd: number) => {
    setPortfolio((prev) => ({
      ...prev,
      cash_ves: cashVes,
      cash_usd: cashUsd,
    }));
  };

  const handleDemoLogin = () => {
    setSession({
      username: 'Inversionista Demo',
      is_demo: true,
      has_2fa: false,
    });
    setCurrentView('terminal');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setSession(null);
    setCurrentView('welcome');
  };

  return (
    <div className="app-container">
      {/* VISTA 1: PANTALLA DE BIENVENIDA */}
      {currentView === 'welcome' && (
        <>
          <TopHeader
            rates={rates}
            session={session}
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
          <TickerTape
            tickers={bvcTickers}
            onSelectTicker={() => setCurrentView('terminal')}
          />
          <WelcomeLanding
            onEnterDemo={handleDemoLogin}
            onOpenRegister={() => {
              setAuthMode('register');
              setIsAuthModalOpen(true);
            }}
            onOpenLogin={() => {
              setAuthMode('login');
              setIsAuthModalOpen(true);
            }}
          />
        </>
      )}

      {/* VISTA 2: TERMINAL BURSÁTIL MODERNA CON SIDEBAR (ESTILO STUDIO ADMIN) */}
      {currentView === 'terminal' && (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
          {/* Navegación Lateral */}
          <Sidebar
            currentNav={currentNav}
            onSelectNav={setCurrentNav}
            rates={rates}
            session={session}
            onOpenAI={() => setIsAIModalOpen(true)}
            onOpenTelegram={() => setIsTelegramOpen(true)}
            onLogout={handleLogout}
            onOpenAuth={() => {
              setAuthMode('login');
              setIsAuthModalOpen(true);
            }}
          />

          {/* Área Principal de Contenido */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <TopHeader
              rates={rates}
              session={session}
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

            <TickerTape
              tickers={bvcTickers}
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
                      gap: '6px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      color: '#a7f3d0',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      marginBottom: '8px',
                    }}
                  >
                    💼 {session?.is_demo ? 'Portafolio Demo BVC (Modo Invitado)' : `Portafolio Activo: ${session?.username}`}
                  </div>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>
                    {currentNav === 'dashboard' && 'Resumen Patrimonial'}
                    {currentNav === 'bvc_live' && 'Pizarra Bursátil en Vivo'}
                    {currentNav === 'whatif' && 'Simulador de Salto Cambiario'}
                    <span
                      className="tag-version"
                      style={{
                        marginLeft: '10px',
                        fontSize: '0.72rem',
                        padding: '3px 8px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '6px',
                        fontWeight: 700,
                      }}
                    >
                      BVC Live
                    </span>
                  </h1>
                  <p className="subtitle" style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '2px' }}>
                    Monitoreo inteligente multi-divisa y protección en tiempo real contra la devaluación
                  </p>
                </div>

                {/* Selector de Divisa Segmentado */}
                <CurrencySelector currentMode={currentMode} onChangeMode={setCurrentMode} />
              </div>

              {/* VISTA A: DASHBOARD PRINCIPAL */}
              {currentNav === 'dashboard' && (
                <>
                  <HeroKPIs
                    currentMode={currentMode}
                    rates={rates}
                    portfolio={portfolio}
                    totals={totals}
                    onOpenAddPosition={() => setIsAddPosOpen(true)}
                    onOpenAdjustCash={() => setIsAdjustCashOpen(true)}
                  />

                  <PortfolioPulse portfolio={portfolio} rates={rates} />

                  <PositionsTable
                    positions={portfolio.positions}
                    bvcTickers={bvcTickers}
                    rates={rates}
                    currentMode={currentMode}
                    totalPortfolioVes={totals.ves.value}
                    onDeletePosition={handleDeletePosition}
                    onOpenAI={() => setIsAIModalOpen(true)}
                  />
                </>
              )}

              {/* VISTA B: PIZARRA BVC EN VIVO */}
              {currentNav === 'bvc_live' && (
                <PositionsTable
                  positions={portfolio.positions}
                  bvcTickers={bvcTickers}
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

      {/* MODALES INTERACTIVOS */}
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
          setCurrentView('terminal');
        }}
      />

      <AddPositionModal
        isOpen={isAddPosOpen}
        bvcTickers={bvcTickers}
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
    </div>
  );
}
