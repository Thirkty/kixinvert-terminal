'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  Bot,
  Check,
} from 'lucide-react';
import { BvcTicker, UserSession } from '@/types';
import { formatVES, formatUSD } from '@/lib/formatters';
import { depositCashApi, addPositionApi, fetchTelegramPairingUrl, fetchTelegramStatus } from '@/lib/api';
import { playTerminalSound } from '@/lib/audio';
import { AnimatedPulseBeacon, AnimatedTelegram } from './AnimatedIcons';
import { SpotlightCard } from './SpotlightCard';

interface OnboardingModalProps {
  isOpen: boolean;
  session: UserSession | null;
  bvcTickers: BvcTicker[];
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  session,
  bvcTickers,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Paso 1: Saldo y Fecha
  const [initialVes, setInitialVes] = useState<number>(10000);
  const [initialUsd, setInitialUsd] = useState<number>(0);
  const [depositDate, setDepositDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [depositConcept, setDepositConcept] = useState<string>('Aporte inicial para operar en BVC');
  const [isSubmittingCash, setIsSubmittingCash] = useState<boolean>(false);

  // Paso 2: Acciones existentes
  const [addedStocks, setAddedStocks] = useState<
    Array<{ ticker: string; shares: number; price: number }>
  >([]);
  const [selectedTicker, setSelectedTicker] = useState<string>('BNC');
  const [stockShares, setStockShares] = useState<number>(500);
  const [stockPrice, setStockPrice] = useState<number>(15.5);
  const [isAddingStock, setIsAddingStock] = useState<boolean>(false);

  // Paso 3: Telegram
  const [pairingUrl, setPairingUrl] = useState<string>('');
  const [botUsername, setBotUsername] = useState<string>('KixInvert_bot');
  const [isTelegramLinked, setIsTelegramLinked] = useState<boolean>(false);
  const [telegramUsername, setTelegramUsername] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      // Cargar deep-link de Telegram
      fetchTelegramPairingUrl().then((res) => {
        if (res.direct_url) setPairingUrl(res.direct_url);
        if (res.bot_username) setBotUsername(res.bot_username);
        if (res.linked) {
          setIsTelegramLinked(true);
          if (res.telegram_username) setTelegramUsername(res.telegram_username);
        }
      });
    }
  }, [isOpen]);

  // Polling automático mientras el paso 3 está visible para detectar cuando pulsa "Iniciar" en Telegram
  useEffect(() => {
    let interval: any = null;
    if (isOpen && step === 3 && !isTelegramLinked) {
      interval = setInterval(async () => {
        const st = await fetchTelegramStatus();
        if (st.linked) {
          setIsTelegramLinked(true);
          playTerminalSound('success');
          if (st.telegram_username) setTelegramUsername(st.telegram_username);
        }
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, step, isTelegramLinked]);

  if (!isOpen) return null;

  const handleFinishCashStep = async () => {
    setIsSubmittingCash(true);
    try {
      if (initialVes > 0) {
        await depositCashApi({
          amount: initialVes,
          currency: 'VES',
          date: depositDate,
          concept: depositConcept,
        });
      }
      if (initialUsd > 0) {
        await depositCashApi({
          amount: initialUsd,
          currency: 'USD',
          date: depositDate,
          concept: depositConcept,
        });
      }
      playTerminalSound('success');
      setStep(2);
    } finally {
      setIsSubmittingCash(false);
    }
  };

  const handleAddStock = async () => {
    if (!selectedTicker || stockShares <= 0 || stockPrice <= 0) return;
    setIsAddingStock(true);
    try {
      await addPositionApi({
        ticker: selectedTicker,
        shares: stockShares,
        buy_price: stockPrice,
        currency: 'VES',
        deduct_from_cash: false, // En onboarding son acciones ya existentes previas
        execution_date: depositDate,
        notes: 'Posición inicial previa',
      });
      setAddedStocks((prev) => [
        ...prev,
        { ticker: selectedTicker, shares: stockShares, price: stockPrice },
      ]);
      playTerminalSound('success');
      // Reset inputs para la siguiente
      setStockShares(100);
    } finally {
      setIsAddingStock(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(5, 7, 13, 0.88)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '580px' }}>
        <SpotlightCard
          spotlightColor="rgba(124, 140, 255, 0.18)"
          borderColor="rgba(124, 140, 255, 0.4)"
          className="glass-panel animate-fade-in"
          style={{ padding: '32px', borderRadius: '20px', background: 'rgba(20, 24, 33, 0.96)' }}
        >
          {/* Header */}
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 14px',
                borderRadius: '9999px',
                background: 'rgba(124, 140, 255, 0.12)',
                border: '1px solid rgba(124, 140, 255, 0.3)',
                color: '#7c8cff',
                fontSize: '0.8rem',
                fontWeight: 800,
                marginBottom: '10px',
              }}
            >
              <Sparkles size={14} /> BIENVENIDO A TU TERMINAL PERSONAL
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
              Hola, {session?.username || 'Inversionista'}
            </h2>
            <p style={{ color: '#9aa3b2', fontSize: '0.88rem', marginTop: '4px' }}>
              Tu cuenta está limpia y lista. Configuremos tus datos reales en 3 sencillos pasos.
            </p>

            {/* Stepper Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                marginTop: '18px',
              }}
            >
              {[
                { num: 1, label: 'Efectivo' },
                { num: 2, label: 'Acciones' },
                { num: 3, label: 'Telegram' },
              ].map((s) => (
                <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background:
                        step === s.num
                          ? '#7c8cff'
                          : step > s.num
                          ? 'rgba(124, 140, 255, 0.3)'
                          : 'rgba(255, 255, 255, 0.08)',
                      color: step === s.num ? '#052e16' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      transition: 'all 0.2s',
                    }}
                  >
                    {step > s.num ? <Check size={14} /> : s.num}
                  </div>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: step === s.num ? '#7c8cff' : '#667085',
                    }}
                  >
                    {s.label}
                  </span>
                  {s.num < 3 && (
                    <div style={{ width: '20px', height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* PASO 1: SALDO EN EFECTIVO Y FECHA */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: 'rgba(124, 140, 255, 0.06)',
                  border: '1px solid rgba(124, 140, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <Wallet size={24} style={{ color: '#7c8cff', minWidth: '24px' }} />
                <div style={{ fontSize: '0.84rem', color: '#b9c0cb' }}>
                  ¿Cuánto efectivo estás ingresando para invertir? Este saldo se irá <strong>liquidando automáticamente</strong> cada vez que registres compras de acciones.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#9aa3b2', marginBottom: '6px' }}>
                  Fecha de Inyección / Depósito
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#9aa3b2', marginBottom: '6px' }}>
                    Monto en Bolívares (VES)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={initialVes}
                    onChange={(e) => setInitialVes(parseFloat(e.target.value) || 0)}
                    placeholder="10000"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#7c8cff',
                      fontWeight: 700,
                      fontSize: '1rem',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#667085', marginTop: '4px', display: 'block' }}>
                    Equivale a {formatVES(initialVes)}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#9aa3b2', marginBottom: '6px' }}>
                    Monto en Dólares (USD Opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={initialUsd}
                    onChange={(e) => setInitialUsd(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#9aa6ff',
                      fontWeight: 700,
                      fontSize: '1rem',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#667085', marginTop: '4px', display: 'block' }}>
                    Equivale a {formatUSD(initialUsd)}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#9aa3b2', marginBottom: '6px' }}>
                  Concepto o Referencia del Aporte
                </label>
                <input
                  type="text"
                  value={depositConcept}
                  onChange={(e) => setDepositConcept(e.target.value)}
                  placeholder="Ej: Aporte quincena, Transferencia inicial"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginTop: '12px' }}>
                <button
                  onClick={handleFinishCashStep}
                  disabled={isSubmittingCash}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'var(--accent)',
                    color: 'var(--on-accent)',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    border: 'none',
                    cursor: isSubmittingCash ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: 'none',
                  }}
                >
                  <span>Continuar al Paso 2</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* PASO 2: TUS ACCIONES EXISTENTES */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: 'rgba(124, 140, 255, 0.06)',
                  border: '1px solid rgba(124, 140, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <TrendingUp size={24} style={{ color: '#7c8cff', minWidth: '24px' }} />
                <div style={{ fontSize: '0.84rem', color: '#b9c0cb' }}>
                  ¿Posees actualmente acciones de la Bolsa de Caracas? Regístralas aquí para calcular tu costo promedio y rendimiento real.
                </div>
              </div>

              {/* Formulario rápido para agregar */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#9aa3b2', marginBottom: '4px' }}>
                      Acción BVC
                    </label>
                    <select
                      value={selectedTicker}
                      onChange={(e) => setSelectedTicker(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: '#1b202b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        fontSize: '0.84rem',
                        outline: 'none',
                      }}
                    >
                      {bvcTickers && bvcTickers.length > 0 ? (
                        bvcTickers.map((t) => (
                          <option key={t.symbol} value={t.symbol}>
                            {t.symbol} - {t.name?.slice(0, 18)}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="BNC">BNC (Banco Nac. Crédito)</option>
                          <option value="BPVO">BPVO (Banco Provincial)</option>
                          <option value="TDV.D">TDV.D (CANTV Clase D)</option>
                          <option value="RST.B">RST.B (Ron Santa Teresa)</option>
                          <option value="MVZ.A">MVZ.A (Mercantil A)</option>
                          <option value="BVCC">BVCC (Bolsa de Caracas)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#9aa3b2', marginBottom: '4px' }}>
                      Nº Acciones
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={stockShares}
                      onChange={(e) => setStockShares(parseInt(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        fontSize: '0.84rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#9aa3b2', marginBottom: '4px' }}>
                      Costo Bs/acc
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={stockPrice}
                      onChange={(e) => setStockPrice(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        fontSize: '0.84rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddStock}
                  disabled={isAddingStock}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'rgba(124, 140, 255, 0.2)',
                    border: '1px solid rgba(124, 140, 255, 0.4)',
                    color: '#9aa6ff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={14} /> Guardar Acción a Mi Portafolio
                </button>
              </div>

              {/* Acciones ya añadidas */}
              {addedStocks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#9aa3b2', fontWeight: 700 }}>
                    Acciones registradas ({addedStocks.length}):
                  </div>
                  {addedStocks.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: 'rgba(124, 140, 255, 0.1)',
                        border: '1px solid rgba(124, 140, 255, 0.2)',
                        fontSize: '0.8rem',
                        color: '#c9cfff',
                      }}
                    >
                      <span>
                        <strong>{s.ticker}</strong>: {s.shares.toLocaleString()} acc @ {s.price} Bs
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={13} />Agregada</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Botones de navegación del paso 2 */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  onClick={() => {
                    playTerminalSound('click');
                    setStep(3);
                  }}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '10px',
                    background:
                      addedStocks.length > 0
                        ? 'var(--accent)'
                        : 'rgba(255, 255, 255, 0.06)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {addedStocks.length > 0 ? 'Continuar al Paso 3' : 'No tengo acciones aún (Comenzar desde 0)'}
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: VINCULAR TELEGRAM EN 1 CLIC */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: isTelegramLinked ? 'rgba(124, 140, 255, 0.12)' : 'rgba(124, 140, 255, 0.12)',
                  border: isTelegramLinked ? '1px solid rgba(124, 140, 255, 0.35)' : '1px solid rgba(124, 140, 255, 0.35)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--on-accent)',
                    minWidth: '38px',
                  }}
                >
                  <AnimatedTelegram size={22} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                    {isTelegramLinked ? '¡Telegram Conectado con Éxito!' : 'Alertas Push Móviles en 1 Clic'}
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: '#9aa3b2', lineHeight: 1.4 }}>
                    {isTelegramLinked
                      ? `Tu cuenta está enlazada con @${telegramUsername || 'tu_usuario'}. Recibirás el reporte consolidado en un solo mensaje.`
                      : 'Pulsa el botón para abrir Telegram. Solo dale a "Iniciar" en el chat y tu cuenta se vinculará sola sin buscar ningún ID.'}
                  </p>
                </div>
              </div>

              {!isTelegramLinked ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}>
                  <a
                    href={pairingUrl || `https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => playTerminalSound('success')}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'var(--accent)',
                      color: 'var(--on-accent)',
                      fontWeight: 800,
                      fontSize: '0.96rem',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: 'none',
                    }}
                  >
                    <span>Conectar Telegram en 1 clic</span>
                    <ExternalLink size={16} />
                  </a>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <AnimatedPulseBeacon color="#d9a441" size={6} />
                    <span style={{ fontSize: '0.76rem', color: '#9aa3b2' }}>
                      Esperando que presiones "Iniciar" en Telegram...
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(124, 140, 255, 0.15)',
                    border: '1px solid rgba(124, 140, 255, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#c9cfff',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle2 size={20} style={{ color: '#7c8cff' }} />
                  <span>Vinculación completada exitosamente</span>
                </div>
              )}

              {/* Botón Final */}
              <div style={{ marginTop: '12px' }}>
                <button
                  onClick={() => {
                    playTerminalSound('success');
                    onComplete();
                  }}
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: '12px',
                    background: 'var(--accent)',
                    color: 'var(--on-accent)',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: 'none',
                  }}
                >
                  <span>Abrir mi terminal</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}
        </SpotlightCard>
      </div>
    </div>
  );
};
