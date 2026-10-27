'use client';

import React, { useRef } from 'react';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  spotlightColor?: string;
  borderColor?: string;
  className?: string;
}

// Halo sutil que sigue al cursor. Se mueve solo con variables CSS (sin setState),
// así la tarjeta no se vuelve a renderizar en cada movimiento del mouse.
// spotlightColor / borderColor se mantienen por compatibilidad; el color sale del tema (--spotlight).
export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  spotlightColor,
  borderColor,
  className = '',
  style,
  ...props
}) => {
  const divRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = divRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      className={`spotlight-card ${className}`}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      {...props}
    >
      <div className="spotlight-radial-glow" aria-hidden="true" />
      <div className="spotlight-border-glow" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 3, height: '100%' }}>{children}</div>
    </div>
  );
};
