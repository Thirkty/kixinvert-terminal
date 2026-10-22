'use client';

import React, { useState, useMemo } from 'react';
import { Layers, LayoutList, Bot, Trash2, Zap, Search, Globe, DollarSign, Pencil, TrendingDown, PlusCircle } from 'lucide-react';
import { Position, BvcTicker, CurrencyMode, MarketRates, Ecosystem, InternationalQuote } from '@/types';
import { formatVES, formatUSD, formatUSDT, formatPercent } from '@/lib/formatters';
import { playTerminalSound } from '@/lib/audio';
import { SpotlightCard } from './SpotlightCard';
import { AnimatedTrend, AnimatedSparkles } from './AnimatedIcons';
import { WhatIfSimulator } from './WhatIfSimulator';

interface PositionsTableProps {
  positions: Position[];
  bvcTickers: BvcTicker[];
  intlQuotes?: InternationalQuote[];
  currentEcosystem?: Ecosystem;
  rates: MarketRates;
  currentMode: CurrencyMode;
  totalPortfolioVes: number;
  onDeletePosition: (symbol: string) => void;
  onOpenAI: () => void;
  onEditPosition?: (position: Position) => void;
  onSellPosition?: (position: Position) => void;
  onOpenAddPosition?: () => void;
  onOpenSellModal?: () => void;
}

