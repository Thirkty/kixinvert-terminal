'use client';

import React, { useState } from 'react';

// ============================================================================
// 1. ANIMATED BELL (Hugeicons Animated Style - Swinging Exchange Bell)
// ============================================================================
export const AnimatedBell: React.FC<{
  size?: number;
  active?: boolean;
  className?: string;
  hasUnread?: boolean;
}> = ({ size = 20, active = false, className = '', hasUnread = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const shouldAnimate = active || isHovered;

  return (
    <div
      className={`animated-icon-wrapper ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transformOrigin: 'top center',
          animation: shouldAnimate ? 'hugeicon-bell-swing 0.85s ease-in-out infinite' : 'none',
          transition: 'transform 0.3s ease',
        }}
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {hasUnread && (
        <span
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '8px',
            height: '8px',
            background: '#ef4444',
            borderRadius: '50%',
            boxShadow: '0 0 8px #ef4444',
            animation: 'hugeicon-pulse 1.5s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// 2. ANIMATED TREND (Market Momentum Arrow with Glide)
// ============================================================================
export const AnimatedTrend: React.FC<{
  type: 'up' | 'down';
  size?: number;
  className?: string;
}> = ({ type, size = 18, className = '' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isUp = type === 'up';

  return (
    <span
      className={`animated-trend-wrapper ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={isUp ? '#10b981' : '#f43f5e'}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: isHovered
            ? isUp
              ? 'translate(2px, -2px) scale(1.15)'
              : 'translate(2px, 2px) scale(1.15)'
            : 'translate(0, 0) scale(1)',
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {isUp ? (
          <>
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </>
        ) : (
          <>
            <line x1="7" y1="7" x2="17" y2="17" />
            <polyline points="17 7 17 17 7 17" />
          </>
        )}
      </svg>
    </span>
  );
};

// ============================================================================
// 3. ANIMATED PULSE BEACON (Live Terminal / Telegram Radar)
// ============================================================================
export const AnimatedPulseBeacon: React.FC<{
  color?: string;
  size?: number;
  label?: string;
}> = ({ color = '#10b981', size = 8, label }) => {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${size * 2}px`,
          height: `${size * 2}px`,
        }}
      >
        <span
          style={{
            position: 'absolute',
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            backgroundColor: color,
            opacity: 0.75,
            animation: 'hugeicon-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
          }}
        />
        <span
          style={{
            position: 'relative',
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}`,
          }}
        />
      </span>
      {label && <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{label}</span>}
    </span>
  );
};

// ============================================================================
// 4. ANIMATED SPARKLES (AI Portfolio Doctor)
// ============================================================================
export const AnimatedSparkles: React.FC<{ size?: number; className?: string }> = ({
  size = 18,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: isHovered ? 'rotate(180deg) scale(1.2)' : 'rotate(0deg) scale(1)',
          transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M19 17v4" />
        <path d="M3 5h4" />
        <path d="M17 19h4" />
      </svg>
    </div>
  );
};

// ============================================================================
// 5. ANIMATED TELEGRAM (Telegram Airplane Flight Gesture)
// ============================================================================
export const AnimatedTelegram: React.FC<{ size?: number; className?: string }> = ({
  size = 18,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: isHovered ? 'translate(3px, -3px) rotate(-10deg) scale(1.15)' : 'translate(0, 0) scale(1)',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    </div>
  );
};
