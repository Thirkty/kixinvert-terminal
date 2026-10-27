'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  Coins,
  Crown,
  Globe,
  KeyRound,
  Landmark,
  LineChart,
  Lock,
  LogOut,
  Mail,
  Send,
  ShieldCheck,
  Sliders,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { TickerTape } from './TickerTape';
import { CountUp } from './Motion';
import { UserSession, BvcTicker, InternationalQuote, Ecosystem, MarketRates } from '@/types';
import { formatVES } from '@/lib/formatters';
import { playTerminalSound } from '@/lib/audio';

interface WelcomeLandingProps {
  onOpenRegister: () => void;
  onOpenLogin: () => void;
  onGoTerminal?: () => void;
  session?: UserSession | null;
  onLogout?: () => void;
  bvcTickers?: BvcTicker[];
  intlTickers?: InternationalQuote[];
  currentEcosystem?: Ecosystem;
  rates?: MarketRates;
}

const FEATURES = [
  {
    icon: Coins,
    title: 'Tres monedas a la vez',
    text: 'Cada acción y tu patrimonio total en bolívares, dólar BCV y USDT. Ves al instante si tu ganancia en Bs le gana a la devaluación.',
  },
  {
    icon: TrendingUp,
    title: 'Señales por posición',
    text: 'Indicadores de toma de ganancia, mantener o reforzar, calculados con tu costo de compra y el rendimiento real en USDT.',
  },
  {
    icon: Bot,
    title: 'Asistente KixInvert AI',
    text: 'Pregunta cuántas acciones vender o cómo vas frente al dólar. Responde con los números de tu propio portafolio.',
  },
  {
    icon: Globe,
    title: 'Caracas y Wall Street',
    text: 'Las 46 acciones de la BVC y acciones o ETFs de EE.UU. en dólares, en carteras separadas para no mezclar monedas.',
  },
  {
    icon: Sliders,
    title: 'Simulador What-If',
    text: 'Mueve el dólar BCV y el USDT a futuro y mira cuánto valdría tu cartera. Planifica antes de que pase.',
  },
  {
    icon: Send,
    title: 'Alertas en Telegram',
    text: 'Vincula @KixInvert_bot y recibe avisos de brecha cambiaria y señales. Consulta tu saldo con /balance.',
  },
];

const STEPS = [
  { icon: UserPlus, title: 'Crea tu cuenta', text: 'Gratis, con correo y contraseña. Puedes activar doble factor (2FA) desde el primer día.' },
  { icon: Wallet, title: 'Registra tus compras', text: 'Ticker, cantidad y precio. KixInvert guarda la tasa BCV y USDT del día para medir tu rendimiento real.' },
  { icon: LineChart, title: 'Decide con datos', text: 'Sigue tus tres monedas, revisa las señales y recibe alertas en el móvil.' },
];

const FAQ = [
  {
    q: '¿Por qué tres monedas para cada acción?',
    a: 'Las acciones de la BVC cotizan en bolívares, pero tu poder de compra real se mide en dólares. KixInvert compara tu rendimiento en Bs con el dólar oficial BCV y con el USDT de Binance P2P para que sepas si de verdad estás ganando.',
  },
  {
    q: '¿Cómo vinculo el bot de Telegram?',
    a: 'Desde el terminal, en "Bot Telegram", generas un código de un solo uso y lo envías a @KixInvert_bot con /start. Desde ese momento recibes alertas y puedes consultar /balance.',
  },
  {
    q: '¿Cómo se paga el Plan PRO?',
    a: 'Con USDT a través de Binance Pay, 5 USDT al mes. El plan se activa cuando Binance confirma el pago.',
  },
  {
    q: '¿Qué tan seguros están mis datos?',
    a: 'Las contraseñas se guardan con bcrypt, la sesión usa tokens firmados con vencimiento, los datos sensibles se cifran en la base de datos y puedes activar 2FA con Google Authenticator. Cada usuario solo puede ver su propio portafolio.',
  },
  {
    q: '¿KixInvert compra o vende acciones por mí?',
    a: 'No. KixInvert es una herramienta de seguimiento y análisis: tú operas con tu casa de bolsa y registras tus compras y ventas aquí.',
  },
];

// Reveals sections as they scroll into view; content is visible by default if JS or IntersectionObserver is missing
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    root.classList.add('lx-reveal-ready');
    const items = root.querySelectorAll<HTMLElement>('[data-reveal]');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lx-in');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

