'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  TrendingDown,
  AlertCircle,
  CheckSquare,
  Square,
  Receipt,
} from 'lucide-react';
import { Position, BvcTicker } from '@/types';
import { formatVES } from '@/lib/formatters';
import { calculateMercosurFees } from '@/lib/mercosurFees';

interface SellPositionModalProps {
  isOpen: boolean;
  positions: Position[];
  selectedInitialPosition?: Position | null;
  bvcTickers: BvcTicker[];
  currentCashVes?: number;
  onClose: () => void;
  onSell: (payload: {
    ticker: string;
    shares_to_sell: number;
    sell_price: number;
    credit_to_cash: boolean;
    broker_commission?: number;
    broker_iva?: number;
    broker_registry_fee?: number;
    net_total_amount?: number;
    execution_date?: string;
    notes?: string;
  }) => Promise<void>;
}

export const SellPositionModal: React.FC<SellPositionModalProps> = ({
  isOpen,
  positions,
  selectedInitialPosition,
  bvcTickers,
  currentCashVes = 0,
  onClose,
  onSell,
}) => {
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [sharesToSell, setSharesToSell] = useState<string>('100');
  const [sellPrice, setSellPrice] = useState<string>('0');
  const [creditToCash, setCreditToCash] = useState<boolean>(true);
  const [executionDate, setExecutionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');

  // Modo de comisiones: 'auto' o 'manual'
  const [feeMode, setFeeMode] = useState<'auto' | 'manual'>('auto');
  const [manualCommission, setManualCommission] = useState<string>('');
  const [manualIva, setManualIva] = useState<string>('');
  const [manualMarketFees, setManualMarketFees] = useState<string>('');
  const [manualNetTotal, setManualNetTotal] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Ref para sincronizar SOLO cuando el modal pasa de cerrado a abierto
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      const initialPos = selectedInitialPosition || positions[0];
      if (initialPos) {
        setSelectedTicker(initialPos.symbol);
        setSharesToSell(String(initialPos.shares));
        const tick = bvcTickers.find((t) => t.symbol === initialPos.symbol);
        const refPrice = tick?.price || initialPos.current_price || initialPos.avg_cost;
        setSellPrice(String(refPrice));
      }
      setFeeMode('auto');
      setManualCommission('');
      setManualIva('');
      setManualMarketFees('');
      setManualNetTotal('');
      setErrorMsg('');
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, selectedInitialPosition]);

  const currentPosition = useMemo(() => {
    return positions.find((p) => p.symbol === selectedTicker);
  }, [positions, selectedTicker]);

  // Si cambia el ticker seleccionado
  const handleSelectTicker = (sym: string) => {
    setSelectedTicker(sym);
    const pos = positions.find((p) => p.symbol === sym);
    if (pos) {
      setSharesToSell(String(pos.shares));
      const tick = bvcTickers.find((t) => t.symbol === sym);
      setSellPrice(String(tick?.price || pos.current_price || pos.avg_cost));
    }
  };

  // Porcentaje rápido de venta (25%, 50%, 75%, 100%)
  const handleSetPercentage = (pct: number) => {
    if (!currentPosition) return;
    const calc = Math.floor(currentPosition.shares * (pct / 100));
    setSharesToSell(String(Math.max(1, calc)));
  };

  // Helper para campos numéricos decimales seguros sin auto-reset
  const handleDecimalChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    const cleanVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val;
    setter(cleanVal);
  };

  // Valores numéricos parseados para cálculos
  const numShares = Math.max(0, parseInt(sharesToSell) || 0);
  const numPrice = Math.max(0, parseFloat(sellPrice) || 0);
  const availableShares = currentPosition ? currentPosition.shares : 0;

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

  const costBasisSold = currentPosition ? numShares * currentPosition.avg_cost : 0;
  const realizedPnl = feeDetails.netAmountSell - costBasisSold;
  const realizedPnlPct = costBasisSold > 0 ? (realizedPnl / costBasisSold) * 100 : 0;
  const isProfit = realizedPnl >= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPosition) {
      setErrorMsg('Selecciona una posición válida para vender');
      return;
    }
    if (numShares <= 0) {
      setErrorMsg('La cantidad de acciones a vender debe ser mayor a 0');
      return;
    }
    if (numShares > availableShares) {
      setErrorMsg(`No puedes vender ${numShares.toLocaleString()} acciones. Solo posees ${availableShares.toLocaleString()} acciones.`);
      return;
    }
    if (numPrice <= 0) {
      setErrorMsg('El precio de venta debe ser mayor a 0');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onSell({
        ticker: currentPosition.symbol,
        shares_to_sell: numShares,
        sell_price: numPrice,
        credit_to_cash: creditToCash,
        broker_commission: feeDetails.commissionAmount,
        broker_iva: feeDetails.ivaAmount,
        broker_registry_fee: feeDetails.marketFeesAmount,
        net_total_amount: feeDetails.netAmountSell,
        execution_date: executionDate,
        notes: notes || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al ejecutar venta de acciones');
    } finally {
      setIsSubmitting(false);
    }
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
        overflowY: 'auto',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '26px',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          border: '1px solid rgba(229, 97, 110, 0.3)',
        }}
      >
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingDown size={20} style={{ color: '#ee8a94' }} /> Registrar Venta de Acciones
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#9aa3b2', margin: '4px 0 0 0' }}>
              Liquida títulos totales o parciales y calcula comisiones de Mercosur
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

        {errorMsg && (
          <div
            style={{
              background: 'rgba(229, 97, 110, 0.1)',
              border: '1px solid rgba(229, 97, 110, 0.3)',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#ee8a94',
              fontSize: '0.82rem',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Selector de Acción */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#9aa3b2', marginBottom: '6px', fontWeight: 600 }}>
              Acción a Vender
            </label>
            <select
              value={selectedTicker}
              onChange={(e) => handleSelectTicker(e.target.value)}
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
              {positions.length === 0 ? (
                <option value="">No tienes acciones en tu portafolio</option>
              ) : (
                positions.map((p) => (
                  <option key={p.symbol} value={p.symbol}>
                    {p.symbol} - {p.name} ({p.shares.toLocaleString()} disponibles)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Tarjeta de Disponibilidad */}
          {currentPosition && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
              }}
            >
              <div>
                <span style={{ color: '#9aa3b2', display: 'block', fontSize: '0.72rem' }}>SALDO DISPONIBLE</span>
                <strong style={{ color: '#fff' }}>{availableShares.toLocaleString()} acciones</strong>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ color: '#9aa3b2', display: 'block', fontSize: '0.72rem' }}>COSTO PROMEDIO COMPRA</span>
                <strong style={{ color: '#9aa3b2' }}>{formatVES(currentPosition.avg_cost)}</strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: '#9aa3b2', display: 'block', fontSize: '0.72rem' }}>COTIZACIÓN ACTUAL</span>
                <strong style={{ color: '#7c8cff' }}>{formatVES(currentPosition.current_price)}</strong>
              </div>
            </div>
          )}

          {/* Cantidad de acciones a vender & Botones de porcentaje */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.78rem', color: '#9aa3b2', fontWeight: 600 }}>
                Nº de Acciones a Vender
              </label>
              <span style={{ fontSize: '0.74rem', color: '#667085' }}>
                Restarán: {Math.max(0, availableShares - numShares).toLocaleString()} acc
              </span>
            </div>

            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 200"
              required
              value={sharesToSell}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setSharesToSell(val);
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: numShares > availableShares ? '1px solid #e5616e' : '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: '1.05rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />

            {numShares > availableShares && (
              <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#ee8a94', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={12} /> Excede tu saldo disponible ({availableShares.toLocaleString()} acc)
              </p>
            )}

            {/* Atajos de % rápido */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '6px' }}>
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleSetPercentage(pct)}
                  style={{
                    padding: '6px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: pct === 100 ? '#f3b0b7' : '#b9c0cb',
                    fontSize: '0.74rem',
                    fontWeight: pct === 100 ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {pct === 100 ? '100% (Todo)' : `${pct}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Precio de Venta Unitario */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.78rem', color: '#9aa3b2', fontWeight: 600 }}>
                Precio Unitario de Venta (Bs)
              </label>
              {currentPosition && (
                <button
                  type="button"
                  onClick={() => setSellPrice(String(currentPosition.current_price))}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#7c8cff',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Pizarra en vivo ({formatVES(currentPosition.current_price)})
                </button>
              )}
            </div>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              required
              value={sellPrice}
              onChange={handleDecimalChange(setSellPrice)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: '1.05rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
          </div>

          {/* SECCIÓN MERCOSUR: CÁLCULO DE COMISIONES & RETENCIONES */}
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
                <Receipt size={16} style={{ color: '#e3b65e' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                  Liquidación Mercosur Casa de Bolsa
                </span>
              </div>

              {/* Selector de modo auto / manual */}
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
                Ingresa los montos exactos de tu comprobante Mercosur, o coloca directamente el Monto Neto Liquidado.
              </div>
            )}

            {/* Desglose de Gastos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9aa3b2' }}>
                <span>Monto Bruto de Venta:</span>
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
                      placeholder={feeDetails.netAmountSell.toFixed(2)}
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
                    <span>(-) Comisión Mercosur ({feeDetails.commissionPct}%):</span>
                    <span style={{ fontFamily: 'monospace', color: '#ee8a94' }}>-{formatVES(feeDetails.commissionAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9aa3b2', fontSize: '0.76rem' }}>
                    <span>(-) IVA sobre Comisión (16%):</span>
                    <span style={{ fontFamily: 'monospace', color: '#ee8a94' }}>-{formatVES(feeDetails.ivaAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9aa3b2', fontSize: '0.76rem' }}>
                    <span>(-) Aranceles BVC & CVV (0.20%):</span>
                    <span style={{ fontFamily: 'monospace', color: '#ee8a94' }}>-{formatVES(feeDetails.marketFeesAmount)}</span>
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
                <strong style={{ color: '#fff', fontSize: '0.9rem' }}>Monto Neto a Recibir:</strong>
                <strong style={{ color: '#7c8cff', fontSize: '1.05rem', fontFamily: 'monospace' }}>
                  {formatVES(feeDetails.netAmountSell)}
                </strong>
              </div>

              {/* Ganancia/Pérdida Realizada */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.78rem',
                  paddingTop: '4px',
                }}
              >
                <span style={{ color: '#9aa3b2' }}>Rendimiento realizado estimado:</span>
                <span style={{ color: isProfit ? 'var(--up)' : 'var(--down)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {isProfit ? '+' : ''}{formatVES(realizedPnl)} ({isProfit ? '+' : ''}{realizedPnlPct.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Fecha de Operación */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#9aa3b2', marginBottom: '6px' }}>
              Fecha de Ejecución
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

          {/* Checkbox Acreditar a Efectivo */}
          <div
            onClick={() => setCreditToCash(!creditToCash)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              padding: '10px 12px',
              borderRadius: '10px',
              background: creditToCash ? 'rgba(124, 140, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              border: creditToCash ? '1px solid rgba(124, 140, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              userSelect: 'none',
            }}
          >
            {creditToCash ? (
              <CheckSquare size={18} style={{ color: '#7c8cff' }} />
            ) : (
              <Square size={18} style={{ color: '#667085' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.82rem', color: creditToCash ? '#c9cfff' : '#9aa3b2', fontWeight: 600 }}>
                Acreditar monto neto a mi saldo de efectivo disponible
              </span>
              <span style={{ fontSize: '0.72rem', color: '#667085' }}>
                Tu saldo pasará de {formatVES(currentCashVes)} a {formatVES(currentCashVes + feeDetails.netAmountSell)}
              </span>
            </div>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
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
              disabled={isSubmitting || !currentPosition || numShares > availableShares}
              style={{
                flex: 2,
                padding: '11px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #e5616e, #b91c1c)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                cursor: isSubmitting || !currentPosition || numShares > availableShares ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || !currentPosition || numShares > availableShares ? 0.6 : 1,
                boxShadow: 'none',
              }}
            >
              {isSubmitting ? 'Procesando Venta...' : `Ejecutar Venta de ${numShares.toLocaleString()} acc`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
