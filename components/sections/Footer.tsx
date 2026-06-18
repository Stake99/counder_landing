"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  RESOLVE,
  FOOTER_COLUMNS,
  QUICK_FACTS,
  SOCIALS,
} from "@/lib/content";

/**
 * The resolve: the camera pulls back, the globe settles, and the Counder
 * ring-mark + a single invitation CTA land — then the full site footer. The
 * lower gradient deepens to near-solid so the footer stays legible as the globe
 * recedes behind it.
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
      {/* Resolve CTA */}
      <div
        ref={ctaRef}
        className="mx-auto flex min-h-[92svh] max-w-3xl flex-col items-center justify-center px-[var(--side-padding)] text-center"
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
          {RESOLVE.eyebrow}
        </p>
        <h2
          data-rise
          className="mt-5 text-[clamp(2.5rem,6vw,5rem)] font-medium leading-[1.02] tracking-[-0.03em] text-hero-fg"
        >
          {RESOLVE.title}
        </h2>
        <p
          data-rise
          className="mx-auto mt-6 max-w-lg text-[clamp(1rem,1.4vw,1.2rem)] font-light leading-[1.6] text-hero-muted"
        >
          {RESOLVE.body}
        </p>
        <div data-rise className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a href={RESOLVE.primary.href} className="btn-pill btn-pill--solid">
            {RESOLVE.primary.label}
          </a>
          <a href={RESOLVE.secondary.href} className="btn-pill btn-pill--ghost">
            {RESOLVE.secondary.label}
          </a>
        </div>

        <dl data-rise className="mt-16 grid w-full grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
          {QUICK_FACTS.map((f) => (
            <div key={f.label} className="text-center">
              <dt className="text-[clamp(1.6rem,3vw,2.4rem)] font-medium text-hero-fg">
                {f.value}
              </dt>
              <dd className="kicker mt-2 text-hero-muted">{f.label}</dd>
            </div>
          ))}
        </dl>
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
