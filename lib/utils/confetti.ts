'use client';

import confetti from 'canvas-confetti';

type ConfettiOptions = {
  durationMs?: number;
  particleCount?: number;
  colors?: string[];
  burstCount?: number;
};

const defaultColors = ['#f59e0b', '#fbbf24', '#fde68a', '#d97706', '#ef4444'];

export function fireCelebrationConfetti(options: ConfettiOptions = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const {
    durationMs = 2000,
    particleCount = 70,
    colors = defaultColors,
    burstCount = 4,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';

  document.body.appendChild(canvas);

  const setCanvasSize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  setCanvasSize();
  window.addEventListener('resize', setCanvasSize, { passive: true });

  const confettiInstance = confetti.create(canvas, { resize: true, useWorker: false });
  const burstInterval = Math.max(220, Math.floor(durationMs / burstCount));
  let bursts = 0;

  const fireBurst = () => {
    confettiInstance?.({
      particleCount: Math.max(12, Math.floor(particleCount / burstCount)),
      spread: 55,
      startVelocity: 24,
      ticks: 220,
      gravity: 0.6,
      scalar: 0.95,
      drift: (Math.random() - 0.5) * 0.3,
      origin: { x: 0.2 + Math.random() * 0.6, y: 0.08 + Math.random() * 0.1 },
      colors,
    });
  };

  const timer = window.setInterval(() => {
    fireBurst();
    bursts += 1;
    if (bursts >= burstCount) {
      window.clearInterval(timer);
      window.setTimeout(() => {
        window.removeEventListener('resize', setCanvasSize);
        canvas.remove();
      }, 500);
    }
  }, burstInterval);
}
