'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Edit3, TrendingDown } from 'lucide-react';
import { Position } from '@/types';
import { formatVES } from '@/lib/formatters';
import { ModalShell, Field, ErrorBanner, StatStrip, CashToggle, ModalActions, digitsOnly, decimalOnly } from './TradeModal';

interface EditPositionModalProps {
  isOpen: boolean;
  position: Position | null;
  onClose: () => void;
  onSave: (positionId: string, updatedShares: number, updatedBuyPrice: number, adjustCash: boolean) => Promise<void>;
}

export const EditPositionModal: React.FC<EditPositionModalProps> = ({ isOpen, position, onClose, onSave }) => {
  const [shares, setShares] = useState<string>('0');
  const [buyPrice, setBuyPrice] = useState<string>('0');
  const [adjustCash, setAdjustCash] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current && position) {
      setShares(String(position.shares));
      setBuyPrice(String(position.avg_cost));
      setErrorMsg('');
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, position]);

  if (!isOpen || !position) return null;

  const originalShares = position.shares;
  const originalTotalCost = originalShares * position.avg_cost;
  const numShares = Math.max(0, parseInt(shares) || 0);
  const numPrice = Math.max(0, parseFloat(buyPrice) || 0);
  const newTotalCost = numShares * numPrice;
  const sharesDiff = numShares - originalShares;
  const costDiff = originalTotalCost - newTotalCost; // positivo: se reintegra efectivo

  const nudgeShares = (delta: number) => setShares(String(Math.max(1, (parseInt(shares) || 0) + delta)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numShares <= 0) return setErrorMsg('La cantidad de acciones debe ser mayor a 0');
    if (numPrice <= 0) return setErrorMsg('El precio de compra debe ser mayor a 0');

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onSave(String(position.id || position.symbol), numShares, numPrice, adjustCash);
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Error al actualizar posición');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      icon={<Edit3 size={20} style={{ color: 'var(--accent-usdt)' }} />}
      title="Editar Posición"
      subtitle={<>Corrige títulos o precio promedio en <strong>{position.symbol}</strong> ({position.name})</>}
      onClose={onClose}
    >
      <StatStrip
        tinted
        items={[
          ['Registro actual', `${originalShares.toLocaleString()} acciones`],
          ['Costo promedio', formatVES(position.avg_cost), 'var(--accent-usdt)'],
          ['Valor total registrado', formatVES(originalTotalCost)],
        ]}
      />

      <ErrorBanner message={errorMsg} />

      <form onSubmit={handleSubmit} className="tm-form">
        <Field
          label="Nº de Acciones Real (Títulos)"
          aside={<span className="tm-aside">Antes: {originalShares.toLocaleString()}</span>}
        >
          <input type="text" inputMode="numeric" placeholder="Ej: 500" required className="tm-input tm-num"
            value={shares} onChange={digitsOnly(setShares)} />
          <div className="tm-chips">
            <span className="tm-aside" style={{ alignSelf: 'center', marginRight: '4px' }}>Corregir:</span>
            <button type="button" className="tm-chip tm-chip-danger" onClick={() => nudgeShares(-150)}
              title="Restar 150 acciones que agregué de más">
              <TrendingDown size={12} /> -150 acc (Error común)
            </button>
            {[-100, -50, 100].map((d) => (
              <button key={d} type="button" className="tm-chip" onClick={() => nudgeShares(d)}>
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Precio Unitario de Compra Promedio (Bs)"
          aside={
            <button type="button" className="tm-link" onClick={() => setBuyPrice(String(position.current_price))}>
              Usar cotización actual ({formatVES(position.current_price)})
            </button>
          }
        >
          <input type="text" inputMode="decimal" placeholder="0.00" required className="tm-input tm-num"
            value={buyPrice} onChange={decimalOnly(setBuyPrice)} />
        </Field>

        {sharesDiff !== 0 && (
          <div className="tm-card tm-rows">
            <div className="tm-row">
              <span>Diferencia de acciones:</span>
              <strong style={{ color: sharesDiff < 0 ? 'var(--down)' : 'var(--up)' }}>
                {sharesDiff > 0 ? `+${sharesDiff.toLocaleString()}` : sharesDiff.toLocaleString()} acciones
              </strong>
            </div>
            <div className="tm-row">
              <span>Nuevo Valor Invertido:</span>
              <strong className="tm-mono">{formatVES(newTotalCost)}</strong>
            </div>
            {costDiff !== 0 && (
              <div className="tm-row tm-total" style={{ color: costDiff > 0 ? '#c9cfff' : '#fed7aa' }}>
                <span>{costDiff > 0 ? 'Monto a reintegrar al saldo:' : 'Monto adicional a deducir:'}</span>
                <strong className="tm-mono" style={{ color: 'inherit' }}>{formatVES(Math.abs(costDiff))}</strong>
              </div>
            )}
          </div>
        )}

        {costDiff !== 0 && (
          <CashToggle
            checked={adjustCash}
            onToggle={() => setAdjustCash(!adjustCash)}
            title="Ajustar la diferencia automáticamente en mi saldo en efectivo"
            hint={costDiff > 0
              ? `Se sumarán ${formatVES(costDiff)} a tu saldo en efectivo disponible.`
              : `Se deducirán ${formatVES(Math.abs(costDiff))} de tu saldo en efectivo disponible.`}
          />
        )}

        <ModalActions onCancel={onClose} disabled={isSubmitting} submitLabel={isSubmitting ? 'Guardando...' : 'Guardar y Corregir'} />
      </form>
    </ModalShell>
  );
};
