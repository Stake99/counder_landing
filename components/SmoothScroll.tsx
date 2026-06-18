"use client";

import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Wires Lenis smooth-scroll to GSAP ScrollTrigger using the canonical recipe:
 *
 *  - Lenis owns the scroll position; on every Lenis tick we call
 *    `ScrollTrigger.update()` so triggers stay in lockstep.
 *  - We drive `lenis.raf()` from the single GSAP ticker (one rAF loop for the
 *    whole app) and disable GSAP's lag smoothing so scrubbed animations track
 *    the scroll exactly.
 *
 * Honors `prefers-reduced-motion`: when reduced, Lenis is not started and the
 * browser's native scrolling is used as-is.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;

    let lenis: import("lenis").default | undefined;
    let cleanup = () => {};

    (async () => {
      const Lenis = (await import("lenis")).default;
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      lenis = new Lenis({
        // easeOutExpo-ish — matches counder.com's unhurried feel.
        duration: 1.1,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });

      // Expose for any consumer that wants to scrollTo (e.g. CTA anchors).
      (window as unknown as { lenis?: unknown }).lenis = lenis;

      lenis.on("scroll", ScrollTrigger.update);

      const onTick = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(onTick);
      gsap.ticker.lagSmoothing(0);

      cleanup = () => {
        gsap.ticker.remove(onTick);
        lenis?.destroy();
        (window as unknown as { lenis?: unknown }).lenis = undefined;
      };
    })();

    return () => cleanup();
  }, [reduced]);

  return <>{children}</>;
}
