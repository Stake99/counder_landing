"use client";

import { Component, type ReactNode } from "react";

/**
 * Static, elegant stand-in for the WebGL stage — shown when the device can't
 * (or won't) run the 3D: WebGL unavailable, context lost, or a render error.
 *
 * It echoes the brand rings motif with a faint Cape-Town-warm convergence point,
 * so the composition still reads as "perspectives converging" with zero WebGL.
 * The accessible overlay renders on top of this exactly as it does over the
 * canvas, so the hero never degrades to a blank or broken frame.
 */
export function HeroFallback() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* Concentric rings, brand-style, centred where the globe would sit. */}
      <svg
        className="absolute left-1/2 top-1/2 h-[120vh] w-[120vh] -translate-x-1/2 -translate-y-1/2 opacity-[0.5]"
        viewBox="-200 -200 400 400"
        fill="none"
      >
        {[60, 110, 158, 200].map((r, i) => (
          <circle
            key={r}
            cx="0"
            cy="0"
            r={r}
            stroke="#0a0a0a"
            strokeOpacity={0.14 - i * 0.028}
            strokeWidth="0.6"
          />
        ))}
        {/* Cape Town convergence accent. */}
        <circle cx="14" cy="58" r="2.4" fill="#e07b1a" />
        <circle
          cx="14"
          cy="58"
          r="9"
          stroke="#e07b1a"
          strokeOpacity="0.55"
          strokeWidth="0.6"
        />
      </svg>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 52% 52%, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0) 60%)",
        }}
      />
    </div>
  );
}

/**
 * Error boundary that swaps the live 3D scene for {@link HeroFallback} if R3F
 * throws (e.g. WebGL context creation fails). Keeps the page alive and on-brand
 * instead of crashing to Next's error overlay / a white screen.
 */
export class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Non-fatal — the overlay + fallback carry the hero.
    console.warn("[hero] 3D scene unavailable, showing static fallback:", error);
  }

  render() {
    if (this.state.failed) return <HeroFallback />;
    return this.props.children;
  }
}
