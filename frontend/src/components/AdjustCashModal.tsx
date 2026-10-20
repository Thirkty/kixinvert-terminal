'use client';

import React, { useState } from 'react';
import { X, Wallet } from 'lucide-react';
import { formatVES, formatUSD } from '@/lib/formatters';

interface AdjustCashModalProps {
  isOpen: boolean;
  currentCashVes: number;
  currentCashUsd: number;
  onClose: () => void;
  onSave: (ves: number, usd: number) => void;
}

export const AdjustCashModal: React.FC<AdjustCashModalProps> = ({
  isOpen,
  currentCashVes,
  currentCashUsd,
  onClose,
  onSave,
}) => {
  const [cashVes, setCashVes] = useState<number>(currentCashVes);
  const [cashUsd, setCashUsd] = useState<number>(currentCashUsd);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(Math.max(0, cashVes), Math.max(0, cashUsd));
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={20} style={{ color: '#3b82f6' }} /> Ajustar Saldos en Efectivo
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
              Saldo en Bolívares (VES)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={cashVes}
              onChange={(e) => setCashVes(parseFloat(e.target.value) || 0)}
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
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Equivale a {formatVES(cashVes)}
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px' }}>
              Saldo en Dólares (USD)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={cashUsd}
              onChange={(e) => setCashUsd(parseFloat(e.target.value) || 0)}
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
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Equivale a {formatUSD(cashUsd)}
            </span>
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
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Guardar Saldos
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
