# Notes — decisions & assumptions

Short log of the non-obvious calls. Flagged so they can be revisited.

## Architecture — the full-site globe

The home is **one persistent globe flown through on scroll**, not a hero with a
pinned canvas. The pieces:

- **`GlobeBackground`** — a single R3F canvas fixed behind the whole page
  (`fixed inset-0 z-0`); all content scrolls over it. Lazy-loaded
  (`ssr: false`), WebGL-probed, with a static `HeroFallback` if WebGL is absent
  or the scene errors.
- **`ScrollProgressProvider`** — one global scroll progress (0→1) in a ref,
  backed by a document-spanning GSAP ScrollTrigger (kept in lockstep with Lenis
  by `SmoothScroll`). The camera reads it in `useFrame`; content sections use
  their own per-section triggers against the same scroll.
- **`Scene` camera rig** — keyframed camera position + look-at, eased and sampled
  by global progress through five beats: hero → approach → pillars (3/4 orbit) →
  convergence on Cape Town → resolve.
- Content layered over it: `Nav`, `Hero` (fades on scroll), `Pillars` (wipe-mask
  cards), `Presenting` (blur→sharp), `Footer` (resolve CTA + footer).

### Why the globe holds a fixed orientation
The globe does **not** spin continuously. It stays locked Cape-Town-front (with a
faint bounded shimmer in the hero only). Continuous spin would leave Cape Town at
an arbitrary azimuth at the convergence beat, so the camera's look-at could land
on the back of the globe. Fixing the orientation makes the convergence reliably
composed; the sense of "flying around it" comes entirely from the **camera rig**,
which is what flying through actually means.

### Scroll length ↔ journey
Total content height (~4.3k px of scroll) defines the journey. Content reveals are
decoupled from the camera keyframes — both ride the same scroll, so they read as
coordinated without needing pixel-perfect alignment. Section heights are sized so
the beats line up roughly; tune section min-heights to re-time beats.

## Brand / look

- **The home inverts to a dark stage.** counder.com is light (near-black on
  white); the full-site globe needs a dark "space" backdrop to carry the luminous
  arcs. `html` is dark, `body` transparent over the globe; the light product
  routes (`(app)`) lay their own white container over it. Tokens unchanged
  (`DESIGN_TOKENS.md`) — the dark hero values are reused site-wide.
- **Wipe-reveal cards** use an animated `linear-gradient` **mask** (`--p` driven
  by GSAP): horizontal sweep on desktop, vertical on mobile — mirroring the
  inspiration. Real component CSS, not a video.
- **Live R3F, never a scrubbed video** — per the brief's critical difference.

## Technical decisions

- **`reactStrictMode: false`** (`next.config.ts`). Strict Mode's dev-only
  double-mount makes R3F force-lose the WebGL context, leaving the dev remount
  dead (the globe would fall to its static fallback **in dev only**; production is
  fine). Disabling keeps one stable context.
- **`ssr: false` lives in a Client Component** (`GlobeBackground`), per the Next
  lazy-loading guide.
- **FOV is declarative** (drei `<PerspectiveCamera>`) rather than mutated each
  frame — both correct for portrait re-framing and clean under the
  `react-hooks/immutability` lint rule. Camera position/look-at are still driven
  imperatively in `useFrame` (the intended R3F pattern).
- **Bloom threshold high (0.5)** so only the bright additive arcs + landing pulses
  bloom; the dot-matrix globe stays restrained.
- **Particles** are a cheap 2D canvas (not a third WebGL pass), between globe and
  content; honour reduced motion and pause when hidden.

## Reduced motion
The globe renders a fixed, elegant 3/4 framing with Cape Town lit; the camera
journey is disabled and content is shown without scroll-driven animation (no
trapping the reader in motion).

## Assumptions to confirm
- Type scale / tracking values marked _(assumed)_ in `DESIGN_TOKENS.md` are
  tasteful matches where the live site didn't expose exact values.
- `lib/cities.ts` is a curated representative spread across the 27+ countries —
  not an official roster. Featured node labels are verbatim from the live copy.
- Conference dates/lens and pillar copy are from SITE-OVERVIEW.md.
- Social URLs in `lib/content.ts` are placeholders.

## Verification
Reviewed via Playwright at desktop (5 journey stops), mobile portrait, and
`prefers-reduced-motion`. Production build, `tsc --noEmit`, and ESLint clean.
