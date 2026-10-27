'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, PlusCircle, History, Sliders, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import { formatVES, formatUSD } from '@/lib/formatters';
import { depositCashApi, fetchCashMovementsApi } from '@/lib/api';
import { playTerminalSound } from '@/lib/audio';
import { ModalShell, Field, ModalActions } from './TradeModal';

interface AdjustCashModalProps {
  isOpen: boolean;
  currentCashVes: number;
  currentCashUsd: number;
  onClose: () => void;
  onSave: (ves: number, usd: number) => void;
}

interface CashMovement {
  id: number;
  movement_type: string;
  currency: string;
  amount: number;
  balance_after: number;
  concept?: string;
  movement_date?: string;
}

const TABS = [
  { id: 'deposit', label: 'Depositar', icon: PlusCircle },
  { id: 'history', label: 'Movimientos', icon: History },
  { id: 'direct', label: 'Ajuste', icon: Sliders },
] as const;

const money = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

export const AdjustCashModal: React.FC<AdjustCashModalProps> = ({
  isOpen,
  currentCashVes,
  currentCashUsd,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('deposit');

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
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState<boolean>(false);

  const loadMovements = async () => {
    setLoadingMovements(true);
    try {
      const data = await fetchCashMovementsApi();
      setMovements(data.movements || []);
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCashVes(currentCashVes);
      setCashUsd(currentCashUsd);
      setDepositSuccessMsg('');
      loadMovements();
    }
  }, [isOpen, currentCashVes, currentCashUsd]);

  if (!isOpen) return null;

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0) return;
    setIsSubmittingDeposit(true);
    setDepositSuccessMsg('');
    try {
      const res = await depositCashApi({ amount: depositAmount, currency: depositCurrency, date: depositDate, concept: depositConcept });
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
    <ModalShell icon={<Wallet size={20} style={{ color: 'var(--accent)' }} />} title="Control de Efectivo y Caja" onClose={onClose}>
      {/* Saldo actual */}
      <div className="tm-stats" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div>
          <span>Saldo Libre VES</span>
          <strong style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent)' }}>{formatVES(cashVes)}</strong>
        </div>
        <div>
          <span>Saldo Libre USD</span>
          <strong style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-usdt)' }}>{formatUSD(cashUsd)}</strong>
        </div>
      </div>

      {/* Pestañas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '6px', padding: '4px', borderRadius: '10px', marginBottom: '18px', background: 'rgba(255, 255, 255, 0.04)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              padding: '7px 8px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
              background: activeTab === id ? 'rgba(124, 140, 255, 0.2)' : 'transparent',
              color: activeTab === id ? '#c9cfff' : 'var(--text-muted)',
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'deposit' && (
        <form onSubmit={handleDepositSubmit} className="tm-form">
          <div className="tm-grid2">
            <Field label="Fecha de Inyección">
              <input type="date" required className="tm-input" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
            </Field>
            <Field label="Moneda">
              <select className="tm-input" value={depositCurrency} onChange={(e) => setDepositCurrency(e.target.value as 'VES' | 'USD')}>
                <option value="VES">Bolívares (VES)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </Field>
          </div>

          <Field label={`Monto a Depositar (${depositCurrency})`}>
            <input
              type="number" step="0.01" min="0.01" required className="tm-input tm-num"
              style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'inherit', color: depositCurrency === 'VES' ? 'var(--accent)' : 'var(--accent-usdt)' }}
              value={depositAmount}
              onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
            />
          </Field>

          <Field label="Concepto / Origen de Fondos">
            <input type="text" required className="tm-input" placeholder="Ej: Aporte inicial, Transferencia Banesco"
              value={depositConcept} onChange={(e) => setDepositConcept(e.target.value)} />
          </Field>

          {depositSuccessMsg && (
            <div className="tm-success">
              <CheckCircle2 size={16} /> {depositSuccessMsg}
            </div>
          )}

          <button type="submit" className="tm-btn tm-btn-primary" disabled={isSubmittingDeposit} style={{ marginTop: '6px', fontWeight: 800 }}>
            <PlusCircle size={16} /> Registrar Depósito (+{depositAmount.toLocaleString()} {depositCurrency})
          </button>
        </form>
      )}

      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
          {loadingMovements ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Cargando historial de caja...
            </div>
          ) : movements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Aún no tienes movimientos registrados en tu libro de caja. Cada depósito o compra de acciones se reflejará aquí.
            </div>
          ) : (
            movements.map((m) => {
              const isPositive = m.movement_type === 'DEPOSIT' || m.movement_type === 'SELL_STOCK';
              const color = isPositive ? 'var(--up)' : 'var(--down)';
              return (
                <div key={m.id} className="tm-row" style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', flexShrink: 0, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color, background: isPositive ? 'var(--up-bg)' : 'var(--down-bg)' }}>
                      {isPositive ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff' }}>
                        {m.concept || (isPositive ? 'Depósito' : 'Liquidación')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        {m.movement_date ? m.movement_date.split('T')[0] : 'Fecha registrada'}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color }}>
                      {isPositive ? '+' : '-'}{money(m.amount)} {m.currency}
                    </div>
                    <div style={{ fontSize: '0.7rem' }}>Saldo: {money(m.balance_after)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'direct' && (
        <form onSubmit={handleDirectSave} className="tm-form">
          <Field label="Saldo Total en Bolívares (VES)">
            <input type="number" step="0.01" min="0" required className="tm-input" value={cashVes}
              onChange={(e) => setCashVes(parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Saldo Total en Dólares (USD)">
            <input type="number" step="0.01" min="0" required className="tm-input" value={cashUsd}
              onChange={(e) => setCashUsd(parseFloat(e.target.value) || 0)} />
          </Field>
          <ModalActions onCancel={onClose} submitLabel="Guardar Saldo Fijo" />
        </form>
      )}
    </ModalShell>
  );
};
