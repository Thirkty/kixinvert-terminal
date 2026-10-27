'use client';

import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => unknown };

// Runs a state change inside a View Transition (animated cross-fade between modules).
// Falls back to a plain update where the API or motion isn't available.
export function runViewTransition(update: () => void) {
  const doc = typeof document !== 'undefined' ? (document as ViewTransitionDoc) : null;
  if (!doc?.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}

interface CountUpProps {
  value: number;
  format: (n: number) => string;
  duration?: number;
}

// Anima el número desde su valor anterior hasta el nuevo (ease-out), respetando reduced-motion
export const CountUp: React.FC<CountUpProps> = ({ value, format, duration = 700 }) => {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;
    if (prefersReducedMotion() || from === value) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{format(display)}</>;
};

interface FlashOnChangeProps {
  value: number;
  children: React.ReactNode;
}

// Destello breve verde/rojo cuando el valor sube o baja (p. ej. precio en vivo)
export const FlashOnChange: React.FC<FlashOnChangeProps> = ({ value, children }) => {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState<'' | 'flash-up' | 'flash-down'>('');

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (value === prev) return;
    setFlash(value > prev ? 'flash-up' : 'flash-down');
    const timer = setTimeout(() => setFlash(''), 900);
    return () => clearTimeout(timer);
  }, [value]);

  return <span className={`flash-value ${flash}`}>{children}</span>;
};

interface MarketCodeProps {
  code: 'VE' | 'US';
}

// Reemplaza las banderas emoji (en Windows se ven como letras sueltas "VE"/"US")
export const MarketCode: React.FC<MarketCodeProps> = ({ code }) => (
  <span className="market-code" aria-label={code === 'VE' ? 'Venezuela' : 'Estados Unidos'}>
    {code}
  </span>
);
