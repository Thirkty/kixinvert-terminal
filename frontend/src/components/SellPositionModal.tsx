'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TrendingDown, AlertCircle } from 'lucide-react';
import { Position, BvcTicker } from '@/types';
import { formatVES } from '@/lib/formatters';
import {
  ModalShell, Field, ErrorBanner, StatStrip, CashToggle, ModalActions, MercosurFees, useMercosurFees,
  digitsOnly, decimalOnly,
} from './TradeModal';

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
  const [executionDate, setExecutionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const numShares = Math.max(0, parseInt(sharesToSell) || 0);
  const numPrice = Math.max(0, parseFloat(sellPrice) || 0);
  const fees = useMercosurFees(numShares, numPrice);

  const refPrice = (p: Position) => bvcTickers.find((t) => t.symbol === p.symbol)?.price || p.current_price || p.avg_cost;
  const selectPosition = (p: Position | undefined) => {
    if (!p) return;
    setSelectedTicker(p.symbol);
    setSharesToSell(String(p.shares));
    setSellPrice(String(refPrice(p)));
  };

  // Sincronizar solo cuando el modal pasa de cerrado a abierto
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      selectPosition(selectedInitialPosition || positions[0]);
      fees.reset();
      setErrorMsg('');
    }
    prevOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedInitialPosition]);

  const currentPosition = useMemo(() => positions.find((p) => p.symbol === selectedTicker), [positions, selectedTicker]);

  if (!isOpen) return null;

  const availableShares = currentPosition ? currentPosition.shares : 0;
  const exceeds = numShares > availableShares;
  const netAmount = fees.details.netAmountSell;
  const costBasisSold = currentPosition ? numShares * currentPosition.avg_cost : 0;
  const realizedPnl = netAmount - costBasisSold;
  const realizedPnlPct = costBasisSold > 0 ? (realizedPnl / costBasisSold) * 100 : 0;
  const plus = realizedPnl >= 0 ? '+' : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPosition) return setErrorMsg('Selecciona una posición válida para vender');
    if (numShares <= 0) return setErrorMsg('La cantidad de acciones a vender debe ser mayor a 0');
    if (exceeds) {
      return setErrorMsg(`No puedes vender ${numShares.toLocaleString()} acciones. Solo posees ${availableShares.toLocaleString()} acciones.`);
    }
    if (numPrice <= 0) return setErrorMsg('El precio de venta debe ser mayor a 0');

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onSell({
        ticker: currentPosition.symbol,
        shares_to_sell: numShares,
        sell_price: numPrice,
        credit_to_cash: creditToCash,
        broker_commission: fees.details.commissionAmount,
        broker_iva: fees.details.ivaAmount,
        broker_registry_fee: fees.details.marketFeesAmount,
        net_total_amount: netAmount,
        execution_date: executionDate,
      });
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Error al ejecutar venta de acciones');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      icon={<TrendingDown size={20} style={{ color: '#ee8a94' }} />}
      title="Registrar Venta de Acciones"
      subtitle="Liquida títulos totales o parciales y calcula comisiones de Mercosur"
      tone="danger"
      onClose={onClose}
    >
      <ErrorBanner message={errorMsg} />

      <form onSubmit={handleSubmit} className="tm-form">
        <Field label="Acción a Vender">
          <select className="tm-input" value={selectedTicker}
            onChange={(e) => selectPosition(positions.find((p) => p.symbol === e.target.value))}>
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
        </Field>

        {currentPosition && (
          <StatStrip
            items={[
              ['Saldo disponible', `${availableShares.toLocaleString()} acciones`],
              ['Costo promedio compra', formatVES(currentPosition.avg_cost), 'var(--text-muted)'],
              ['Cotización actual', formatVES(currentPosition.current_price), 'var(--accent)'],
            ]}
          />
        )}

        <Field
          label="Nº de Acciones a Vender"
          aside={<span className="tm-aside">Restarán: {Math.max(0, availableShares - numShares).toLocaleString()} acc</span>}
        >
          <input type="text" inputMode="numeric" placeholder="Ej: 200" required
            className={`tm-input tm-num${exceeds ? ' tm-invalid' : ''}`}
            value={sharesToSell} onChange={digitsOnly(setSharesToSell)} />
          {exceeds && (
            <p className="tm-field-error">
              <AlertCircle size={12} /> Excede tu saldo disponible ({availableShares.toLocaleString()} acc)
            </p>
          )}
          <div className="tm-chips tm-chips-grid">
            {[25, 50, 75, 100].map((pct) => (
              <button key={pct} type="button" className={`tm-chip${pct === 100 ? ' tm-chip-danger' : ''}`}
                onClick={() => currentPosition && setSharesToSell(String(Math.max(1, Math.floor(currentPosition.shares * pct / 100))))}>
                {pct === 100 ? '100% (Todo)' : `${pct}%`}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Precio Unitario de Venta (Bs)"
          aside={currentPosition && (
            <button type="button" className="tm-link" onClick={() => setSellPrice(String(currentPosition.current_price))}>
              Pizarra en vivo ({formatVES(currentPosition.current_price)})
            </button>
          )}
        >
          <input type="text" inputMode="decimal" placeholder="0.00" required className="tm-input tm-num"
            value={sellPrice} onChange={decimalOnly(setSellPrice)} />
        </Field>

        <MercosurFees side="sell" fees={fees} grossLabel="Monto Bruto de Venta:">
          <div className="tm-row">
            <span>Rendimiento realizado estimado:</span>
            <span className="tm-mono" style={{ color: realizedPnl >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>
              {plus}{formatVES(realizedPnl)} ({plus}{realizedPnlPct.toFixed(2)}%)
            </span>
          </div>
        </MercosurFees>

        <Field label="Fecha de Ejecución">
          <input type="date" required className="tm-input" value={executionDate}
            onChange={(e) => setExecutionDate(e.target.value)} />
        </Field>

        <CashToggle
          checked={creditToCash}
          onToggle={() => setCreditToCash(!creditToCash)}
          title="Acreditar monto neto a mi saldo de efectivo disponible"
          hint={`Tu saldo pasará de ${formatVES(currentCashVes)} a ${formatVES(currentCashVes + netAmount)}`}
        />

        <ModalActions
          onCancel={onClose}
          variant="danger"
          disabled={isSubmitting || !currentPosition || exceeds}
          submitLabel={isSubmitting ? 'Procesando Venta...' : `Ejecutar Venta de ${numShares.toLocaleString()} acc`}
        />
      </form>
    </ModalShell>
  );
};
