'use client';

import React, { useState } from 'react';
import { Bot, Send, X, AlertCircle, Sparkles, UserPlus } from 'lucide-react';
import { askKixInvertAI } from '@/lib/api';
import { UserSession } from '@/types';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: UserSession | null;
  onOpenRegister: () => void;
}

export const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, session, onOpenRegister }) => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content:
        '¡Hola! Soy KixInvert AI, tu analista bursátil inteligente para la Bolsa de Valores de Caracas. Pregúntame sobre cobertura cambiaria, análisis de Ron Santa Teresa, CANTV o rebalanceo de cartera.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [demoQueryCount, setDemoQueryCount] = useState(0);

  if (!isOpen) return null;

  const isDemo = session?.is_demo ?? true;
  const isLimitReached = isDemo && demoQueryCount >= 2;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || loading) return;

    if (isLimitReached) return;

    const userMsg = prompt.trim();
    setPrompt('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    if (isDemo) {
      setDemoQueryCount((prev) => prev + 1);
    }

    try {
      const response = await askKixInvertAI(userMsg, demoQueryCount);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.answer }]);
      if (response.limit_reached) {
        setDemoQueryCount(2);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'No pude procesar la consulta en este momento. Por favor intenta de nuevo en unos minutos.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop show"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        opacity: 1,
        pointerEvents: 'auto',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '660px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={20} />
            </div>
            <div>
              <strong style={{ color: '#fff', fontSize: '1rem', display: 'block' }}>Analista Bursátil KixInvert AI</strong>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {isDemo ? `Modo Práctica Demo (${2 - demoQueryCount} consultas restantes)` : 'Acceso Ilimitado'}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Chat History */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '300px' }}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '12px 16px',
                borderRadius: '12px',
                background: m.role === 'user' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.05)',
                border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          ))}

          {loading && (
            <div style={{ alignSelf: 'flex-start', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: '#a78bfa', fontSize: '0.85rem' }}>
              <Sparkles size={14} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
              Analizando cotizaciones y cobertura cambiaria...
            </div>
          )}

          {/* Banner de Límite de Consultas en Demo */}
          {isLimitReached && (
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(139, 92, 246, 0.12)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                textAlign: 'center',
                alignItems: 'center',
              }}
            >
              <AlertCircle size={24} style={{ color: '#c084fc' }} />
              <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>
                ¡Has completado tus 2 consultas de práctica en modo Demo!
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                Para seguir disfrutando de diagnósticos bursátiles ilimitados y guardar tu portafolio, regístrate gratis.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenRegister();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  marginTop: '4px',
                }}
              >
                <UserPlus size={16} /> Registrarme para IA Ilimitada
              </button>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading || isLimitReached}
            placeholder={isLimitReached ? 'Límite alcanzado en Demo. Regístrate para continuar.' : 'Escribe tu consulta sobre la BVC...'}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: '0.88rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading || isLimitReached || !prompt.trim()}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              cursor: (loading || isLimitReached || !prompt.trim()) ? 'not-allowed' : 'pointer',
              opacity: (loading || isLimitReached || !prompt.trim()) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};
