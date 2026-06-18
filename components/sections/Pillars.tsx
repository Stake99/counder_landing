"use client";

import { PILLARS } from "@/lib/content";
import { GALLERY_TILES } from "@/lib/gallery";

/**
 * Scroll "timeline" for the surfacing-faces gallery. The old glass text cards
 * are gone — the gallery (Gallery.tsx, on the globe) plays across this section's
 * scroll. We give it one tall ~full-viewport station per gallery tile so each
 * face surfaces slowly and holds the screen as you scroll through, rather than
 * whipping past. The first panels keep the per-pillar nav anchors + SR headings.
 */
export function Pillars() {
  return (
    <section
      id="conference"
      aria-label="The Counder network"
      className="relative z-10"
    >
      {GALLERY_TILES.map((t, i) => {
        const pillar = PILLARS[i];
        return (
          <div
            key={t.key}
            id={pillar?.id}
            className="flex min-h-[165svh] items-center justify-center"
          >
            {pillar && <h2 className="sr-only">{pillar.title}</h2>}
          </div>
        );
      })}
    </section>
  );
}
