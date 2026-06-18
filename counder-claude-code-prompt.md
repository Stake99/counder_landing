# Claude Code — Bootstrap Prompt: Counder Motion Hero + Foundation

> Paste everything below into Claude Code, run from an **empty folder**. It will inspect counder.com itself, scaffold the project, and build the hero in passes.

---

You are bootstrapping a new, production-grade web project for **Counder — The Network for Collective Understanding**: a curated global network of investors, founders, and leaders across 27+ countries that converges once a year at the **Counder Conference** in Cape Town (25–29 Jan 2027; this year's lens, "The AI Inflection").

This repo will eventually become the home of the Counder product, but your **immediate, primary deliverable** is a **full-screen, responsive 3D motion hero section** for the home page that matches the look, feel, and tone of the live site at **https://counder.com**. Treat this hero as the centerpiece — it is the thing being judged. Quality of this one section beats breadth everywhere else.

## Step 0 — Study the live site before writing any code

Fetch and study `https://counder.com` (also `/conference`, `/network`, `/about`). Extract the **real** design language and write it into `DESIGN_TOKENS.md`:

- Exact color palette (background, foreground, accents) as hex values
- Display + body typefaces, weights, type scale, letter-spacing
- Spacing rhythm, border-radius usage, max content widths
- Motion language: easing curves, durations, scroll behavior (the live site uses smooth scroll + scroll-triggered image sequences and video — match that feel)
- The brand's geometric motif — note the concentric **rings** logo (`logo-rings.svg`)

Match these **exactly**. Do not impose a generic aesthetic. Where you can't determine an exact value, pick the closest tasteful match and record the assumption in `DESIGN_TOKENS.md`.

## Creative direction (the hero)

Build an elevated take on the brief's reference idea: **a slowly rotating 3D globe with luminous arcs of connection streaming in from cities across the world and converging on Cape Town** — the visual expression of "500 perspectives from all over the world, in one place… Cape Town."

Make it unmistakably *Counder*, not a generic globe demo:

- **Echo the concentric-rings brand motif** — soft orbital rings around the globe, and a pulsing ring-ping where each arc lands on Cape Town.
- **Restraint over spectacle.** Counder is editorial and refined. Spend the entire "wow" budget in one place (the converging arcs + the Cape Town landing); keep everything else quiet and disciplined. Scattered effects read as AI-generated — one orchestrated moment lands harder.
- **Surface the network's real people.** Occasionally reveal labelled nodes pulled from the site's own copy: "Quantum computing professor · Zurich", "Family office principal · São Paulo", "Architect · Cape Town", "Fortune 500 CEO · New York".
- **Headline overlay in accessible HTML**, in Counder's voice and type — e.g. *"The Network for Collective Understanding."* with a quiet sub-line and a single CTA.

> Optional stretch (record in `NOTES.md`, but default to the globe): a field of drifting perspective-nodes that, on scroll, draw connecting lines and resolve into the Counder ring-mark. Only pursue if you can execute it to a *higher* bar than the globe.

## Hero motion — technical spec

- Full-viewport (`100svh`), pinned canvas behind accessible HTML content.
- **Globe:** dark, premium earth (landmass via texture or dot-matrix shader), gentle auto-rotation, atmospheric fresnel rim-glow.
- **Connection arcs:** great-circle arcs from ~12–20 global cities converging on Cape Town (`lat -33.9249, lng 18.4241`). Travelling glow along each arc, staggered, looping seamlessly. **Instanced** for performance.
- **Landing pulses:** a concentric ring pulse on Cape Town as each arc completes.
- **Glow:** selective bloom postprocessing so arcs/lights read as luminous; keep the globe itself restrained.
- **Ambient:** faint starfield / particle depth — very subtle.
- **Scroll choreography (GSAP ScrollTrigger + Lenis):** as the user scrolls into/through the section, ease the camera (slow push toward Cape Town / slight tilt) and reveal the headline + nodes in one orchestrated sequence.
- **Responsive:** scale gracefully to mobile — reduce arc/particle counts, lower DPR cap, simplify postprocessing; never drop below smooth on a mid-range phone. Hold the composition at every breakpoint.
- **Accessibility / quality floor:** honor `prefers-reduced-motion` (render a still, elegant frame), visible keyboard focus on the CTA, strong contrast on overlay text, zero layout shift.
- **Performance targets:** 60fps desktop / smooth mobile. Lazy-load the 3D (`next/dynamic`, `ssr: false`); cap `dpr` (e.g. `[1, 2]`); pause `useFrame` when offscreen or the tab is hidden; dispose geometries/materials; keep textures sane. Aim Lighthouse performance ≥ 90 with the canvas deferred.

## Tech stack (use exactly this — opinionated and modern)

- **Next.js 15** (App Router, TypeScript, Turbopack), React 19
- **React Three Fiber** + **@react-three/drei** + **@react-three/postprocessing** (+ `three`) for WebGL 3D
- **GSAP** with **ScrollTrigger** for motion + scroll orchestration
- **Lenis** (`lenis`) for smooth scroll, synced to ScrollTrigger
- **Tailwind CSS v4** + **shadcn/ui** for the design system and UI primitives
- **next/font** (or self-hosted) for typefaces matched to counder.com
- TypeScript **strict**, ESLint + Prettier
- Deploy target: **Vercel**

## Foundation for the wider product (scaffold + configure — do NOT fully implement)

This repo is meant to grow into the Counder Connect web app. Set up the structure and wiring so it's obvious how it extends, but in this pass **only the hero is fully built**. Stub the rest with config, env placeholders, and a one-line README note each:

- **Auth (email + magic link), DB, Realtime:** Supabase (Postgres + Auth + Realtime) — create the client + `.env.example`, no flows yet.
- **Transactional email:** Resend + React Email — config + one placeholder template.
- **ORM:** Drizzle — config + an empty schema folder.
- **Placeholder routes** (empty handlers/pages with TODOs): `profiles`, `events` (event management + session scheduling), `chat`, `matchmaking`, `notifications` (web push), `chatbot`.

Keep these lightweight. Do not let them distract from the hero.

## Suggested project structure

```
app/
  (marketing)/page.tsx        # home, renders <Hero/>
  (app)/...                   # placeholder product routes
  layout.tsx
  globals.css
components/
  three/                      # Globe, Arcs, Pulses, Starfield, Scene
  sections/                   # Hero (+ room to grow)
  ui/                         # shadcn primitives
lib/                          # supabase, email, utils, geo (lat/lng -> vec3)
hooks/                        # useLenis, useReducedMotion, useScrollProgress
DESIGN_TOKENS.md
NOTES.md
README.md
```

## How to proceed

1. Scaffold the Next.js 15 app (TS, App Router, Tailwind v4); init git; set up ESLint/Prettier.
2. Do Step 0 (study counder.com → `DESIGN_TOKENS.md`) and apply tokens to the Tailwind theme + fonts.
3. Install the 3D + motion stack; wire Lenis ↔ ScrollTrigger.
4. Build the hero in passes: **(a)** globe + rotation + atmosphere → **(b)** arcs + travelling glow + bloom → **(c)** Cape Town landing pulses + ring motif → **(d)** scroll choreography + headline/node reveals → **(e)** responsive + reduced-motion + perf tuning.
5. Add the foundation scaffolding (Supabase / Resend / Drizzle configs + placeholder routes).
6. Write `README.md`: run instructions, env setup, where the wider app plugs in, and the design decisions you made.
7. Run `dev`, self-review against counder.com side by side, screenshot and critique the hero, and iterate until it feels genuinely on-brand and premium.

## Working agreement

- Make pragmatic, opinionated calls. Where a decision is non-obvious, leave a short note in `NOTES.md` and flag it to me.
- Production-quality, fully typed, commented — especially the shader and animation math. No dead placeholder copy where real Counder copy fits.
- Prioritize the hero's quality above breadth. A few things executed beautifully beat many done roughly.
