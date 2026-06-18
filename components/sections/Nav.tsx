"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { NAV_LINKS } from "@/lib/content";

/**
 * Fixed top navigation over the globe — Counder ring-mark + wordmark, the
 * primary links, and the Join CTA. A faint backdrop blur fades in once the user
 * scrolls past the hero so the bar stays legible over the brighter globe.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-[var(--hero-line)] bg-[rgba(255,255,255,0.72)] backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 w-full max-w-[var(--content-width)] items-center justify-between px-[var(--side-padding)]">
        <a
          href="#top"
          className="flex items-center gap-2.5 text-hero-fg"
          aria-label="Counder — home"
        >
          <Image
            src="/brand/logo-rings.svg"
            alt=""
            width={22}
            height={22}
            className="opacity-90 invert"
            priority
          />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">
            Counder
          </span>
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-[13px] text-hero-muted transition-colors hover:text-hero-fg"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <a
            href="#partners"
            className="hidden text-[13px] text-hero-muted transition-colors hover:text-hero-fg sm:inline"
          >
            Partner with us
          </a>
          <a
            href="#apply"
            className="btn-pill btn-pill--solid !px-5 !py-2.5 !text-[13px]"
          >
            Join
          </a>
        </div>
      </nav>
    </header>
  );
}
