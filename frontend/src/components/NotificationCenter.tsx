'use client';

import React, { useState } from 'react';
import {
  BellRing,
  Check,
  RefreshCw,
  X,
  ShieldAlert,
  TrendingUp,
  Zap,
  Send,
  Target,
} from 'lucide-react';
import { NotificationItem } from '@/types';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/api';
import { playTerminalSound } from '@/lib/audio';
import { AnimatedBell, AnimatedTelegram } from './AnimatedIcons';
import { SpotlightCard } from './SpotlightCard';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
  onRefresh: () => void;
  onOpenTelegram: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onRefresh,
  onOpenTelegram,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'tactical' | 'market'>('all');
  const [localItems, setLocalItems] = useState<NotificationItem[]>(notifications);

  React.useEffect(() => {
    setLocalItems(notifications);
  }, [notifications]);

  if (!isOpen) return null;

  const filtered = localItems.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const handleMarkAllRead = async () => {
    playTerminalSound('success');
    setLocalItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsRead();
    onRefresh();
  };

  const handleMarkOne = async (id: number) => {
    playTerminalSound('click');
    setLocalItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await markNotificationRead(id);
    onRefresh();
  };

  return (
    <div
      className="notif-dropdown-wrapper active kx-drop"
      style={{
        position: 'fixed',
        top: '64px',
        right: '24px',
        width: '420px',
        maxWidth: '92vw',
        zIndex: 1000,
        animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <SpotlightCard
        spotlightColor="rgba(124, 140, 255, 0.14)"
        borderColor="rgba(124, 140, 255, 0.35)"
        className="glass-panel"
        style={{
          borderRadius: '16px',
          background: 'rgba(11, 15, 25, 0.96)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AnimatedBell size={20} active={true} />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
              Alertas y Señales
            </h3>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: 'rgba(229, 97, 110, 0.2)',
                  color: '#ee8a94',
                  border: '1px solid rgba(229, 97, 110, 0.35)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                }}
              >
                {unreadCount} no leídas
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => {
                playTerminalSound('click');
                onRefresh();
              }}
              title="Refrescar alertas"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#9aa3b2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={onClose}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#9aa3b2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => {
                playTerminalSound('click');
                setSelectedCategory('all');
              }}
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '6px',
                background: selectedCategory === 'all' ? 'rgba(124, 140, 255, 0.15)' : 'transparent',
                color: selectedCategory === 'all' ? '#7c8cff' : '#9aa3b2',
                border: selectedCategory === 'all' ? '1px solid rgba(124, 140, 255, 0.3)' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              Todas
            </button>
            <button
              onClick={() => {
                playTerminalSound('click');
                setSelectedCategory('tactical');
              }}
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '6px',
                background: selectedCategory === 'tactical' ? 'rgba(124, 140, 255, 0.15)' : 'transparent',
                color: selectedCategory === 'tactical' ? '#7c8cff' : '#9aa3b2',
                border: selectedCategory === 'tactical' ? '1px solid rgba(124, 140, 255, 0.3)' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              <Target size={13} className="inline-icon" style={{ color: 'inherit' }} />Tácticas
            </button>
            <button
              onClick={() => {
                playTerminalSound('click');
                setSelectedCategory('market');
              }}
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '6px',
                background: selectedCategory === 'market' ? 'rgba(124, 140, 255, 0.15)' : 'transparent',
                color: selectedCategory === 'market' ? '#7c8cff' : '#9aa3b2',
                border: selectedCategory === 'market' ? '1px solid rgba(124, 140, 255, 0.3)' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              <Zap size={13} className="inline-icon" style={{ color: 'inherit' }} />Mercado
            </button>
          </div>

          <button
            onClick={handleMarkAllRead}
            style={{
              fontSize: '0.74rem',
              color: '#9aa6ff',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Marcar leídas
          </button>
        </div>

        {/* Notifications List */}
        <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '12px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: '#667085', fontSize: '0.85rem' }}>
              No tienes alertas pendientes en esta categoría.
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => handleMarkOne(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  marginBottom: '8px',
                  background: item.is_read ? 'rgba(255, 255, 255, 0.02)' : 'rgba(124, 140, 255, 0.08)',
                  border: item.is_read ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(124, 140, 255, 0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: item.category === 'tactical' ? 'rgba(217, 164, 65, 0.15)' : 'rgba(124, 140, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.category === 'tactical' ? '#e3b65e' : '#9aa6ff',
                    minWidth: '32px',
                  }}
                >
                  {item.category === 'tactical' ? <Zap size={16} /> : <TrendingUp size={16} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#fff' }}>
                      {item.title}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#667085' }}>
                      {item.time || 'En vivo'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#9aa3b2', marginTop: '3px', lineHeight: 1.4 }}>
                    {item.desc || item.message}
                  </div>
                </div>

                {!item.is_read && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#7c8cff',
                      boxShadow: '0 0 6px #7c8cff',
                      marginTop: '6px',
                      minWidth: '6px',
                    }}
                  />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer with Telegram Connection */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <span style={{ fontSize: '0.74rem', color: '#667085' }}>
            Monitor: BVC • Wall Street
          </span>

          <button
            onClick={() => {
              playTerminalSound('click');
              onClose();
              onOpenTelegram();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(124, 140, 255, 0.12)',
              border: '1px solid rgba(124, 140, 255, 0.3)',
              color: '#9aa6ff',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <AnimatedTelegram size={14} />
            <span>Telegram Bot</span>
          </button>
        </div>
      </SpotlightCard>
    </div>
  );
};
