"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * A faint particle layer drifting above the globe for atmospheric depth — a 2D
 * canvas, deliberately cheap and barely-there. Sits between the globe and the
 * content. Honours reduced motion (renders a single static field) and pauses
 * when the tab is hidden.
 */
export function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const coarse = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;

    type P = { x: number; y: number; r: number; vy: number; a: number };
    let parts: P[] = [];

    const seed = () => {
      const count = coarse ? 34 : 70;
      parts = Array.from({ length: count }, (_, i) => {
        // Deterministic-ish spread; varied per index.
        const rnd = (n: number) => {
          const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        return {
          x: rnd(i) * w,
          y: rnd(i + 99) * h,
          r: 0.4 + rnd(i + 7) * 1.1,
          vy: 2 + rnd(i + 3) * 6,
          a: 0.1 + rnd(i + 11) * 0.35,
        };
      });
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(20, 20, 24, ${p.a * 0.4})`;
        ctx.fill();
      }
    };

    if (reduced) {
      draw();
      return () => window.removeEventListener("resize", resize);
    }

    let last = 0;
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      if (!document.hidden) {
        for (const p of parts) {
          p.y -= p.vy * dt;
          if (p.y < -2) {
            p.y = h + 2;
            p.x = Math.random() * w;
          }
        }
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1]"
    />
  );
}
