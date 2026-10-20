'use client';

import React, { useMemo } from 'react';
import { BvcTicker } from '@/types';
import { formatVES } from '@/lib/formatters';

interface TickerTapeProps {
  tickers: BvcTicker[];
  onSelectTicker?: (symbol: string) => void;
}

const TickerTapeComponent: React.FC<TickerTapeProps> = ({ tickers, onSelectTicker }) => {
  // Ordenar tickers: instrumentos líquidos y con variación al frente
  const sortedTickers = useMemo(() => {
    if (!tickers || tickers.length === 0) return [];

    // Filtrar instrumentos sin cotización válida
    const valid = tickers.filter((t) => t.price > 0);

    // Separar en activos con variación y activos sin movimiento
    const movers = valid.filter((t) => Math.abs(t.change_pct) > 0);
    const neutrals = valid.filter((t) => Math.abs(t.change_pct) === 0);

    // Ordenar los que tienen variación por magnitud de variación
    movers.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));

    return [...movers, ...neutrals];
  }, [tickers]);

  // Duplicar elementos para que el marquee sea infinito y sin cortes
  const marqueeList = useMemo(() => {
    if (sortedTickers.length === 0) return [];
    return [...sortedTickers, ...sortedTickers];
  }, [sortedTickers]);

  return (
    <div className="tape-container">
      <div className="tape-badge">
        <span className="pulse-dot" style={{ width: '6px', height: '6px', minWidth: '6px' }}></span>
        <span>BVC LIVE</span>
      </div>
      <div className="tape-viewport">
        <div className="tape-track">
          {marqueeList.map((t, idx) => {
            const isPos = t.change_pct > 0;
            const isZero = t.change_pct === 0;
            const sign = isPos ? '▲ +' : t.change_pct < 0 ? '▼ ' : '';
            const badgeClass = isPos ? 'tag-green' : isZero ? 'tag-neutral' : 'tag-red';

            return (
              <div
                key={`${t.symbol}-${idx}`}
                className="tape-item"
                onClick={() => onSelectTicker?.(t.symbol)}
                title={`${t.name}: ${formatVES(t.price)} (${isPos ? '+' : ''}${t.change_pct.toFixed(2)}%)`}
              >
                <span className="sym">{t.symbol}</span>
                <span className="price">{formatVES(t.price)}</span>
                <span className={`tag ${badgeClass}`}>
                  {sign}
                  {t.change_pct.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const TickerTape = React.memo(TickerTapeComponent);
