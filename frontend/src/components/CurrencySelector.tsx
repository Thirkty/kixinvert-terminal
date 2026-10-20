'use client';

import React from 'react';
import { Columns3, Banknote, Landmark, Coins } from 'lucide-react';
import { CurrencyMode } from '@/types';

interface CurrencySelectorProps {
  currentMode: CurrencyMode;
  onChangeMode: (mode: CurrencyMode) => void;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({ currentMode, onChangeMode }) => {
  return (
    <div className="currency-segmented-control" role="group" aria-label="Selector de divisa de visualización">
      <button
        type="button"
        className={`curr-btn ${currentMode === 'compare' ? 'active' : ''}`}
        data-curr="compare"
        onClick={() => onChangeMode('compare')}
        title="Vista integral: Muestra simultáneamente Bolívares, USD BCV y USDT Binance"
      >
        <Columns3 size={15} /> Comparativa Tri-Monetaria
      </button>

      <button
        type="button"
        className={`curr-btn ${currentMode === 'ves' ? 'active' : ''}`}
        data-curr="ves"
        onClick={() => onChangeMode('ves')}
        title="Expresar todos los saldos en Bolívares oficiales (VES)"
      >
        <Banknote size={15} /> Bolívares (VES)
      </button>

      <button
        type="button"
        className={`curr-btn ${currentMode === 'usd_bcv' ? 'active' : ''}`}
        data-curr="usd_bcv"
        onClick={() => onChangeMode('usd_bcv')}
        title="Expresar valores al Dólar Oficial del Banco Central de Venezuela"
      >
        <Landmark size={15} /> USD (Tasa BCV)
      </button>

      <button
        type="button"
        className={`curr-btn ${currentMode === 'usdt' ? 'active' : ''}`}
        data-curr="usdt"
        onClick={() => onChangeMode('usdt')}
        title="Expresar valores al dólar real P2P de Binance (Poder adquisitivo)"
      >
        <Coins size={15} /> USDT (Binance)
      </button>
    </div>
  );
};
