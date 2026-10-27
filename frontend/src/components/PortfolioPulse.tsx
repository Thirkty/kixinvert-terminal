'use client';

import React, { useEffect, useRef } from 'react';
import { PieChart, Activity, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Position, MarketRates, PortfolioData } from '@/types';
import { formatPercent } from '@/lib/formatters';

ChartJS.register(ArcElement, Tooltip, Legend);

interface PortfolioPulseProps {
  portfolio: PortfolioData;
  rates: MarketRates;
}

interface Performer {
  pos: Position;
  pnlPct: number;
}

const PortfolioPulseComponent: React.FC<PortfolioPulseProps> = ({ portfolio, rates }) => {
  // Encontrar mejor y peor rendimiento con useMemo
  const { bestPos, worstPos } = React.useMemo(() => {
    let best: Performer | null = null;
    let worst: Performer | null = null;

    for (const p of portfolio.positions) {
      const costVes = p.shares * p.avg_cost;
      const valVes = p.shares * p.current_price;
      const costUsdt = costVes / (rates.usdt || 1);
      const valUsdt = valVes / (rates.usdt || 1);
      const pnlUsdtPct = costUsdt > 0 ? ((valUsdt - costUsdt) / costUsdt) * 100 : 0;

      if (!best || pnlUsdtPct > best.pnlPct) {
        best = { pos: p, pnlPct: pnlUsdtPct };
      }
      if (!worst || pnlUsdtPct < worst.pnlPct) {
        worst = { pos: p, pnlPct: pnlUsdtPct };
      }
    }

    return { bestPos: best, worstPos: worst };
  }, [portfolio.positions, rates.usdt]);

  // Datos para el gráfico de dona (memoizados para evitar repintados continuos de Canvas)
  const chartData = React.useMemo(() => {
    const totalStockVes = portfolio.positions.reduce((acc, p) => acc + (p.shares * p.current_price), 0);
    const totalCashVesEquivalent = portfolio.cash_ves + (portfolio.cash_usd * (rates.bcv || 1));
    const totalConsolidated = totalStockVes + totalCashVesEquivalent;

    const labels = [...portfolio.positions.map((p) => p.symbol), 'Efectivo'];
    const dataValues = [
      ...portfolio.positions.map((p) =>
        totalConsolidated > 0 ? ((p.shares * p.current_price) / totalConsolidated) * 100 : 0
      ),
      totalConsolidated > 0 ? (totalCashVesEquivalent / totalConsolidated) * 100 : 0,
    ];

    // Un tono de índigo distinto por posición; el efectivo siempre en gris
    const positionShades = ['#7c8cff', '#6672d6', '#5560b3', '#454e92', '#373e74', '#2c3259', '#232842'];
    const cashColor = '#4a5160';
    const backgroundColors = [
      ...portfolio.positions.map((_, i) => positionShades[i % positionShades.length]),
      cashColor,
    ];

    return {
      labels,
      datasets: [
        {
          data: dataValues,
          backgroundColor: backgroundColors,
          borderWidth: 2,
          borderColor: '#0c0f14',
        },
      ],
    };
  }, [portfolio.positions, portfolio.cash_ves, portfolio.cash_usd, rates.bcv]);

  const chartOptions = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350,
    },
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#9aa3b2',
          font: { family: 'Inter', size: 12 },
          boxWidth: 12,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => ` ${context.label}: ${context.raw.toFixed(2)}%`,
        },
      },
    },
    cutout: '70%',
  }), []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
      {/* DONUT CHART: PONDERACIÓN DE CARTERA */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div className="kpi-header" style={{ marginBottom: '16px' }}>
          <span className="kpi-title">
            <PieChart size={16} /> Ponderación y Distribución de Activos
          </span>
          <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#9aa3b2' }}>
            % sobre patrimonio total
          </span>
        </div>

        <div style={{ height: '220px', position: 'relative' }}>
          <Doughnut data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* PULSO DEL PORTAFOLIO: BEST/WORST PERFORMER */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div className="kpi-header" style={{ marginBottom: '16px' }}>
          <span className="kpi-title">
            <Activity size={16} /> Pulso del Portafolio
          </span>
          <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#9aa3b2' }}>
            Desempeño y Brecha Cambiaria
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          {/* MAYOR RENDIMIENTO */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(124, 140, 255, 0.06)',
              border: '1px solid rgba(124, 140, 255, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#7c8cff', fontWeight: 700, marginBottom: '6px' }}>
              <TrendingUp size={14} /> MAYOR RENDIMIENTO REAL
            </div>
            <strong style={{ fontSize: '1.1rem', color: '#fff', display: 'block' }}>{bestPos?.pos.symbol || '---'}</strong>
            <span style={{ fontSize: '0.75rem', color: '#9aa3b2', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {bestPos?.pos.name || '---'}
            </span>
            <div style={{ marginTop: '6px', fontSize: '1rem', fontWeight: 800, color: '#7c8cff' }}>
              {bestPos ? `+${bestPos.pnlPct.toFixed(2)}% USDT` : '---'}
            </div>
          </div>

          {/* MENOR RENDIMIENTO */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(217, 164, 65, 0.06)',
              border: '1px solid rgba(217, 164, 65, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#d9a441', fontWeight: 700, marginBottom: '6px' }}>
              <TrendingDown size={14} /> MENOR RENDIMIENTO REAL
            </div>
            <strong style={{ fontSize: '1.1rem', color: '#fff', display: 'block' }}>{worstPos?.pos.symbol || '---'}</strong>
            <span style={{ fontSize: '0.75rem', color: '#9aa3b2', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {worstPos?.pos.name || '---'}
            </span>
            <div style={{ marginTop: '6px', fontSize: '1rem', fontWeight: 800, color: (worstPos?.pnlPct || 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>
              {worstPos ? `${worstPos.pnlPct >= 0 ? '+' : ''}${worstPos.pnlPct.toFixed(2)}% USDT` : '---'}
            </div>
          </div>
        </div>

        {/* ALERTA DE BRECHA CAMBIARIA */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(217, 164, 65, 0.08)',
            border: '1px solid rgba(217, 164, 65, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertTriangle size={20} style={{ color: '#d9a441', flexShrink: 0 }} />
          <div style={{ fontSize: '0.8rem', color: '#ecc985', lineHeight: 1.4 }}>
            <strong>Brecha Cambiaria actual: +{rates.brecha_pct.toFixed(2)}%</strong>
            <div style={{ color: '#9aa3b2', fontSize: '0.75rem' }}>
              La brecha entre el dólar BCV y USDT es de +{rates.brecha_pct.toFixed(2)}%. Tus acciones deben rendir por encima para mantener poder adquisitivo real.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PortfolioPulse = React.memo(PortfolioPulseComponent);
