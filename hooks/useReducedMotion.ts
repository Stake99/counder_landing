"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the user's `prefers-reduced-motion` setting, live.
 *
 * Returns `true` when motion should be reduced. The hero uses this to render a
 * single elegant still frame (no auto-rotation, no travelling arcs, no scroll
 * camera moves) instead of the full animation.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Sync to the OS setting on mount (starts `false` for SSR safety).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(mq.matches);

    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
