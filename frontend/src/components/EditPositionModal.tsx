'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3, AlertCircle, CheckSquare, Square, TrendingDown } from 'lucide-react';
import { Position } from '@/types';
import { formatVES } from '@/lib/formatters';

interface EditPositionModalProps {
  isOpen: boolean;
  position: Position | null;
  currentCashVes?: number;
  onClose: () => void;
  onSave: (positionId: string, updatedShares: number, updatedBuyPrice: number, adjustCash: boolean) => Promise<void>;
}

export const EditPositionModal: React.FC<EditPositionModalProps> = ({
  isOpen,
  position,
  currentCashVes = 0,
  onClose,
  onSave,
}) => {
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
  const originalCost = position.avg_cost;
  const originalTotalCost = originalShares * originalCost;

  const numShares = Math.max(0, parseInt(shares) || 0);
  const numPrice = Math.max(0, parseFloat(buyPrice) || 0);

  const newTotalCost = numShares * numPrice;
  const sharesDiff = numShares - originalShares; // negative means reduced shares (e.g. -150)
  const costDiff = originalTotalCost - newTotalCost; // positive means cash refunded to user

  const handleQuickDeduct = (amount: number) => {
    const current = parseInt(shares) || 0;
    setShares(String(Math.max(1, current - amount)));
  };

  const handleQuickAdd = (amount: number) => {
    const current = parseInt(shares) || 0;
    setShares(String(current + amount));
  };

  const handleDecimalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    const cleanVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val;
    setBuyPrice(cleanVal);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numShares <= 0) {
      setErrorMsg('La cantidad de acciones debe ser mayor a 0');
      return;
    }
    if (numPrice <= 0) {
      setErrorMsg('El precio de compra debe ser mayor a 0');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onSave(String(position.id || position.symbol), numShares, numPrice, adjustCash);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar posición');
    } finally {
      setIsSubmitting(false);
    }
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
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '28px',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={20} style={{ color: '#9aa6ff' }} /> Editar Posición
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#9aa3b2', margin: '4px 0 0 0' }}>
              Corrige títulos o precio promedio en <strong style={{ color: '#fff' }}>{position.symbol}</strong> ({position.name})
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

        {/* Resumen Actual */}
        <div
          style={{
            background: 'rgba(124, 140, 255, 0.06)',
            border: '1px solid rgba(124, 140, 255, 0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.84rem',
          }}
        >
          <div>
            <span style={{ color: '#9aa3b2', display: 'block', fontSize: '0.74rem' }}>REGISTRO ACTUAL</span>
            <strong style={{ color: '#fff' }}>{originalShares.toLocaleString()} acciones</strong>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: '#9aa3b2', display: 'block', fontSize: '0.74rem' }}>COSTO PROMEDIO</span>
            <strong style={{ color: '#9aa6ff' }}>{formatVES(originalCost)}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#9aa3b2', display: 'block', fontSize: '0.74rem' }}>VALOR TOTAL REGISTRADO</span>
            <strong style={{ color: '#fff' }}>{formatVES(originalTotalCost)}</strong>
          </div>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Campo de Acciones con Atajos Rápidos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: '#9aa3b2', fontWeight: 600 }}>
                Nº de Acciones Real (Títulos)
              </label>
              <span style={{ fontSize: '0.74rem', color: '#667085' }}>
                Antes: {originalShares.toLocaleString()}
              </span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 500"
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
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />

            {/* Atajos de corrección rápida */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: '#667085', alignSelf: 'center', marginRight: '4px' }}>
                Corregir:
              </span>
              <button
                type="button"
                onClick={() => handleQuickDeduct(150)}
                title="Restar 150 acciones que agregué de más"
                style={{
                  background: 'rgba(229, 97, 110, 0.15)',
                  border: '1px solid rgba(229, 97, 110, 0.3)',
                  color: '#f3b0b7',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <TrendingDown size={12} /> -150 acc (Error común)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDeduct(100)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#b9c0cb',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                }}
              >
                -100
              </button>
              <button
                type="button"
                onClick={() => handleQuickDeduct(50)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#b9c0cb',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                }}
              >
                -50
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(100)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#b9c0cb',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                }}
              >
                +100
              </button>
            </div>
          </div>

          {/* Campo de Precio Unitario de Compra */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: '#9aa3b2', fontWeight: 600 }}>
                Precio Unitario de Compra Promedio (Bs)
              </label>
              <button
                type="button"
                onClick={() => setBuyPrice(String(position.current_price))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9aa6ff',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Usar cotización actual ({formatVES(position.current_price)})
              </button>
            </div>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              required
              value={buyPrice}
              onChange={handleDecimalChange}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
          </div>

          {/* Tarjeta de Comparación / Diferencia */}
          {sharesDiff !== 0 && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#9aa3b2' }}>Diferencia de acciones:</span>
                <strong style={{ color: sharesDiff < 0 ? 'var(--down)' : 'var(--up)' }}>
                  {sharesDiff > 0 ? `+${sharesDiff.toLocaleString()}` : sharesDiff.toLocaleString()} acciones
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#9aa3b2' }}>Nuevo Valor Invertido:</span>
                <strong style={{ color: '#fff' }}>{formatVES(newTotalCost)}</strong>
              </div>

              {costDiff !== 0 && (
                <div
                  style={{
                    paddingTop: '6px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: costDiff > 0 ? '#c9cfff' : '#fed7aa',
                  }}
                >
                  <span>{costDiff > 0 ? 'Monto a reintegrar al saldo:' : 'Monto adicional a deducir:'}</span>
                  <strong style={{ fontFamily: 'monospace' }}>{formatVES(Math.abs(costDiff))}</strong>
                </div>
              )}
            </div>
          )}

          {/* Checkbox de ajuste de efectivo */}
          {costDiff !== 0 && (
            <div
              onClick={() => setAdjustCash(!adjustCash)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: '10px',
                background: adjustCash ? 'rgba(124, 140, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: adjustCash ? '1px solid rgba(124, 140, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                userSelect: 'none',
              }}
            >
              {adjustCash ? (
                <CheckSquare size={18} style={{ color: '#9aa6ff' }} />
              ) : (
                <Square size={18} style={{ color: '#667085' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.82rem', color: adjustCash ? '#e0f2fe' : '#9aa3b2', fontWeight: 600 }}>
                  Ajustar la diferencia automáticamente en mi saldo en efectivo
                </span>
                <span style={{ fontSize: '0.72rem', color: '#667085' }}>
                  {costDiff > 0
                    ? `Se sumarán ${formatVES(costDiff)} a tu saldo en efectivo disponible.`
                    : `Se deducirán ${formatVES(Math.abs(costDiff))} de tu saldo en efectivo disponible.`}
                </span>
              </div>
            </div>
          )}

          {/* Botones de Acción */}
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
              disabled={isSubmitting}
              style={{
                flex: 2,
                padding: '11px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6674e6, #0369a1)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
              }}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar y Corregir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
