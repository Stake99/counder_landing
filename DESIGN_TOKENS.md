# Counder — Design Tokens

Extracted directly from the live site at **https://counder.com** (inline `:root`
CSS + computed styles). Values marked _(assumed)_ are tasteful choices where the
live site did not expose an exact value; they are flagged so they can be tuned.

## Brand essence

> "The Network for Collective Understanding."

Editorial, restrained, intellectual but warm. Lots of whitespace, near-black on
white, a single quiet accent (cream), pill buttons, and the concentric **rings**
logo mark. Motion is smooth and unhurried (Lenis smooth-scroll + scroll-driven
reveals). The product marketing is _light_; our hero inverts to a _dark_ stage so
the luminous globe can carry the "wow" — see `NOTES.md` for that decision.

## Color palette (exact, from `:root`)

| Token               | Value     | Usage                                  |
| ------------------- | --------- | -------------------------------------- |
| `--black`           | `#000000` | Foreground text, buttons, focus ring   |
| `--white`           | `#ffffff` | Page background                        |
| `--gray-body`       | `#666666` | Body copy                              |
| `--gray-muted`      | `#999999` | Secondary / muted copy                 |
| `--gray-border`     | `#e0e0e0` | Hairline borders                       |
| `--gray-placeholder`| `#757575` | Form placeholders                      |
| `--cream`           | `#f5f3ef` | Warm section background / accent       |

### Hero (dark stage) — derived for our hero only

| Token             | Value       | Usage                                |
| ----------------- | ----------- | ------------------------------------ |
| `--hero-bg`       | `#05060a`   | Near-black space backdrop            |
| `--hero-bg-2`     | `#0a0d14`   | Radial vignette inner               |
| `--hero-fg`       | `#f5f3ef`   | Overlay text (the brand cream)       |
| `--hero-muted`    | `#9aa0ac`   | Sub-copy / labels                    |
| `--hero-arc`      | `#eef1f6`   | Arc core (near-white, luminous)      |
| `--hero-arc-warm` | `#f3e9d6`   | Arc warm tint near Cape Town landing |
| `--hero-land`     | `#2a3240`   | Globe land dots (cool slate)         |
| `--hero-cape`     | `#ffd9a0`   | Cape Town pulse / convergence accent |

## Typography (exact)

Loaded from Google Fonts on the live site:
`family=DM+Mono&family=Manrope:wght@300;400;500;600;700`

| Role     | Family                      | Weights            |
| -------- | --------------------------- | ------------------ |
| Sans / display | **Manrope**, sans-serif | 300, 400, 500, 600, 700 |
| Mono / eyebrow | **DM Mono**, monospace  | 400 (used for labels, uppercase, tracked) |

- Display headlines: Manrope, weight ~500–600, **tight tracking** (`-0.02em` to
  `-0.035em` on large sizes) _(assumed scale)_, line-height ~1.02–1.08.
- Body: Manrope 400, `--gray-body`, line-height ~1.6.
- Eyebrow / kicker: DM Mono, uppercase, letter-spacing ~`0.18em`, small
  (12–13px) — matches the live "JOIN COUNDER · JANUARY 2027 · CAPE TOWN" rhythm.

## Spacing, layout, radius (exact)

| Token             | Value                          |
| ----------------- | ------------------------------ |
| `--content-width` | `1420px`                       |
| `--side-padding`  | `40px` desktop / `20px` ≤640px |
| Button radius     | `100px` (full pill)            |
| Focus ring        | `2px solid #000`, offset `3px`, radius `2px` |
| Hairlines/cards   | minimal radius, sharp corners  |

## Motion language (exact curves observed)

| Curve                          | Used for                                  |
| ------------------------------ | ----------------------------------------- |
| `cubic-bezier(.23, 1, .32, 1)` | Button hover (box-shadow + lift), "easeOutExpo"-like |
| `cubic-bezier(.215, .61, .355, 1)` | Reveal transforms / menu (easeOutCubic) |
| Durations                      | `.2s` color, `.25s` shadow/transform, `.3–.4s` reveals |

- Smooth scroll: **Lenis** (the live `<html>` carries `class="lenis"`).
- Reveals are scroll-triggered (word-by-word headline `.b-word`, scroll-pinned
  cards). We mirror this with **GSAP ScrollTrigger** synced to Lenis.
- Buttons lift `translateY(-1px)` + soft shadow on hover; respect
  `prefers-reduced-motion` (live site disables the lift).

## Interaction details (exact)

- `.btn-outline`: 14px Manrope, `1px solid #000`, pill, padding `11px 25px`;
  hover inverts to black bg / white text + `0 6px 20px #0000001f` shadow.
- `::selection`: black background, white text.
- `:focus-visible`: `2px solid #000`, offset `3px`.

## Brand motif — the rings

`/brand/logo-rings.svg` (copied from the live `/images/icons/logo-rings.svg`):
a large open ring forming a "C" interlocked with a smaller solid-stroked ring —
concentric / orbital geometry. The hero echoes this with **orbital rings** around
the globe and a **concentric ring-ping** wherever an arc lands on Cape Town.

## Real copy (sourced from the live site, reused verbatim in the hero)

- Headline: **"The Network for Collective Understanding."**
- Tagline: _"Everybody wants to understand what is going on in the world. Most try
  to figure it out alone. We decided to do it together."_
- Convergence line: _"500 perspectives from all over the world, in one place.
  Once a year. Cape Town."_
- Eyebrow: **JOIN COUNDER · JANUARY 2027 · CAPE TOWN**
- Conference: **Counder Conference 2027 · 25–29 January · Cape Town · This year's
  lens: The AI Inflection.**
- CTAs: **Join**, **Apply for invite**, **Learn more**
- Network reach: **27+ countries**
- People nodes (verbatim from the live "different worlds" copy):
  - A Fortune 500 CEO — New York
  - A renowned architect — Cape Town
  - A quantum computing professor — Zurich
  - A family office principal — São Paulo
