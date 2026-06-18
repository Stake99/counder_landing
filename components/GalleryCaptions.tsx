"use client";

import { useEffect, useRef } from "react";

import { GALLERY_TILES, GALLERY_RAMP } from "@/lib/gallery";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The words that surface with the pictures.
 *
 * The faces gallery (Gallery.tsx) plays as 3D photo tiles that pop out of the
 * globe and drift to screen-centre as you scroll the #conference section. This
 * is the editorial counterpart: a fixed, scroll-synced overlay that rises one
 * caption per tile — concept beat, headline, and the face's name/place — driven
 * by the EXACT same section-scroll progress the tiles use, so word and picture
 * move as one. The six captions trace the Counder argument (CORE-CONCEPTS.md):
 * Curiosity → Perspective → Trust → Together → the circle widens → the Lens.
 *
 * Updates run imperatively in a rAF loop (no per-frame React renders), mirroring
 * Gallery.tsx: same eased section progress, same start/dur windows, same RAMP.
 * Decorative + duplicated by GalleryFacesList for SR, so the layer is aria-hidden.
 */
export function GalleryCaptions() {
  const reduced = useReducedMotion();
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const sectionId = "conference";
    let section: HTMLElement | null = null;
    let raf = 0;
    let eased = 0;
    let last = performance.now();

    const smoothstep = (a: number, b: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!section) section = document.getElementById(sectionId);
      // Local section progress (0 → 1): 0 when the section top hits the viewport
      // top, 1 when its bottom reaches the bottom — identical to Gallery.tsx.
      let target = 0;
      if (section) {
        const rect = section.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const denom = rect.height - vh;
        target = denom > 0 ? Math.min(1, Math.max(0, -rect.top / denom)) : 0;
      }
      // Same easing as the 3D tiles so the words track them exactly.
      eased += (target - eased) * Math.min(1, dt * 4);

      for (let i = 0; i < GALLERY_TILES.length; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        const t = GALLERY_TILES[i];
        const start = t.start;
        const end = t.start + t.dur;
        const enter = smoothstep(start, start + GALLERY_RAMP, eased);
        const exit = smoothstep(end - GALLERY_RAMP, end, eased);
        const presence = enter * (1 - exit);

        el.style.opacity = String(presence);
        if (reduced) {
          // Fade only — no travel, no blur.
          el.style.transform = "translate(-50%, 0)";
          el.style.filter = "none";
        } else {
          // One continuous upward drift: rises from below as it enters, settles
          // at centre on the hold, lifts away as it exits — so a fading-out
          // caption clears upward while the next rises in beneath it.
          const y = (1 - enter) * 64 - exit * 64;
          const blur = (1 - presence) * 6;
          el.style.transform = `translate(-50%, ${y}px)`;
          el.style.filter = blur > 0.05 ? `blur(${blur}px)` : "none";
        }
        // Skip painting fully-faded captions.
        el.style.visibility = presence > 0.002 ? "visible" : "hidden";
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div className="gallery-captions" aria-hidden>
      {GALLERY_TILES.map((t, i) => (
        <div
          key={t.key}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          className="gcap"
          style={{ opacity: 0, visibility: "hidden" }}
        >
          <p className="gcap__concept">
            <span className="gcap__index">{String(i + 1).padStart(2, "0")}</span>
            <span className="gcap__rule" aria-hidden />
            {t.caption.concept}
          </p>
          <p className="gcap__headline">{t.caption.headline}</p>
          <p className="gcap__sub">
            {t.person}
            <span className="gcap__dot">·</span>
            {t.role}
          </p>
        </div>
      ))}
    </div>
  );
}
