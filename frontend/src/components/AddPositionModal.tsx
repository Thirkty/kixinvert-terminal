'use client';

import React, { useState } from 'react';
import { X, PlusCircle, CheckSquare, Square, Calendar } from 'lucide-react';
import { BvcTicker, Position } from '@/types';
import { formatVES } from '@/lib/formatters';

interface AddPositionModalProps {
  isOpen: boolean;
  bvcTickers: BvcTicker[];
  currentCashVes?: number;
  onClose: () => void;
  onAdd: (newPos: Position, deductFromCash?: boolean, execDate?: string) => void;
}

export const AddPositionModal: React.FC<AddPositionModalProps> = ({
  isOpen,
  bvcTickers,
  currentCashVes = 0,
  onClose,
  onAdd,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState(bvcTickers[0]?.symbol || 'BNC');
  const [shares, setShares] = useState<number>(100);
  const [buyPrice, setBuyPrice] = useState<number>(bvcTickers[0]?.price || 250);
  const [deductFromCash, setDeductFromCash] = useState<boolean>(true);
  const [executionDate, setExecutionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  if (!isOpen) return null;

  const currentTicker = bvcTickers.find((t) => t.symbol === selectedSymbol);
  const totalCost = shares * buyPrice;
  const cashRemaining = currentCashVes - totalCost;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTicker || shares <= 0 || buyPrice <= 0) return;

    onAdd(
      {
        symbol: currentTicker.symbol,
        name: currentTicker.name,
        shares: Number(shares),
        avg_cost: Number(buyPrice),
        current_price: currentTicker.price,
        change_pct: currentTicker.change_pct,
      },
      deductFromCash,
      executionDate
    );
    onClose();
  };

  const handleSelectSymbol = (sym: string) => {
    setSelectedSymbol(sym);
    const tick = bvcTickers.find((t) => t.symbol === sym);
    if (tick) setBuyPrice(tick.price);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '28px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={20} style={{ color: '#10b981' }} /> Operar / Agregar Título
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
              Acción / Título BVC
            </label>
            <select
              value={selectedSymbol}
              onChange={(e) => handleSelectSymbol(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#1e293b',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '0.88rem',
                outline: 'none',
              }}
            >
              {bvcTickers.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol} - {t.name} ({formatVES(t.price)})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
                Nº de Acciones
              </label>
              <input
                type="number"
                min="1"
                required
                value={shares}
                onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 0))}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
                Precio por Acción (Bs)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={buyPrice}
                onChange={(e) => setBuyPrice(Math.max(0.01, parseFloat(e.target.value) || 0))}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
              Fecha de Compra
            </label>
            <input
              type="date"
              required
              value={executionDate}
              onChange={(e) => setExecutionDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '0.84rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Liquidación de efectivo checkbox */}
          <div
            onClick={() => setDeductFromCash(!deductFromCash)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              padding: '10px 12px',
              borderRadius: '10px',
              background: deductFromCash ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              border: deductFromCash ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              userSelect: 'none',
            }}
          >
            {deductFromCash ? (
              <CheckSquare size={18} style={{ color: '#10b981' }} />
            ) : (
              <Square size={18} style={{ color: '#64748b' }} />
            )}
            <span style={{ fontSize: '0.82rem', color: deductFromCash ? '#a7f3d0' : '#94a3b8', fontWeight: 600 }}>
              Liquidar automáticamente de mi saldo en efectivo disponible
            </span>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.82rem',
              color: '#94a3b8',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Inversión Total:</span>
              <strong style={{ color: '#fff' }}>{formatVES(totalCost)}</strong>
            </div>
            {deductFromCash && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span>Saldo disponible tras compra:</span>
                <span style={{ color: cashRemaining >= 0 ? '#10b981' : '#f87171', fontWeight: 700 }}>
                  {formatVES(Math.max(0, cashRemaining))}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                flex: 2,
                padding: '10px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Registrar Compra
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
