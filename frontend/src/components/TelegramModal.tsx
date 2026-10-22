'use client';

import React, { useState, useEffect } from 'react';
import { X, Send, Bell, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck, RefreshCw } from 'lucide-react';
import { TelegramStatus } from '@/types';
import { fetchTelegramStatus, sendTelegramTestAlert, toggleTelegramAlerts, fetchTelegramPairingUrl } from '@/lib/api';
import { AnimatedBell, AnimatedPulseBeacon, AnimatedTelegram } from './AnimatedIcons';
import { SpotlightCard } from './SpotlightCard';
import { playTerminalSound } from '@/lib/audio';

interface TelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelegramModal: React.FC<TelegramModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [pairingUrl, setPairingUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await fetchTelegramStatus();
      setStatus(data);
      const pair = await fetchTelegramPairingUrl();
      if (pair.direct_url) setPairingUrl(pair.direct_url);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      setTestResult(null);
    }
  }, [isOpen]);

  // Polling automático mientras el modal está abierto para detectar cuando el usuario pulsa "Iniciar" en Telegram
  useEffect(() => {
    let timer: any = null;
    if (isOpen && !status?.linked) {
      timer = setInterval(async () => {
        const data = await fetchTelegramStatus();
        if (data.linked) {
          setStatus(data);
          playTerminalSound('success');
        }
      }, 2500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen, status?.linked]);

  if (!isOpen) return null;

  const handleSendTest = async () => {
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await sendTelegramTestAlert();
      setTestResult(res);
      if (res.success) {
        loadStatus();
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleToggle = async () => {
    if (!status) return;
    const newState = !status.alerts_enabled;
    setStatus({ ...status, alerts_enabled: newState });
    await toggleTelegramAlerts(newState);
  };

  const botUsername = status?.bot_username || 'KixInvert_bot';
  const telegramDirectUrl = pairingUrl || `https://t.me/${botUsername}`;

  return (
    <div
      className="modal-overlay active"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 13, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '520px' }}
      >
        <SpotlightCard
          spotlightColor="rgba(6, 182, 212, 0.16)"
          borderColor="rgba(6, 182, 212, 0.45)"
          className="glass-panel"
          style={{
            padding: '28px',
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.95)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 14px rgba(6, 182, 212, 0.4)',
                }}
              >
                <AnimatedTelegram size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                  Alertas Telegram en Vivo
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <AnimatedPulseBeacon color={status?.linked ? '#10b981' : '#f59e0b'} size={6} />
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    {status?.linked ? 'Bot Vinculado & Activo' : 'Pendiente por Vincular'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Bot Card Status */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Canal Oficial:</span>
              <a
                href={telegramDirectUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#38bdf8',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                @{botUsername} <ExternalLink size={14} />
              </a>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>ID de Chat Vinculado:</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: status?.linked ? '#10b981' : '#64748b' }}>
                {status?.linked ? status.chat_id : 'No configurado'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Despacho de Alertas Móviles:</span>
              <button
                onClick={handleToggle}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  background: status?.alerts_enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: status?.alerts_enabled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                  color: status?.alerts_enabled ? '#10b981' : '#f87171',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <AnimatedBell size={13} active={status?.alerts_enabled} />
                {status?.alerts_enabled ? 'Activadas' : 'Pausadas'}
              </button>
            </div>
          </div>

          {/* Botón de 1-Clic cuando no está vinculado */}
          {!status?.linked && (
            <div style={{ marginBottom: '16px' }}>
              <a
                href={telegramDirectUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => playTerminalSound('success')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '13px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                  color: '#fff',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.94rem',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(6, 182, 212, 0.4)',
                  marginBottom: '8px',
                }}
              >
                <AnimatedTelegram size={18} />
                <span>📱 Conectar Telegram en 1 Clic</span>
                <ExternalLink size={15} />
              </a>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <AnimatedPulseBeacon color="#f59e0b" size={6} />
                <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                  Solo dale a &quot;Iniciar&quot; en el chat y se vinculará automáticamente sin buscar ningún ID.
                </span>
              </div>
            </div>
          )}

          {/* Test Alert Button */}
          <button
            onClick={handleSendTest}
            disabled={isSendingTest}
            className="btn-shimmer"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              color: '#fff',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: isSendingTest ? 'wait' : 'pointer',
              border: 'none',
              boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)',
              marginBottom: '16px',
            }}
          >
            {isSendingTest ? (
              <>
                <RefreshCw size={16} className="spin-icon" /> Enviando Alerta a tu Celular...
              </>
            ) : (
              <>
                <Send size={16} /> Enviar Alerta de Prueba Instantánea
              </>
            )}
          </button>

          {/* Feedback Banner */}
          {testResult && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: testResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: testResult.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                color: testResult.success ? '#a7f3d0' : '#fca5a5',
                fontSize: '0.84rem',
                marginBottom: '16px',
              }}
            >
              {testResult.success ? <CheckCircle2 size={18} style={{ color: '#10b981', minWidth: '18px' }} /> : <AlertCircle size={18} style={{ color: '#ef4444', minWidth: '18px' }} />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Security & Instruction Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.74rem',
              color: '#64748b',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              paddingTop: '14px',
            }}
          >
            <ShieldCheck size={14} style={{ color: '#10b981', minWidth: '14px' }} />
            <span>Encriptación punto a punto y sin almacenar números de teléfono personales.</span>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
};