export const WelcomeLanding: React.FC<WelcomeLandingProps> = ({
  onOpenRegister,
  onOpenLogin,
  onGoTerminal,
  session,
  onLogout,
  bvcTickers,
  intlTickers,
  currentEcosystem,
  rates,
}) => {
  const rootRef = useReveal();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Nominal illusion calculator
  const [stockGain, setStockGain] = useState(25);
  const [dollarJump, setDollarJump] = useState(35);
  const realReturn = ((1 + stockGain / 100) / (1 + dollarJump / 100) - 1) * 100;

  const hasRates = Boolean(rates && rates.bcv > 0 && rates.usdt > 0);

  // Today's biggest movers, from the real BVC board
  const movers = useMemo(
    () =>
      [...(bvcTickers || [])]
        .filter((t) => t.price > 0 && t.change_pct !== 0)
        .sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))
        .slice(0, 4),
    [bvcTickers]
  );

  const register = () => {
    playTerminalSound('success');
    onOpenRegister();
  };
  const login = () => {
    playTerminalSound('click');
    onOpenLogin();
  };

  return (
    <div className="lx" ref={rootRef}>
      {/* NAV */}
      <nav className="lx-nav">
        <div className="lx-nav-inner">
          <a href="#top" className="lx-brand" aria-label="KixInvert, inicio">
            <span className="lx-brand-mark"><TrendingUp size={16} /></span>
            KixInvert
          </a>
          <div className="lx-nav-links">
            <a href="#funciones">Funciones</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#precios">Precios</a>
            <a href="#faq">Preguntas</a>
          </div>
          <div className="lx-nav-actions">
            {session ? (
              <>
                <button type="button" className="lx-btn lx-btn-primary lx-btn-sm" onClick={onGoTerminal}>
                  Abrir terminal <ArrowRight size={14} />
                </button>
                <span className="lx-user"><span className="lx-dot" />{session.username}</span>
                {onLogout && (
                  <button type="button" className="lx-icon-btn" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
                    <LogOut size={15} />
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" className="lx-btn lx-btn-ghost lx-btn-sm" onClick={login}>
                  <Lock size={14} /> Entrar
                </button>
                <button type="button" className="lx-btn lx-btn-primary lx-btn-sm" onClick={register}>
                  Crear cuenta
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {bvcTickers && bvcTickers.length > 0 && (
        <div className="lx-tape">
          <TickerTape
            tickers={bvcTickers}
            intlTickers={intlTickers}
            currentEcosystem={currentEcosystem || 'BVC'}
            onSelectTicker={() => onGoTerminal?.()}
          />
        </div>
      )}

      {/* HERO */}
      <header className="lx-hero" id="top">
        <div className="lx-hero-copy">
          <span className="lx-eyebrow lx-rise" style={{ animationDelay: '40ms' }}>
            Bolsa de Valores de Caracas · Wall Street
          </span>
          <h1 className="lx-rise" style={{ animationDelay: '110ms' }}>
            Tu ganancia en bolívares, <span className="lx-accent-text">medida en dólares reales</span>
          </h1>
          <p className="lx-lead lx-rise" style={{ animationDelay: '180ms' }}>
            KixInvert sigue tu portafolio de la BVC en bolívares, dólar BCV y USDT al mismo tiempo, para que sepas
            si tus acciones le están ganando a la devaluación.
          </p>
          <div className="lx-cta lx-rise" style={{ animationDelay: '250ms' }}>
            {session ? (
              <button type="button" className="lx-btn lx-btn-primary" onClick={onGoTerminal}>
                Ir a mi terminal <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <button type="button" className="lx-btn lx-btn-primary" onClick={register}>
                  Crear cuenta gratis <ArrowRight size={16} />
                </button>
                <button type="button" className="lx-btn lx-btn-ghost" onClick={login}>
                  Ya tengo cuenta
                </button>
              </>
            )}
          </div>
          <ul className="lx-trust lx-rise" style={{ animationDelay: '320ms' }}>
            <li><Check size={14} /> Plan gratuito sin tarjeta</li>
            <li><ShieldCheck size={14} /> 2FA con Google Authenticator</li>
            <li><Send size={14} /> Alertas en Telegram</li>
          </ul>
        </div>

        {/* Live market card: every number here comes from the backend */}
        <aside className="lx-market lx-rise" style={{ animationDelay: '200ms' }} aria-label="Mercado en vivo">
          <div className="lx-market-head">
            <span className="lx-live"><span className="lx-dot" /> Mercado ahora</span>
            <span className="lx-muted">{rates?.updated_at ? `Actualizado ${rates.updated_at}` : 'Tasas en vivo'}</span>
          </div>
          <div className="lx-rates">
            <div className="lx-rate">
              <span className="lx-rate-label"><Landmark size={13} /> Dólar BCV</span>
              <strong>{hasRates ? <CountUp value={rates!.bcv} format={formatVES} /> : '—'}</strong>
            </div>
            <div className="lx-rate">
              <span className="lx-rate-label"><Coins size={13} /> USDT P2P</span>
              <strong>{hasRates ? <CountUp value={rates!.usdt} format={formatVES} /> : '—'}</strong>
            </div>
            <div className="lx-rate lx-rate-gap">
              <span className="lx-rate-label">Brecha</span>
              <strong>{hasRates ? <CountUp value={rates!.brecha_pct} format={(n) => `${n.toFixed(2)}%`} /> : '—'}</strong>
            </div>
          </div>
          <div className="lx-movers">
            <div className="lx-movers-title">Mayores movimientos de hoy en la BVC</div>
            {movers.length === 0 ? (
              <div className="lx-muted lx-movers-empty">Cargando la pizarra de la BVC…</div>
            ) : (
              <ul>
                {movers.map((t, i) => {
                  const up = t.change_pct > 0;
                  return (
                    <li key={t.symbol} style={{ animationDelay: `${380 + i * 70}ms` }}>
                      <span className="lx-tk">{t.symbol}</span>
                      <span className="lx-tk-name">{t.name}</span>
                      <span className="lx-tk-price">{formatVES(t.price)}</span>
                      <span className={`lx-chg ${up ? 'up' : 'down'}`}>
                        {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        {Math.abs(t.change_pct).toFixed(2)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </header>

      {/* NOMINAL ILLUSION */}
      <section className="lx-section lx-illusion" data-reveal>
        <div className="lx-section-head">
          <span className="lx-eyebrow">La ilusión nominal</span>
          <h2>Subir en bolívares no siempre es ganar</h2>
          <p>
            Si tu acción sube 25% pero el dólar sube 35% en el mismo tiempo, en dólares perdiste dinero.
            Mueve los valores y compruébalo.
          </p>
        </div>
        <div className="lx-calc">
          <div className="lx-calc-inputs">
            <label htmlFor="lx-stock-gain">
              <span>Tu acción subió en bolívares</span>
              <strong>+{stockGain}%</strong>
            </label>
            <input id="lx-stock-gain" type="range" min={0} max={150} value={stockGain} onChange={(e) => setStockGain(Number(e.target.value))} />
            <label htmlFor="lx-dollar-jump">
              <span>El dólar subió en el mismo período</span>
              <strong>+{dollarJump}%</strong>
            </label>
            <input id="lx-dollar-jump" type="range" min={0} max={150} value={dollarJump} onChange={(e) => setDollarJump(Number(e.target.value))} />
          </div>
          <div className={`lx-calc-result ${realReturn >= 0 ? 'up' : 'down'}`} aria-live="polite">
            <span className="lx-muted">Tu rendimiento real en dólares</span>
            <strong className="lx-calc-big">{realReturn >= 0 ? '+' : ''}{realReturn.toFixed(2)}%</strong>
            <p>
              {realReturn >= 0
                ? 'Le ganaste a la devaluación: tu poder de compra creció.'
                : 'Ganaste en bolívares, pero perdiste poder de compra en dólares.'}
            </p>
            <div className="lx-bars" aria-hidden="true">
              <div className="lx-bar"><span>En Bs</span><i style={{ width: `${Math.min(100, stockGain / 1.5)}%` }} /></div>
              <div className="lx-bar lx-bar-dollar"><span>Dólar</span><i style={{ width: `${Math.min(100, dollarJump / 1.5)}%` }} /></div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lx-section" id="funciones" data-reveal>
        <div className="lx-section-head">
          <span className="lx-eyebrow">Funciones</span>
          <h2>Todo lo que necesitas para seguir tu cartera</h2>
        </div>
        <div className="lx-features">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <article key={title} className="lx-feature" data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
              <span className="lx-feature-icon"><Icon size={20} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS (a real sequence, so the numbers carry meaning) */}
      <section className="lx-section" id="como-funciona" data-reveal>
        <div className="lx-section-head">
          <span className="lx-eyebrow">Cómo funciona</span>
          <h2>Empieza en tres pasos</h2>
        </div>
        <ol className="lx-steps">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="lx-step" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="lx-step-num">{i + 1}</span>
              <span className="lx-step-icon"><Icon size={18} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* PRICING */}
      <section className="lx-section" id="precios" data-reveal>
        <div className="lx-section-head">
          <span className="lx-eyebrow">Precios</span>
          <h2>Gratis para empezar, PRO cuando lo necesites</h2>
        </div>
        <div className="lx-pricing">
          <article className="lx-plan">
            <h3>Gratuito</h3>
            <div className="lx-price"><strong>0</strong><span>USDT / mes</span></div>
            <ul>
              <li><Check size={15} /> Portafolio en Bs, dólar BCV y USDT</li>
              <li><Check size={15} /> Pizarra de la BVC y Wall Street</li>
              <li><Check size={15} /> Simulador What-If</li>
              <li><Check size={15} /> Alertas en Telegram</li>
              <li><Check size={15} /> 10 consultas al mes a KixInvert AI</li>
            </ul>
            <button type="button" className="lx-btn lx-btn-ghost lx-btn-block" onClick={session ? onGoTerminal : register}>
              {session ? 'Ir al terminal' : 'Crear cuenta gratis'}
            </button>
          </article>
          <article className="lx-plan lx-plan-pro">
            <span className="lx-plan-tag"><Crown size={13} /> PRO</span>
            <h3>PRO</h3>
            <div className="lx-price"><strong>5</strong><span>USDT / mes</span></div>
            <ul>
              <li><Check size={15} /> Todo lo del plan gratuito</li>
              <li><Check size={15} /> Consultas ilimitadas a KixInvert AI</li>
              <li><Check size={15} /> Pago con Binance Pay</li>
            </ul>
            <button type="button" className="lx-btn lx-btn-primary lx-btn-block" onClick={session ? onGoTerminal : register}>
              {session ? 'Activar desde el terminal' : 'Empezar y pasar a PRO'}
            </button>
          </article>
        </div>
      </section>

      {/* FAQ */}
      <section className="lx-section" id="faq" data-reveal>
        <div className="lx-section-head">
          <span className="lx-eyebrow">Preguntas frecuentes</span>
          <h2>Lo que suelen preguntarnos</h2>
        </div>
        <div className="lx-faq">
          {FAQ.map((item, idx) => {
            const open = openFaq === idx;
            return (
              <div key={item.q} className={`lx-faq-item ${open ? 'open' : ''}`}>
                <button
                  type="button"
                  id={`lx-faq-q-${idx}`}
                  aria-expanded={open}
                  aria-controls={`lx-faq-a-${idx}`}
                  onClick={() => setOpenFaq(open ? null : idx)}
                >
                  <span>{item.q}</span>
                  <ChevronDown size={18} />
                </button>
                <div id={`lx-faq-a-${idx}`} role="region" aria-labelledby={`lx-faq-q-${idx}`} className="lx-faq-a">
                  <div><p>{item.a}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="lx-final" data-reveal>
        <h2>Empieza a medir tu cartera en dólares reales</h2>
        <p>Crea tu cuenta gratis y registra tu primera compra en menos de un minuto.</p>
        <div className="lx-cta lx-cta-center">
          {session ? (
            <button type="button" className="lx-btn lx-btn-primary" onClick={onGoTerminal}>
              Ir a mi terminal <ArrowRight size={16} />
            </button>
          ) : (
            <>
              <button type="button" className="lx-btn lx-btn-primary" onClick={register}>
                Crear cuenta gratis <ArrowRight size={16} />
              </button>
              <button type="button" className="lx-btn lx-btn-ghost" onClick={login}>
                <KeyRound size={15} /> Iniciar sesión
              </button>
            </>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lx-footer">
        <div className="lx-footer-row">
          <span className="lx-brand"><span className="lx-brand-mark"><TrendingUp size={14} /></span>KixInvert</span>
          <div className="lx-footer-links">
            <a href="https://t.me/KixInvert_bot" target="_blank" rel="noopener noreferrer"><Send size={14} /> @KixInvert_bot</a>
            <span><Mail size={14} /> soporte@kixinvert.com</span>
          </div>
        </div>
        <p className="lx-disclaimer">
          KixInvert es una herramienta de seguimiento y análisis. Las señales y respuestas del asistente son informativas y no
          constituyen asesoría financiera. Invertir en bolsa implica riesgo de pérdida.
        </p>
        <p className="lx-muted lx-copy">© 2026 KixInvert</p>
      </footer>
    </div>
  );
};
