'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crown, ShieldCheck, UserCog, ExternalLink, CheckCircle2 } from 'lucide-react';
import { authedJson } from '@/lib/api';
import { ModalShell, Field, ErrorBanner, digitsOnly } from './TradeModal';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Plan {
  payments_available: boolean;
  price_usdt: number;
  days: number;
  is_pro: boolean;
  expires_at: string | null;
  ai_queries_used_this_month: number;
  ai_queries_limit: number | null;
}

interface Order { order_id: string; amount_usdt: number; checkout_url?: string; qr_url?: string; expires_in_minutes: number }

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });

// "Mi cuenta": plan PRO con Binance Pay y verificación en dos pasos
export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [twoFactor, setTwoFactor] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, me] = await Promise.all([
        authedJson<Plan>('/payments/plan'),
        authedJson<{ two_factor_enabled: boolean }>('/auth/me'),
      ]);
      setPlan(p);
      setTwoFactor(me.two_factor_enabled);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setNotice('');
      load();
    }
  }, [isOpen, load]);

  if (!isOpen) return null;

  return (
    <ModalShell icon={<UserCog size={20} style={{ color: 'var(--accent)' }} />} title="Mi cuenta" subtitle="Plan, pagos y seguridad" tone="accent" onClose={onClose}>
      <ErrorBanner message={error} />
      {notice && <div className="tm-success" style={{ marginBottom: '14px' }}><CheckCircle2 size={16} /> {notice}</div>}
      <div className="tm-form">
        {plan && <PlanSection plan={plan} onPaid={() => { setNotice('¡Pago confirmado! Tu plan PRO ya está activo.'); load(); }} onError={setError} />}
        {twoFactor !== null && (
          <TwoFactorSection enabled={twoFactor} onChange={(on, msg) => { setTwoFactor(on); setNotice(msg); setError(''); }} onError={setError} />
        )}
      </div>
    </ModalShell>
  );
};

