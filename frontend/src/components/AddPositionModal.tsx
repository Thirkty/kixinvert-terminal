'use client';

import React, { useState } from 'react';
import { X, PlusCircle } from 'lucide-react';
import { BvcTicker, Position } from '@/types';
import { formatVES } from '@/lib/formatters';

interface AddPositionModalProps {
  isOpen: boolean;
  bvcTickers: BvcTicker[];
  onClose: () => void;
  onAdd: (newPos: Position) => void;
}

export const AddPositionModal: React.FC<AddPositionModalProps> = ({
  isOpen,
  bvcTickers,
  onClose,
  onAdd,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState(bvcTickers[0]?.symbol || 'BNC');
  const [shares, setShares] = useState<number>(100);
  const [buyPrice, setBuyPrice] = useState<number>(bvcTickers[0]?.price || 250);

  if (!isOpen) return null;

  const currentTicker = bvcTickers.find((t) => t.symbol === selectedSymbol);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTicker || shares <= 0 || buyPrice <= 0) return;

    onAdd({
      symbol: currentTicker.symbol,
      name: currentTicker.name,
      shares: Number(shares),
      avg_cost: Number(buyPrice),
      current_price: currentTicker.price,
      change_pct: currentTicker.change_pct,
    });
    onClose();
  };

  const handleSelectSymbol = (sym: string) => {
    setSelectedSymbol(sym);
    const tick = bvcTickers.find((t) => t.symbol === sym);
    if (tick) setBuyPrice(tick.price);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
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
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '0.88rem',
                outline: 'none',
              }}
            >
              {bvcTickers.map((t) => (
                <option key={t.symbol} value={t.symbol} style={{ background: '#111827', color: '#fff' }}>
                  {t.symbol} - {t.name} ({formatVES(t.price)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
              Cantidad de Títulos (Acciones)
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
              Precio de Compra por Acción (Bs.)
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

          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.82rem', color: '#94a3b8' }}>
            Inversión Total Estimada: <strong style={{ color: '#fff' }}>{formatVES(shares * buyPrice)}</strong>
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
              Agregar a Portafolio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
