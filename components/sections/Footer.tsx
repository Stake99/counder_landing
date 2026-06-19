"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CONTINUES, FOOTER_COLUMNS, SOCIALS } from "@/lib/content";

/**
 * The resolve: the camera pulls back, the globe settles, and the Counder
 * ring-mark lands with a quiet "beyond this page" note — this is a landing, not
 * the whole site, so the experience is shown carrying on — then the full site
 * footer. The lower gradient deepens to near-solid so the footer stays legible
 * as the globe recedes behind it.
 */
export function Footer() {
  const reduced = useReducedMotion();
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-rise]"));

    if (reduced) {
      items.forEach((n) => {
        n.style.opacity = "1";
        n.style.transform = "none";
      });
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
        gsap.fromTo(
          items,
          { y: 36, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 1.1,
            ease: "power3.out",
            stagger: 0.1,
            scrollTrigger: { trigger: el, start: "top 70%" },
          },
        );
      }, el);
      cleanup = () => ctx.revert();
    })();
    return () => {
      mounted = false;
      cleanup();
    };
  }, [reduced]);

  return (
    <footer
      id="apply"
      className="relative z-10"
      style={{
        background:
          "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.78) 40%, #ffffff 100%)",
      }}
    >
      {/* Resolve — the brand ring-mark settles with a quiet "beyond this page"
          note. This is a landing, not the whole site, so the experience is shown
          carrying on (sweeping line = "more follows") rather than an apply CTA. */}
      <div
        ref={ctaRef}
        className="mx-auto flex min-h-[88svh] max-w-2xl flex-col items-center justify-center px-[var(--side-padding)] text-center"
      >
        <Image
          data-rise
          src="/brand/logo-rings.svg"
          alt="Counder"
          width={64}
          height={64}
          className="opacity-90 invert"
        />
        <p data-rise className="kicker mt-8 text-hero-muted">
          {CONTINUES.eyebrow}
        </p>
        <p
          data-rise
          className="mx-auto mt-6 max-w-xl text-[clamp(1.3rem,2.4vw,2rem)] font-light leading-[1.4] tracking-[-0.015em] text-hero-fg"
        >
          {CONTINUES.line}
        </p>
        <a
          data-rise
          href={CONTINUES.cta.href}
          className="continues-cta kicker mt-9 inline-flex items-center gap-2 text-hero-fg"
        >
          {CONTINUES.cta.label}
          <span className="continues-arrow" aria-hidden>
            →
          </span>
        </a>
        <div data-rise className="continues-line mx-auto mt-12" aria-hidden />
      </div>

      {/* Footer rail */}
      <div className="border-t border-[var(--hero-line)]">
        <div className="mx-auto max-w-[var(--content-width)] px-[var(--side-padding)] py-16">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 text-hero-fg">
                <Image
                  src="/brand/logo-rings.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="opacity-90 invert"
                />
                <span className="text-[15px] font-semibold">Counder</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-[1.6] text-hero-muted">
                The Network for Collective Understanding. 27+ countries, once a
                year, in Cape Town.
              </p>
              <div className="mt-5 flex gap-2">
                {SOCIALS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--hero-line)] text-[12px] text-hero-muted transition-colors hover:border-[rgba(0,0,0,0.24)] hover:text-hero-fg"
                  >
                    {s.short}
                  </a>
                ))}
              </div>
            </div>

            {FOOTER_COLUMNS.map((col) => (
              <div key={col.heading}>
                <p className="kicker text-hero-muted">{col.heading}</p>
                <ul className="mt-4 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-sm text-hero-muted transition-colors hover:text-hero-fg"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-[var(--hero-line)] pt-6 sm:flex-row sm:items-center">
            <p className="kicker text-hero-muted">© 2026 Counder Ltd. · Dublin</p>
            <p className="kicker text-hero-muted">
              Counder Conference 2027 · Cape Town
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
