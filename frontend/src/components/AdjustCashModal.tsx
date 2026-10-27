'use client';

import React, { useState, useEffect } from 'react';
import { X, Wallet, PlusCircle, History, Sliders, Calendar, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import { formatVES, formatUSD } from '@/lib/formatters';
import { depositCashApi, fetchCashMovementsApi } from '@/lib/api';
import { playTerminalSound } from '@/lib/audio';

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
  const [activeTab, setActiveTab] = useState<'deposit' | 'history' | 'direct'>('deposit');

  // Depósito por fecha
  const [depositAmount, setDepositAmount] = useState<number>(10000);
  const [depositCurrency, setDepositCurrency] = useState<'VES' | 'USD'>('VES');
  const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [depositConcept, setDepositConcept] = useState<string>('Aporte para compra de acciones BVC');
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState<boolean>(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string>('');

  // Ajuste directo
  const [cashVes, setCashVes] = useState<number>(currentCashVes);
  const [cashUsd, setCashUsd] = useState<number>(currentCashUsd);

  // Historial de movimientos
  const [movements, setMovements] = useState<any[]>([]);
  const [loadingMovements, setLoadingMovements] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setCashVes(currentCashVes);
      setCashUsd(currentCashUsd);
      setDepositSuccessMsg('');
      loadMovements();
    }
  }, [isOpen, currentCashVes, currentCashUsd]);

  const loadMovements = async () => {
    setLoadingMovements(true);
    try {
      const data = await fetchCashMovementsApi();
      setMovements(data.movements || []);
    } finally {
      setLoadingMovements(false);
    }
  };

  if (!isOpen) return null;

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0) return;
    setIsSubmittingDeposit(true);
    setDepositSuccessMsg('');

    try {
      const res = await depositCashApi({
        amount: depositAmount,
        currency: depositCurrency,
        date: depositDate,
        concept: depositConcept,
      });

      if (res.success) {
        playTerminalSound('success');
        setDepositSuccessMsg(`¡Depósito de ${depositAmount.toLocaleString()} ${depositCurrency} registrado!`);
        if (res.cash_ves !== undefined && res.cash_usd !== undefined) {
          onSave(res.cash_ves, res.cash_usd);
          setCashVes(res.cash_ves);
          setCashUsd(res.cash_usd);
        }
        loadMovements();
        setTimeout(() => setDepositSuccessMsg(''), 4000);
      }
    } finally {
      setIsSubmittingDeposit(false);
    }
  };

  const handleDirectSave = (e: React.FormEvent) => {
    e.preventDefault();
    playTerminalSound('success');
    onSave(Math.max(0, cashVes), Math.max(0, cashUsd));
    onClose();
  };

  return (
    <div className="kx-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '26px', borderRadius: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={20} style={{ color: '#7c8cff' }} /> Control de Efectivo y Caja
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9aa3b2', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Saldo Actual Resumido */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '0.72rem', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Saldo Libre VES
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#7c8cff' }}>
              {formatVES(cashVes)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Saldo Libre USD
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#9aa6ff' }}>
              {formatUSD(cashUsd)}
            </div>
          </div>
        </div>

        {/* Tabs de navegación */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1.2fr 1fr',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '18px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('deposit')}
            style={{
              padding: '7px 8px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'deposit' ? 'rgba(124, 140, 255, 0.2)' : 'transparent',
              color: activeTab === 'deposit' ? '#c9cfff' : '#9aa3b2',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <PlusCircle size={14} /> Depositar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              padding: '7px 8px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'history' ? 'rgba(124, 140, 255, 0.2)' : 'transparent',
              color: activeTab === 'history' ? '#bae6fd' : '#9aa3b2',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <History size={14} /> Movimientos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            style={{
              padding: '7px 8px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'direct' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: activeTab === 'direct' ? '#fff' : '#9aa3b2',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <Sliders size={14} /> Ajuste
          </button>
        </div>

        {/* TAB 1: DEPOSITAR POR FECHA */}
        {activeTab === 'deposit' && (
          <form onSubmit={handleDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: '#9aa3b2', marginBottom: '4px' }}>
                  Fecha de Inyección
                </label>
                <input
                  type="date"
                  required
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '0.84rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: '#9aa3b2', marginBottom: '4px' }}>
                  Moneda
                </label>
                <select
                  value={depositCurrency}
                  onChange={(e) => setDepositCurrency(e.target.value as 'VES' | 'USD')}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: '#1b202b',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: '0.84rem',
                    outline: 'none',
                  }}
                >
                  <option value="VES">Bolívares (VES)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', color: '#9aa3b2', marginBottom: '4px' }}>
                Monto a Depositar ({depositCurrency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={depositAmount}
                onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: depositCurrency === 'VES' ? '#7c8cff' : '#9aa6ff',
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', color: '#9aa3b2', marginBottom: '4px' }}>
                Concepto / Origen de Fondos
              </label>
              <input
                type="text"
                required
                value={depositConcept}
                onChange={(e) => setDepositConcept(e.target.value)}
                placeholder="Ej: Aporte inicial, Transferencia Banesco"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '0.84rem',
                  outline: 'none',
                }}
              />
            </div>

            {depositSuccessMsg && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(124, 140, 255, 0.15)',
                  border: '1px solid rgba(124, 140, 255, 0.3)',
                  color: '#c9cfff',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={16} /> {depositSuccessMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingDeposit}
              style={{
                marginTop: '6px',
                width: '100%',
                padding: '11px',
                borderRadius: '10px',
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                fontWeight: 800,
                fontSize: '0.9rem',
                border: 'none',
                cursor: isSubmittingDeposit ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: 'none',
              }}
            >
              <PlusCircle size={16} /> Registrar Depósito (+{depositAmount.toLocaleString()} {depositCurrency})
            </button>
          </form>
        )}

        {/* TAB 2: HISTORIAL DE MOVIMIENTOS Y LIQUIDACIONES */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
            {loadingMovements ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#9aa3b2', fontSize: '0.85rem' }}>
                Cargando historial de caja...
              </div>
            ) : movements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 16px', color: '#667085', fontSize: '0.85rem' }}>
                Aún no tienes movimientos registrados en tu libro de caja. Cada depósito o compra de acciones se reflejará aquí.
              </div>
            ) : (
              movements.map((m) => {
                const isPositive = m.movement_type === 'DEPOSIT' || m.movement_type === 'SELL_STOCK';
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: isPositive ? 'rgba(63,182,139, 0.15)' : 'rgba(229,97,110, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isPositive ? 'var(--up)' : 'var(--down)',
                        }}
                      >
                        {isPositive ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff' }}>
                          {m.concept || (isPositive ? 'Depósito' : 'Liquidación')}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#667085' }}>
                          {m.movement_date ? m.movement_date.split('T')[0] : 'Fecha registrada'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '0.86rem',
                          fontWeight: 800,
                          color: isPositive ? 'var(--up)' : 'var(--down)',
                        }}
                      >
                        {isPositive ? '+' : '-'}{Number(m.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {m.currency}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#9aa3b2' }}>
                        Saldo: {Number(m.balance_after).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: AJUSTE DIRECTO */}
        {activeTab === 'direct' && (
          <form onSubmit={handleDirectSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#9aa3b2', marginBottom: '6px' }}>
                Saldo Total en Bolívares (VES)
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
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#9aa3b2', marginBottom: '6px' }}>
                Saldo Total en Dólares (USD)
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
                  color: '#9aa3b2',
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
                  background: 'var(--accent)',
                  color: 'var(--on-accent)',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Guardar Saldo Fijo
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
