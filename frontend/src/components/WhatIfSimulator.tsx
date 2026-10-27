'use client';

import React, { useState, useEffect } from 'react';
import {
  Calculator,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Zap,
  Landmark,
  Coins,
  Globe,
} from 'lucide-react';
import { MarketRates, PortfolioData, WhatIfSimulationResult } from '@/types';
import { simulateWhatIf } from '@/lib/api';
import { formatVES, formatUSD, formatUSDT } from '@/lib/formatters';
import { SpotlightCard } from './SpotlightCard';

interface WhatIfSimulatorProps {
  rates: MarketRates;
  portfolio: PortfolioData;
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({ rates, portfolio }) => {
  const [bcvTarget, setBcvTarget] = useState<number>(rates.bcv ? Math.round(rates.bcv * 1.15) : 1000);
  const [usdtTarget, setUsdtTarget] = useState<number>(rates.usdt ? Math.round(rates.usdt * 1.25) : 1250);
  const [wallStreetShock, setWallStreetShock] = useState<number>(0);
  const [bvcAdjustmentRate, setBvcAdjustmentRate] = useState<number>(0.85);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<WhatIfSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rates.bcv && rates.usdt) {
      setBcvTarget(Math.round(rates.bcv * 1.15));
      setUsdtTarget(Math.round(rates.usdt * 1.25));
    }
  }, [rates.bcv, rates.usdt]);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const res = await simulateWhatIf({
        bcv_target: bcvTarget,
        usdt_target: usdtTarget,
        wall_street_shock_pct: wallStreetShock,
        bvc_adjustment_rate: bvcAdjustmentRate,
      });
      setResult(res);
      setError(null);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'No se pudo ejecutar la simulación.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation();
    }, 400);
    return () => clearTimeout(timer);
  }, [bcvTarget, usdtTarget, wallStreetShock, bvcAdjustmentRate]);

  return (
    <div className="whatif-simulator-container" style={{ marginTop: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Panel Izquierdo: Controles y Sliders */}
        <SpotlightCard
          spotlightColor="rgba(124, 140, 255, 0.14)"
          borderColor="rgba(124, 140, 255, 0.35)"
          className="glass-panel"
          style={{ padding: '24px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(124, 140, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7c8cff',
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                Simulador de Salto Cambiario (What-If)
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#9aa3b2' }}>
                Evalúa la resistencia de tus acciones caraqueñas ante devaluaciones
              </p>
            </div>
          </div>

          {/* Slider 1: Dólar Oficial BCV Proyectado */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: '#d5d9e0', fontWeight: 600 }}>
                <Landmark size={14} className="inline-icon" />Meta Dólar BCV:
              </span>
              <span style={{ fontSize: '0.9rem', color: '#7c8cff', fontWeight: 800 }}>
                {formatVES(bcvTarget)}
              </span>
            </div>
            <input
              type="range"
              min={Math.round((rates.bcv || 800) * 0.9)}
              max={Math.round((rates.bcv || 800) * 2.5)}
              step="5"
              value={bcvTarget}
              onChange={(e) => setBcvTarget(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#7c8cff', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#667085' }}>
              <span>Actual: {formatVES(rates.bcv)}</span>
              <span>+150%</span>
            </div>
          </div>

          {/* Slider 2: USDT Binance P2P Proyectado */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: '#d5d9e0', fontWeight: 600 }}>
                <Coins size={14} className="inline-icon" />Meta USDT Binance:
              </span>
              <span style={{ fontSize: '0.9rem', color: '#9aa6ff', fontWeight: 800 }}>
                {formatVES(usdtTarget)}
              </span>
            </div>
            <input
              type="range"
              min={Math.round((rates.usdt || 900) * 0.9)}
              max={Math.round((rates.usdt || 900) * 2.5)}
              step="5"
              value={usdtTarget}
              onChange={(e) => setUsdtTarget(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#9aa6ff', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#667085' }}>
              <span>Actual: {formatVES(rates.usdt)}</span>
              <span>+150%</span>
            </div>
          </div>

          {/* Slider 3: Tasa de Traspaso / Ajuste BVC */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: '#d5d9e0', fontWeight: 600 }}>
                <TrendingUp size={14} className="inline-icon" />Sensibilidad de la Bolsa BVC:
              </span>
              <span style={{ fontSize: '0.9rem', color: '#7c8cff', fontWeight: 800 }}>
                {(bvcAdjustmentRate * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.3"
              step="0.05"
              value={bvcAdjustmentRate}
              onChange={(e) => setBvcAdjustmentRate(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#7c8cff', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#667085' }}>
              <span>Lento (30%)</span>
              <span>Típico BVC (85%)</span>
              <span>Sobre-ajuste (130%)</span>
            </div>
          </div>

          {/* Slider 4: Shock de Wall Street (S&P 500) */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: '#d5d9e0', fontWeight: 600 }}>
                <Globe size={14} className="inline-icon" />Shock en Wall Street (S&P 500):
              </span>
              <span style={{ fontSize: '0.9rem', color: wallStreetShock >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 800 }}>
                {wallStreetShock >= 0 ? `+${wallStreetShock}%` : `${wallStreetShock}%`}
              </span>
            </div>
            <input
              type="range"
              min="-20"
              max="20"
              step="1"
              value={wallStreetShock}
              onChange={(e) => setWallStreetShock(Number(e.target.value))}
              style={{ width: '100%', accentColor: wallStreetShock >= 0 ? 'var(--up)' : 'var(--down)', cursor: 'pointer' }}
            />
          </div>
        </SpotlightCard>

        {/* Panel Derecho: Proyecciones Tri-Monetarias */}
        <SpotlightCard
          spotlightColor="rgba(124, 140, 255, 0.16)"
          borderColor="rgba(124, 140, 255, 0.45)"
          className="glass-panel"
          style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                Impacto Patrimonial Proyectado
              </h3>
              {loading && <RefreshCw size={14} className="spin-icon" style={{ color: '#7c8cff' }} />}
            </div>

            {error && (
              <div className="whatif-error" role="alert">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Solo se muestran proyecciones cuando hay un resultado real del backend */}
            {result && (<>
            {/* Tri-Monetary Projected Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              {/* VES */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '12px',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#9aa3b2', fontWeight: 700, marginBottom: '4px' }}>
                  BOLÍVARES (VES)
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                  {formatVES(result?.projected_portfolio_ves || 0)}
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    marginTop: '4px',
                    color: (result?.net_ves_impact || 0) >= 0 ? 'var(--up)' : 'var(--down)',
                  }}
                >
                  {(result?.net_ves_impact || 0) >= 0 ? '+' : ''}
                  {formatVES(result?.net_ves_impact || 0)}
                </div>
              </div>

              {/* Dólar BCV */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '12px',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#9aa3b2', fontWeight: 700, marginBottom: '4px' }}>
                  DÓLAR BCV
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                  {formatUSD(result?.projected_portfolio_usd_bcv || 0)}
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    marginTop: '4px',
                    color: (result?.net_usd_bcv_impact || 0) >= 0 ? 'var(--up)' : 'var(--down)',
                  }}
                >
                  {(result?.net_usd_bcv_impact || 0) >= 0 ? '+' : ''}
                  {formatUSD(result?.net_usd_bcv_impact || 0)}
                </div>
              </div>

              {/* USDT Real */}
              <div
                style={{
                  background: 'rgba(124, 140, 255, 0.08)',
                  border: '1px solid rgba(124, 140, 255, 0.3)',
                  borderRadius: '12px',
                  padding: '12px',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#c9cfff', fontWeight: 700, marginBottom: '4px' }}>
                  USDT REAL
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                  {formatUSDT(result?.projected_portfolio_usdt || 0)}
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    marginTop: '4px',
                    color: (result?.net_usdt_impact || 0) >= 0 ? 'var(--up)' : 'var(--down)',
                  }}
                >
                  {(result?.net_usdt_impact || 0) >= 0 ? '+' : ''}
                  {formatUSDT(result?.net_usdt_impact || 0)}
                </div>
              </div>
            </div>

            {/* Rating de Cobertura */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: 'rgba(124, 140, 255, 0.1)',
                border: '1px solid rgba(124, 140, 255, 0.25)',
                borderRadius: '10px',
                marginBottom: '16px',
              }}
            >
              <ShieldCheck size={20} style={{ color: '#7c8cff' }} />
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#c9cfff' }}>
                  Calificación de Protección Anti-Devaluación: {result.protection_rating}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#9aa3b2' }}>
                  {result.advice}
                </div>
              </div>
            </div>
            </>)}
          </div>

          <div style={{ fontSize: '0.74rem', color: '#667085', textAlign: 'center' }}>
            <Zap size={12} className="inline-icon" />Simulación generada mediante el motor estocástico de KixInvert Terminal.
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
};
