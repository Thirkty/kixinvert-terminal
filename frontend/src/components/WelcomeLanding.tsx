'use client';

import React from 'react';
import Image from 'next/image';
import { UserPlus, Lock, Zap, Coins, Bot, ShieldAlert, Cpu } from 'lucide-react';

interface WelcomeLandingProps {
  onEnterDemo: () => void;
  onOpenRegister: () => void;
  onOpenLogin: () => void;
}

export const WelcomeLanding: React.FC<WelcomeLandingProps> = ({
  onEnterDemo,
  onOpenRegister,
  onOpenLogin,
}) => {
  return (
    <div className="welcome-view-container">
      {/* HERO SECTION */}
      <section className="welcome-hero glass-panel">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="pulse-dot"></span>
            <span>Bolsa de Valores de Caracas en Tiempo Real</span>
          </div>

          <h1 className="hero-title">
            Domina tus inversiones con claridad <span className="gradient-text">Tri-Monetaria</span>
          </h1>

          <p className="hero-description">
            Bienvenido a <strong>KixInvertAPP</strong>. Tu terminal bursátil multi-divisa de alto rendimiento, diseñado para monitorear tu patrimonio en tiempo real y medir tu retorno verdadero en <strong>Bolívares (VES)</strong>, <strong>Dólares Oficiales (BCV)</strong> y <strong>USDT (Binance P2P)</strong> frente al impacto de la brecha cambiaria.
          </p>

          <div className="hero-actions">
            <button className="btn-hero-primary" onClick={onOpenRegister}>
              <UserPlus size={18} /> Registrar Inversionista
            </button>
            <button className="btn-hero-secondary" onClick={onOpenLogin}>
              <Lock size={18} /> Iniciar Sesión
            </button>
            <button className="btn-hero-secondary" onClick={onEnterDemo}>
              <Zap size={18} /> Probar Demo Directo
            </button>
          </div>

          <div className="hero-stats-row">
            <div className="hero-stat-item">
              <span className="stat-number">46</span>
              <span className="stat-label">Títulos BVC Monitoreados</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <span className="stat-number">3</span>
              <span className="stat-label">Valoraciones Simultáneas (Bs/BCV/USDT)</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <span className="stat-number">🤖 AI</span>
              <span className="stat-label">Analista Bursátil KixInvert AI Integrado</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <span className="stat-number">100%</span>
              <span className="stat-label">Privado y Confidencial</span>
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY SHOWCASE */}
      <section className="welcome-gallery-section">
        <div className="gallery-header text-center" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Galería del Proyecto: Así Funciona KixInvertAPP</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Capturas directas de la plataforma en funcionamiento</p>
        </div>

        <div className="gallery-grid">
          {/* Card 1: Dashboard Overview */}
          <div className="gallery-card glass-panel">
            <div className="gallery-img-wrapper" style={{ position: 'relative', height: '220px' }}>
              <Image
                src="/img/preview-dashboard.png"
                alt="Resumen Patrimonial KixInvertAPP"
                fill
                style={{ objectFit: 'cover', objectPosition: 'top' }}
              />
              <div className="img-badge">Panel Principal</div>
            </div>
            <div className="gallery-card-body">
              <h3>1. Resumen Patrimonial Multi-Divisa</h3>
              <p>
                Visualiza el valor consolidado de tu cartera con switch en 1 clic entre Bolívares, Dólares a tasa BCV y USDT. Monitoriza la <strong>Brecha Cambiaria</strong> en tiempo real para proteger tu poder adquisitivo.
              </p>
            </div>
          </div>

          {/* Card 2: Table of Positions */}
          <div className="gallery-card glass-panel">
            <div className="gallery-img-wrapper" style={{ position: 'relative', height: '220px' }}>
              <Image
                src="/img/preview-positions.png"
                alt="Tabla de Posiciones KixInvertAPP"
                fill
                style={{ objectFit: 'cover', objectPosition: 'top' }}
              />
              <div className="img-badge">Libro de Posiciones</div>
            </div>
            <div className="gallery-card-body">
              <h3>2. Posiciones & Rendimiento Nominal vs Real</h3>
              <p>
                Detalle exhaustivo de cada título (BNC, Ron Santa Teresa, Mercantil, Bolsa de Caracas). Compara el precio de compra histórico contra el precio actual de pizarra y conoce tu ganancia real en USDT.
              </p>
            </div>
          </div>

          {/* Card 3: Donut & Pulse */}
          <div className="gallery-card glass-panel">
            <div className="gallery-img-wrapper" style={{ position: 'relative', height: '220px' }}>
              <Image
                src="/img/preview-allocation.png"
                alt="Ponderación de Cartera KixInvertAPP"
                fill
                style={{ objectFit: 'cover', objectPosition: 'top' }}
              />
              <div className="img-badge">Ponderación de Cartera</div>
            </div>
            <div className="gallery-card-body">
              <h3>3. Ponderación de Cartera & Pulso</h3>
              <p>
                Gráfico de dona interactivo para evaluar la diversificación y porcentaje de concentración de tu capital por acción y liquidez en efectivo, junto al mejor y peor desempeño del portafolio.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE PILLARS */}
      <section className="welcome-features-section">
        <div className="features-grid">
          <div className="feature-box glass-panel">
            <div className="feature-icon bg-green"><Coins size={24} /></div>
            <h4>Cálculo Tri-Monetario</h4>
            <p>Calcula automáticamente la equivalencia en Bolívares oficiales, Dólares BCV y USDT de Binance P2P para cada título.</p>
          </div>

          <div className="feature-box glass-panel">
            <div className="feature-icon bg-purple"><Bot size={24} /></div>
            <h4>Inteligencia Artificial BVC</h4>
            <p>Diagnóstico automatizado de cobertura cambiaria, rebalanceo de cartera y análisis de sentimiento financiero.</p>
          </div>

          <div className="feature-box glass-panel">
            <div className="feature-icon bg-blue"><ShieldAlert size={24} /></div>
            <h4>Alerta de Brecha Cambiaria</h4>
            <p>Alarma visual cuando el diferencial cambiario se ensancha, alertando sobre posible pérdida de poder adquisitivo.</p>
          </div>

          <div className="feature-box glass-panel">
            <div className="feature-icon bg-amber"><Cpu size={24} /></div>
            <h4>Scraping en Tiempo Real</h4>
            <p>Actualización de cotizaciones de la Bolsa de Valores de Caracas directamente sin retrasos de operadores.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
