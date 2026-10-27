'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  UserPlus,
  Lock,
  LogOut,
  Zap,
  Coins,
  TrendingUp,
  Bot,
  Globe,
  Sliders,
  Send,
  Check,
  X,
  Crown,
  Calendar,
  AlertTriangle,
  Layers,
  ChevronDown,
  Mail,
  Briefcase,
  Clock,
  ShieldCheck,
  ShieldAlert,
  PlayCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';
import { TickerTape } from './TickerTape';
import { UserSession, BvcTicker, InternationalQuote, Ecosystem } from '@/types';
import {
  AnimatedPulseBeacon,
  AnimatedTelegram,
  AnimatedSparkles,
  AnimatedTrend,
} from './AnimatedIcons';
import { playTerminalSound } from '@/lib/audio';

interface WelcomeLandingProps {
  onEnterDemo: () => void;
  onOpenRegister: () => void;
  onOpenLogin: () => void;
  onGoTerminal?: () => void;
  session?: UserSession | null;
  onLogout?: () => void;
  bvcTickers?: BvcTicker[];
  intlTickers?: InternationalQuote[];
  currentEcosystem?: Ecosystem;
}

export const WelcomeLanding: React.FC<WelcomeLandingProps> = ({
  onEnterDemo,
  onOpenRegister,
  onOpenLogin,
  onGoTerminal,
  session,
  onLogout,
  bvcTickers,
  intlTickers,
  currentEcosystem,
}) => {
  // FAQ accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Contact form state
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    topic: 'pro_subscription',
    message: '',
  });

  const toggleFaq = (idx: number) => {
    playTerminalSound('click');
    setOpenFaqIndex((prev) => (prev === idx ? null : idx));
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playTerminalSound('success');
    setContactSubmitted(true);
    setTimeout(() => {
      setContactSubmitted(false);
      setContactForm({ name: '', email: '', topic: 'pro_subscription', message: '' });
    }, 4500);
  };

  return (
    <div className="welcome-view-container" style={{ width: '100%', maxWidth: '1280px', margin: '0 auto' }}>
      {/* 1. FLOATING LANDING QUICK SUB-NAVBAR */}
      <nav className="welcome-nav-bar glass-panel animate-fade-in" id="welcome-subnav">
        <div className="welcome-nav-brand">
          <AnimatedPulseBeacon color="#7c8cff" size={8} />
          <span className="welcome-nav-brand-text">
            KixInvertAPP <span className="badge-v6">v6.0</span>
          </span>
        </div>

        <div className="welcome-nav-links">
          <a href="#sec-story" className="welcome-nav-link" onClick={() => playTerminalSound('click')}>
            Historia
          </a>
          <a href="#sec-gallery" className="welcome-nav-link" onClick={() => playTerminalSound('click')}>
            Galería
          </a>
          <a href="#sec-features" className="welcome-nav-link" onClick={() => playTerminalSound('click')}>
            Funciones
          </a>
          <a href="#sec-pricing" className="welcome-nav-link" onClick={() => playTerminalSound('click')}>
            Precios
          </a>
          <a href="#sec-changelog" className="welcome-nav-link" onClick={() => playTerminalSound('click')}>
            Changelog
          </a>
          <a href="#sec-faq" className="welcome-nav-link" onClick={() => playTerminalSound('click')}>
            FAQ
          </a>
          <a href="#sec-contact" className="welcome-nav-link" onClick={() => playTerminalSound('click')}>
            Contacto
          </a>
        </div>

        <div className="welcome-nav-cta" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onGoTerminal && (
            <button
              className="btn-nav-terminal"
              onClick={() => {
                playTerminalSound('click');
                onGoTerminal();
              }}
              title="Ir directamente al Terminal Bursátil en Vivo"
            >
              <TrendingUp size={14} /> Abrir Terminal
            </button>
          )}
          <button
            className="btn-nav-demo"
            onClick={() => {
              playTerminalSound('success');
              onEnterDemo();
            }}
          >
            <PlayCircle size={15} /> Probar Demo
          </button>
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="nav-user-pill">
                <span className="user-online-dot"></span>
                {session.username}
              </span>
              {onLogout && (
                <button
                  className="btn-nav-logout"
                  onClick={() => {
                    playTerminalSound('click');
                    onLogout();
                  }}
                  title="Cerrar Sesión"
                >
                  <LogOut size={13} />
                </button>
              )}
            </div>
          ) : (
            <button
              className="btn-hero-secondary"
              style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '20px' }}
              onClick={() => {
                playTerminalSound('click');
                onOpenLogin();
              }}
            >
              <Lock size={13} /> Entrar
            </button>
          )}
        </div>
      </nav>

      {/* Live Financial Ticker on Landing */}
      {bvcTickers && bvcTickers.length > 0 && (
        <div style={{ margin: '0 auto 16px auto', maxWidth: '1240px', width: 'calc(100% - 32px)' }}>
          <TickerTape
            tickers={bvcTickers}
            intlTickers={intlTickers}
            currentEcosystem={currentEcosystem || 'BVC'}
            onSelectTicker={() => {
              if (onGoTerminal) onGoTerminal();
            }}
          />
        </div>
      )}

      {/* 2. HERO SECTION */}
      <section className="welcome-hero glass-panel">
        <div className="hero-glow-blob blob-1"></div>
        <div className="hero-glow-blob blob-2"></div>

        <div className="hero-content">
          <div className="hero-badge">
            <span className="pulse-dot"></span>
            <span>TERMINAL BURSÁTIL BVC & WALL STREET · VERSIÓN 6.0 OFICIAL</span>
          </div>

          <h1 className="hero-title">
            Domina la Rueda Bursátil: Protección Patrimonial contra la Devaluación en{' '}
            <span className="gradient-text">Caracas y Wall Street</span>
          </h1>

          <p className="hero-description">
            Bienvenido a <strong>KixInvertAPP</strong>, la primera plataforma financiera con motor{' '}
            <strong>Tri-Monetario (VES, BCV y USDT)</strong> diseñada para eliminar la ilusión nominal en Venezuela.
            Monitorea las 46 acciones de la <strong>Bolsa de Valores de Caracas (BVC)</strong>, invierte en gigantes
            de <strong>Wall Street (NYSE / NASDAQ)</strong>, ejecuta señales tácticas cuantitativas y recibe alertas push
            instantáneas en Telegram.
          </p>

          <div className="hero-actions">
            <button
              className="btn-hero-primary"
              id="btn-hero-register"
              onClick={() => {
                playTerminalSound('success');
                onOpenRegister();
              }}
            >
              <UserPlus size={18} /> Crear Cuenta Gratis
            </button>
            <button
              className="btn-hero-secondary"
              id="btn-hero-login"
              onClick={() => {
                playTerminalSound('click');
                onOpenLogin();
              }}
            >
              <Lock size={18} /> Iniciar Sesión
            </button>
            <button
              className="btn-hero-accent"
              id="btn-hero-explore-demo"
              onClick={() => {
                playTerminalSound('success');
                onEnterDemo();
              }}
            >
              <Zap size={18} /> Probar Demo en Vivo
            </button>
          </div>

          <div className="hero-stats-row">
            <div className="hero-stat-item">
              <span className="stat-number">46</span>
              <span className="stat-label">Títulos BVC Caracas en Vivo</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <span className="stat-number">15+</span>
              <span className="stat-label">Wall Street (AAPL, NVDA, SPY)</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <span className="stat-number">Tri-Moneda</span>
              <span className="stat-label">VES • Dólar BCV • USDT Binance</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <span className="stat-number">IA + Bot</span>
              <span className="stat-label">Analista IA & Push Telegram</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HISTORIA DEL PRODUCTO SECTION */}
      <section className="welcome-story-section" id="sec-story">
        <div className="section-badge-center">
          <Layers size={14} /> NUESTRA HISTORIA Y MISIÓN
        </div>
        <h2 className="section-title-large text-center">
          Por qué creamos KixInvertAPP: La solución a la Ilusión Nominal
        </h2>
        <p className="section-subtitle-center text-center">
          Nacimos para resolver el mayor dilema de los inversionistas venezolanos: el impacto destructivo del desfase cambiario en las acciones locales.
        </p>

        <div className="story-grid">
          {/* Story Block 1 */}
          <SpotlightCard className="story-card" spotlightColor="rgba(229, 97, 110, 0.15)">
            <div className="story-card-icon bg-rose">
              <AlertTriangle size={24} />
            </div>
            <h3>1. El Dilema de la Ilusión Nominal</h3>
            <p>
              Invertir en la Bolsa de Caracas tradicionalmente significaba volar a ciegas. Una acción podía subir{' '}
              <strong>+25% en Bolívares</strong> en una semana, pero si la tasa del dólar libre saltaba <strong>+35%</strong>{' '}
              en el mismo período, el inversionista en realidad había <strong>perdido un 10% de su poder adquisitivo en dólares</strong>{' '}
              sin darse cuenta. Las plataformas bancarias tradicionales solo muestran bolívares, ocultando esta erosión patrimonial.
            </p>
          </SpotlightCard>

          {/* Story Block 2 */}
          <SpotlightCard className="story-card highlighted-border" spotlightColor="rgba(124, 140, 255, 0.18)">
            <div className="story-card-icon bg-cyan">
              <Layers size={24} />
            </div>
            <h3>2. La Solución Tri-Monetaria en Tiempo Real</h3>
            <p>
              KixInvertAPP fue fundada por operadores bursátiles y desarrolladores para terminar con la ceguera cambiaria. Desarrollamos un motor cuantitativo que sincroniza cada rueda bursátil de la BVC con los tipos de cambio oficiales del{' '}
              <strong>Banco Central de Venezuela (BCV)</strong> y el mercado libre <strong>(Binance P2P USDT)</strong>. Cada posición calcula al segundo su rentabilidad real en moneda dura y advierte del rezago cambiario.
            </p>
          </SpotlightCard>

          {/* Story Block 3 */}
          <SpotlightCard className="story-card" spotlightColor="rgba(124, 140, 255, 0.15)">
            <div className="story-card-icon bg-purple">
              <Globe size={24} />
            </div>
            <h3>3. De Caracas a Wall Street & Móvil</h3>
            <p>
              Nuestra comunidad exigía diversificar el riesgo país. Integramos <strong>Wall Street en dólares nativos</strong>, permitiendo gestionar en una misma terminal títulos de Caracas (BNC, Mercantil, Santa Teresa) junto a gigantes globales (Apple, NVIDIA, S&P 500). Hoy, con la versión 6.0, KixInvertAPP es un ecosistema SaaS institucional con analista IA, simulador de estrés cambiario What-If y alertas móviles en Telegram.
            </p>
          </SpotlightCard>
        </div>

        {/* Story Metrics Bar */}
        <div className="story-metrics-bar glass-panel" style={{ marginTop: '32px' }}>
          <div className="story-metric">
            <strong className="metric-big text-cyan">+Bs 250M+</strong>
            <span>Operaciones de mercado analizadas en rueda bursátil</span>
          </div>
          <div className="story-metric-divider"></div>
          <div className="story-metric">
            <strong className="metric-big text-green">100%</strong>
            <span>Protección transparente contra el desfase cambiario</span>
          </div>
          <div className="story-metric-divider"></div>
          <div className="story-metric">
            <strong className="metric-big text-amber">&lt; 3 seg</strong>
            <span>Tiempo de cálculo para señales de compra y venta</span>
          </div>
        </div>
      </section>

      {/* 4. VISUAL SHOWCASE: 3 PROJECT IMAGES */}
      <section className="welcome-gallery-section" id="sec-gallery">
        <div className="gallery-header text-center">
          <div className="section-badge-center">
            <Sparkles size={14} /> VISTA PREVIA DEL SISTEMA
          </div>
          <h2>El Terminal en Funcionamiento Real</h2>
          <p className="subtitle">
            Ecosistemas especializados, aislados y diseñados bajo estándares de Bloomberg Terminal
          </p>
        </div>

        <div className="gallery-grid">
          {/* Card 1: Ecosistema BVC Caracas */}
          <SpotlightCard className="gallery-card" spotlightColor="rgba(124, 140, 255, 0.15)">
            <div className="gallery-img-wrapper" style={{ position: 'relative', height: '220px' }}>
              <Image
                src="/img/preview-dashboard.png"
                alt="Ecosistema BVC Caracas KixInvertAPP"
                fill
                style={{ objectFit: 'cover', objectPosition: 'top' }}
              />
              <div className="img-badge">Terminal BVC Caracas</div>
            </div>
            <div className="gallery-card-body">
              <h3>1. Terminal BVC (Bolsa de Caracas)</h3>
              <p>
                Ecosistema especializado en acciones venezolanas (BNC, Mercantil, Santa Teresa). Monitoreo simultáneo en{' '}
                <strong>Bolívares (VES)</strong>, <strong>Dólar BCV</strong> y <strong>USDT Binance</strong> con medidor en vivo de{' '}
                <strong>Brecha Cambiaria</strong>.
              </p>
            </div>
          </SpotlightCard>

          {/* Card 2: Ecosistema Wall Street Global */}
          <SpotlightCard className="gallery-card" spotlightColor="rgba(124, 140, 255, 0.15)">
            <div className="gallery-img-wrapper" style={{ position: 'relative', height: '220px' }}>
              <Image
                src="/img/preview-positions.png"
                alt="Ecosistema Wall Street KixInvertAPP"
                fill
                style={{ objectFit: 'cover', objectPosition: 'top' }}
              />
              <div className="img-badge">Terminal Wall Street</div>
            </div>
            <div className="gallery-card-body">
              <h3>2. Terminal Wall Street & ETFs</h3>
              <p>
                Ecosistema independiente en Dólares (USD). Monitorea gigantes como{' '}
                <strong>Apple, NVIDIA, Tesla, Microsoft</strong> y fondos globales como el <strong>S&P 500 (SPY)</strong> y{' '}
                <strong>Nasdaq 100 (QQQ)</strong> con cotizaciones en tiempo real.
              </p>
            </div>
          </SpotlightCard>

          {/* Card 3: Patrimonio Consolidado & AI */}
          <SpotlightCard className="gallery-card" spotlightColor="rgba(124, 140, 255, 0.15)">
            <div className="gallery-img-wrapper" style={{ position: 'relative', height: '220px' }}>
              <Image
                src="/img/preview-allocation.png"
                alt="Patrimonio Consolidado KixInvertAPP"
                fill
                style={{ objectFit: 'cover', objectPosition: 'top' }}
              />
              <div className="img-badge">Patrimonio Consolidado</div>
            </div>
            <div className="gallery-card-body">
              <h3>3. Consolidación Global & AI</h3>
              <p>
                Visualiza tu patrimonio neto total unificado sin mezclar tus operaciones. Tu analista bursátil autónomo{' '}
                <strong>KixInvert AI</strong> te asesora sobre diversificación bimonetaria entre Caracas y Nueva York.
              </p>
            </div>
          </SpotlightCard>
        </div>
      </section>

      {/* 5. FEATURE PILLARS SECTION */}
      <section className="welcome-features-section" id="sec-features">
        <div className="section-badge-center">
          <Zap size={14} /> TECNOLOGÍA BURSÁTIL INSTITUCIONAL
        </div>
        <h2 className="section-title-large text-center">Seis Pilares de Alto Rendimiento para tu Portafolio</h2>
        <p className="section-subtitle-center text-center">
          Herramientas profesionales que reemplazan múltiples hojas de Excel por un sistema automático e infalible.
        </p>

        <div className="features-grid-6">
          <SpotlightCard className="feature-box" spotlightColor="rgba(124, 140, 255, 0.15)">
            <div className="feature-icon bg-green">
              <Coins size={24} />
            </div>
            <h4>1. Matemática Tri-Monetaria</h4>
            <p>
              Calcula automáticamente la equivalencia en Bolívares, Dólares BCV y USDT de Binance P2P para cada título, detectando el rendimiento real en moneda dura.
            </p>
          </SpotlightCard>

          <SpotlightCard className="feature-box" spotlightColor="rgba(217, 164, 65, 0.15)">
            <div className="feature-icon bg-amber">
              <TrendingUp size={24} />
            </div>
            <h4>2. Señales Tácticas Cuantitativas</h4>
            <p>
              Badges en vivo que te indican cuándo tomar ganancias (+25% a +40% USDT), cuándo comprar en descuento cambiario y cuándo rotar títulos por rezago.
            </p>
          </SpotlightCard>

          <SpotlightCard className="feature-box" spotlightColor="rgba(124, 140, 255, 0.15)">
            <div className="feature-icon bg-purple">
              <Bot size={24} />
            </div>
            <h4>3. Analista KixInvert AI</h4>
            <p>
              Diagnóstico conversacional multi-turno con IA bursátil que evalúa la salud de tu cartera, calcula cobertura contra la devaluación y sugiere rebalanceos exactos.
            </p>
          </SpotlightCard>

          <SpotlightCard className="feature-box" spotlightColor="rgba(124, 140, 255, 0.15)">
            <div className="feature-icon bg-blue">
              <Globe size={24} />
            </div>
            <h4>4. Terminal Wall Street Integrada</h4>
            <p>
              Invierte en acciones de EE.UU. (NYSE / NASDAQ) con cotizaciones en vivo en USD. Cero confusiones cambiarias gracias a la separación estricta de ecosistemas.
            </p>
          </SpotlightCard>

          <SpotlightCard className="feature-box" spotlightColor="rgba(124, 140, 255, 0.15)">
            <div className="feature-icon bg-cyan">
              <Sliders size={24} />
            </div>
            <h4>5. Simulador What-If & PDF</h4>
            <p>
              Modela saltos del dólar BCV (+15%, +30%, +50%) y choques de mercado. Emite estados de cuenta ejecutivos A4 en PDF listos para imprimir con un clic.
            </p>
          </SpotlightCard>

          <SpotlightCard className="feature-box" spotlightColor="rgba(0, 136, 204, 0.15)">
            <div className="feature-icon bg-telegram">
              <Send size={24} />
            </div>
            <h4>6. Bot de Telegram Móvil</h4>
            <p>
              Recibe alertas push instantáneas en tu celular con @KixInvert_bot ante brechas cambiarias críticas (&gt;=18%) y consulta tus saldos con el comando /balance.
            </p>
          </SpotlightCard>
        </div>
      </section>

      {/* 6. PRICING & SUBSCRIPTION SECTION */}
      <section className="welcome-pricing-section" id="sec-pricing">
        <div className="section-badge-center">
          <Crown size={14} /> PRECIOS Y PLANES
        </div>
        <h2 className="section-title-large text-center">Inversión Inteligente a un Precio Transparente</h2>
        <p className="section-subtitle-center text-center">
          Paga en USDT con Binance Pay (sin comisiones), Pago Móvil en Bolívares o Tarjeta Internacional. Cancela cuando quieras.
        </p>

        <div className="pricing-grid">
          {/* Plan Free */}
          <SpotlightCard className="pricing-card" spotlightColor="rgba(255, 255, 255, 0.08)">
            <div className="pricing-header">
              <span className="plan-tag">INVERSIONISTA INICIAL</span>
              <h3 className="plan-name">Plan Free</h3>
              <p className="plan-desc">Para inversionistas particulares que desean monitorear su cartera sin costo.</p>
              <div className="plan-price">
                <span className="currency">$</span>
                <span className="amount">0</span>
                <span className="period">/ siempre gratis</span>
              </div>
            </div>

            <ul className="plan-features">
              <li><Check size={16} className="text-green" /> Monitoreo Tri-Monetario (VES / BCV / USDT)</li>
              <li><Check size={16} className="text-green" /> Posiciones ilimitadas en BVC y Wall Street</li>
              <li><Check size={16} className="text-green" /> Pizarra bursátil en tiempo real</li>
              <li><Check size={16} className="text-green" /> 10 consultas mensuales a KixInvert AI</li>
              <li><Check size={16} className="text-green" /> Medidor de brecha cambiaria en vivo</li>
              <li className="disabled"><X size={16} /> Alertas móviles 24/7 en Telegram</li>
              <li className="disabled"><X size={16} /> Simulador What-If ilimitado</li>
              <li className="disabled"><X size={16} /> Reportes Ejecutivos PDF descargables</li>
            </ul>

            <button
              className="btn-plan-secondary"
              onClick={() => {
                playTerminalSound('click');
                onOpenRegister();
              }}
            >
              Comenzar Gratis
            </button>
          </SpotlightCard>

          {/* Plan PRO (Featured) */}
          <SpotlightCard className="pricing-card featured-pricing" spotlightColor="rgba(124, 140, 255, 0.22)">
            <div className="featured-badge">
              <Crown size={14} /> MÁS POPULAR
            </div>
            <div className="pricing-header">
              <span className="plan-tag text-cyan">INVERSIONISTA ACTIVO</span>
              <h3 className="plan-name">Plan PRO Ilimitado</h3>
              <p className="plan-desc">Para operadores bursátiles exigentes que demandan señales cuantitativas y alertas móviles.</p>
              <div className="plan-price">
                <span className="currency">$</span>
                <span className="amount">7</span>
                <span className="period">/ mes (o equivalente en Bs / USDT)</span>
              </div>
            </div>

            <ul className="plan-features">
              <li><Check size={16} className="text-cyan" /> <strong>Todo lo incluido en el Plan Free</strong></li>
              <li><Check size={16} className="text-cyan" /> <strong>Consultas ILIMITADAS a KixInvert AI</strong></li>
              <li><Check size={16} className="text-cyan" /> <strong>Bot de Telegram @KixInvert_bot 24/7</strong></li>
              <li><Check size={16} className="text-cyan" /> <strong>Simulador What-If de Devaluación ilimitado</strong></li>
              <li><Check size={16} className="text-cyan" /> <strong>Reportes Ejecutivos Oficiales en PDF A4</strong></li>
              <li><Check size={16} className="text-cyan" /> <strong>Detalle de Señales Tácticas</strong> con precios objetivo</li>
              <li><Check size={16} className="text-cyan" /> Pagos en Binance Pay USDT o Pago Móvil VES</li>
            </ul>

            <button
              className="btn-plan-primary"
              onClick={() => {
                playTerminalSound('success');
                onOpenRegister();
              }}
            >
              <Zap size={16} /> Suscribirme a PRO
            </button>
          </SpotlightCard>

          {/* Plan Institucional */}
          <SpotlightCard className="pricing-card" spotlightColor="rgba(255, 255, 255, 0.08)">
            <div className="pricing-header">
              <span className="plan-tag">CASAS DE BOLSA & FONDOS</span>
              <h3 className="plan-name">Plan Institucional</h3>
              <p className="plan-desc">Para corredores bursátiles, firmas de corretaje y asesores de inversión registrados.</p>
              <div className="plan-price">
                <span className="amount-custom">Personalizado</span>
                <span className="period">/ facturación corporativa</span>
              </div>
            </div>

            <ul className="plan-features">
              <li><Check size={16} className="text-green" /> Multi-portafolio consolidado de clientes</li>
              <li><Check size={16} className="text-green" /> Reportes PDF con marca blanca y logo propio</li>
              <li><Check size={16} className="text-green" /> API Webhook para sincronizar sistemas internos</li>
              <li><Check size={16} className="text-green" /> Acceso a data histórica de transacciones BVC</li>
              <li><Check size={16} className="text-green" /> Canal de soporte prioritario directo vía Telegram/WhatsApp</li>
            </ul>

            <a
              href="#sec-contact"
              className="btn-plan-secondary"
              onClick={() => playTerminalSound('click')}
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
            >
              Contactar Asesor Institucional
            </a>
          </SpotlightCard>
        </div>
      </section>

      {/* 7. CHANGELOG / PRODUCT TIMELINE SECTION */}
      <section className="welcome-changelog-section" id="sec-changelog">
        <div className="section-badge-center">
          <Calendar size={14} /> REGISTRO DE VERSIONES
        </div>
        <h2 className="section-title-large text-center">Evolución Continua · Changelog KixInvertAPP</h2>
        <p className="section-subtitle-center text-center">
          Desarrollo ágil e iterativo enfocado en resolver las necesidades reales de los inversionistas.
        </p>

        <div className="changelog-timeline">
          {/* Release v6.0 */}
          <div className="changelog-item">
            <div className="cl-point active-point"></div>
            <SpotlightCard className="cl-card" spotlightColor="rgba(124, 140, 255, 0.15)">
              <div className="cl-header">
                <span className="cl-version-badge badge-current">v6.0 · VERSIÓN ACTUAL</span>
                <span className="cl-date"><Calendar size={14} /> Octubre 2026</span>
              </div>
              <h3 className="cl-title">Bot de Telegram (@KixInvert_bot) & Alertas Push Móviles</h3>
              <p className="cl-desc">Lanzamiento del canal móvil en tiempo real para no tener que estar frente a la pantalla todo el día.</p>
              <div className="cl-tags">
                <span className="cl-tag tag-new"><Check size={13} /> Bot Telegram Oficial</span>
                <span className="cl-tag tag-new"><Check size={13} /> Emparejamiento por código /start KIX-XXXX</span>
                <span className="cl-tag tag-new"><Check size={13} /> Alertas push de Brecha Crítica (&gt;=18%)</span>
                <span className="cl-tag tag-new"><Check size={13} /> Comandos /balance, /alertas y /ayuda</span>
              </div>
            </SpotlightCard>
          </div>

          {/* Release v5.0 */}
          <div className="changelog-item">
            <div className="cl-point"></div>
            <SpotlightCard className="cl-card" spotlightColor="rgba(124, 140, 255, 0.12)">
              <div className="cl-header">
                <span className="cl-version-badge">v5.0</span>
                <span className="cl-date"><Calendar size={14} /> Octubre 2026</span>
              </div>
              <h3 className="cl-title">Simulador de Estrés What-If & Reportes Ejecutivos PDF</h3>
              <p className="cl-desc">Herramientas matemáticas para planificar escenarios de devaluación y emitir estados de cuenta bancarios.</p>
              <div className="cl-tags">
                <span className="cl-tag tag-new"><Check size={13} /> Simulador What-If (+15%, +30%, +50% BCV)</span>
                <span className="cl-tag tag-new"><Check size={13} /> Reportes Ejecutivos A4 imprimibles</span>
                <span className="cl-tag tag-improve"><ShieldCheck size={13} /> Medición de poder adquisitivo salvado vs efectivo</span>
              </div>
            </SpotlightCard>
          </div>

          {/* Release v4.0 */}
          <div className="changelog-item">
            <div className="cl-point"></div>
            <SpotlightCard className="cl-card" spotlightColor="rgba(255, 255, 255, 0.08)">
              <div className="cl-header">
                <span className="cl-version-badge">v4.0</span>
                <span className="cl-date"><Calendar size={14} /> Octubre 2026</span>
              </div>
              <h3 className="cl-title">Centro de Notificaciones Inteligente & Feed Bursátil</h3>
              <p className="cl-desc">Campanita en el navbar con categorización de alertas y algoritmo de deduplicación de 4 horas.</p>
              <div className="cl-tags">
                <span className="cl-tag tag-new"><Check size={13} /> Filtros de alertas (Tácticas / Mercado)</span>
                <span className="cl-tag tag-improve"><Sliders size={13} /> Ventana de deduplicación inteligente anti-spam</span>
              </div>
            </SpotlightCard>
          </div>

          {/* Release v3.0 */}
          <div className="changelog-item">
            <div className="cl-point"></div>
            <SpotlightCard className="cl-card" spotlightColor="rgba(255, 255, 255, 0.08)">
              <div className="cl-header">
                <span className="cl-version-badge">v3.0</span>
                <span className="cl-date"><Calendar size={14} /> Octubre 2026</span>
              </div>
              <h3 className="cl-title">Terminal Wall Street & Arquitectura Bimonetaria</h3>
              <p className="cl-desc">Integración de activos estadounidenses (NYSE/NASDAQ) con cotizaciones en vivo en USD vía Yahoo Finance.</p>
              <div className="cl-tags">
                <span className="cl-tag tag-new"><Check size={13} /> Cotizaciones en vivo de AAPL, NVDA, SPY, QQQ</span>
                <span className="cl-tag tag-improve"><Layers size={13} /> Aislamiento estricto de carteras Caracas vs. Nueva York</span>
              </div>
            </SpotlightCard>
          </div>

          {/* Release v2.0 */}
          <div className="changelog-item">
            <div className="cl-point"></div>
            <SpotlightCard className="cl-card" spotlightColor="rgba(255, 255, 255, 0.08)">
              <div className="cl-header">
                <span className="cl-version-badge">v2.0</span>
                <span className="cl-date"><Calendar size={14} /> Octubre 2026</span>
              </div>
              <h3 className="cl-title">Motor de Señales Tácticas Cuantitativas</h3>
              <p className="cl-desc">Detección matemática de toma de ganancias en dólares y riesgo de sobreconcentración.</p>
              <div className="cl-tags">
                <span className="cl-tag tag-new"><Check size={13} /> Badges de Vender 40% (+25% a +40% USDT)</span>
                <span className="cl-tag tag-improve"><Check size={13} /> Alerta de rotación por desfase cambiario</span>
              </div>
            </SpotlightCard>
          </div>

          {/* Release v1.0 */}
          <div className="changelog-item">
            <div className="cl-point"></div>
            <SpotlightCard className="cl-card" spotlightColor="rgba(255, 255, 255, 0.08)">
              <div className="cl-header">
                <span className="cl-version-badge">v1.0</span>
                <span className="cl-date"><Calendar size={14} /> Octubre 2026</span>
              </div>
              <h3 className="cl-title">Lanzamiento Fundacional del Terminal BVC Tri-Monetario</h3>
              <p className="cl-desc">El primer monitor bursátil de Venezuela con valuación simultánea en Bolívares, BCV y USDT.</p>
              <div className="cl-tags">
                <span className="cl-tag tag-new"><Check size={13} /> Scraping en vivo de 46 títulos de la BVC</span>
                <span className="cl-tag tag-new"><Check size={13} /> Conexión con tasas BCV y Binance P2P</span>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </section>

      {/* 8. FAQ SECTION */}
      <section className="welcome-faq-section" id="sec-faq">
        <div className="section-badge-center">
          <ShieldAlert size={14} /> PREGUNTAS FRECUENTES
        </div>
        <h2 className="section-title-large text-center">Respuestas a tus Dudas Financieras</h2>
        <p className="section-subtitle-center text-center">
          Todo lo que necesitas saber antes de registrarte en KixInvertAPP.
        </p>

        <div className="faq-accordion">
          {[
            {
              q: '¿Por qué KixInvertAPP calcula tres monedas diferentes para cada acción?',
              a: 'En Venezuela, una acción se compra en Bolívares (VES), pero su costo de reposición se rige por el Dólar Oficial BCV y su liquidez efectiva se compara con el Dólar Cripto USDT (Binance P2P). KixInvertAPP calcula las tres monedas en tiempo real para que sepas si tu ganancia nominal en bolívares supera la devaluación real y estás verdaderamente ganando dinero en moneda dura.',
            },
            {
              q: '¿Cómo funciona el Bot de Telegram (@KixInvert_bot)?',
              a: 'Una vez creada tu cuenta, puedes vincular tu Telegram en un solo clic enviando el comando /start KIX-XXXX a nuestro bot oficial. A partir de ese momento, el sistema te enviará alertas automáticas cada vez que la brecha cambiaria supere el 18% o cuando una acción de tu cartera alcance una señal táctica de toma de ganancias. Además, puedes escribirle /balance para consultar el saldo de tu cartera en cualquier momento.',
            },
            {
              q: '¿Puedo pagar el Plan PRO con métodos locales de Venezuela?',
              a: '¡Sí! Aceptamos Binance Pay USDT (pago automático en 5 segundos con 0% de comisiones), Pago Móvil en Bolívares (VES) a la tasa oficial, y tarjetas internacionales de débito/crédito.',
            },
            {
              q: '¿Mis datos financieros y compras de acciones son confidenciales?',
              a: 'Totalmente. Tus posiciones, compras y saldos están protegidos con cifrado de grado bancario (AES-256), autenticación por doble factor (2FA TOTP), y estricta separación de datos multi-inquilino. Ningún otro usuario ni tercero puede acceder a la composición de tu patrimonio.',
            },
            {
              q: '¿Puedo monitorear acciones de Caracas y Wall Street a la vez?',
              a: 'Sí. KixInvertAPP cuenta con dos ecosistemas especializados y estrictamente aislados: el Terminal BVC Caracas (en Bolívares y Dólares) y el Terminal Wall Street Global (en Dólares nativos). Puedes alternar entre ellos con un solo clic y consultar un banner superior que consolida tu patrimonio neto global sin mezclar tus operaciones.',
            },
            {
              q: '¿Qué es el Simulador de Estrés What-If?',
              a: 'Es una herramienta interactiva que te permite mover sliders para simular saltos en la tasa BCV (+15%, +30%, +50%) o cambios en la brecha cambiaria. El motor recalcula instantáneamente el valor proyectado de tu portafolio y te muestra exactamente cuántos dólares de poder adquisitivo salvaste al estar invertido en acciones en lugar de mantener bolívares ociosos en el banco.',
            },
          ].map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={idx} className={`faq-card glass-panel ${isOpen ? 'open' : ''}`}>
                <button type="button" className="faq-question-btn" onClick={() => toggleFaq(idx)}>
                  <span>{item.q}</span>
                  <ChevronDown
                    size={18}
                    className="faq-arrow"
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s ease',
                      color: isOpen ? '#9aa6ff' : '#9aa3b2',
                    }}
                  />
                </button>
                {isOpen && (
                  <div className="faq-answer-content">
                    <p>{item.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. CONTACT & SUPPORT SECTION */}
      <section className="welcome-contact-section" id="sec-contact">
        <div className="section-badge-center">
          <Mail size={14} /> MESA DE ATENCIÓN AL INVERSIONISTA
        </div>
        <h2 className="section-title-large text-center">¿Tienes Preguntas o Necesitas Soporte?</h2>
        <p className="section-subtitle-center text-center">
          Estamos a tu disposición para ayudarte a configurar tu terminal bursátil o responder dudas sobre el Plan PRO.
        </p>

        <div className="contact-grid">
          {/* Contact Direct Channels */}
          <SpotlightCard className="contact-info-card" spotlightColor="rgba(124, 140, 255, 0.15)">
            <h3>Canales Oficiales Directos</h3>
            <p className="text-dim text-sm">Nuestro equipo bursátil responde en menos de 2 horas durante ruedas de mercado.</p>

            <div className="contact-methods-list">
              <div className="contact-method-item">
                <div className="method-icon bg-telegram">
                  <AnimatedTelegram size={20} />
                </div>
                <div>
                  <strong>Bot & Canal Oficial Telegram</strong>
                  <span>
                    <a href="https://t.me/KixInvert_bot" target="_blank" rel="noopener noreferrer">
                      @KixInvert_bot
                    </a>
                  </span>
                </div>
              </div>

              <div className="contact-method-item">
                <div className="method-icon bg-cyan">
                  <Mail size={18} />
                </div>
                <div>
                  <strong>Correo de Soporte Técnico</strong>
                  <span>soporte@kixinvert.com</span>
                </div>
              </div>

              <div className="contact-method-item">
                <div className="method-icon bg-blue">
                  <Briefcase size={18} />
                </div>
                <div>
                  <strong>Ventas & Planes Institucionales</strong>
                  <span>ventas@kixinvert.com</span>
                </div>
              </div>

              <div className="contact-method-item">
                <div className="method-icon bg-green">
                  <Clock size={18} />
                </div>
                <div>
                  <strong>Horario Rueda Bursátil BVC</strong>
                  <span>Lunes a Viernes · 8:30 AM a 5:00 PM (Hora Caracas)</span>
                </div>
              </div>
            </div>
          </SpotlightCard>

          {/* Interactive Contact Form */}
          <SpotlightCard className="contact-form-card" spotlightColor="rgba(124, 140, 255, 0.15)">
            <h3>Envíanos un Mensaje</h3>
            {contactSubmitted ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ color: '#7c8cff', marginBottom: '12px' }}>
                  <ShieldCheck size={48} style={{ margin: '0 auto' }} />
                </div>
                <h4 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '8px' }}>¡Mensaje Enviado con Éxito!</h4>
                <p style={{ color: '#9aa3b2', fontSize: '0.9rem' }}>
                  Un asesor bursátil se comunicará contigo a tu correo en menos de 2 horas.
                </p>
              </div>
            ) : (
              <form id="landing-contact-form" onSubmit={handleContactSubmit}>
                <div className="form-group-contact">
                  <label htmlFor="contact-name">Nombre y Apellido</label>
                  <input
                    type="text"
                    id="contact-name"
                    className="contact-input"
                    placeholder="Tu nombre completo"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-contact">
                  <label htmlFor="contact-email">Correo Electrónico</label>
                  <input
                    type="email"
                    id="contact-email"
                    className="contact-input"
                    placeholder="tu.correo@ejemplo.com"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-contact">
                  <label htmlFor="contact-topic">Tipo de Consulta</label>
                  <select
                    id="contact-topic"
                    className="contact-select"
                    value={contactForm.topic}
                    onChange={(e) => setContactForm({ ...contactForm, topic: e.target.value })}
                  >
                    <option value="pro_subscription">Consulta sobre el Plan PRO y Pagos</option>
                    <option value="technical_support">Soporte Técnico / Conexión de Bot</option>
                    <option value="institutional">Plan Institucional para Casas de Bolsa</option>
                    <option value="general">Duda General sobre la Plataforma</option>
                  </select>
                </div>

                <div className="form-group-contact">
                  <label htmlFor="contact-message">Mensaje</label>
                  <textarea
                    id="contact-message"
                    className="contact-textarea"
                    rows={4}
                    placeholder="Escribe tu consulta aquí..."
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    required
                  ></textarea>
                </div>

                <button type="submit" className="btn-submit-contact" id="btn-submit-contact">
                  <Send size={16} /> Enviar Mensaje a la Mesa de Asistencia
                </button>
              </form>
            )}
          </SpotlightCard>
        </div>
      </section>

      {/* 10. FINAL WELCOME CTA */}
      <section className="welcome-cta-banner glass-panel" style={{ marginTop: '48px' }}>
        <div className="cta-banner-content">
          <h2>¿Listo para elevar tus decisiones en la Bolsa de Caracas?</h2>
          <p>Crea tu cuenta de inversionista en 30 segundos y comienza a monitorear tu capital con claridad tri-monetaria.</p>
        </div>
        <div className="cta-banner-actions">
          <button
            className="btn-hero-primary"
            onClick={() => {
              playTerminalSound('success');
              onOpenRegister();
            }}
          >
            <UserPlus size={18} /> Crear Mi Cuenta Gratis
          </button>
          <button
            className="btn-hero-secondary"
            onClick={() => {
              playTerminalSound('click');
              onOpenLogin();
            }}
          >
            <Lock size={18} /> Ya Tengo Cuenta
          </button>
        </div>
      </section>

      {/* 11. COMPREHENSIVE LANDING FOOTER */}
      <footer className="welcome-footer-full glass-panel" style={{ marginTop: '40px', padding: '40px 32px' }}>
        <div className="footer-top-grid">
          <div className="footer-col-brand">
            <div className="footer-brand-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={22} className="text-cyan" />
              <strong>KixInvertAPP</strong>
            </div>
            <p className="footer-brand-desc">
              La plataforma de inteligencia bursátil tri-monetaria líder para inversionistas de la Bolsa de Valores de Caracas (BVC) y Wall Street Global.
            </p>
            <div className="footer-badges">
              <span className="badge-ft"><ShieldCheck size={14} /> 2FA Habilitado</span>
              <span className="badge-ft"><Lock size={14} /> Cifrado AES-256</span>
              <span className="badge-ft"><Sparkles size={14} /> AI Cuantitativa</span>
            </div>
          </div>

          <div className="footer-col-links">
            <h4>Ecosistemas</h4>
            <a href="#sec-gallery" onClick={onEnterDemo}>Bolsa de Caracas (BVC)</a>
            <a href="#sec-gallery" onClick={onEnterDemo}>Wall Street Global (USD)</a>
            <a href="#sec-gallery" onClick={onEnterDemo}>Patrimonio Consolidado</a>
            <a href="#sec-features">Señales Tácticas de Venta</a>
          </div>

          <div className="footer-col-links">
            <h4>Herramientas</h4>
            <a href="#sec-features">Analista KixInvert AI</a>
            <a href="#sec-features">Simulador What-If</a>
            <a href="#sec-features">Reportes Ejecutivos PDF</a>
            <a href="#sec-features">Bot Telegram @KixInvert_bot</a>
          </div>

          <div className="footer-col-links">
            <h4>Legal & Plataforma</h4>
            <a href="#sec-faq">Términos del Servicio</a>
            <a href="#sec-faq">Aviso de Riesgo Bursátil</a>
            <a href="#sec-faq">Política de Privacidad</a>
            <a href="#sec-contact">Mesa de Asistencia</a>
          </div>
        </div>

        <div className="footer-bottom-bar" style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ color: '#667085', fontSize: '0.8rem', margin: 0 }}>
            © 2026 KixInvertAPP. Todos los derechos reservados. Diseñado para inversionistas independientes y casas de bolsa.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#7c8cff', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7c8cff', boxShadow: '0 0 8px #7c8cff' }}></span>
              Sistemas Operativos 100%
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
