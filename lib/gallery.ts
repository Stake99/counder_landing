import { CAPE_TOWN, type LatLng } from "./geo";
import { CITIES } from "./cities";

/**
 * The surfacing-faces gallery shown across the 0.25–0.55 scroll range (in place
 * of the old text "pillar" cards). Each tile is a photo anchored to a real city
 * on the globe that pops out, holds, and fades as the camera flies past — the
 * network's faces surfacing from the planet and connecting toward Cape Town.
 *
 * Tiles are anchored to front-hemisphere cities so they read while that face of
 * the globe is toward the camera. The first four are the counder.com personas
 * (also shown first on mobile); the last two are conference moments.
 *
 * Images are tasteful placeholders (downscaled from /public/images). To drop in
 * real client photos later, just replace `url` — everything else is structural.
 */
export interface GalleryTileDef {
  key: string;
  /** Anchor city — resolved to lat/lng below. */
  city: string;
  /** Real text (not baked into the texture) — also used for alt + the a11y list. */
  person: string;
  role: string;
  url: string;
  /**
   * Window within the gallery section's OWN scroll (local 0→1, not the global
   * journey) — start + duration. Evenly spaced with a long hold so each tile is
   * a "station" you scroll through, like a timeline. The section is made tall
   * (see Pillars) so each window spans a lot of scrolling and reads slowly.
   */
  start: number;
  dur: number;
  /** Relative size, for gentle depth variation. */
  baseScale: number;
  /**
   * The words that surface with the picture (rendered as a scroll-synced DOM
   * overlay by GalleryCaptions, in lockstep with this tile's start/dur window).
   * The six captions trace the Counder argument from CORE-CONCEPTS.md:
   * Curiosity → Perspective → Trust → Together → the circle widens → the Lens.
   * `concept` is the kicker beat; `headline` is the line that lands with the face.
   */
  caption: { concept: string; headline: string };
}

export const GALLERY_TILES: GalleryTileDef[] = [
  { key: "ny", city: "New York", person: "A Fortune 500 CEO", role: "New York", url: "/images/gallery/ny.jpg", start: 0.0, dur: 0.22, baseScale: 1.15,
    caption: { concept: "Curiosity", headline: "It starts with a question too big to answer alone." } },
  { key: "zurich", city: "Zurich", person: "A quantum computing professor", role: "Zurich", url: "/images/gallery/zurich.jpg", start: 0.156, dur: 0.22, baseScale: 1.0,
    caption: { concept: "Perspective", headline: "Completely different worlds, in the same room." } },
  { key: "saopaulo", city: "São Paulo", person: "A family office principal", role: "São Paulo", url: "/images/gallery/saopaulo.jpg", start: 0.312, dur: 0.22, baseScale: 1.05,
    caption: { concept: "Trust", headline: "Speak freely. Think out loud. Nothing leaves attributed." } },
  { key: "capetown", city: "Cape Town", person: "A renowned architect", role: "Cape Town", url: "/images/gallery/capetown.jpg", start: 0.468, dur: 0.22, baseScale: 1.2,
    caption: { concept: "Together", headline: "Everyone contributes. Everyone listens. Together, we make sense." } },
  { key: "london", city: "London", person: "Counder & Friends", role: "January 2027", url: "/images/gallery/london.jpg", start: 0.624, dur: 0.22, baseScale: 0.95,
    caption: { concept: "The circle widens", headline: "Curated to 500. Opened to thousands." } },
  { key: "lagos", city: "Lagos", person: "Context Day", role: "Norval Foundation", url: "/images/gallery/lagos.jpg", start: 0.78, dur: 0.22, baseScale: 1.0,
    caption: { concept: "The Lens", headline: "Where today meets tomorrow — for 2027, the AI Inflection." } },
];

/** Fade-edge width of each caption/tile window (mirrors RAMP in Gallery.tsx). */
export const GALLERY_RAMP = 0.06;

/** Resolve a tile's anchor city to a lat/lng (Cape Town is its own constant). */
export function tileLatLng(city: string): LatLng {
  if (city === "Cape Town") return CAPE_TOWN;
  return CITIES.find((c) => c.name === city) ?? CAPE_TOWN;
}
