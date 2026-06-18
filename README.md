# Counder — The Network for Collective Understanding

A production-grade home page for **Counder**, a curated global network of
investors, founders, and leaders across 27+ countries that converges once a year
at the **Counder Conference** in Cape Town (25–29 Jan 2027 · _The AI Inflection_).

The centerpiece is a **full-screen, responsive 3D motion hero**: a slowly
rotating dot-matrix earth with luminous great-circle arcs streaming in from cities
worldwide and converging on Cape Town — the visual expression of _"500
perspectives from all over the world, in one place… Cape Town."_ The rest of the
repo is scaffolded (but not implemented) so it can grow into the Counder Connect
product.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run build && npm start   # production
npm run lint                 # ESLint (clean)
npx tsc --noEmit             # typecheck (clean)
```

No environment variables are needed to run the hero — the home page is static
HTML + client-side WebGL. The `.env.*` values are only for the (stubbed) product
surface below.

## The experience — one globe, the whole site, flown on scroll

The entire home rests on a single persistent 3D globe fixed behind the page.
Scrolling is one continuous cinematic camera journey that ends at Cape Town —
"500 perspectives from all over the world, in one place… Cape Town." It is the
centerpiece; everything else serves it.

**The five beats** (bound to one global scroll progress, 0→1):

1. **Hero** — distant rotating Earth, arcs pulsing in; headline overlay fades out.
2. **Approach** — camera eases inward; arcs intensify toward Cape Town.
3. **The pillars** — a 3/4 orbit framing; The Network · The Conference · Counder
   & Friends wipe-reveal as cards; member nodes surface and fade.
4. **Convergence** — camera descends onto Cape Town as arcs land with ring-pulses;
   "Counder Conference 2027" resolves out of blur.
5. **Resolve** — the camera pulls back, the ring-mark and a single invitation CTA
   land, into the footer.

| Layer | File | What it does |
| --- | --- | --- |
| Background | `components/GlobeBackground.tsx` | Fixed full-site R3F canvas; WebGL probe; pause-on-hidden; static fallback |
| Progress | `components/ScrollProgress.tsx` | One global 0→1 scroll progress (ref) shared by camera + sections |
| Camera + stage | `three/Scene.tsx` | Keyframed camera rig driven by progress; lights; selective bloom; node fade |
| Globe | `three/Globe.tsx` | Dot-matrix earth — a land mask sampled on a Fibonacci sphere; fresnel atmosphere |
| Arcs | `three/Arcs.tsx` | Great-circle arcs from every city to Cape Town, GPU comets in one draw call |
| Pulses | `three/Pulses.tsx` | Concentric ring-pings (the brand rings) as each comet lands |
| Rings / Starfield | `three/OrbitalRings.tsx`, `three/Starfield.tsx` | Brand orbital rings; faint depth |
| Particles | `components/Particles.tsx` | Cheap 2D drift layer between globe and content |
| Content | `components/sections/*` | `Nav`, `Hero`, `Pillars` (wipe cards), `Presenting` (blur→sharp), `Footer` |
| Content data | `lib/content.ts` | Real Counder copy — nav, pillars, presenting, resolve, footer |
| Geo | `lib/geo.ts`, `lib/cities.ts` | lat/lng → vec3, great-circle math, city list + member labels |

**Motion & scroll** — Lenis smooth-scroll synced to GSAP ScrollTrigger
(`SmoothScroll`). The camera reads the global progress ref in `useFrame`; content
sections reveal via their own per-section triggers against the same scroll.

**Quality floor**

- `prefers-reduced-motion` → a fixed, elegant 3/4 globe framing with Cape Town
  lit; the journey is disabled and content shows without scroll-driven motion.
- WebGL is capability-probed; unavailable / error → an on-brand static fallback
  (`HeroFallback.tsx`) behind the same content.
- Visible keyboard focus on CTAs, contrast scrims, no layout shift.

**Performance** — `dpr` capped (`[1, 2]` desktop, `1` mobile); a mobile tier drops
dot/star counts, bloom cost, and node labels and widens the framing; loops idle
(`frameloop: demand`) when the tab is hidden or motion is reduced; arcs pack into
one draw call.

## Design system

Tokens are extracted from the live counder.com (`DESIGN_TOKENS.md`) and wired into
the Tailwind v4 theme + `app/globals.css`: Manrope + DM Mono via `next/font`, the
exact palette, pill buttons, focus ring, and `::selection`. The home inverts to a
dark stage so the luminous globe can carry the whole site — see `NOTES.md`.

## Foundation (scaffolded, not implemented)

Wired so it's obvious how the product extends; **only the hero is fully built**
this pass. Each is a lightweight stub:

| Area | Where | Status |
| --- | --- | --- |
| Supabase (Auth + Postgres + Realtime) | `lib/supabase/{client,server}.ts` | clients wired, no flows |
| Drizzle ORM | `lib/db/`, `drizzle.config.ts` | client + empty schema; `npm run db:*` |
| Resend + email | `lib/email/` | client + one placeholder invite template |
| Product routes | `app/(app)/{profiles,events,chat,matchmaking,notifications,chatbot}` | empty pages with TODOs |
| Chatbot API | `app/api/chatbot/route.ts` | `501` stub (will stream from Claude) |

Copy `.env.example` → `.env.local` to fill in Supabase / Resend / VAPID keys when
those flows get built.

## Where the wider app plugs in

`app/page.tsx` (marketing, outside the `(app)` group) renders `<Hero/>` and the
editorial hand-off section. The product lives under `app/(app)/` behind its own
layout. Profiles/events/chat/matchmaking read through `lib/db` (Drizzle) and
`lib/supabase`; notifications use Web Push (VAPID); the chatbot streams from the
latest Claude model via the API route.

## Stack

Next.js 16 (App Router, TypeScript strict, Turbopack) · React 19 ·
React Three Fiber + drei + postprocessing + three · GSAP ScrollTrigger · Lenis ·
Tailwind CSS v4 · Supabase · Drizzle · Resend. Deploy target: Vercel.
