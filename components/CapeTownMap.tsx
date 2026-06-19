"use client";

import { useEffect, useRef, useState } from "react";

import {
  SA_PATH,
  SA_TRANSFORM,
  SA_VIEWBOX,
  CAPE_TOWN_MARKER,
} from "@/lib/saMap";

/**
 * The Cape Town "arrival" panel.
 *
 * When Cape Town is clicked, the globe (Scene) finishes its signature descent,
 * stops the converging arcs, and dispatches `globe:cape-enter`. This DOM overlay
 * answers it: a framed panel floats over the dimmed globe showing the map of
 * South Africa with Cape Town highlighted. Closing it (× / Esc / click-anywhere)
 * dispatches `globe:cape-exit`, which tells Scene to resume the beaming arcs.
 *
 * Kept as a DOM layer (not in the R3F canvas) so the map is crisp text + vector
 * and fully accessible; the canvas↔DOM handshake reuses the window-event bridge
 * already used by GlobeNodeList.
 */

// Marker position as a fraction of the square viewBox → lets us place a crisp
// HTML label beside it (the SVG is rendered xMidYMid in a square box).
const MARK_LEFT = (CAPE_TOWN_MARKER.x / 1024) * 100;
const MARK_TOP = (CAPE_TOWN_MARKER.y / 1024) * 100;

export function CapeTownMap() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<Element | null>(null);

  // Open on the globe's signal.
  useEffect(() => {
    const onEnter = () => setOpen(true);
    window.addEventListener("globe:cape-enter", onEnter as EventListener);
    return () =>
      window.removeEventListener("globe:cape-enter", onEnter as EventListener);
  }, []);

  // Close → tell the globe to resume the arcs.
  const close = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("globe:cape-exit"));
  };

  // Esc to dismiss + focus management while open.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Return focus to whatever had it before the panel opened.
      (restoreRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  return (
    <div
      className={`ct-overlay${open ? " is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="South Africa — Cape Town, host of the Counder Conference"
      aria-hidden={!open}
      onClick={close}
    >
      {/* Stop nothing: a click anywhere (incl. the panel) dismisses, by design. */}
      <div className="ct-panel">
        <div className="ct-panel__head">
          <p className="kicker ct-eyebrow">Counder 2027 · The destination</p>
          <button
            ref={closeRef}
            type="button"
            className="ct-close"
            aria-label="Close map and return to the globe"
            onClick={close}
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        <h2 className="ct-title">South Africa</h2>

        <div className="ct-map">
          <svg
            viewBox={SA_VIEWBOX}
            preserveAspectRatio="xMidYMid meet"
            className="ct-svg"
            aria-hidden
          >
            <g transform={SA_TRANSFORM}>
              <path d={SA_PATH} className="ct-country" />
            </g>
            {/* Cape Town beacon — pinging rings + core dot. */}
            <g transform={`translate(${CAPE_TOWN_MARKER.x} ${CAPE_TOWN_MARKER.y})`}>
              <circle className="ct-ping ct-ping--1" r={16} />
              <circle className="ct-ping ct-ping--2" r={16} />
              <circle className="ct-dot" r={9} />
            </g>
          </svg>

          {/* Crisp HTML label anchored beside the marker. */}
          <div
            className="ct-pin-label"
            style={{ left: `${MARK_LEFT}%`, top: `${MARK_TOP}%` }}
          >
            <span className="ct-pin-name">Cape Town</span>
            <span className="ct-pin-coords">33.92°S · 18.42°E</span>
          </div>
        </div>

        <p className="ct-caption">
          Where today meets tomorrow — the Mother City, 25–29 January 2027.
        </p>
      </div>
    </div>
  );
}