const PlanSection: React.FC<{ plan: Plan; onPaid: () => void; onError: (m: string) => void }> = ({ plan, onPaid, onError }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  const startPayment = async () => {
    setBusy(true);
    onError('');
    try {
      const o = await authedJson<Order>('/payments/binance/order', 'POST');
      setOrder(o);
      if (o.checkout_url) window.open(o.checkout_url, '_blank', 'noopener');
      const deadline = Date.now() + o.expires_in_minutes * 60_000;
      // Ask our server every 5 s; it checks the order with Binance and activates PRO when paid
      poll.current = setInterval(async () => {
        try {
          const { status } = await authedJson<{ status: string }>(`/payments/order/${o.order_id}`);
          if (status === 'PAID') {
            clearInterval(poll.current!);
            setOrder(null);
            onPaid();
          } else if (status !== 'PENDING' || Date.now() > deadline) {
            clearInterval(poll.current!);
            setOrder(null);
            onError('La orden venció o fue cancelada. Puedes generar una nueva cuando quieras.');
          }
        } catch { /* transient: try again on the next tick */ }
      }, 5000);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tm-card">
      <div className="tm-fees-head">
        <span><Crown size={16} style={{ color: plan.is_pro ? 'var(--warn)' : 'var(--accent)' }} /> {plan.is_pro ? 'Plan PRO activo' : 'Plan gratuito'}</span>
      </div>
      <div className="tm-rows">
        {plan.is_pro && plan.expires_at ? (
          <div className="tm-row"><span>Vigente hasta</span><span className="tm-mono">{fmtDate(plan.expires_at)}</span></div>
        ) : (
          <div className="tm-row"><span>Consultas a KixInvert AI este mes</span><span className="tm-mono">{plan.ai_queries_used_this_month} / {plan.ai_queries_limit}</span></div>
        )}
        <div className="tm-row tm-row-sm"><span>PRO: consultas ilimitadas a la IA por {plan.days} días</span><span className="tm-mono">{plan.price_usdt.toFixed(2)} USDT</span></div>
      </div>

      {order ? (
        <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {order.qr_url && <img src={order.qr_url} alt="Código QR de Binance Pay" width={180} height={180} style={{ margin: '0 auto 8px', borderRadius: '8px', background: '#fff' }} />}
          <p>Paga {order.amount_usdt ?? plan.price_usdt} USDT con la app de Binance. Esta ventana se actualiza sola al confirmarse el pago.</p>
          {order.checkout_url && (
            <a className="tm-link" href={order.checkout_url} target="_blank" rel="noopener noreferrer">
              Abrir la página de pago de Binance <ExternalLink size={11} />
            </a>
          )}
        </div>
      ) : plan.payments_available ? (
        <button type="button" className="tm-btn tm-btn-primary" style={{ width: '100%', marginTop: '12px' }} disabled={busy} onClick={startPayment}>
          {busy ? 'Creando orden...' : plan.is_pro ? `Extender ${plan.days} días con Binance Pay` : `Pasar a PRO con Binance Pay (${plan.price_usdt} USDT)`}
        </button>
      ) : (
        <p className="tm-aside" style={{ marginTop: '10px' }}>Los pagos con Binance Pay todavía no están disponibles.</p>
      )}
    </div>
  );
};

const TwoFactorSection: React.FC<{ enabled: boolean; onChange: (on: boolean, msg: string) => void; onError: (m: string) => void }> = ({ enabled, onChange, onError }) => {
  const [setup, setSetup] = useState<{ qr: string; manual_key: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    onError('');
    try { await fn(); } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  };

  const begin = () => run(async () => { setSetup(await authedJson('/auth/2fa/setup', 'POST')); setCode(''); });
  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await authedJson('/auth/2fa/enable', 'POST', { code });
      setSetup(null);
      onChange(true, 'Verificación en dos pasos activada. La próxima vez que inicies sesión te pediremos el código.');
    });
  };
  const disable = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await authedJson('/auth/2fa/disable', 'POST', { code, password });
      setCode('');
      setPassword('');
      onChange(false, 'Verificación en dos pasos desactivada.');
    });
  };

  const codeInput = (
    <Field label="Código de 6 dígitos de tu app">
      <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="tm-input tm-num"
        placeholder="123456" style={{ letterSpacing: '0.3em' }} value={code} onChange={digitsOnly(setCode)} />
    </Field>
  );

  return (
    <div className="tm-card">
      <div className="tm-fees-head">
        <span><ShieldCheck size={16} style={{ color: enabled ? 'var(--up)' : 'var(--text-muted)' }} /> Verificación en dos pasos</span>
        <span className="tm-aside" style={{ color: enabled ? 'var(--up)' : undefined }}>{enabled ? 'Activa' : 'Desactivada'}</span>
      </div>

      {enabled ? (
        <form onSubmit={disable} className="tm-form">
          <p className="tm-aside">Para desactivarla confirma tu contraseña y un código de la app.</p>
          <Field label="Contraseña">
            <input type="password" required className="tm-input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {codeInput}
          <button type="submit" className="tm-btn tm-btn-ghost" disabled={busy || code.length !== 6}>Desactivar</button>
        </form>
      ) : setup ? (
        <form onSubmit={confirm} className="tm-form">
          <p className="tm-aside">1. Escanea este código con Google Authenticator, Authy o Microsoft Authenticator.</p>
          <img src={setup.qr} alt="Código QR para la app de autenticación" width={180} height={180} style={{ margin: '0 auto', borderRadius: '8px' }} />
          <p className="tm-aside" style={{ textAlign: 'center' }}>¿No puedes escanear? Escribe esta clave: <strong className="tm-mono">{setup.manual_key}</strong></p>
          <p className="tm-aside">2. Escribe el código que muestra la app para confirmar.</p>
          {codeInput}
          <button type="submit" className="tm-btn tm-btn-primary" disabled={busy || code.length !== 6}>Activar</button>
        </form>
      ) : (
        <>
          <p className="tm-aside" style={{ marginBottom: '10px' }}>Además de tu contraseña, se pedirá un código de tu teléfono al iniciar sesión.</p>
          <button type="button" className="tm-btn tm-btn-primary" style={{ width: '100%' }} disabled={busy} onClick={begin}>Configurar</button>
        </>
      )}
    </div>
  );
};
