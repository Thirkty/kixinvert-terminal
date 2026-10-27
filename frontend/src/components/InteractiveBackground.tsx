'use client';

import React, { useEffect, useRef } from 'react';

interface InteractiveBackgroundProps {
  /** 1 = landing (more visible), lower values keep the terminal calm */
  intensity?: number;
  /** false: draw once and stay still (the terminal), true: react to the cursor (landing) */
  interactive?: boolean;
}

type Dot = { x: number; y: number; ox: number; oy: number; vx: number; vy: number };

// Canvas dot grid that lights up and gently parts around the cursor, plus a soft glow that follows it.
// It only animates while something moves: the loop stops as soon as the dots settle, so an idle page
// costs nothing. Static with prefers-reduced-motion and when `interactive` is false.
export const InteractiveBackground: React.FC<InteractiveBackgroundProps> = ({ intensity = 1, interactive = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const animate = interactive && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SPACING = 34;
    const RADIUS = 170;
    let width = 0;
    let height = 0;
    let dots: Dot[] = [];
    const mouse = { x: -9999, y: -9999, active: false };
    const glow = { x: window.innerWidth * 0.7, y: window.innerHeight * 0.2 };
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = SPACING / 2; y < height + SPACING; y += SPACING) {
        for (let x = SPACING / 2; x < width + SPACING; x += SPACING) {
          dots.push({ x, y, ox: x, oy: y, vx: 0, vy: 0 });
        }
      }
      draw();
    };

    // Moves the dots one step; returns true while anything is still moving
    const step = () => {
      let moving = false;
      const tx = mouse.active ? mouse.x : glow.x;
      const ty = mouse.active ? mouse.y : glow.y;
      glow.x += (tx - glow.x) * 0.06;
      glow.y += (ty - glow.y) * 0.06;
      if (Math.abs(tx - glow.x) > 0.5 || Math.abs(ty - glow.y) > 0.5) moving = true;

      for (const d of dots) {
        const dx = d.x - mouse.x;
        const dy = d.y - mouse.y;
        const near = mouse.active && dx * dx + dy * dy < RADIUS * RADIUS;
        // Dots at rest far from the cursor need no work
        if (!near && d.vx === 0 && d.vy === 0 && d.x === d.ox && d.y === d.oy) continue;
        if (near) {
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const push = (1 - dist / RADIUS) ** 2 * 1.4;
          d.vx += (dx / dist) * push;
          d.vy += (dy / dist) * push;
        }
        // Spring back to the grid position
        d.vx = (d.vx + (d.ox - d.x) * 0.06) * 0.82;
        d.vy = (d.vy + (d.oy - d.y) * 0.06) * 0.82;
        d.x += d.vx;
        d.y += d.vy;
        if (Math.abs(d.vx) < 0.01 && Math.abs(d.vy) < 0.01 && Math.abs(d.x - d.ox) < 0.05 && Math.abs(d.y - d.oy) < 0.05) {
          d.x = d.ox; d.y = d.oy; d.vx = 0; d.vy = 0;
        } else if (Math.abs(d.vx) > 0.01 || Math.abs(d.vy) > 0.01) {
          moving = true;
        }
      }
      return moving;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, 520);
      g.addColorStop(0, `rgba(124, 140, 255, ${0.16 * intensity})`);
      g.addColorStop(1, 'rgba(124, 140, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // Every dot away from the cursor shares one colour: one path, one fill
      ctx.fillStyle = `rgba(120, 130, 160, ${0.09 * intensity})`;
      ctx.beginPath();
      const lit: [Dot, number][] = [];
      for (const d of dots) {
        const dx = d.x - mouse.x;
        const dy = d.y - mouse.y;
        const near = mouse.active ? 1 - Math.sqrt(dx * dx + dy * dy) / RADIUS : 0;
        if (near > 0.05) {
          lit.push([d, near]);
        } else {
          ctx.moveTo(d.x + 1, d.y);
          ctx.arc(d.x, d.y, 1, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      // The few dots near the cursor glow and link to it (constellation)
      for (const [d, near] of lit) {
        ctx.fillStyle = `rgba(154, 166, 255, ${(0.09 + near * 0.8) * intensity})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1 + near * 1.8, 0, Math.PI * 2);
        ctx.fill();
        if (near > 0.4) {
          ctx.strokeStyle = `rgba(124, 140, 255, ${(near - 0.4) * 0.5 * intensity})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(d.x, d.y);
          ctx.stroke();
        }
      }
    };

    const loop = () => {
      const moving = step();
      draw();
      frame = moving && !document.hidden ? requestAnimationFrame(loop) : 0;
    };
    const wake = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
      wake();
    };
    const onLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
      wake();
    };

    resize();
    window.addEventListener('resize', resize);
    if (animate) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerleave', onLeave);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [intensity, interactive]);

  return <canvas ref={canvasRef} className="kx-bg-canvas" aria-hidden="true" />;
};
