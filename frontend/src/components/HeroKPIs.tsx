'use client';

import React from 'react';
import {
  Briefcase,
  TrendingUp,
  Coins,
  ShieldCheck,
  Shield,
  HelpCircle,
  Wallet,
  Edit3,
  PlusCircle,
  Calculator,
  LineChart,
  ArrowUpRight,
} from 'lucide-react';
import { CurrencyMode, MarketRates, PortfolioData, TriMonetaryTotals } from '@/types';
import { formatVES, formatUSD, formatUSDT, formatPercent } from '@/lib/formatters';
import { SpotlightCard } from './SpotlightCard';
import { AnimatedTrend } from './AnimatedIcons';

interface HeroKPIsProps {
  currentMode: CurrencyMode;
  rates: MarketRates;
  portfolio: PortfolioData;
  totals: TriMonetaryTotals;
  onOpenAddPosition: () => void;
  onOpenAdjustCash: () => void;
}

const HeroKPIsComponent: React.FC<HeroKPIsProps> = ({
  currentMode,
  rates,
  portfolio,
  totals,
  onOpenAddPosition,
  onOpenAdjustCash,
}) => {
  // Cálculos de liquidez y totales
  const totalStockVes = totals.ves.value - portfolio.cash_ves;
  const totalStockUsdBcv = totalStockVes / (rates.bcv || 1);
  const totalStockUsdt = totalStockVes / (rates.usdt || 1);

  const totalPortfolioVes = totals.ves.value;
  const totalPortfolioUsdBcv = totals.usd_bcv.value;
  const totalPortfolioUsdt = totals.usdt.value;

  const totalCashVesEquivalent = portfolio.cash_ves + (portfolio.cash_usd * (rates.bcv || 1));
  const liquidityPct = totalPortfolioVes > 0 ? (totalCashVesEquivalent / totalPortfolioVes) * 100 : 0;

  // Estados de ganancia
  const isVesPos = totals.ves.pnl >= 0;
  const isBcvPos = totals.usd_bcv.pnl >= 0;
  const isUsdtPos = totals.usdt.pnl >= 0;

  const vesSign = isVesPos ? '+' : '';
  const bcvSign = isBcvPos ? '+' : '';
  const usdtSign = isUsdtPos ? '+' : '';

  const vesColor = isVesPos ? 'text-green' : 'text-red';
  const bcvColor = isBcvPos ? 'text-green' : 'text-red';
  const usdtColor = isUsdtPos ? 'text-green' : 'text-red';

  // Cobertura cambiaria (Rendimiento en Bs vs Brecha)
  const brecha = rates.brecha_pct || 0;
  const netCoverage = (totals.ves.pnl_pct - brecha).toFixed(2);
  const isNetCoveragePositive = parseFloat(netCoverage) >= 0;

  // Medidor visual
  const maxScale = Math.max(brecha + 15, Math.abs(totals.ves.pnl_pct) + 10, 30);
  const fillPercent = Math.min(100, Math.max(5, (Math.max(0, totals.ves.pnl_pct) / maxScale) * 100));
  const markerPercent = Math.min(95, Math.max(5, (brecha / maxScale) * 100));

  return (
    <div className="hero-kpis-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '28px' }}>
      {/* ==============================================================
          CARD 1: MI PATRIMONIO TOTAL (MICROKIT SPOTLIGHT)
         ============================================================== */}
      <SpotlightCard
        spotlightColor="rgba(16, 185, 129, 0.16)"
        borderColor="rgba(16, 185, 129, 0.45)"
        className="kpi-card glass-panel kpi-card-hero"
      >
        <div className="kpi-header">
          <span className="kpi-title">
            <Briefcase size={16} /> Mi Patrimonio Total
            <span className="help-tooltip" data-tooltip="Valor neto total consolidado de tus acciones en cartera más el saldo líquido disponible en efectivo.">
              <HelpCircle size={14} />
            </span>
          </span>
          <span className="badge badge-pulse">
            <span className="pulse-dot"></span>
            <span>BVC EN VIVO</span>
          </span>
        </div>

        {/* Valor Primario según la divisa seleccionada */}
        <div className="kpi-main-block">
          <div className="kpi-main-metric">
            {currentMode === 'ves' && formatVES(totalPortfolioVes)}
            {currentMode === 'usd_bcv' && formatUSD(totalPortfolioUsdBcv)}
            {currentMode === 'usdt' && formatUSDT(totalPortfolioUsdt)}
            {currentMode === 'compare' && formatVES(totalPortfolioVes)}
          </div>
          <span className="kpi-metric-sublabel">
            {currentMode === 'ves' && 'Patrimonio Total en Bolívares (VES)'}
            {currentMode === 'usd_bcv' && 'Patrimonio Total al Dólar Oficial BCV'}
            {currentMode === 'usdt' && 'Patrimonio Total en Dólar Real (USDT Binance P2P)'}
            {currentMode === 'compare' && 'Patrimonio Total Consolidado (Acciones + Efectivo)'}
          </span>
        </div>

        {/* Píldoras de desglose: Acciones vs Efectivo */}
        <div className="kpi-sub-pills">
          <div className="sub-pill">
            <div className="sub-pill-icon icon-stocks"><TrendingUp size={16} /></div>
            <div className="sub-pill-content">
              <span className="sub-pill-label">Acciones (BVC)</span>
              <strong className="sub-pill-val">
                {currentMode === 'ves' && formatVES(totalStockVes)}
                {currentMode === 'usd_bcv' && formatUSD(totalStockUsdBcv)}
                {currentMode === 'usdt' && formatUSDT(totalStockUsdt)}
                {currentMode === 'compare' && formatVES(totalStockVes)}
              </strong>
            </div>
          </div>

          <div className="sub-pill">
            <div className="sub-pill-icon icon-cash"><Coins size={16} /></div>
            <div className="sub-pill-content">
              <span className="sub-pill-label">Efectivo Líquido</span>
              <strong className="sub-pill-val">
                {currentMode === 'ves' && formatVES(portfolio.cash_ves)}
                {currentMode === 'usd_bcv' && formatUSD(portfolio.cash_usd)}
                {currentMode === 'usdt' && formatUSDT((portfolio.cash_ves / (rates.usdt || 1)) + portfolio.cash_usd)}
                {currentMode === 'compare' && formatVES(portfolio.cash_ves)}
              </strong>
            </div>
          </div>
        </div>

        {/* Equivalencias multi-divisa al pie */}
        <div className="kpi-footer-equivalents">
          <span className="equiv-chip" title="Equivalencia al Dólar Oficial del Banco Central de Venezuela">
            🏛️ BCV: <strong>{formatUSD(totalPortfolioUsdBcv)}</strong>
          </span>
          <span className="equiv-chip chip-highlight" title="Equivalencia al Dólar Real de Binance P2P (Poder Adquisitivo)">
            💎 USDT Real: <strong>{formatUSDT(totalPortfolioUsdt)}</strong>
          </span>
        </div>
      </SpotlightCard>

      {/* ==============================================================
          CARD 2: RENDIMIENTO Y COBERTURA (MICROKIT SPOTLIGHT)
         ============================================================== */}
      <SpotlightCard
        spotlightColor={isUsdtPos ? 'rgba(16, 185, 129, 0.16)' : 'rgba(244, 63, 94, 0.16)'}
        borderColor={isUsdtPos ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)'}
        className="kpi-card glass-panel kpi-card-pnl"
      >
        <div className="kpi-header">
          <span className="kpi-title">
            <ShieldCheck size={16} /> Rendimiento y Cobertura
            <span className="help-tooltip" data-tooltip="Compara tu ganancia en Bolívares con la subida del dólar paralelo (USDT). Si tu ganancia real en USDT es positiva, tu dinero está superando a la devaluación.">
              <HelpCircle size={14} />
            </span>
          </span>
          <span className={`badge ${isUsdtPos ? 'badge-success' : 'badge-danger'}`}>
            {currentMode === 'ves' ? (isVesPos ? 'Ganancia Nominal' : 'Pérdida Nominal') : ''}
            {currentMode === 'usd_bcv' ? (isBcvPos ? 'Retorno Oficial BCV' : 'Retorno Negativo') : ''}
            {(currentMode === 'usdt' || currentMode === 'compare') ? (isUsdtPos ? 'Ganancia Real' : 'Pérdida en USDT') : ''}
          </span>
        </div>

        {/* MODO 1: COMPARATIVA TRI-MONETARIA (Muestra los 3 rendimientos simultáneamente) */}
        {currentMode === 'compare' && (
          <>
            <div className="pnl-tri-hero-grid">
              {/* VES */}
              <div className="tri-hero-card card-ves">
                <div className="tri-hero-header">
                  <span className="pill-mini">VES</span>
                  <span className="tri-hero-title">Bolívares</span>
                </div>
                <div className={`tri-hero-val ${vesColor}`}>{vesSign}{formatVES(totals.ves.pnl)}</div>
                <div className={`tri-hero-sub ${vesColor}`}>{vesSign}{totals.ves.pnl_pct.toFixed(2)}% Nominal</div>
              </div>

              {/* BCV */}
              <div className="tri-hero-card card-bcv">
                <div className="tri-hero-header">
                  <span className="pill-mini">BCV</span>
                  <span className="tri-hero-title">Dólar BCV</span>
                </div>
                <div className={`tri-hero-val ${bcvColor}`}>{bcvSign}{formatUSD(totals.usd_bcv.pnl)}</div>
                <div className={`tri-hero-sub ${bcvColor}`}>{bcvSign}{totals.usd_bcv.pnl_pct.toFixed(2)}% BCV</div>
              </div>

              {/* USDT */}
              <div className="tri-hero-card card-usdt">
                <div className="tri-hero-header">
                  <span className="pill-mini pill-crypto">USDT</span>
                  <span className="tri-hero-title">Poder Real</span>
                </div>
                <div className={`tri-hero-val ${usdtColor}`}>{usdtSign}{formatUSDT(totals.usdt.pnl)}</div>
                <div className={`tri-hero-sub ${usdtColor}`}>{usdtSign}{totals.usdt.pnl_pct.toFixed(2)}% Real</div>
              </div>
            </div>

            {/* Medidor de Cobertura Cambiaria */}
            <div className="spread-meter-box">
              <div className="meter-labels">
                <span>Ganancia en Bs: <strong className="text-green">{formatPercent(totals.ves.pnl_pct)}</strong></span>
                <span>Brecha Dólar: <strong className="text-amber">+{brecha.toFixed(2)}%</strong></span>
              </div>
              <div className="meter-track">
                <div className="meter-fill meter-fill-pnl" style={{ width: `${fillPercent}%` }}></div>
                <div className="meter-marker" style={{ left: `${markerPercent}%` }} title="Nivel de la Brecha Cambiaria"></div>
              </div>
              <div className="meter-caption">
                <span>🎯 Cobertura cambiaria neta: <strong className={isNetCoveragePositive ? 'text-green' : 'text-amber'}>{isNetCoveragePositive ? `+${netCoverage}%` : `${netCoverage}%`} neto por encima del dólar</strong></span>
              </div>
            </div>

            {/* Píldora de veredicto tri-monetario */}
            <div className="pnl-tri-verdict-row">
              <div className={`pnl-verdict-pill ${isUsdtPos ? 'badge-success' : 'badge-danger'}`}>
                <Shield size={13} />
                <span>
                  {isUsdtPos
                    ? `Ganancia Real: +${totals.usdt.pnl_pct.toFixed(2)}% USDT (Superas la devaluación)`
                    : `Riesgo Cambiario: ${totals.usdt.pnl_pct.toFixed(2)}% USDT (La devaluación absorbe ganancia)`}
                </span>
              </div>
            </div>
          </>
        )}

        {/* MODO 2: BOLÍVARES (VES) INDIVIDUAL */}
        {currentMode === 'ves' && (
          <>
            <div className="pnl-hero-container">
              <div className={`pnl-hero-val ${vesColor}`}>{vesSign}{formatVES(totals.ves.pnl)}</div>
              <div className={`pnl-verdict-pill ${isVesPos ? 'badge-success' : 'badge-danger'}`}>
                <Shield size={13} /> <span>🇻🇪 Rendimiento en Bolívares: {vesSign}{totals.ves.pnl_pct.toFixed(2)}% Nominal</span>
              </div>
            </div>

            <div className="pnl-single-currency-stack">
              <div className="single-pnl-card">
                <span className="single-lbl"><Calculator size={14} /> Capital Invertido:</span>
                <strong className="single-val">{formatVES(totalStockVes - totals.ves.pnl)}</strong>
              </div>
              <div className="single-pnl-card">
                <span className="single-lbl"><LineChart size={14} /> Valor Actual en la BVC:</span>
                <strong className="single-val">{formatVES(totalStockVes)}</strong>
              </div>
              <div className="single-pnl-card single-pnl-highlight">
                <span className="single-lbl"><ArrowUpRight size={14} /> Ganancia Nominal Neta:</span>
                <strong className={`single-val ${vesColor}`}>{vesSign}{formatVES(totals.ves.pnl)} ({formatPercent(totals.ves.pnl_pct)})</strong>
              </div>
            </div>
          </>
        )}

        {/* MODO 3: USD (TASA BCV) INDIVIDUAL */}
        {currentMode === 'usd_bcv' && (
          <>
            <div className="pnl-hero-container">
              <div className={`pnl-hero-val ${bcvColor}`}>{bcvSign}{formatUSD(totals.usd_bcv.pnl)}</div>
              <div className={`pnl-verdict-pill ${isBcvPos ? 'badge-success' : 'badge-danger'}`}>
                <Shield size={13} /> <span>🏛️ Rendimiento Oficial USD: {bcvSign}{totals.usd_bcv.pnl_pct.toFixed(2)}% BCV</span>
              </div>
            </div>

            <div className="pnl-single-currency-stack">
              <div className="single-pnl-card">
                <span className="single-lbl"><Calculator size={14} /> Costo de Compra (Tasa BCV):</span>
                <strong className="single-val">{formatUSD(totalStockUsdBcv - totals.usd_bcv.pnl)}</strong>
              </div>
              <div className="single-pnl-card">
                <span className="single-lbl"><LineChart size={14} /> Valor Oficial de Cartera:</span>
                <strong className="single-val">{formatUSD(totalStockUsdBcv)}</strong>
              </div>
              <div className="single-pnl-card single-pnl-highlight">
                <span className="single-lbl"><ArrowUpRight size={14} /> Retorno Oficial en Dólares:</span>
                <strong className={`single-val ${bcvColor}`}>{bcvSign}{formatUSD(totals.usd_bcv.pnl)} ({formatPercent(totals.usd_bcv.pnl_pct)})</strong>
              </div>
            </div>
          </>
        )}

        {/* MODO 4: USDT (BINANCE P2P) INDIVIDUAL */}
        {currentMode === 'usdt' && (
          <>
            <div className="pnl-hero-container">
              <div className={`pnl-hero-val ${usdtColor}`}>{usdtSign}{formatUSDT(totals.usdt.pnl)}</div>
              <div className={`pnl-verdict-pill ${isUsdtPos ? 'badge-success' : 'badge-danger'}`}>
                <Shield size={13} /> <span>💎 Rendimiento Real: {usdtSign}{totals.usdt.pnl_pct.toFixed(2)}% USDT P2P</span>
              </div>
            </div>

            <div className="spread-meter-box" style={{ marginBottom: '10px' }}>
              <div className="meter-labels">
                <span>Ganancia en Bs: <strong className="text-green">{formatPercent(totals.ves.pnl_pct)}</strong></span>
                <span>Brecha Dólar: <strong className="text-amber">+{brecha.toFixed(2)}%</strong></span>
              </div>
              <div className="meter-track">
                <div className="meter-fill meter-fill-pnl" style={{ width: `${fillPercent}%` }}></div>
                <div className="meter-marker" style={{ left: `${markerPercent}%` }}></div>
              </div>
            </div>

            <div className="pnl-single-currency-stack">
              <div className="single-pnl-card">
                <span className="single-lbl"><Calculator size={14} /> Inversión Real P2P:</span>
                <strong className="single-val">{formatUSDT(totalStockUsdt - totals.usdt.pnl)}</strong>
              </div>
              <div className="single-pnl-card">
                <span className="single-lbl"><LineChart size={14} /> Valor Real en USDT:</span>
                <strong className="single-val">{formatUSDT(totalStockUsdt)}</strong>
              </div>
              <div className="single-pnl-card single-pnl-highlight">
                <span className="single-lbl"><ArrowUpRight size={14} /> Poder Adquisitivo Real:</span>
                <strong className={`single-val ${usdtColor}`}>{usdtSign}{formatUSDT(totals.usdt.pnl)} ({formatPercent(totals.usdt.pnl_pct)})</strong>
              </div>
            </div>
          </>
        )}
      </SpotlightCard>

      {/* ==============================================================
          CARD 3: BILLETERA Y LIQUIDEZ DISPONIBLE (MICROKIT SPOTLIGHT)
         ============================================================== */}
      <SpotlightCard
        spotlightColor="rgba(59, 130, 246, 0.16)"
        borderColor="rgba(59, 130, 246, 0.45)"
        className="kpi-card glass-panel kpi-card-wallet"
      >
        <div className="kpi-header">
          <span className="kpi-title">
            <Wallet size={16} /> Billetera y Liquidez
            <span className="help-tooltip" data-tooltip="Dinero líquido en tu cuenta de corretaje sin invertir. Te permite comprar títulos durante correcciones o bajas del mercado.">
              <HelpCircle size={14} />
            </span>
          </span>
          <button className="btn-ghost-small" onClick={onOpenAdjustCash}>
            <Edit3 size={13} /> Ajustar Saldos
          </button>
        </div>

        {/* Dual Modern Wallet Cards */}
        <div className="wallet-pills-row">
          <div className="wallet-pill-card">
            <div className="wallet-pill-header">
              <span className="flag-circle">🇻🇪</span>
              <span className="wallet-currency-name">Bolívares (VES)</span>
            </div>
            <strong className="wallet-pill-amount">{formatVES(portfolio.cash_ves)}</strong>
          </div>

          <div className="wallet-pill-card">
            <div className="wallet-pill-header">
              <span className="flag-circle">🇺🇸</span>
              <span className="wallet-currency-name">Dólares (USD)</span>
            </div>
            <strong className="wallet-pill-amount">{formatUSD(portfolio.cash_usd)}</strong>
          </div>
        </div>

        {/* Liquidity Health Meter */}
        <div className="liquidity-health-box" style={{ marginTop: '12px' }}>
          <div className="meter-labels">
            <span>% Liquidez de Cartera: <strong className="text-blue">{liquidityPct.toFixed(2)}%</strong></span>
            {liquidityPct < 5 ? (
              <span className="text-amber">⚠️ Liquidez baja (conviene tener 5-10% en efectivo)</span>
            ) : (
              <span className="text-green">✓ Liquidez óptima</span>
            )}
          </div>
          <div className="meter-track" style={{ marginTop: '6px' }}>
            <div
              className="meter-fill"
              style={{
                width: `${Math.min(100, liquidityPct * 5)}%`,
                background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
              }}
            ></div>
          </div>
        </div>

        {/* Botón principal de acción: Operar */}
        <button
          className="btn-action-primary"
          onClick={onOpenAddPosition}
          style={{
            marginTop: '16px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '11px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            border: 'none',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
          }}
        >
          <PlusCircle size={16} /> Operar / Agregar Acción
        </button>
      </SpotlightCard>
    </div>
  );
};

export const HeroKPIs = React.memo(HeroKPIsComponent);
