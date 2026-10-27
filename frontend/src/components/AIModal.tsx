'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, AlertCircle, Sparkles, UserPlus, FastForward, Cpu } from 'lucide-react';
import { askKixInvertAI } from '@/lib/api';
import { UserSession } from '@/types';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: UserSession | null;
  onOpenRegister: () => void;
}

const THINKING_THOUGHTS = [
  'Analizando tus posiciones en la Bolsa de Caracas...',
  'Comparando precios actuales con tus costos de compra...',
  'Calculando rendimientos reales y cobertura cambiaria...',
  'Evaluando estrategia táctica: ¿vender parcial o mantener?...',
  'Formulando la mejor recomendación personalizada...',
];

const SUGGESTIONS = [
  '¿Cuáles y cuántas acciones me recomiendas vender hoy?',
  '¿Me quedo o vendo un poco?',
  '¿Cómo me protege de la devaluación?',
  '¿En cuáles acciones puedo comprar más?',
];

export const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, session, onOpenRegister }) => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content:
        '¡Hola! Soy tu asesor de KixInvert AI. Tengo a la mano tus posiciones en la Bolsa de Caracas en tiempo real. Pregúntame con confianza cuáles y cuántas acciones exactas te conviene vender hoy, cuáles mantener o cómo va tu cobertura frente al dólar.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [demoQueryCount, setDemoQueryCount] = useState(0);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<(() => void) | null>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, isStreaming, thinkingIndex]);

  // Thinking timer & thoughts rotation
  useEffect(() => {
    if (!isThinking) {
      setThinkingSeconds(0);
      setThinkingIndex(0);
      return;
    }

    const timerInterval = setInterval(() => {
      setThinkingSeconds((prev) => +(prev + 0.1).toFixed(1));
    }, 100);

    const thoughtInterval = setInterval(() => {
      setThinkingIndex((prev) => (prev + 1) % THINKING_THOUGHTS.length);
    }, 600);

    return () => {
      clearInterval(timerInterval);
      clearInterval(thoughtInterval);
    };
  }, [isThinking]);

  if (!isOpen) return null;

  const isDemo = session?.is_demo ?? true;
  const isLimitReached = isDemo && demoQueryCount >= 2;

  const typeWriterEffect = (fullText: string): Promise<void> => {
    return new Promise((resolve) => {
      setIsStreaming(true);
      // Create empty assistant message placeholder
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      let currentLength = 0;
      const chunkSize = 14; // Characters per tick
      const intervalMs = 18;

      let cancelled = false;
      streamAbortRef.current = () => {
        cancelled = true;
        // Immediately set full text
        setMessages((prev) => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
            updated[updated.length - 1].content = fullText;
          }
          return updated;
        });
        setIsStreaming(false);
        resolve();
      };

      const timer = setInterval(() => {
        if (cancelled) {
          clearInterval(timer);
          return;
        }

        currentLength += chunkSize;
        if (currentLength >= fullText.length) {
          currentLength = fullText.length;
          clearInterval(timer);
          setMessages((prev) => {
            const updated = [...prev];
            if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
              updated[updated.length - 1].content = fullText;
            }
            return updated;
          });
          setIsStreaming(false);
          streamAbortRef.current = null;
          resolve();
        } else {
          const slice = fullText.slice(0, currentLength);
          setMessages((prev) => {
            const updated = [...prev];
            if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
              updated[updated.length - 1].content = slice;
            }
            return updated;
          });
        }
      }, intervalMs);
    });
  };

  const handleSkipTyping = () => {
    if (streamAbortRef.current) {
      streamAbortRef.current();
    }
  };

  const executeSend = async (userMsg: string) => {
    if (!userMsg.trim() || loading || isLimitReached) return;

    setPrompt('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setIsThinking(true);

    if (isDemo) {
      setDemoQueryCount((prev) => prev + 1);
    }

    try {
      // Humanized deliberate thinking: enforce minimum 1.6s so the user sees the AI thinking process
      const minThinkDelay = new Promise((res) => setTimeout(res, 1600));
      const [response] = await Promise.all([askKixInvertAI(userMsg, demoQueryCount), minThinkDelay]);

      setIsThinking(false);

      if (response.limit_reached) {
        setDemoQueryCount(2);
      }

      // Smooth streaming reveal
      await typeWriterEffect(response.answer);
    } catch {
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'No pude procesar la consulta en este momento. Por favor intenta de nuevo en unos minutos.',
        },
      ]);
    } finally {
      setLoading(false);
      setIsThinking(false);
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeSend(prompt.trim());
  };

  const handleSuggestionClick = (suggestionText: string) => {
    executeSend(suggestionText);
  };

  // Helper to clean any markdown asterisks and format message cleanly
  const renderFormattedMessage = (content: string, isLastAssistant: boolean) => {
    const cleanText = content.replace(/\*+/g, '');
    return (
      <span>
        {cleanText}
        {isStreaming && isLastAssistant && (
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '14px',
              marginLeft: '3px',
              background: '#7c8cff',
              borderRadius: '2px',
              verticalAlign: 'middle',
              animation: 'aiCursorBlink 0.8s infinite',
            }}
          />
        )}
      </span>
    );
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
      <style>{`
        @keyframes aiPulseGlow {
          0%, 100% { opacity: 0.6; transform: scale(0.97); }
          50% { opacity: 1; transform: scale(1.03); }
        }
        @keyframes aiCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes aiDotWave {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'rgba(20, 24, 33, 0.96)',
          border: '1px solid rgba(124, 140, 255, 0.35)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(27, 32, 43, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(124, 140, 255, 0.3), rgba(124, 140, 255, 0.3))',
                border: '1px solid rgba(124, 140, 255, 0.4)',
                color: '#9aa6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ color: '#fff', fontSize: '1.02rem' }}>Analista Bursátil KixInvert AI</strong>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    background: 'rgba(124, 140, 255, 0.15)',
                    color: '#9aa6ff',
                    border: '1px solid rgba(124, 140, 255, 0.3)',
                    fontWeight: 600,
                  }}
                >
                  BVC en Vivo
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#9aa3b2' }}>
                {isDemo ? `Modo Práctica Demo (${Math.max(0, 2 - demoQueryCount)} consultas restantes)` : 'Acceso Ilimitado'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9aa3b2',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#9aa3b2')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Chat History */}
        <div
          ref={chatContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            minHeight: '320px',
            scrollBehavior: 'smooth',
          }}
        >
          {messages.map((m, idx) => {
            const isLastAssistant = m.role === 'assistant' && idx === messages.length - 1;
            return (
              <div
                key={idx}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  padding: '13px 18px',
                  borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background:
                    m.role === 'user'
                      ? 'var(--accent)'
                      : 'rgba(27, 32, 43, 0.7)',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: '0.88rem',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  boxShadow:
                    m.role === 'user'
                      ? '0 4px 14px rgba(124, 140, 255, 0.25)'
                      : '0 4px 16px rgba(0,0,0,0.25)',
                }}
              >
                {renderFormattedMessage(m.content, isLastAssistant)}

                {/* Skip typing button */}
                {isStreaming && isLastAssistant && (
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleSkipTyping}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        color: '#b9c0cb',
                        fontSize: '0.72rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <FastForward size={12} /> Ver completo
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* HUMANIZED "PENSANDO" CARD */}
          {isThinking && (
            <div
              style={{
                alignSelf: 'flex-start',
                maxWidth: '90%',
                padding: '14px 18px',
                borderRadius: '16px 16px 16px 4px',
                background: 'linear-gradient(135deg, rgba(124, 140, 255, 0.12), rgba(124, 140, 255, 0.08))',
                border: '1px solid rgba(124, 140, 255, 0.35)',
                boxShadow: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'aiPulseGlow 1.4s ease-in-out infinite',
                  }}
                >
                  <Cpu size={12} color="#fff" />
                </div>
                <span style={{ color: '#9aa6ff', fontSize: '0.86rem', fontWeight: 600 }}>
                  KixInvert AI está pensando
                </span>
                <span style={{ display: 'inline-flex', gap: '3px', marginLeft: '2px' }}>
                  <span
                    style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: '#9aa6ff',
                      display: 'inline-block',
                      animation: 'aiDotWave 1.4s infinite ease-in-out both',
                      animationDelay: '0s',
                    }}
                  />
                  <span
                    style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: '#9aa6ff',
                      display: 'inline-block',
                      animation: 'aiDotWave 1.4s infinite ease-in-out both',
                      animationDelay: '0.2s',
                    }}
                  />
                  <span
                    style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: '#9aa6ff',
                      display: 'inline-block',
                      animation: 'aiDotWave 1.4s infinite ease-in-out both',
                      animationDelay: '0.4s',
                    }}
                  />
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#9aa3b2',
                    marginLeft: 'auto',
                    fontFamily: 'monospace',
                  }}
                >
                  {thinkingSeconds}s
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.82rem',
                  color: '#d5d9e0',
                  paddingLeft: '30px',
                  fontStyle: 'italic',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={13} style={{ color: '#9aa6ff', flexShrink: 0 }} />
                <span>{THINKING_THOUGHTS[thinkingIndex]}</span>
              </div>
            </div>
          )}

          {/* Banner de Límite de Consultas en Demo */}
          {isLimitReached && (
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(124, 140, 255, 0.12)',
                border: '1px solid rgba(124, 140, 255, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                textAlign: 'center',
                alignItems: 'center',
              }}
            >
              <AlertCircle size={24} style={{ color: '#9aa6ff' }} />
              <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>
                ¡Has completado tus 2 consultas de práctica en modo Demo!
              </div>
              <p style={{ color: '#9aa3b2', fontSize: '0.8rem', margin: 0 }}>
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
                  background: 'var(--accent)',
                  color: 'var(--on-accent)',
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

        {/* Quick Suggestion Chips */}
        {!isLimitReached && !loading && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              padding: '8px 20px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(20, 24, 33, 0.6)',
              scrollbarWidth: 'none',
            }}
          >
            {SUGGESTIONS.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSuggestionClick(sug)}
                disabled={loading}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '20px',
                  padding: '5px 12px',
                  fontSize: '0.74rem',
                  color: '#b9c0cb',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(124, 140, 255, 0.25)';
                  e.currentTarget.style.borderColor = 'rgba(124, 140, 255, 0.5)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                  e.currentTarget.style.color = '#b9c0cb';
                }}
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={handleSend}
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            gap: '10px',
            background: 'rgba(20, 27, 45, 0.8)',
          }}
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading || isLimitReached}
            placeholder={
              isLimitReached
                ? 'Límite alcanzado en Demo. Regístrate para continuar.'
                : 'Pregúntale a la IA (ej. ¿Me quedo o vendo un poco?)...'
            }
            style={{
              flex: 1,
              padding: '11px 16px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: '0.88rem',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(124, 140, 255, 0.6)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
          />
          <button
            type="submit"
            disabled={loading || isLimitReached || !prompt.trim()}
            style={{
              padding: '11px 20px',
              borderRadius: '10px',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              border: 'none',
              fontWeight: 700,
              cursor: loading || isLimitReached || !prompt.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || isLimitReached || !prompt.trim() ? 0.45 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: 'none',
              transition: 'opacity 0.2s, transform 0.1s',
            }}
          >
            <Send size={15} />
            <span style={{ fontSize: '0.85rem' }}>Enviar</span>
          </button>
        </form>
      </div>
    </div>
  );
};
