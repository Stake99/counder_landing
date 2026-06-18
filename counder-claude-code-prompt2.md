# Claude Code — Bootstrap Prompt: Counder, the Full-Site Globe Experience

> Paste everything below into Claude Code, run from an **empty folder**. It will study counder.com itself, scaffold the project, and build the experience in passes. An inspiration page is attached to the conversation — mirror its *interaction patterns*, but read the note under "Inspiration" before copying its technique.

---

You are bootstrapping a new, production-grade web project for **Counder — The Network for Collective Understanding**: a curated global network of investors, founders, and leaders across 27+ countries that converges once a year at the **Counder Conference** in Cape Town (25–29 Jan 2027; this year's lens, "The AI Inflection").

Your **primary deliverable** is the home page, and its defining feature is a **full-screen 3D globe that is the background of the entire site and that you fly through as you scroll** — matching the look, feel, and tone of the live site at **https://counder.com**. This is the centerpiece and the thing being judged. Its quality beats breadth everywhere else.

## Inspiration (attached page)

Mirror these **interaction patterns** from the attached inspiration:

- A single full-screen background fixed behind the page (`position: fixed; inset: 0`), with all content scrolling *over* it.
- A hero that fades out as you scroll past it.
- Three cards that **wipe-reveal** via an animated `linear-gradient` mask (horizontal on desktop, vertical on mobile).
- A subtle particle layer overlaid on top for depth.
- An intersection-triggered "Presenting …" reveal (translateY + blur→sharp).
- A bouncing scroll-hint arrow in the hero, and a clean nav (logo + links + socials).

**One critical difference — do NOT copy its background technique.** The inspiration scrubs a pre-rendered flower video frame-by-frame on a canvas. We are **replacing the flower with a live 3D globe**. Do **not** ship or scrub a pre-rendered video for the globe. Instead, render a real **React Three Fiber** scene and bind its camera + animation timeline to scroll progress. Live 3D is sharper, far lighter (no multi-MB video download), infinitely zoomable, and lets the globe genuinely respond to scroll — which is the whole point.

## Step 0 — Study the live site first (before writing any code)

Fetch and study `https://counder.com` (also `/conference`, `/network`, `/about`). Extract the **real** design language into `DESIGN_TOKENS.md`:

- Exact color palette (background, foreground, accents) as hex
- Display + body typefaces, weights, type scale, letter-spacing
- Spacing rhythm, border-radius, max content widths
- Motion language: easing curves, durations, scroll feel (the live site already uses smooth scroll + scroll-triggered sequences — match it)
- The brand's geometric motif — note the concentric **rings** logo (`logo-rings.svg`)

Match these exactly; don't impose a generic aesthetic. Where a value can't be determined, pick the closest tasteful match and record the assumption.

## The centerpiece — one globe, the whole site, flown on scroll

The entire site rests on a single persistent, full-viewport 3D globe background. Scrolling the page is one continuous cinematic camera journey around and into the globe, ending at Cape Town — the visual expression of "500 perspectives from all over the world, in one place… Cape Town."

Make it unmistakably *Counder*: echo the concentric-**rings** motif, keep it editorial and restrained (spend the whole "wow" budget on the arcs converging on Cape Town), and surface the network's real people as labelled nodes pulled from the site's own copy ("Quantum computing professor · Zurich", "Family office principal · São Paulo", "Architect · Cape Town", "Fortune 500 CEO · New York").

### Scroll journey — bind to a single global scroll progress (0 → 1) via Lenis + GSAP ScrollTrigger

- **0.00 — Hero.** Distant, slowly rotating dark Earth; atmospheric fresnel rim-glow; faint starfield; connection arcs pulsing in from around the world. Headline overlay: *"The Network for Collective Understanding."* Scroll-hint arrow.
- **0.00–0.25 — Approach.** Camera eases inward; arcs intensify and stream toward Cape Town; hero copy fades out.
- **0.25–0.55 — The pillars.** Camera settles on a 3/4 framing with Cape Town prominent and slowly orbiting. The three Counder pillars — **The Network**, **The Conference**, **Counder & Friends** — wipe-reveal as cards over the globe (mirror the inspiration's mask wipe). Labelled network nodes surface and fade.
- **0.55–0.80 — Convergence.** Camera descends toward Cape Town; every arc lands with concentric ring-pulses (the brand rings made literal). A "Presenting" reveal resolves out of blur: *"Counder Conference 2027 · Cape Town · 25–29 January."*
- **0.80–1.00 — Resolve.** Camera pulls back / the globe settles; the Counder ring-mark and a single CTA: *"Apply for an invitation."*

### Globe — technical spec

- Full-viewport R3F canvas fixed behind content (`position: fixed; inset: 0; z-index: -10`).
- **Globe:** dark, premium Earth (landmass via texture or dot-matrix shader), gentle base rotation, atmospheric fresnel rim-glow.
- **Connection arcs:** great-circle arcs from ~12–20 global cities converging on Cape Town (`lat -33.9249, lng 18.4241`). Travelling glow along each, staggered, seamless loop. **Instanced** for performance.
- **Landing pulses:** concentric ring pulse on Cape Town as each arc completes.
- **Glow:** selective bloom so arcs/lights read as luminous; keep the globe itself restrained.
- **Camera rig:** a single rig whose position + look-at target are driven entirely by scroll progress through the journey above. Ease everything; no snapping.
- **Reduced motion:** honor `prefers-reduced-motion` — render a still, elegant framing of the globe with Cape Town lit, and let content reveal with simple fades. Never trap the reader in motion.
- **Performance:** lazy-load (`next/dynamic`, `ssr: false`); cap `dpr` `[1, 2]`; pause `useFrame` when the tab is hidden; dispose geometries/materials; sane texture sizes. Target 60fps desktop / smooth mobile and Lighthouse perf ≥ 90 with the canvas deferred.
- **Responsive:** recompose for portrait — adjust camera framing and FOV so Cape Town and the arcs stay legible; reduce arc/particle counts on mobile.

### Content & interaction (mirror the inspiration, layered over the globe)

- `#content` wrapper scrolls above the fixed globe; nav fixed on top.
- Hero fades out on scroll.
- Three pillar cards wipe-reveal via animated `linear-gradient` mask (horizontal desktop / vertical mobile).
- Subtle particle canvas overlaid above the globe.
- Intersection-triggered "Presenting" reveal (translateY + blur→sharp).
- Bouncing scroll-hint arrow in the hero; nav with the Counder logo, links (Conference, Network, About), and socials.

## Tech stack (use exactly this)

- **Next.js 15** (App Router, TypeScript, Turbopack), React 19
- **React Three Fiber** + **@react-three/drei** + **@react-three/postprocessing** (+ `three`)
- **GSAP** + **ScrollTrigger** for the scroll-bound timeline
- **Lenis** (`lenis`) for smooth scroll, synced to ScrollTrigger
- **Tailwind CSS v4** + **shadcn/ui**
- **next/font** for typefaces matched to counder.com
- TypeScript **strict**, ESLint + Prettier; deploy target **Vercel**
- **Not** a scrubbed pre-rendered video for the globe — live R3F only.

## Foundation for the wider product (scaffold + configure only — don't implement)

This repo will grow into the Counder Connect app. Set up the wiring so it's obvious how it extends, but in this pass only the globe experience is fully built. Stub with config + `.env.example` + a one-line README note each: Supabase (Postgres + Auth incl. magic link + Realtime), Resend + React Email, Drizzle (empty schema), and placeholder routes for `profiles`, `events`, `chat`, `matchmaking`, `notifications`, `chatbot`. Keep these lightweight; don't let them distract from the globe.

## Suggested structure

```
app/
  (marketing)/page.tsx        # home — globe background + scrolling content
  (app)/...                   # placeholder product routes
  layout.tsx
  globals.css
components/
  three/                      # Scene, Globe, Arcs, Pulses, Starfield, CameraRig
  sections/                   # Hero, Pillars (wipe cards), Presenting, Footer
  ui/                         # shadcn primitives
lib/                          # supabase, email, geo (lat/lng -> vec3), utils
hooks/                        # useLenis, useScrollProgress, useReducedMotion
DESIGN_TOKENS.md
NOTES.md
README.md
```

## How to proceed

1. Scaffold Next.js 15 (TS, App Router, Tailwind v4); init git; ESLint/Prettier.
2. Step 0 → `DESIGN_TOKENS.md`; apply tokens to the Tailwind theme + fonts.
3. Install the 3D + motion stack; wire Lenis ↔ ScrollTrigger; set up a single `useScrollProgress`.
4. Build in passes: **(a)** globe + rotation + atmosphere + starfield → **(b)** arcs + travelling glow + bloom → **(c)** scroll-bound `CameraRig` running the full journey → **(d)** content sections (hero fade, pillar wipe-cards, "Presenting" reveal, footer CTA) → **(e)** particles overlay → **(f)** responsive + reduced-motion + perf tuning.
5. Add the foundation scaffolding (configs + placeholder routes).
6. Write `README.md`: run instructions, env setup, where the wider app plugs in, and the design decisions you made.
7. Run `dev`, review side-by-side with counder.com, screenshot and critique the journey end-to-end, and iterate until it feels genuinely on-brand and premium.

## Working agreement

- Make pragmatic, opinionated calls; note non-obvious ones in `NOTES.md` and flag them.
- Production-quality, fully typed, commented — especially the shaders, arc math, and the scroll→camera mapping.
- Prioritize the globe journey above all else. A few things executed beautifully beat many done roughly.
