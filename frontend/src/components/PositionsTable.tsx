'use client';

import React, { useState, useMemo } from 'react';
import { Layers, LayoutList, Bot, Trash2 } from 'lucide-react';
import { Position, BvcTicker, CurrencyMode, MarketRates } from '@/types';
import { formatVES, formatUSD, formatUSDT, formatPercent } from '@/lib/formatters';

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
  const [activeTab, setActiveTab] = useState<'positions' | 'bvc_live' | 'ai'>('positions');

  // Ordenar cotizaciones de la pizarra BVC: activos con variación y de mayor movimiento primero
  const sortedBvcTickers = useMemo(() => {
    const list = [...bvcTickers].filter((t) => t.price > 0);
    const movers = list.filter((t) => Math.abs(t.change_pct) > 0);
    const neutrals = list.filter((t) => Math.abs(t.change_pct) === 0);
    movers.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
    return [...movers, ...neutrals];
  }, [bvcTickers]);

  return (
    <div className="positions-container glass-panel" style={{ padding: '24px', marginBottom: '40px' }}>
      {/* Navigation Tabs */}
      <div className="table-tabs" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
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
          }}
        >
          <LayoutList size={15} /> Pizarra BVC en Vivo ({bvcTickers.length} Títulos)
        </button>

        <button
          className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={onOpenAI}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            color: '#c084fc',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          <Bot size={15} /> KixInvert AI Analista
        </button>
      </div>

      {/* TAB 1: POSICIONES */}
      {activeTab === 'positions' && (
        <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Activo / Ticker</th>
                <th className="text-right">Títulos</th>
                <th className="text-right">Precio Compra</th>
                <th className="text-right">Precio Actual</th>
                <th className="text-right">Precio USD (BCV)</th>
                <th className="text-right">Precio USDT (Real)</th>
                <th className="text-right">Valor Total</th>
                <th className="text-right">P&L Nominal (Bs)</th>
                <th className="text-right">P&L Real (USDT)</th>
                <th className="text-right">Peso (%)</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center" style={{ padding: '32px', color: '#64748b' }}>
                    No tienes posiciones registradas. Haz clic en "Operar / Agregar Acción" para comenzar.
                  </td>
                </tr>
              ) : (
                positions.map((pos) => {
                  const valVes = pos.shares * pos.current_price;
                  const costVes = pos.shares * pos.avg_cost;
                  const pnlVes = valVes - costVes;
                  const pnlVesPct = costVes > 0 ? (pnlVes / costVes) * 100 : 0;

                  const costUsdt = costVes / (rates.usdt || 1);
                  const valUsdt = valVes / (rates.usdt || 1);
                  const pnlUsdt = valUsdt - costUsdt;
                  const pnlUsdtPct = costUsdt > 0 ? (pnlUsdt / costUsdt) * 100 : 0;

                  const priceUsdBcv = pos.current_price / (rates.bcv || 1);
                  const priceUsdt = pos.current_price / (rates.usdt || 1);
                  const weightPct = totalPortfolioVes > 0 ? (valVes / totalPortfolioVes) * 100 : 0;

                  const isVesPos = pnlVes >= 0;
                  const isUsdtPos = pnlUsdt >= 0;

                  return (
                    <tr key={pos.symbol}>
                      <td>
                        <div className="ticker-cell">
                          <span className="ticker-symbol">{pos.symbol}</span>
                          <span className="ticker-name">{pos.name}</span>
                        </div>
                      </td>
                      <td className="text-right font-mono">{pos.shares.toLocaleString()}</td>
                      <td className="text-right font-mono">{formatVES(pos.avg_cost)}</td>
                      <td className="text-right font-mono font-bold">
                        <div>{formatVES(pos.current_price)}</div>
                        {pos.change_pct !== undefined && pos.change_pct !== null && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontWeight: 600,
                              marginTop: '2px',
                            }}
                            className={pos.change_pct > 0 ? 'text-green' : pos.change_pct < 0 ? 'text-red' : 'text-dim'}
                          >
                            {pos.change_pct > 0 ? '▲ +' : pos.change_pct < 0 ? '▼ ' : ''}
                            {pos.change_pct.toFixed(2)}% hoy
                          </div>
                        )}
                      </td>
                      <td className="text-right font-mono text-dim">{formatUSD(priceUsdBcv)}</td>
                      <td className="text-right font-mono text-dim">{priceUsdt.toFixed(2)} USDT</td>
                      <td className="text-right font-mono font-bold">
                        {currentMode === 'ves' && formatVES(valVes)}
                        {currentMode === 'usd_bcv' && formatUSD(valVes / (rates.bcv || 1))}
                        {currentMode === 'usdt' && formatUSDT(valUsdt)}
                        {currentMode === 'compare' && (
                          <div>
                            <div>{formatUSD(valVes / (rates.bcv || 1))}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{formatVES(valVes)}</div>
                          </div>
                        )}
                      </td>
                      <td className={`text-right font-mono ${isVesPos ? 'text-green' : 'text-red'}`}>
                        {isVesPos ? '+' : ''}{formatVES(pnlVes)} ({formatPercent(pnlVesPct)})
                      </td>
                      <td className={`text-right font-mono ${isUsdtPos ? 'text-green' : 'text-red'}`}>
                        {isUsdtPos ? '+' : ''}{pnlUsdt.toFixed(2)} USDT ({formatPercent(pnlUsdtPct)})
                      </td>
                      <td className="text-right font-mono">{weightPct.toFixed(2)}%</td>
                      <td className="text-center">
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
              {sortedBvcTickers.map((t) => {
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
                      {sign}{t.change_pct.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const PositionsTable = React.memo(PositionsTableComponent);
