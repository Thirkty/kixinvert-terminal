'use client';

import React, { useState, useMemo } from 'react';
import { Layers, LayoutList, Bot, Trash2, Zap, Search } from 'lucide-react';
import { Position, BvcTicker, CurrencyMode, MarketRates } from '@/types';
import { formatVES, formatUSD, formatUSDT, formatPercent } from '@/lib/formatters';
import { SpotlightCard } from './SpotlightCard';
import { AnimatedTrend, AnimatedSparkles } from './AnimatedIcons';
import { WhatIfSimulator } from './WhatIfSimulator';

interface PositionsTableProps {
  positions: Position[];
  bvcTickers: BvcTicker[];
  rates: MarketRates;
  currentMode: CurrencyMode;
  totalPortfolioVes: number;
  onDeletePosition: (symbol: string) => void;
  onOpenAI: () => void;
}

const PositionsTableComponent: React.FC<PositionsTableProps> = ({
  positions,
  bvcTickers,
  rates,
  currentMode,
  totalPortfolioVes,
  onDeletePosition,
  onOpenAI,
}) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'bvc_live' | 'whatif'>('positions');
  const [searchTerm, setSearchTerm] = useState('');

  // Ordenar cotizaciones de la pizarra BVC: activos con variación y de mayor movimiento primero
  const sortedBvcTickers = useMemo(() => {
    const list = [...bvcTickers].filter((t) => t.price > 0);
    const movers = list.filter((t) => Math.abs(t.change_pct) > 0);
    const neutrals = list.filter((t) => Math.abs(t.change_pct) === 0);
    movers.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
    return [...movers, ...neutrals];
  }, [bvcTickers]);

  // Filtrado reactivo en vivo por Ticker o Nombre de Empresa
  const filteredBvcTickers = useMemo(() => {
    if (!searchTerm.trim()) return sortedBvcTickers;
    const term = searchTerm.toLowerCase();
    return sortedBvcTickers.filter(
      (t) => t.symbol.toLowerCase().includes(term) || t.name.toLowerCase().includes(term)
    );
  }, [sortedBvcTickers, searchTerm]);

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
          onClick={() => setActiveTab('positions')}
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
          <Layers size={15} /> Mis Posiciones ( {positions.length} )
        </button>

        <button
          className={`tab-btn ${activeTab === 'bvc_live' ? 'active' : ''}`}
          onClick={() => setActiveTab('bvc_live')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: activeTab === 'bvc_live' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
            border: activeTab === 'bvc_live' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
            color: activeTab === 'bvc_live' ? '#10b981' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <LayoutList size={15} /> Pizarra BVC en Vivo ({bvcTickers.length} Títulos)
        </button>

        <button
          className={`tab-btn ${activeTab === 'whatif' ? 'active' : ''}`}
          onClick={() => setActiveTab('whatif')}
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

        <button
          className="tab-btn btn-shimmer"
          onClick={onOpenAI}
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
            marginLeft: 'auto',
          }}
        >
          <AnimatedSparkles size={16} /> KixInvert AI Analista
        </button>
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
                <th className="text-right">Precio Actual (BVC)</th>
                <th className="text-right">Valor Total</th>
                <th className="text-right">Ganancia / Pérdida</th>
                <th className="text-right">% Cartera</th>
                <th style={{ width: '40px' }}></th>
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
                            {sign}
                            {currentMode === 'ves' && formatVES(pnlVes)}
                            {currentMode === 'usd_bcv' && formatUSD(pnlVes / (rates.bcv || 1))}
                            {currentMode === 'usdt' && formatUSDT(pnlVes / (rates.usdt || 1))}
                            {currentMode === 'compare' && `${sign}${pnlPct.toFixed(2)}%`}
                          </span>
                        </div>
                      </td>
                      <td className="text-right font-mono font-bold text-dim">{weightPct.toFixed(1)}%</td>
                      <td>
                        <button
                          className="btn-delete-pos"
                          onClick={() => onDeletePosition(pos.symbol)}
                          title={`Eliminar posición en ${pos.symbol}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            transition: 'color 0.2s ease',
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: PIZARRA BVC EN VIVO */}
      {activeTab === 'bvc_live' && (
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
                maxWidth: '400px',
              }}
            >
              <Search size={16} style={{ color: '#64748b' }} />
              <input
                type="text"
                placeholder="Filtrar por Ticker o Nombre (ej: BNC, CANTV, Banco)..."
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
              Mostrando {filteredBvcTickers.length} títulos
            </span>
          </div>

          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Nombre de la Empresa</th>
                  <th className="text-right">Precio en Bolívares (VES)</th>
                  <th className="text-right">Equivalente USD (BCV)</th>
                  <th className="text-right">Equivalente USDT (P2P)</th>
                  <th className="text-right">Variación Diaria</th>
                </tr>
              </thead>
              <tbody>
                {filteredBvcTickers.map((t) => {
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