const PositionsTableComponent: React.FC<PositionsTableProps> = ({
  positions,
  bvcTickers,
  intlQuotes = [],
  currentEcosystem = 'BVC',
  rates,
  currentMode,
  totalPortfolioVes,
  onDeletePosition,
  onOpenAI,
  onEditPosition,
  onSellPosition,
  onOpenAddPosition,
  onOpenSellModal,
}) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'market_live' | 'whatif'>('positions');
  const [searchTerm, setSearchTerm] = useState('');

  // Ordenar cotizaciones de la pizarra BVC
  const sortedBvcTickers = useMemo(() => {
    const list = [...bvcTickers].filter((t) => t.price > 0);
    const movers = list.filter((t) => Math.abs(t.change_pct) > 0);
    const neutrals = list.filter((t) => Math.abs(t.change_pct) === 0);
    movers.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
    return [...movers, ...neutrals];
  }, [bvcTickers]);

  // Filtrado BVC
  const filteredBvcTickers = useMemo(() => {
    if (!searchTerm.trim()) return sortedBvcTickers;
    const term = searchTerm.toLowerCase();
    return sortedBvcTickers.filter(
      (t) => t.symbol.toLowerCase().includes(term) || t.name.toLowerCase().includes(term)
    );
  }, [sortedBvcTickers, searchTerm]);

  // Filtrado Wall Street
  const filteredIntlQuotes = useMemo(() => {
    if (!searchTerm.trim()) return intlQuotes;
    const term = searchTerm.toLowerCase();
    return intlQuotes.filter(
      (t) => t.symbol.toLowerCase().includes(term) || t.name.toLowerCase().includes(term)
    );
  }, [intlQuotes, searchTerm]);

  return (
    <SpotlightCard
      spotlightColor="rgba(16, 185, 129, 0.12)"
      borderColor="rgba(16, 185, 129, 0.35)"
      className="positions-container glass-panel"
      style={{ padding: '24px', marginBottom: '40px', borderRadius: '16px' }}
    >
      {/* Navigation Tabs (MicroKit Sliding Tabs Pattern) */}
      <div className="table-tabs" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          className={`tab-btn ${activeTab === 'positions' ? 'active' : ''}`}
          onClick={() => {
            playTerminalSound('click');
            setActiveTab('positions');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: activeTab === 'positions' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
            border: activeTab === 'positions' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
            color: activeTab === 'positions' ? '#10b981' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <Layers size={15} /> Mis Posiciones ({positions.length})
        </button>

        <button
          className={`tab-btn ${activeTab === 'market_live' ? 'active' : ''}`}
          onClick={() => {
            playTerminalSound('click');
            setActiveTab('market_live');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: activeTab === 'market_live' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
            border: activeTab === 'market_live' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
            color: activeTab === 'market_live' ? '#10b981' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <LayoutList size={15} />
          {currentEcosystem === 'BVC' ? `Pizarra BVC en Vivo (${bvcTickers.length} Títulos)` : `Pizarra Wall Street (${intlQuotes.length} Acciones & ETFs)`}
        </button>

        <button
          className={`tab-btn ${activeTab === 'whatif' ? 'active' : ''}`}
          onClick={() => {
            playTerminalSound('click');
            setActiveTab('whatif');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: activeTab === 'whatif' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.04)',
            border: activeTab === 'whatif' ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
            color: activeTab === 'whatif' ? '#c084fc' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <Zap size={15} /> Simulador What-If (Salto Cambiario)
        </button>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {onOpenAddPosition && (
            <button
              type="button"
              onClick={() => {
                playTerminalSound('click');
                onOpenAddPosition();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '9px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#10b981',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <PlusCircle size={14} /> Comprar
            </button>
          )}

          {onOpenSellModal && positions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                playTerminalSound('click');
                onOpenSellModal();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '9px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <TrendingDown size={14} /> Vender
            </button>
          )}

          <button
            className="tab-btn btn-shimmer"
            onClick={() => {
              playTerminalSound('click');
              onOpenAI();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(6, 182, 212, 0.2))',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              color: '#c084fc',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <AnimatedSparkles size={16} /> KixInvert AI Analista
          </button>
        </div>
      </div>

      {/* TAB 1: POSICIONES DEL USUARIO */}
      {activeTab === 'positions' && (
        <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Activo / Ticker</th>
                <th className="text-right">Títulos</th>
                <th className="text-right">Costo Promedio</th>
                <th className="text-right">Precio Actual</th>
                <th className="text-right">Valor Total</th>
                <th className="text-right">Ganancia / Pérdida</th>
                <th className="text-right">% Cartera</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Tu portafolio aún no tiene acciones registradas. Haz clic en "Operar / Agregar Acción" para comenzar.
                  </td>
                </tr>
              ) : (
                positions.map((pos) => {
                  const totalValVes = pos.shares * pos.current_price;
                  const totalCostVes = pos.shares * pos.avg_cost;
                  const pnlVes = totalValVes - totalCostVes;
                  const pnlPct = totalCostVes > 0 ? (pnlVes / totalCostVes) * 100 : 0;
                  const weightPct = totalPortfolioVes > 0 ? (totalValVes / totalPortfolioVes) * 100 : 0;

                  const isPos = pnlVes >= 0;
                  const sign = isPos ? '+' : '';
                  const colorClass = isPos ? 'text-green' : 'text-red';

                  return (
                    <tr key={pos.symbol} style={{ transition: 'background 0.15s ease' }}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{pos.symbol}</strong>
                          <span style={{ fontSize: '0.76rem', color: '#64748b' }}>{pos.name}</span>
                        </div>
                      </td>
                      <td className="text-right font-mono font-bold">{pos.shares.toLocaleString()}</td>
                      <td className="text-right font-mono text-dim">
                        {currentMode === 'ves' && formatVES(pos.avg_cost)}
                        {currentMode === 'usd_bcv' && formatUSD(pos.avg_cost / (rates.bcv || 1))}
                        {currentMode === 'usdt' && formatUSDT(pos.avg_cost / (rates.usdt || 1))}
                        {currentMode === 'compare' && formatVES(pos.avg_cost)}
                      </td>
                      <td className="text-right font-mono font-bold">
                        {currentMode === 'ves' && formatVES(pos.current_price)}
                        {currentMode === 'usd_bcv' && formatUSD(pos.current_price / (rates.bcv || 1))}
                        {currentMode === 'usdt' && formatUSDT(pos.current_price / (rates.usdt || 1))}
                        {currentMode === 'compare' && formatVES(pos.current_price)}
                      </td>
                      <td className="text-right font-mono font-bold" style={{ color: '#fff' }}>
                        {currentMode === 'ves' && formatVES(totalValVes)}
                        {currentMode === 'usd_bcv' && formatUSD(totalValVes / (rates.bcv || 1))}
                        {currentMode === 'usdt' && formatUSDT(totalValVes / (rates.usdt || 1))}
                        {currentMode === 'compare' && formatVES(totalValVes)}
                      </td>
                      <td className={`text-right font-mono font-bold ${colorClass}`}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <AnimatedTrend type={isPos ? 'up' : 'down'} size={14} />
                          <span>
                            {currentMode !== 'compare' && sign}
                            {currentMode === 'ves' && formatVES(pnlVes)}
                            {currentMode === 'usd_bcv' && formatUSD(pnlVes / (rates.bcv || 1))}
                            {currentMode === 'usdt' && formatUSDT(pnlVes / (rates.usdt || 1))}
                            {currentMode === 'compare' && `${sign}${pnlPct.toFixed(2)}%`}
                          </span>
                        </div>
                      </td>
                      <td className="text-right font-mono font-bold text-dim">{weightPct.toFixed(1)}%</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => {
                              playTerminalSound('click');
                              onSellPosition && onSellPosition(pos);
                            }}
                            title={`Vender acciones de ${pos.symbol}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              borderRadius: '7px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#fca5a5',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <TrendingDown size={12} /> Vender
                          </button>

                          <button
                            onClick={() => {
                              playTerminalSound('click');
                              onEditPosition && onEditPosition(pos);
                            }}
                            title={`Editar / Corregir títulos o precio en ${pos.symbol}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '5px 7px',
                              borderRadius: '7px',
                              background: 'rgba(56, 189, 248, 0.12)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              color: '#38bdf8',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Pencil size={13} />
                          </button>

                          <button
                            className="btn-delete-pos"
                            onClick={() => {
                              playTerminalSound('click');
                              if (confirm(`¿Estás seguro de que deseas eliminar permanentemente la posición en ${pos.symbol}?`)) {
                                onDeletePosition(pos.symbol);
                              }
                            }}
                            title={`Eliminar posición en ${pos.symbol}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '5px',
                              borderRadius: '7px',
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer',
                              transition: 'color 0.2s ease',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: PIZARRA DE MERCADO EN VIVO (CARACAS BVC O WALL STREET) */}
      {activeTab === 'market_live' && (
        <div>
          {/* Quick Search Bar (Studio Admin Pattern) */}
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                borderRadius: '10px',
                padding: '8px 14px',
                width: '100%',
                maxWidth: '420px',
              }}
            >
              <Search size={16} style={{ color: '#64748b' }} />
              <input
                type="text"
                placeholder={currentEcosystem === 'BVC' ? 'Buscar en BVC (ej: BNC, CANTV, Provincial)...' : 'Buscar en Wall Street (ej: SPY, Nvidia, Apple, Tesla)...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.86rem',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {currentEcosystem === 'BVC' ? `Mostrando ${filteredBvcTickers.length} acciones BVC` : `Mostrando ${filteredIntlQuotes.length} activos globales`}
            </span>
          </div>

          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                {currentEcosystem === 'BVC' ? (
                  <tr>
                    <th>Ticker</th>
                    <th>Nombre de la Empresa</th>
                    <th className="text-right">Precio en Bolívares (VES)</th>
                    <th className="text-right">Equivalente USD (BCV)</th>
                    <th className="text-right">Equivalente USDT (P2P)</th>
                    <th className="text-right">Variación Diaria</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Ticker</th>
                    <th>Nombre del Activo / ETF</th>
                    <th className="text-right">Precio Oficial (USD)</th>
                    <th className="text-right">Equivalente en Bolívares (BCV)</th>
                    <th className="text-right">Equivalente en USDT</th>
                    <th className="text-right">Variación Diaria</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {currentEcosystem === 'BVC'
                  ? filteredBvcTickers.map((t) => {
                      const isPos = t.change_pct > 0;
                      const isZero = t.change_pct === 0;
                      const colorClass = isPos ? 'text-green' : isZero ? 'text-dim' : 'text-red';
                      const sign = isPos ? '+' : '';

                      return (
                        <tr key={t.symbol}>
                          <td><strong style={{ color: '#fff' }}>{t.symbol}</strong></td>
                          <td style={{ color: '#94a3b8' }}>{t.name}</td>
                          <td className="text-right font-mono font-bold">{formatVES(t.price)}</td>
                          <td className="text-right font-mono text-dim">{formatUSD(t.price / (rates.bcv || 1))}</td>
                          <td className="text-right font-mono text-dim">{(t.price / (rates.usdt || 1)).toFixed(2)} USDT</td>
                          <td className={`text-right font-mono ${colorClass}`}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {!isZero && <AnimatedTrend type={isPos ? 'up' : 'down'} size={14} />}
                              <span>{sign}{t.change_pct.toFixed(2)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  : filteredIntlQuotes.map((t) => {
                      const isPos = t.change_pct > 0;
                      const isZero = t.change_pct === 0;
                      const colorClass = isPos ? 'text-green' : isZero ? 'text-dim' : 'text-red';
                      const sign = isPos ? '+' : '';

                      return (
                        <tr key={t.symbol}>
                          <td><strong style={{ color: '#fff' }}>{t.symbol}</strong></td>
                          <td style={{ color: '#94a3b8' }}>{t.name}</td>
                          <td className="text-right font-mono font-bold text-green">{formatUSD(t.price)}</td>
                          <td className="text-right font-mono text-dim">{formatVES(t.price * (rates.bcv || 1))}</td>
                          <td className="text-right font-mono text-dim">{t.price.toFixed(2)} USDT</td>
                          <td className={`text-right font-mono ${colorClass}`}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {!isZero && <AnimatedTrend type={isPos ? 'up' : 'down'} size={14} />}
                              <span>{sign}{t.change_pct.toFixed(2)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SIMULADOR WHAT-IF DE DEVALUACIÓN */}
      {activeTab === 'whatif' && (
        <WhatIfSimulator
          rates={rates}
          portfolio={{
            cash_ves: 15000,
            cash_usd: 50,
            positions,
          }}
        />
      )}
    </SpotlightCard>
  );
};

export const PositionsTable = React.memo(PositionsTableComponent);
