"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The closing transition: as the globe journey resolves (global scroll progress
 * ~0.80 → ~0.97), a full-viewport video crossfades in over the globe and becomes
 * the backdrop for the final invitation + footer. Sits above the globe/particles
 * but below the content, so the resolve copy reads over it.
 *
 * Muted + looping so it can autoplay; under reduced motion it fades in but stays
 * paused on its first frame (no looping motion forced on the reader).
 */
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function VideoTransition() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap || !video) return;

    let st: { kill: () => void } | undefined;
    let mounted = true;

    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      if (!mounted) return;

      st = ScrollTrigger.create({
        trigger: document.documentElement,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const o = smoothstep(0.8, 0.97, self.progress);
          wrap.style.opacity = String(o);
          if (reduced) return;
          if (o > 0.02 && video.paused) video.play().catch(() => {});
          else if (o <= 0.02 && !video.paused) video.pause();
        },
      });
    })();

    return () => {
      mounted = false;
      st?.kill();
    };
  }, [reduced]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[2] overflow-hidden"
      style={{ opacity: 0 }}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src="/video/first_vid.mp4" type="video/mp4" />
      </video>
      {/* Legibility scrim — keeps the resolve copy + footer readable over it. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.25) 38%, rgba(255,255,255,0.82) 100%)",
        }}
      />
    </div>
  );
}
