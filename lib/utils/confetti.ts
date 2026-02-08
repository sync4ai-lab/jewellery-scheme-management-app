'use client';

import confetti from 'canvas-confetti';

type ConfettiOptions = {
  durationMs?: number;
  particleCount?: number;
  colors?: string[];
};

const defaultColors = ['#f59e0b', '#fbbf24', '#fde68a', '#d97706', '#ef4444'];

export function fireCelebrationConfetti(options: ConfettiOptions = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const { durationMs = 1400, particleCount = 160, colors = defaultColors } = options;

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
  const end = Date.now() + durationMs;

  const frame = () => {
    confettiInstance?.({
      particleCount: Math.floor(particleCount / 2),
      spread: 75,
      startVelocity: 40,
      ticks: 180,
      origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 },
      colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    } else {
      setTimeout(() => {
        window.removeEventListener('resize', setCanvasSize);
        canvas.remove();
      }, 300);
    }
  };

  frame();
}
