"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useGlobalProgress } from "./ScrollProgress";
import { HeroFallback, SceneBoundary } from "./sections/HeroFallback";

/**
 * The persistent globe background: a single full-viewport R3F canvas fixed
 * behind the whole page, flown through on scroll. All site content scrolls over
 * it. Lazy-loaded client-only (`ssr: false`) so it never blocks SSR or first
 * paint; if WebGL is unavailable or the scene errors, an on-brand static frame
 * stands in behind the same content.
 */
const Scene = dynamic(() => import("@/components/three/Scene"), {
  ssr: false,
  loading: () => null,
});

export function GlobeBackground() {
  const reduced = useReducedMotion();
  const progressRef = useGlobalProgress();

  // The globe is always on screen, so it only idles when the tab is hidden or
  // motion is reduced (then it renders a single still framing on demand).
  const [active, setActive] = useState(true);
  const pausedRef = useRef(false);
  const setPaused = (v: boolean) => {
    pausedRef.current = v;
    setActive(!v);
  };

  const [webgl, setWebgl] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let supported = false;
    try {
      const c = document.createElement("canvas");
      supported = !!(
        window.WebGLRenderingContext &&
        (c.getContext("webgl2") || c.getContext("webgl"))
      );
    } catch {
      supported = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWebgl(supported);
  }, []);

  const [quality, setQuality] = useState<"low" | "high">("high");
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const apply = () => setQuality(mq.matches ? "low" : "high");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- still frame on demand
      setPaused(true);
      return;
    }
    const sync = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => document.removeEventListener("visibilitychange", sync);
  }, [reduced]);

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-0"
      style={{
        background:
          "radial-gradient(130% 100% at 50% 42%, #ffffff 0%, #fafafa 56%, #f4f4f4 100%)",
      }}
    >
      {webgl === false ? (
        <HeroFallback />
      ) : webgl ? (
        <SceneBoundary>
          <Scene
            progressRef={progressRef}
            pausedRef={pausedRef}
            reduced={reduced}
            active={active}
            quality={quality}
          />
        </SceneBoundary>
      ) : null}
    </div>
  );
}
