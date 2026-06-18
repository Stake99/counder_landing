"use client";

import { CITIES, CAPE_TOWN_NODE } from "@/lib/cities";

/**
 * A non-pointer path into the globe's network. Visually hidden but fully
 * focusable, so keyboard + screen-reader users can reach every node that a
 * mouse user can hover. Focusing a button surfaces that node in the scene
 * (label + emphasised arcs); activating it flies to the city — the same two
 * outcomes as hover and click, dispatched as window events the canvas listens
 * for. Cape Town is the final entry (index === CITIES.length).
 */
function emit(name: "globe:focus" | "globe:meet", index: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail: { index } }));
}

export function GlobeNodeList() {
  const nodes = [
    ...CITIES.map((c, i) => ({
      index: i,
      label: c.person ? `${c.person} · ${c.role ?? c.name}` : c.name,
    })),
    {
      index: CITIES.length,
      label: `${CAPE_TOWN_NODE.person} · ${CAPE_TOWN_NODE.role}`,
    },
  ];

  return (
    <nav aria-label="Explore the Counder network" className="sr-only">
      <ul>
        {nodes.map((n) => (
          <li key={n.index}>
            <button
              type="button"
              onFocus={() => emit("globe:focus", n.index)}
              onBlur={() => emit("globe:focus", -1)}
              onClick={() => emit("globe:meet", n.index)}
            >
              Meet {n.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
