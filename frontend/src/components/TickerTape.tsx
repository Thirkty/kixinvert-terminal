'use client';

import React, { useMemo } from 'react';
import { BvcTicker, Ecosystem, InternationalQuote } from '@/types';
import { formatVES, formatUSD } from '@/lib/formatters';
import { playTerminalSound } from '@/lib/audio';

interface TickerTapeProps {
  tickers: BvcTicker[];
  intlTickers?: InternationalQuote[];
  currentEcosystem?: Ecosystem;
  onSelectTicker?: (symbol: string) => void;
}

const TickerTapeComponent: React.FC<TickerTapeProps> = ({
  tickers,
  intlTickers = [],
  currentEcosystem = 'BVC',
  onSelectTicker,
}) => {
  const activeItems = useMemo(() => {
    if (currentEcosystem === 'US') {
      if (!intlTickers || intlTickers.length === 0) return [];
      return intlTickers.map((item) => ({
        symbol: item.symbol,
        name: item.name,
        price: item.price,
        change_pct: item.change_pct,
        currency: 'USD',
      }));
    }

    if (!tickers || tickers.length === 0) return [];
    const valid = tickers.filter((t) => t.price > 0);
    const movers = valid.filter((t) => Math.abs(t.change_pct) > 0);
    const neutrals = valid.filter((t) => Math.abs(t.change_pct) === 0);
    movers.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
    return [...movers, ...neutrals].map((item) => ({
      symbol: item.symbol,
      name: item.name,
      price: item.price,
      change_pct: item.change_pct,
      currency: 'VES',
    }));
  }, [tickers, intlTickers, currentEcosystem]);

  // Duplicar elementos para que el marquee sea infinito y sin cortes
  const marqueeList = useMemo(() => {
    if (activeItems.length === 0) return [];
    return [...activeItems, ...activeItems];
  }, [activeItems]);

  return (
    <div className="tape-container" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div className="tape-badge" style={{ background: currentEcosystem === 'US' ? 'rgba(124, 140, 255, 0.15)' : 'rgba(124, 140, 255, 0.15)', color: currentEcosystem === 'US' ? '#b4bcff' : '#c9cfff' }}>
        <span className="pulse-dot" style={{ width: '6px', height: '6px', minWidth: '6px', background: currentEcosystem === 'US' ? '#7c8cff' : '#7c8cff' }}></span>
        <span>{currentEcosystem === 'US' ? 'WALL STREET' : 'BVC LIVE'}</span>
      </div>
      <div className="tape-viewport">
        <div className="tape-track">
          {marqueeList.map((t, idx) => {
            const isPos = t.change_pct > 0;
            const isZero = t.change_pct === 0;
            const sign = isPos ? '▲ +' : t.change_pct < 0 ? '▼ ' : '';
            const badgeClass = isPos ? 'tag-green' : isZero ? 'tag-neutral' : 'tag-red';
            const priceFormatted = t.currency === 'USD' ? formatUSD(t.price) : formatVES(t.price);

            return (
              <div
                key={`${t.symbol}-${idx}`}
                className="tape-item"
                onClick={() => {
                  playTerminalSound('click');
                  onSelectTicker?.(t.symbol);
                }}
                title={`${t.name}: ${priceFormatted} (${isPos ? '+' : ''}${t.change_pct.toFixed(2)}%)`}
              >
                <span className="sym">{t.symbol}</span>
                <span className="price">{priceFormatted}</span>
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
