'use client';

import React, { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { UserSession } from '@/types';
import { setAuthToken } from '@/lib/api';
import { ModalShell, Field, ErrorBanner, digitsOnly } from './TradeModal';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (session: UserSession, isNewRegistration?: boolean) => void;
}

type ApiBody = { detail?: unknown; message?: string; token?: string; access_token?: string; challenge?: string; two_factor_required?: boolean; user?: { username?: string } };

const postJson = async (url: string, body: object): Promise<ApiBody> => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  let data: ApiBody;
  try {
    data = JSON.parse(text);
  } catch {
    data = { detail: text || 'Error del servidor (500).' };
  }
  if (!res.ok) {
    const d = data.detail;
    const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((e: { msg?: string }) => e.msg).join(', ') : data.message;
    throw new Error(msg || 'Error en la solicitud');
  }
  return data;
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, initialMode = 'login', onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState(''); // set when the account has 2FA
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const reset = (m: 'login' | 'register') => {
    setMode(m);
    setUsername('');
    setEmail('');
    setPassword('');
    setChallenge('');
    setCode('');
    setErrorMsg('');
  };

  React.useEffect(() => {
    if (isOpen) reset(initialMode);
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const finish = (data: ApiBody, isNew: boolean) => {
    const token = (data.token || data.access_token) as string;
    setAuthToken(token);
    onSuccess({ username: data.user?.username || username, token, is_demo: false }, isNew);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      if (challenge) {
        finish(await postJson('/api/auth/2fa/verify-login', { challenge, code }), false);
      } else if (mode === 'login') {
        const data = await postJson('/api/auth/login', { username_or_email: username.trim(), password });
        if (data.two_factor_required && data.challenge) {
          setChallenge(data.challenge);
        } else {
          finish(data, false);
        }
      } else {
        const data = await postJson('/api/auth/register', {
          username: username.trim(),
          email: email.trim(),
          password,
          full_name: username.trim(),
        });
        finish(data, true);
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
      if (challenge) setCode('');
    } finally {
      setLoading(false);
    }
  };

  const tab = (m: 'login' | 'register', label: string) => (
    <button
      type="button"
      onClick={() => reset(m)}
      style={{
        padding: '8px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem',
        background: mode === m ? 'rgba(124, 140, 255, 0.2)' : 'transparent',
        color: mode === m ? 'var(--accent)' : 'var(--text-muted)',
      }}
    >
      {label}
    </button>
  );

  return (
    <ModalShell
      icon={challenge ? <ShieldCheck size={20} style={{ color: 'var(--accent)' }} /> : <Lock size={20} style={{ color: 'var(--accent)' }} />}
      title={challenge ? 'Verificación en dos pasos' : mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
      subtitle={challenge ? 'Abre tu app de autenticación y escribe el código de 6 dígitos.' : undefined}
      tone="accent"
      onClose={onClose}
    >
      {!challenge && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px', marginBottom: '18px' }}>
          {tab('login', 'Iniciar Sesión')}
          {tab('register', 'Registrarse')}
        </div>
      )}

      <ErrorBanner message={errorMsg} />

      <form onSubmit={handleSubmit} autoComplete="off" className="tm-form">
        {challenge ? (
          <Field label="Código de verificación">
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus
              className="tm-input tm-num" placeholder="123456"
              style={{ fontSize: '1.4rem', letterSpacing: '0.4em', textAlign: 'center' }}
              value={code} onChange={digitsOnly(setCode)}
            />
          </Field>
        ) : (
          <>
            <Field label="Nombre de Usuario">
              <input type="text" name="kix_auth_user" autoComplete="off" required className="tm-input"
                placeholder="inversionista_bvc" value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            {mode === 'register' && (
              <Field label="Correo Electrónico">
                <input type="email" name="kix_auth_email" autoComplete="off" required className="tm-input"
                  placeholder="inversionista@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            )}
            <Field label="Contraseña">
              <input type="password" name="kix_auth_password" autoComplete="new-password" required className="tm-input"
                placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </>
        )}

        <button type="submit" className="tm-btn tm-btn-primary" disabled={loading || (!!challenge && code.length !== 6)} style={{ marginTop: '6px', padding: '12px' }}>
          {loading ? 'Procesando...' : challenge ? 'Verificar y entrar' : mode === 'login' ? 'Entrar a Mi Terminal' : 'Crear Cuenta Gratis'}
        </button>
        {challenge && (
          <button type="button" className="tm-link" style={{ alignSelf: 'center' }} onClick={() => reset('login')}>
            Volver al inicio de sesión
          </button>
        )}
      </form>
    </ModalShell>
  );
};
