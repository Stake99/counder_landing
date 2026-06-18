"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Hero overlay — the opening of the scroll journey, laid over the distant globe.
 * The 3D is the page-wide background (see GlobeBackground); this is just the
 * accessible copy: kicker, headline (word-by-word reveal), sub-line, CTAs, and a
 * bouncing scroll hint. It fades and lifts away as the camera flies inward.
 */
export function Hero() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Headline words — kept for when the hero copy is re-enabled (see commented JSX below).
  // const headlineWords = useMemo(
  //   () => ["The", "Network", "for", "Collective", "Understanding."],
  //   [],
  // );

  useEffect(() => {
    const inner = innerRef.current;
    const section = sectionRef.current;
    if (!inner || !section) return;

    if (reduced) {
      inner.style.visibility = "visible";
      return;
    }

    let cleanup = () => {};
    let mounted = true;
    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      if (!mounted) return;

      const ctx = gsap.context(() => {
        gsap.set(inner, { autoAlpha: 1 });
        // Entrance tweens — disabled while the hero copy is commented out (no
        // [data-reveal]/[data-fade] targets exist). Re-enable with the copy.
        // gsap.from("[data-reveal] > span", {
        //   yPercent: 110,
        //   opacity: 0,
        //   duration: 1.1,
        //   ease: "expo.out",
        //   stagger: 0.09,
        //   delay: 0.3,
        // });
        // gsap.from("[data-fade]", {
        //   y: 16,
        //   opacity: 0,
        //   duration: 0.9,
        //   ease: "power3.out",
        //   stagger: 0.1,
        //   delay: 1,
        // });
        // Fade + lift away as the approach begins (headline + scroll hint).
        gsap.to(".hero-fades", {
          autoAlpha: 0,
          y: -60,
          filter: "blur(6px)",
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      }, section);
      cleanup = () => ctx.revert();
    })();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      id="top"
      aria-label="The Network for Collective Understanding"
      className="relative flex h-[100svh] w-full items-center justify-center"
    >
      {/* Legibility scrim behind the headline — disabled while the hero copy is
          commented out so it doesn't wash the globe. When the copy returns, use
          a light scrim, e.g. rgba(255,255,255,0.6) → transparent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "transparent" }}
      />

      <div
        ref={innerRef}
        className="hero-fades invisible relative z-10 mx-auto flex max-w-3xl flex-col items-center px-[var(--side-padding)] text-center"
      >
        {/* Hero wording temporarily commented out — letting the cinematic globe
            carry the opening on its own.
        <p
          data-fade
          className="kicker mb-7 flex items-center gap-3 text-hero-muted"
        >
          <span
            className="inline-block h-px w-8"
            style={{ background: "rgba(0,0,0,0.4)" }}
            aria-hidden
          />
          Join Counder · January 2027 · Cape Town
          <span
            className="inline-block h-px w-8"
            style={{ background: "rgba(0,0,0,0.4)" }}
            aria-hidden
          />
        </p>

        <h1 className="font-sans text-[clamp(2.5rem,7vw,5.75rem)] font-medium leading-[1.02] tracking-[-0.03em] text-hero-fg">
          {headlineWords.map((w, i) => (
            <span
              key={i}
              data-reveal
              className="reveal-line mx-[0.14em] inline-block align-top"
            >
              <span>{w}</span>
            </span>
          ))}
        </h1>

        <p
          data-fade
          className="mx-auto mt-7 max-w-xl text-pretty text-[clamp(1rem,1.4vw,1.2rem)] font-light leading-[1.6] text-hero-muted"
        >
          Everybody wants to understand what is going on in the world. Most try to
          figure it out alone.{" "}
          <span className="text-hero-fg">We decided to do it together.</span>
        </p>

        <div data-fade className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a href="#apply" className="btn-pill btn-pill--solid">
            Apply for invite
          </a>
          <a href="#conference" className="btn-pill btn-pill--ghost">
            Explore the journey
          </a>
        </div>
        */}
      </div>

      {/* Bouncing scroll hint. */}
      <div
        data-fade
        aria-hidden
        className="hero-fades absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <span className="scroll-hint" />
      </div>
    </section>
  );
}
