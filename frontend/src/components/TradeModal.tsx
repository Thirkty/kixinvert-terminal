'use client';

// Piezas compartidas por los modales de operaciones: comprar, vender, editar y efectivo.
// Los estilos viven en globals.css bajo el prefijo `tm-`.

import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckSquare, Receipt, Square, X } from 'lucide-react';
import { formatVES } from '@/lib/formatters';
import { calculateMercosurFees } from '@/lib/mercosurFees';

type Tone = 'accent' | 'danger' | 'neutral';

export const ModalShell: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  tone?: Tone;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, tone = 'neutral', onClose, children }) => (
  <div className="kx-overlay tm-overlay">
    <div className={`glass-panel tm-panel tm-tone-${tone}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="tm-head">
        <div>
          <h2 className="tm-title">{icon} {title}</h2>
          {subtitle && <p className="tm-sub">{subtitle}</p>}
        </div>
        <button type="button" className="tm-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const Field: React.FC<{ label: string; aside?: React.ReactNode; children: React.ReactNode }> = ({
  label,
  aside,
  children,
}) => (
  <div>
    <div className="tm-label-row">
      <label className="tm-label">{label}</label>
      {aside}
    </div>
    {children}
  </div>
);

export const ErrorBanner: React.FC<{ message: string }> = ({ message }) =>
  message ? (
    <div className="tm-error" role="alert">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  ) : null;

// Tres datos en una franja: [etiqueta, valor, color opcional]
export const StatStrip: React.FC<{ items: [string, React.ReactNode, string?][]; tinted?: boolean }> = ({
  items,
  tinted,
}) => (
  <div className={`tm-stats${tinted ? ' tm-tinted' : ''}`}>
    {items.map(([label, value, color]) => (
      <div key={label}>
        <span>{label}</span>
        <strong style={color ? { color } : undefined}>{value}</strong>
      </div>
    ))}
  </div>
);

export const CashToggle: React.FC<{
  checked: boolean;
  onToggle: () => void;
  title: string;
  hint?: React.ReactNode;
}> = ({ checked, onToggle, title, hint }) => (
  <button type="button" className={`tm-check${checked ? ' is-on' : ''}`} onClick={onToggle} aria-pressed={checked}>
    {checked ? <CheckSquare size={18} /> : <Square size={18} />}
    <span>
      <b>{title}</b>
      {hint && <small>{hint}</small>}
    </span>
  </button>
);

export const ModalActions: React.FC<{
  onCancel: () => void;
  submitLabel: React.ReactNode;
  variant?: 'primary' | 'danger';
  disabled?: boolean;
}> = ({ onCancel, submitLabel, variant = 'primary', disabled }) => (
  <div className="tm-actions">
    <button type="button" className="tm-btn tm-btn-ghost" onClick={onCancel}>
      Cancelar
    </button>
    <button type="submit" className={`tm-btn tm-btn-${variant}`} disabled={disabled}>
      {submitLabel}
    </button>
  </div>
);

// Campos de texto que solo aceptan enteros o decimales (acepta coma como separador)
export const digitsOnly = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) =>
  setter(e.target.value.replace(/[^0-9]/g, ''));

export const decimalOnly = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
  const parts = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '').split('.');
  setter(parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : parts.join('.'));
};

// Comisiones Mercosur: cálculo automático o montos del boleto escritos a mano
export function useMercosurFees(shares: number, price: number) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [manual, setManual] = useState({ commission: '', iva: '', marketFees: '', net: '' });

  const pick = (v: string) => (mode === 'manual' && v !== '' ? parseFloat(v) || 0 : null);
  const details = useMemo(
    () =>
      calculateMercosurFees({
        shares,
        price,
        manualCommission: pick(manual.commission),
        manualIva: pick(manual.iva),
        manualMarketFees: pick(manual.marketFees),
        manualNetAmount: pick(manual.net),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shares, price, mode, manual]
  );

  const setField = (key: keyof typeof manual) => (v: string) => setManual((m) => ({ ...m, [key]: v }));
  const reset = () => {
    setMode('auto');
    setManual({ commission: '', iva: '', marketFees: '', net: '' });
  };
  return { mode, setMode, manual, setField, details, reset };
}

export const MercosurFees: React.FC<{
  side: 'buy' | 'sell';
  fees: ReturnType<typeof useMercosurFees>;
  grossLabel: string;
  children?: React.ReactNode;
}> = ({ side, fees, grossLabel, children }) => {
  const { mode, setMode, manual, setField, details } = fees;
  const isBuy = side === 'buy';
  const sign = isBuy ? '+' : '-';
  const net = isBuy ? details.netAmountBuy : details.netAmountSell;
  const feeRows: [string, number][] = [
    [`Comisión Mercosur (${details.commissionPct}%)`, details.commissionAmount],
    ['IVA sobre Comisión (16%)', details.ivaAmount],
    ['Aranceles BVC & CVV (0.20%)', details.marketFeesAmount],
  ];
  const manualFields: [string, keyof typeof manual, number][] = [
    ['Comisión Mercosur (Bs)', 'commission', details.commissionAmount],
    ['IVA Comisión 16% (Bs)', 'iva', details.ivaAmount],
    ['Aranceles Bolsa/CVV (Bs)', 'marketFees', details.marketFeesAmount],
    ['Monto Neto Boleto (Bs)', 'net', net],
  ];

  return (
    <div className="tm-card">
      <div className="tm-fees-head">
        <span>
          <Receipt size={16} style={{ color: isBuy ? 'var(--accent)' : '#e3b65e' }} /> Liquidación Mercosur Casa de Bolsa
        </span>
        <div className="tm-seg">
          <button type="button" className={mode === 'auto' ? 'is-auto' : ''} onClick={() => setMode('auto')}>
            Automático
          </button>
          <button type="button" className={mode === 'manual' ? 'is-manual' : ''} onClick={() => setMode('manual')}>
            Boleto Mercosur
          </button>
        </div>
      </div>

      {mode === 'manual' && (
        <div className="tm-hint">
          {isBuy
            ? 'Ajusta las comisiones o coloca el Monto Total Neto que debitó tu comprobante de Mercosur.'
            : 'Ingresa los montos exactos de tu comprobante Mercosur, o coloca directamente el Monto Neto Liquidado.'}
        </div>
      )}

      <div className="tm-rows">
        <div className="tm-row">
          <span>{grossLabel}</span>
          <span className="tm-mono">{formatVES(details.grossAmount)}</span>
        </div>

        {mode === 'manual' ? (
          <div className="tm-fee-grid">
            {manualFields.map(([label, key, placeholder]) => (
              <div key={key} className={key === 'net' ? 'tm-net' : undefined}>
                <label>{label}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="tm-input"
                  placeholder={placeholder.toFixed(2)}
                  value={manual[key]}
                  onChange={decimalOnly(setField(key))}
                />
              </div>
            ))}
          </div>
        ) : (
          feeRows.map(([label, amount]) => (
            <div key={label} className="tm-row tm-row-sm">
              <span>({sign}) {label}:</span>
              <span className="tm-mono" style={{ color: isBuy ? '#e3b65e' : '#ee8a94' }}>
                {sign}{formatVES(amount)}
              </span>
            </div>
          ))
        )}

        <div className="tm-row tm-total">
          <strong>{isBuy ? 'Total Liquidado a Pagar:' : 'Monto Neto a Recibir:'}</strong>
          <strong>{formatVES(net)}</strong>
        </div>
        {children}
      </div>
    </div>
  );
};
