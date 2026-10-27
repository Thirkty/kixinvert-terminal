'use client';

import React, { useEffect, useRef } from 'react';

interface InteractiveBackgroundProps {
  /** 1 = landing (more visible), lower values keep the terminal calm */
  intensity?: number;
}

// Canvas dot grid that lights up and gently parts around the cursor, plus a soft glow that trails it.
// Pauses when the tab is hidden and stays static with prefers-reduced-motion.
export const InteractiveBackground: React.FC<InteractiveBackgroundProps> = ({ intensity = 1 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SPACING = 34;
    const RADIUS = 170;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let dots: { x: number; y: number; ox: number; oy: number; vx: number; vy: number }[] = [];
    const mouse = { x: -9999, y: -9999, active: false };
    const glow = { x: window.innerWidth * 0.7, y: window.innerHeight * 0.2 };
    let frame = 0;
    let time = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    };

    const draw = () => {
      time += 0.004;
      ctx.clearRect(0, 0, width, height);

      // Glow eases toward the cursor, or drifts slowly on its own
      const targetX = mouse.active ? mouse.x : width * (0.6 + Math.sin(time) * 0.2);
      const targetY = mouse.active ? mouse.y : height * (0.3 + Math.cos(time * 0.8) * 0.15);
      glow.x += (targetX - glow.x) * 0.06;
      glow.y += (targetY - glow.y) * 0.06;
      const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, 520);
      g.addColorStop(0, `rgba(124, 140, 255, ${0.16 * intensity})`);
      g.addColorStop(1, 'rgba(124, 140, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      for (const d of dots) {
        const dx = d.x - mouse.x;
        const dy = d.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let near = 0;
        if (mouse.active && dist < RADIUS) {
          near = 1 - dist / RADIUS;
          const push = near * near * 1.4;
          d.vx += (dx / (dist || 1)) * push;
          d.vy += (dy / (dist || 1)) * push;
        }
        // Spring back to the grid position
        d.vx += (d.ox - d.x) * 0.06;
        d.vy += (d.oy - d.y) * 0.06;
        d.vx *= 0.82;
        d.vy *= 0.82;
        d.x += d.vx;
        d.y += d.vy;

        const alpha = (0.09 + near * 0.8) * intensity;
        const size = 1 + near * 1.8;
        ctx.fillStyle = `rgba(${near > 0.05 ? '154, 166, 255' : '120, 130, 160'}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Constellation: thin lines from the cursor to the closest dots
        if (near > 0.4) {
          ctx.strokeStyle = `rgba(124, 140, 255, ${(near - 0.4) * 0.5 * intensity})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(d.x, d.y);
          ctx.stroke();
        }
      }
      frame = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !reduced) frame = requestAnimationFrame(draw);
    };

    resize();
    if (reduced) {
      draw();
      cancelAnimationFrame(frame);
    } else {
      frame = requestAnimationFrame(draw);
    }
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intensity]);

  return <canvas ref={canvasRef} className="kx-bg-canvas" aria-hidden="true" />;
};
