'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, PlusCircle, CheckSquare, Square, Calendar, Receipt } from 'lucide-react';
import { BvcTicker, Position } from '@/types';
import { formatVES } from '@/lib/formatters';
import { calculateMercosurFees } from '@/lib/mercosurFees';

interface AddPositionModalProps {
  isOpen: boolean;
  bvcTickers: BvcTicker[];
  currentCashVes?: number;
  onClose: () => void;
  onAdd: (
    newPos: Position,
    deductFromCash?: boolean,
    execDate?: string,
    fees?: {
      broker_commission?: number;
      broker_iva?: number;
      broker_registry_fee?: number;
      net_total_amount?: number;
    }
  ) => void;
}

export const AddPositionModal: React.FC<AddPositionModalProps> = ({
  isOpen,
  bvcTickers,
  currentCashVes = 0,
  onClose,
  onAdd,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState(bvcTickers[0]?.symbol || 'BNC');
  const [shares, setShares] = useState<string>('100');
  const [buyPrice, setBuyPrice] = useState<string>('250');
  const [deductFromCash, setDeductFromCash] = useState<boolean>(true);
  const [executionDate, setExecutionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Modo de comisiones: 'auto' o 'manual' (para ajustar con comprobante Mercosur)
  const [feeMode, setFeeMode] = useState<'auto' | 'manual'>('auto');
  const [manualCommission, setManualCommission] = useState<string>('');
  const [manualIva, setManualIva] = useState<string>('');
  const [manualMarketFees, setManualMarketFees] = useState<string>('');
  const [manualNetTotal, setManualNetTotal] = useState<string>('');

  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      if (bvcTickers.length > 0 && !selectedSymbol) {
        setSelectedSymbol(bvcTickers[0].symbol);
        setBuyPrice(String(bvcTickers[0].price || 250));
      } else if (selectedSymbol) {
        const tick = bvcTickers.find((t) => t.symbol === selectedSymbol);
        if (tick) setBuyPrice(String(tick.price));
      }
      setFeeMode('auto');
      setManualCommission('');
      setManualIva('');
      setManualMarketFees('');
      setManualNetTotal('');
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, bvcTickers]);

  const currentTicker = bvcTickers.find((t) => t.symbol === selectedSymbol);

  const numShares = Math.max(0, parseInt(shares) || 0);
  const numPrice = Math.max(0, parseFloat(buyPrice) || 0);

  const handleDecimalChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    const cleanVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val;
    setter(cleanVal);
  };

  // Cálculo de gastos y retenciones Mercosur
  const feeDetails = useMemo(() => {
    return calculateMercosurFees({
      shares: numShares,
      price: numPrice,
      manualCommission: feeMode === 'manual' && manualCommission !== '' ? parseFloat(manualCommission) || 0 : null,
      manualIva: feeMode === 'manual' && manualIva !== '' ? parseFloat(manualIva) || 0 : null,
      manualMarketFees: feeMode === 'manual' && manualMarketFees !== '' ? parseFloat(manualMarketFees) || 0 : null,
      manualNetAmount: feeMode === 'manual' && manualNetTotal !== '' ? parseFloat(manualNetTotal) || 0 : null,
    });
  }, [numShares, numPrice, feeMode, manualCommission, manualIva, manualMarketFees, manualNetTotal]);

  if (!isOpen) return null;

  const totalLiquidationCost = feeDetails.netAmountBuy;
  const cashRemaining = currentCashVes - totalLiquidationCost;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTicker || numShares <= 0 || numPrice <= 0) return;

    onAdd(
      {
        symbol: currentTicker.symbol,
        name: currentTicker.name,
        shares: numShares,
        avg_cost: numPrice,
        current_price: currentTicker.price,
        change_pct: currentTicker.change_pct,
      },
      deductFromCash,
      executionDate,
      {
        broker_commission: feeDetails.commissionAmount,
        broker_iva: feeDetails.ivaAmount,
        broker_registry_fee: feeDetails.marketFeesAmount,
        net_total_amount: feeDetails.netAmountBuy,
      }
    );
    onClose();
  };

  const handleSelectSymbol = (sym: string) => {
    setSelectedSymbol(sym);
    const tick = bvcTickers.find((t) => t.symbol === sym);
    if (tick) setBuyPrice(String(tick.price));
  };

  return (
    <div
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
        overflowY: 'auto',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '26px',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          border: '1px solid rgba(124, 140, 255, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusCircle size={20} style={{ color: '#7c8cff' }} /> Operar / Comprar Acción
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#9aa3b2', margin: '4px 0 0 0' }}>
              Registra compras con desglose de comisiones de Mercosur Casa de Bolsa
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              color: '#9aa3b2',
              cursor: 'pointer',
              borderRadius: '8px',
              padding: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#9aa3b2', marginBottom: '6px', fontWeight: 600 }}>
              Acción / Título BVC
            </label>
            <select
              value={selectedSymbol}
              onChange={(e) => handleSelectSymbol(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#1b202b',
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
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#9aa3b2', marginBottom: '6px', fontWeight: 600 }}>
                Nº de Acciones
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ej: 100"
                required
                value={shares}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setShares(val);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#9aa3b2', marginBottom: '6px', fontWeight: 600 }}>
                Precio por Acción (Bs)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                required
                value={buyPrice}
                onChange={handleDecimalChange(setBuyPrice)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#9aa3b2', marginBottom: '6px' }}>
              Fecha de Compra
            </label>
            <input
              type="date"
              required
              value={executionDate}
              onChange={(e) => setExecutionDate(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '0.84rem',
                outline: 'none',
              }}
            />
          </div>

          {/* SECCIÓN MERCOSUR: DESGLOSE DE COMISIONES & ARANCELES */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Receipt size={16} style={{ color: '#7c8cff' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                  Liquidación Mercosur Casa de Bolsa
                </span>
              </div>

              {/* Selector Auto / Manual */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
                <button
                  type="button"
                  onClick={() => setFeeMode('auto')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: feeMode === 'auto' ? '#7c8cff' : 'transparent',
                    color: feeMode === 'auto' ? '#fff' : '#9aa3b2',
                  }}
                >
                  Automático
                </button>
                <button
                  type="button"
                  onClick={() => setFeeMode('manual')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: feeMode === 'manual' ? '#d9a441' : 'transparent',
                    color: feeMode === 'manual' ? '#fff' : '#9aa3b2',
                  }}
                >
                  Boleto Mercosur
                </button>
              </div>
            </div>

            {feeMode === 'manual' && (
              <div
                style={{
                  background: 'rgba(217, 164, 65, 0.08)',
                  border: '1px solid rgba(217, 164, 65, 0.2)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  marginBottom: '10px',
                  fontSize: '0.74rem',
                  color: '#f5e6c8',
                }}
              >
                Ajusta las comisiones o coloca el Monto Total Neto que debitó tu comprobante de Mercosur.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9aa3b2' }}>
                <span>Monto Bruto ({numShares} × {formatVES(numPrice)}):</span>
                <span style={{ fontFamily: 'monospace', color: '#fff' }}>{formatVES(feeDetails.grossAmount)}</span>
              </div>

              {feeMode === 'manual' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '6px 0' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#9aa3b2', display: 'block', marginBottom: '2px' }}>
                      Comisión Mercosur (Bs)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={feeDetails.commissionAmount.toFixed(2)}
                      value={manualCommission}
                      onChange={handleDecimalChange(setManualCommission)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#9aa3b2', display: 'block', marginBottom: '2px' }}>
                      IVA Comisión 16% (Bs)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={feeDetails.ivaAmount.toFixed(2)}
                      value={manualIva}
                      onChange={handleDecimalChange(setManualIva)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#9aa3b2', display: 'block', marginBottom: '2px' }}>
                      Aranceles Bolsa/CVV (Bs)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={feeDetails.marketFeesAmount.toFixed(2)}
                      value={manualMarketFees}
                      onChange={handleDecimalChange(setManualMarketFees)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#d9a441', display: 'block', marginBottom: '2px', fontWeight: 600 }}>
                      Monto Neto Boleto (Bs)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={feeDetails.netAmountBuy.toFixed(2)}
                      value={manualNetTotal}
                      onChange={handleDecimalChange(setManualNetTotal)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(217, 164, 65, 0.1)',
                        border: '1px solid rgba(217, 164, 65, 0.3)',
                        color: '#f5e6c8',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9aa3b2', fontSize: '0.76rem' }}>
                    <span>(+) Comisión Mercosur ({feeDetails.commissionPct}%):</span>
                    <span style={{ fontFamily: 'monospace', color: '#e3b65e' }}>+{formatVES(feeDetails.commissionAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9aa3b2', fontSize: '0.76rem' }}>
                    <span>(+) IVA sobre Comisión (16%):</span>
                    <span style={{ fontFamily: 'monospace', color: '#e3b65e' }}>+{formatVES(feeDetails.ivaAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9aa3b2', fontSize: '0.76rem' }}>
                    <span>(+) Aranceles BVC & CVV (0.20%):</span>
                    <span style={{ fontFamily: 'monospace', color: '#e3b65e' }}>+{formatVES(feeDetails.marketFeesAmount)}</span>
                  </div>
                </>
              )}

              <div
                style={{
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <strong style={{ color: '#fff', fontSize: '0.9rem' }}>Total Liquidado a Pagar:</strong>
                <strong style={{ color: '#7c8cff', fontSize: '1.05rem', fontFamily: 'monospace' }}>
                  {formatVES(totalLiquidationCost)}
                </strong>
              </div>
            </div>
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
              background: deductFromCash ? 'rgba(124, 140, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              border: deductFromCash ? '1px solid rgba(124, 140, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              userSelect: 'none',
            }}
          >
            {deductFromCash ? (
              <CheckSquare size={18} style={{ color: '#7c8cff' }} />
            ) : (
              <Square size={18} style={{ color: '#667085' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.82rem', color: deductFromCash ? '#c9cfff' : '#9aa3b2', fontWeight: 600 }}>
                Liquidar automáticamente de mi saldo en efectivo disponible
              </span>
              {deductFromCash && (
                <span style={{ fontSize: '0.72rem', color: '#667085' }}>
                  Saldo tras compra: {formatVES(Math.max(0, cashRemaining))}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '11px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#9aa3b2',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                flex: 2,
                padding: '11px',
                borderRadius: '10px',
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 'none',
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
