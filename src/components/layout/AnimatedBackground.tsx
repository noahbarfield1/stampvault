'use client';

import React, { useEffect, useRef } from 'react';
import styles from './AnimatedBackground.module.css';

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let particles: Array<{ x: number; y: number; vx: number; vy: number; size: number }> = [];
    let width = 0;
    let height = 0;
    let animationFrameId: number;

    const init = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      // Create fewer particles for a cleaner, premium look
      const count = Math.min(Math.floor((width * height) / 25000), 50);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 1.2 + 0.5,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      ctx.fillStyle = 'rgba(212, 165, 116, 0.4)'; // Subtle gold
      
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw subtle connecting lines between close particles
      ctx.strokeStyle = 'rgba(212, 165, 116, 0.05)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = dx * dx + dy * dy;
          if (dist < 15000) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    init();
    draw();

    window.addEventListener('resize', init);
    return () => {
      window.removeEventListener('resize', init);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className={styles.backgroundContainer}>
      <div className={styles.meshGradient} />
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.noiseOverlay} />
    </div>
  );
}
