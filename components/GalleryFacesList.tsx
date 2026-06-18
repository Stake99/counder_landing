"use client";

import { GALLERY_TILES } from "@/lib/gallery";

/**
 * Accessible, non-visual counterpart to the surfacing-faces gallery. The tile
 * captions live on textured planes (not real DOM <img> alt), so this visually
 * hidden focusable list carries the names/roles as real text for keyboard and
 * screen-reader users. Activating an entry scrolls the journey to the gallery.
 */
export function GalleryFacesList() {
  return (
    <nav aria-label="Faces in the Counder network" className="sr-only">
      <ul>
        {GALLERY_TILES.map((t) => (
          <li key={t.key}>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("conference")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {t.person} · {t.role}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
