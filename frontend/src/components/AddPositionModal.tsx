'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PlusCircle } from 'lucide-react';
import { BvcTicker, Position } from '@/types';
import { formatVES } from '@/lib/formatters';
import {
  ModalShell, Field, CashToggle, ModalActions, MercosurFees, useMercosurFees, digitsOnly, decimalOnly,
} from './TradeModal';

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
  const [executionDate, setExecutionDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const numShares = Math.max(0, parseInt(shares) || 0);
  const numPrice = Math.max(0, parseFloat(buyPrice) || 0);
  const fees = useMercosurFees(numShares, numPrice);

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
      fees.reset();
    }
    prevOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, bvcTickers]);

  if (!isOpen) return null;

  const currentTicker = bvcTickers.find((t) => t.symbol === selectedSymbol);
  const totalCost = fees.details.netAmountBuy;

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
        broker_commission: fees.details.commissionAmount,
        broker_iva: fees.details.ivaAmount,
        broker_registry_fee: fees.details.marketFeesAmount,
        net_total_amount: totalCost,
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
    <ModalShell
      icon={<PlusCircle size={20} style={{ color: 'var(--accent)' }} />}
      title="Operar / Comprar Acción"
      subtitle="Registra compras con desglose de comisiones de Mercosur Casa de Bolsa"
      tone="accent"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="tm-form">
        <Field label="Acción / Título BVC">
          <select className="tm-input" value={selectedSymbol} onChange={(e) => handleSelectSymbol(e.target.value)}>
            {bvcTickers.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol} - {t.name} ({formatVES(t.price)})
              </option>
            ))}
          </select>
        </Field>

        <div className="tm-grid2">
          <Field label="Nº de Acciones">
            <input type="text" inputMode="numeric" placeholder="Ej: 100" required className="tm-input tm-num"
              value={shares} onChange={digitsOnly(setShares)} />
          </Field>
          <Field label="Precio por Acción (Bs)">
            <input type="text" inputMode="decimal" placeholder="0.00" required className="tm-input tm-num"
              value={buyPrice} onChange={decimalOnly(setBuyPrice)} />
          </Field>
        </div>

        <Field label="Fecha de Compra">
          <input type="date" required className="tm-input" value={executionDate}
            onChange={(e) => setExecutionDate(e.target.value)} />
        </Field>

        <MercosurFees side="buy" fees={fees} grossLabel={`Monto Bruto (${numShares} × ${formatVES(numPrice)}):`} />

        <CashToggle
          checked={deductFromCash}
          onToggle={() => setDeductFromCash(!deductFromCash)}
          title="Liquidar automáticamente de mi saldo en efectivo disponible"
          hint={deductFromCash && `Saldo tras compra: ${formatVES(Math.max(0, currentCashVes - totalCost))}`}
        />

        <ModalActions onCancel={onClose} submitLabel="Registrar Compra" />
      </form>
    </ModalShell>
  );
};
