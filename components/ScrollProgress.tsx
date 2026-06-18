"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

/**
 * One global scroll progress (0 → 1) for the whole page, shared by the fixed
 * globe background (which flies the camera through the journey) and any content
 * that wants to read journey position.
 *
 * The value lives in a **ref**, not React state — it updates every frame and is
 * read inside the R3F `useFrame` loop, so routing it through React would thrash
 * re-renders. Content reveals use their own per-section ScrollTriggers (which
 * track the same scroll); this context exists purely to hand the camera a stable
 * progress pointer.
 *
 * Backed by a GSAP ScrollTrigger spanning the document, kept in lockstep with
 * Lenis by `SmoothScroll`. Under reduced motion (no Lenis) ScrollTrigger still
 * tracks native scroll, so the still framing's content fades work unchanged.
 */

interface ScrollProgressValue {
  progressRef: React.RefObject<number>;
}

const ScrollProgressContext = createContext<ScrollProgressValue | null>(null);

export function ScrollProgressProvider({ children }: { children: ReactNode }) {
  const progressRef = useRef(0);

  useEffect(() => {
    let st: { kill: () => void } | undefined;
    let mounted = true;

    // Immediate fallback so progress is valid before GSAP finishes loading
    // (keeps the camera at the hero framing on first paint, then hands off).
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

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
          progressRef.current = self.progress;
        },
      });
      // Native-scroll fallback no longer needed once the trigger is live.
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    })();

    return () => {
      mounted = false;
      st?.kill();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <ScrollProgressContext.Provider value={{ progressRef }}>
      {children}
    </ScrollProgressContext.Provider>
  );
}

export function useGlobalProgress(): React.RefObject<number> {
  const ctx = useContext(ScrollProgressContext);
  if (!ctx)
    throw new Error("useGlobalProgress must be used within ScrollProgressProvider");
  return ctx.progressRef;
}
