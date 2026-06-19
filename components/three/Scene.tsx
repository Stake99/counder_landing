"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

import { Globe } from "./Globe";
import { Gallery } from "./Gallery";
import { CityPoints } from "./CityPoints";
import { OrbitalRings } from "./OrbitalRings";
import { Arcs, type ArcsProps } from "./Arcs";
import { Pulses, type PulsesHandle } from "./Pulses";
import { Starfield } from "./Starfield";
import { WordSatellites } from "./WordSatellites";
import { CITIES, CAPE_TOWN_NODE } from "@/lib/cities";
import { CAPE_TOWN, greatCircleArc, latLngToVector3, type LatLng } from "@/lib/geo";

/**
 * The persistent, full-site globe stage. One R3F Canvas, fixed behind all
 * content, composing the cinematic Earth, converging arcs, Cape Town landing
 * pulses, orbital rings, and starfield.
 *
 * Two timelines coexist:
 *  • SCROLL is the master — it flies the camera (keyframes) through the journey
 *    and settles the globe to a fixed Cape-Town-front orientation at the
 *    convergence so the landing is always composed.
 *  • The CURSOR adds a tactile layer on top of the GLOBE group (drag + inertia,
 *    a luminous wake, hover-to-meet) and a gyroscopic parallax on the whole
 *    scene. All cursor input eases out as the camera converges so it never
 *    fights the scroll-bound landing.
 */

const RADIUS = 1;
const CAPE_INDEX = CITIES.length; // node id for Cape Town (after the origin cities)
const ROT_SPEED = 0.005; // rad per pixel dragged
const PITCH_LIMIT = 0.5; // clamp vertical tilt
const TAP_THRESH = 8; // px of movement under which a press counts as a tap/click

export interface SceneProps {
  /** Global scroll progress 0→1 (from the ScrollProgress provider). */
  progressRef: React.RefObject<number>;
  /** True when tab hidden / reduced-motion — freezes all loops. */
  pausedRef: React.RefObject<boolean>;
  /** Render a single still framing, no animation. */
  reduced: boolean;
  /** Drives the rAF loop: continuous unless idle. */
  active: boolean;
  /** Coarse quality tier — drops counts + bloom cost + widens framing on mobile. */
  quality: "low" | "high";
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const nowSec = () =>
  (typeof performance !== "undefined" ? performance.now() : 0) / 1000;

/* Cape-Town-front orientation: rotate the globe so Cape Town's longitude faces
 * the camera (+Z) and its southern latitude lifts toward centre. Fixed for the
 * whole journey, so the convergence point is reliably composed. */
function useOrientation() {
  return useMemo(() => {
    const v = latLngToVector3(CAPE_TOWN.lat, CAPE_TOWN.lng, RADIUS);
    const baseY = Math.atan2(-v.x, v.z);
    const afterY = v.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), baseY);
    const baseX = Math.atan2(afterY.y, afterY.z) * 0.82;
    const euler = new THREE.Euler(baseX, baseY, 0, "XYZ");
    const cape = latLngToVector3(CAPE_TOWN.lat, CAPE_TOWN.lng, RADIUS).applyEuler(euler);
    return { baseY, baseX, cape };
  }, []);
}

function Stage({ progressRef, pausedRef, reduced, quality }: SceneProps) {
  const { camera, size, gl } = useThree();
  const isMobile = quality === "low";
  const coarse = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches,
    [],
  );

  const parallaxRef = useRef<THREE.Group>(null);
  const worldRef = useRef<THREE.Group>(null);
  const occluderRef = useRef<THREE.Mesh>(null!);
  const pulsesRef = useRef<PulsesHandle>(null);
  const cityPointsRef = useRef<THREE.InstancedMesh>(null);
  const hoverDotRef = useRef<THREE.Mesh>(null);
  const { baseY, baseX, cape } = useOrientation();

  // ── Static geometry helpers ────────────────────────────────────────────────
  const cityPos = useMemo(
    () => CITIES.map((c) => latLngToVector3(c.lat, c.lng, RADIUS * 1.012)),
    [],
  );
  const capePos = useMemo(
    () => latLngToVector3(CAPE_TOWN.lat, CAPE_TOWN.lng, RADIUS * 1.012),
    [],
  );
  const capeDir = useMemo(() => capePos.clone().normalize(), [capePos]);

  // Nearest neighbours (angular) for the hover "introduction" threads.
  const neighbours = useMemo(() => {
    const dirs = CITIES.map((c) => latLngToVector3(c.lat, c.lng, 1));
    return CITIES.map((_, i) =>
      dirs
        .map((d, j) => ({ j, a: d.angleTo(dirs[i]) }))
        .filter((x) => x.j !== i)
        .sort((p, q) => p.a - q.a)
        .slice(0, 3)
        .map((x) => x.j),
    );
  }, []);
  const capeNeighbours = useMemo(() => {
    const c = latLngToVector3(CAPE_TOWN.lat, CAPE_TOWN.lng, 1);
    return CITIES.map((city, j) => ({
      j,
      a: latLngToVector3(city.lat, city.lng, 1).angleTo(c),
    }))
      .sort((p, q) => p.a - q.a)
      .slice(0, 4)
      .map((x) => x.j);
  }, []);

  // ── Camera journey keyframes ───────────────────────────────────────────────
  const { keys, scratch } = useMemo(() => {
    const pull = isMobile ? 1.16 : 1;
    const v = (x: number, y: number, z: number) =>
      new THREE.Vector3(x * pull, y * pull, z * pull);
    const capeMid = cape.clone().multiplyScalar(0.55);
    return {
      keys: [
        { p: 0.0, pos: v(0.0, 0.32, 4.35), tgt: new THREE.Vector3(0, 0, 0) },
        { p: 0.22, pos: v(0.12, 0.24, 3.5), tgt: new THREE.Vector3(0, 0.04, 0) },
        { p: 0.5, pos: v(1.5, 0.55, 2.78), tgt: new THREE.Vector3(0, 0.05, 0) },
        { p: 0.72, pos: v(0.6, 0.72, 2.05), tgt: capeMid },
        { p: 0.88, pos: v(0.08, 0.6, 1.62), tgt: cape.clone() },
        { p: 1.0, pos: v(0.0, 0.16, 4.85), tgt: new THREE.Vector3(0, 0, 0) },
      ],
      scratch: {
        pos: new THREE.Vector3(),
        tgt: new THREE.Vector3(),
        flyPos: new THREE.Vector3(),
        flyTgt: new THREE.Vector3(),
        hit: new THREE.Vector3(),
        city: new THREE.Vector3(),
        dir: new THREE.Vector3(),
      },
    };
  }, [cape, isMobile]);

  const reducedPose = useMemo(() => {
    const pull = isMobile ? 1.16 : 1;
    return {
      pos: new THREE.Vector3(0.95 * pull, 0.45 * pull, 3.25 * pull),
      tgt: new THREE.Vector3(0, 0.05, 0),
    };
  }, [isMobile]);

  // Steady Cape-Town-front framing held while scrolling through the gallery —
  // the globe stops, Cape Town faces the camera, and the scroll drives the
  // surfacing tiles (not the camera), so each face reads clearly.
  const galleryPose = useMemo(() => {
    const pull = isMobile ? 1.16 : 1;
    return {
      pos: new THREE.Vector3(0, 0.34 * pull, 3.4 * pull),
      tgt: new THREE.Vector3(0, 0.04, 0),
    };
  }, [isMobile]);

  // ── Mutable interaction state (refs — no per-frame allocations / re-renders) ─
  const eased = useRef(0);
  const tRef = useRef(0);
  const spinRef = useRef(0);
  const ptr = useRef({ x: 0, y: 0, inside: false });
  const drag = useRef({ active: false, lastX: 0, lastY: 0, moved: 0 });
  const vel = useRef({ yaw: 0, pitch: 0 });
  const off = useRef({ yaw: 0, pitch: 0 });
  const lastInteract = useRef(-999);
  const wake = useRef({ pos: new THREE.Vector3(0, 0, 1), amp: 0, t: 0 });
  const pointerHoverRef = useRef(-1);
  const focusRef = useRef(-1); // keyboard focus (a11y)
  const arcHoverRef = useRef(-1);
  const fly = useRef({ active: false, city: -1, t: 0 });
  const camBlend = useRef(0);
  const prevActive = useRef(-1);
  const conferenceRef = useRef<HTMLElement | null>(null);

  // Cape Town "arrival": caped → arcs suppressed + map open; capePending → wait
  // for the descent to settle before opening the map (see the fly block + meet).
  const capedRef = useRef(false);
  const capePendingRef = useRef(false);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  const [activeNode, setActiveNode] = useState<number | null>(null);

  const fov = size.height > size.width ? 52 : isMobile ? 44 : 40;
  const onLand: ArcsProps["onLand"] = () => pulsesRef.current?.trigger();

  // ── Click / tap / keyboard "meet": fly the camera to a node ────────────────
  const meet = useCallback(
    (index: number) => {
      if (index < 0) return;
      lastInteract.current = nowSec();
      if (index >= CAPE_INDEX) {
        // Cape Town — the signature descent gets extra ring-pulses, then the
        // South Africa map surfaces (immediately under reduced motion; otherwise
        // once the descent settles — see the fly block).
        pulsesRef.current?.trigger();
        pulsesRef.current?.trigger();
        pulsesRef.current?.trigger();
        if (reduced) {
          capedRef.current = true;
          window.dispatchEvent(new CustomEvent("globe:cape-enter"));
        } else {
          capePendingRef.current = true;
        }
      }
      if (!reduced) {
        fly.current.active = true;
        fly.current.city = index;
        fly.current.t = 0;
      }
    },
    [reduced],
  );

  // ── Pointer + keyboard wiring (window-level: the globe sits behind content) ─
  useEffect(() => {
    const el = gl.domElement;
    const setNDC = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ptr.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.current.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      ptr.current.inside = true;
    };
    const isUI = (t: EventTarget | null) =>
      t instanceof Element &&
      !!t.closest('a,button,input,textarea,select,[role="button"]');

    const onMove = (e: PointerEvent) => {
      setNDC(e);
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.lastX;
      const dy = e.clientY - drag.current.lastY;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      off.current.yaw += dx * ROT_SPEED;
      vel.current.yaw = dx * ROT_SPEED;
      if (!coarse) {
        // Vertical tilt only on fine pointers — on touch, dy belongs to scroll.
        off.current.pitch = THREE.MathUtils.clamp(
          off.current.pitch + dy * ROT_SPEED,
          -PITCH_LIMIT,
          PITCH_LIMIT,
        );
        vel.current.pitch = dy * ROT_SPEED;
      }
      drag.current.moved += Math.abs(dx) + Math.abs(dy);
      lastInteract.current = nowSec();
    };
    const onDown = (e: PointerEvent) => {
      if (isUI(e.target)) return; // never hijack nav / buttons / inputs
      setNDC(e);
      drag.current.active = true;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      drag.current.moved = 0;
      vel.current.yaw = 0;
      vel.current.pitch = 0;
      lastInteract.current = nowSec();
      if (!coarse) document.body.style.userSelect = "none";
    };
    const onUp = (e: PointerEvent) => {
      if (!drag.current.active) return;
      drag.current.active = false;
      document.body.style.userSelect = "";
      lastInteract.current = nowSec();
      // Touch taps jitter more than mouse clicks — allow a little more travel on
      // coarse pointers before treating a press as a drag (else taps get eaten).
      const tapThresh = coarse ? 16 : TAP_THRESH;
      if (drag.current.moved >= tapThresh || isUI(e.target)) return;
      // Tap/click → raycast immediately (hover state is suppressed mid-press).
      ndc.set(ptr.current.x, ptr.current.y);
      raycaster.setFromCamera(ndc, camera);
      const pts = cityPointsRef.current;
      if (pts) {
        const hits = raycaster.intersectObject(pts, false);
        if (hits.length && hits[0].instanceId != null) {
          meet(hits[0].instanceId);
          return;
        }
      }
      // No node hit — a click on/near Cape Town triggers its descent.
      const world = worldRef.current;
      if (world && occluderRef.current) {
        const sh = raycaster.intersectObject(occluderRef.current, false);
        if (sh.length) {
          world.worldToLocal(scratch.hit.copy(sh[0].point));
          const ang = Math.acos(
            THREE.MathUtils.clamp(
              scratch.dir.copy(scratch.hit).normalize().dot(capeDir),
              -1,
              1,
            ),
          );
          // Cape Town is oriented to face the camera, so the front-centre cap of
          // the globe IS roughly Cape Town. A generous angular target (wider on
          // touch) makes the click reliably land — the old ~10° cap was a ~20px
          // bullseye that taps almost always missed.
          const capeThresh = coarse ? 0.52 : 0.42;
          if (ang < capeThresh) meet(CAPE_INDEX);
        }
      }
    };
    const onCancel = () => {
      drag.current.active = false;
      document.body.style.userSelect = "";
    };
    const onLeave = () => {
      ptr.current.inside = false;
    };
    const onFocusEvt = (e: Event) => {
      const i = (e as CustomEvent<{ index: number }>).detail?.index ?? -1;
      focusRef.current = i;
      if (i >= 0) lastInteract.current = nowSec();
    };
    const onMeetEvt = (e: Event) => {
      meet((e as CustomEvent<{ index: number }>).detail?.index ?? -1);
    };
    // The Cape Town map closed → resume the converging arcs.
    const onCapeExit = () => {
      capedRef.current = false;
      capePendingRef.current = false;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onCancel, { passive: true });
    window.addEventListener("blur", onCancel);
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("globe:focus", onFocusEvt as EventListener);
    window.addEventListener("globe:meet", onMeetEvt as EventListener);
    window.addEventListener("globe:cape-exit", onCapeExit as EventListener);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("globe:focus", onFocusEvt as EventListener);
      window.removeEventListener("globe:meet", onMeetEvt as EventListener);
      window.removeEventListener("globe:cape-exit", onCapeExit as EventListener);
    };
  }, [gl, camera, coarse, meet, capeDir, raycaster, ndc, scratch]);

  useFrame((_, delta) => {
    const world = worldRef.current;
    if (!world) return;
    const cam = camera as THREE.PerspectiveCamera;
    const now = nowSec();
    tRef.current += delta;
    wake.current.t = tRef.current;
    const lerp = (k: number) => Math.min(1, delta * k);

    // ── Pointer hover (instanced points) + luminous wake (surface proxy) ──────
    let pointerHover = -1;
    const canHover = ptr.current.inside && !drag.current.active;
    if (canHover) {
      ndc.set(ptr.current.x, ptr.current.y);
      raycaster.setFromCamera(ndc, cam);
      const pts = cityPointsRef.current;
      if (pts) {
        const hits = raycaster.intersectObject(pts, false);
        if (hits.length && hits[0].instanceId != null)
          pointerHover = hits[0].instanceId;
      }
      if (!coarse && !reduced && occluderRef.current) {
        const sh = raycaster.intersectObject(occluderRef.current, false);
        if (sh.length) {
          world.worldToLocal(scratch.hit.copy(sh[0].point));
          if (wake.current.amp < 0.02) wake.current.pos.copy(scratch.hit);
          else wake.current.pos.lerp(scratch.hit, lerp(8)); // trails the cursor
          wake.current.amp += (1 - wake.current.amp) * lerp(6);
        } else {
          wake.current.amp += (0 - wake.current.amp) * lerp(6);
        }
      } else {
        wake.current.amp += (0 - wake.current.amp) * lerp(6);
      }
    } else {
      wake.current.amp += (0 - wake.current.amp) * lerp(6);
    }
    pointerHoverRef.current = pointerHover;

    // Active node: fly target > keyboard focus > pointer hover.
    const active = fly.current.active
      ? fly.current.city
      : focusRef.current >= 0
        ? focusRef.current
        : pointerHover;
    arcHoverRef.current = active >= 0 && active < CITIES.length ? active : -1;
    if (active !== prevActive.current) {
      prevActive.current = active;
      setActiveNode(active >= 0 ? active : null);
    }
    if (hoverDotRef.current) {
      hoverDotRef.current.scale.setScalar(1 + 0.28 * Math.sin(tRef.current * 5));
    }

    // ── Drag inertia (spring-ish exponential decay when not actively dragging) ─
    if (!drag.current.active) {
      const decay = Math.pow(reduced ? 0.82 : 0.94, delta * 60);
      off.current.yaw += vel.current.yaw;
      vel.current.yaw *= decay;
      off.current.pitch = THREE.MathUtils.clamp(
        off.current.pitch + vel.current.pitch,
        -PITCH_LIMIT,
        PITCH_LIMIT,
      );
      vel.current.pitch *= decay;
      if (Math.abs(vel.current.yaw) < 1e-5) vel.current.yaw = 0;
      if (Math.abs(vel.current.pitch) < 1e-5) vel.current.pitch = 0;
    }

    // ── Click-to-fly camera blend timer ───────────────────────────────────────
    if (fly.current.active) {
      fly.current.t += delta;
      const RAMP = 0.9;
      const HOLD = 1.4;
      const total = 2 * RAMP + HOLD;
      const ft = fly.current.t;
      if (ft < RAMP) camBlend.current = smoothstep(0, RAMP, ft);
      else if (ft < RAMP + HOLD) camBlend.current = 1;
      else if (ft < total) camBlend.current = 1 - smoothstep(RAMP + HOLD, total, ft);
      else {
        camBlend.current = 0;
        fly.current.active = false;
      }

      // Descent has settled on Cape Town → stop the arcs and surface the map.
      // (Separate from the timer chain above — must not steal its final `else`.)
      if (
        capePendingRef.current &&
        fly.current.city >= CAPE_INDEX &&
        ft >= RAMP
      ) {
        capePendingRef.current = false;
        capedRef.current = true;
        window.dispatchEvent(new CustomEvent("globe:cape-enter"));
      }
    } else {
      camBlend.current += (0 - camBlend.current) * lerp(4);
    }

    // ── Reduced motion: fixed framing, drag still allowed, no parallax/wake ────
    if (reduced) {
      world.rotation.set(baseX + off.current.pitch, baseY + off.current.yaw, 0);
      cam.position.copy(reducedPose.pos);
      cam.lookAt(reducedPose.tgt);
      if (parallaxRef.current) parallaxRef.current.rotation.set(0, 0, 0);
      return;
    }

    // ── Scroll-driven orientation + the cursor layer on top ───────────────────
    const p = progressRef.current ?? 0;
    eased.current += (p - eased.current) * lerp(3.2);
    const s = eased.current;
    const TWO_PI = Math.PI * 2;
    const settle = smoothstep(0.45, 0.72, s);

    // Gallery hold: while scrolling through the #conference section the globe
    // freezes Cape-Town-front so the surfacing tiles read clearly. 1 across the
    // section, ramping at its edges.
    let galleryActive = 0;
    if (!conferenceRef.current) {
      conferenceRef.current = document.getElementById("conference");
    }
    const sec = conferenceRef.current;
    if (sec) {
      const rect = sec.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const denom = rect.height - vh;
      const frac = denom > 0 ? -rect.top / denom : 0;
      galleryActive =
        smoothstep(-0.02, 0.08, frac) * (1 - smoothstep(0.9, 1.04, frac));
    }

    // `hold` stops the spin and eases the cursor layer out — for both the
    // convergence (settle) and the gallery (galleryActive).
    const hold = Math.max(settle, galleryActive);
    const userScale = 1 - hold;

    // Auto-rotation pauses while interacting (and ~2s after), then eases back.
    const autoGate = smoothstep(2.0, 3.0, now - lastInteract.current);
    spinRef.current += delta * 0.28 * (1 - hold) * autoGate;
    spinRef.current =
      ((spinRef.current + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
    spinRef.current *= 1 - hold;

    // Shimmer only lives in the hero; killed entirely during the gallery hold.
    const heroLife = (1 - smoothstep(0.02, 0.26, s)) * (1 - galleryActive);
    world.rotation.y =
      baseY +
      spinRef.current +
      off.current.yaw * userScale +
      Math.sin(tRef.current * 0.18) * 0.04 * heroLife;
    world.rotation.x =
      baseX +
      off.current.pitch * userScale +
      Math.sin(tRef.current * 0.13 + 1) * 0.02 * heroLife;

    // Gyroscopic parallax of the whole scene (off on touch / reduced).
    if (parallaxRef.current) {
      const g = (coarse ? 0 : 1) * userScale;
      const tx = ptr.current.inside ? -ptr.current.y * 0.05 * g : 0;
      const ty = ptr.current.inside ? ptr.current.x * 0.05 * g : 0;
      parallaxRef.current.rotation.x +=
        (tx - parallaxRef.current.rotation.x) * lerp(3);
      parallaxRef.current.rotation.y +=
        (ty - parallaxRef.current.rotation.y) * lerp(3);
    }

    // Camera: sample the scroll keyframes, then blend toward a fly pose if active.
    const k = keys;
    let i = 0;
    while (i < k.length - 2 && s > k[i + 1].p) i++;
    const a = k[i];
    const b = k[i + 1];
    const lt = smoothstep(a.p, b.p, s);
    scratch.pos.copy(a.pos).lerp(b.pos, lt);
    scratch.tgt.copy(a.tgt).lerp(b.tgt, lt);

    // Hold the steady Cape-Town-front framing while scrolling the gallery.
    if (galleryActive > 0.001) {
      scratch.pos.lerp(galleryPose.pos, galleryActive);
      scratch.tgt.lerp(galleryPose.tgt, galleryActive);
    }

    if (camBlend.current > 0.001 && fly.current.city >= 0) {
      const ci = fly.current.city;
      scratch.city.copy(ci < CITIES.length ? cityPos[ci] : capePos);
      world.localToWorld(scratch.city); // live world position of the node
      scratch.flyTgt.copy(scratch.city);
      const dist = (ci >= CAPE_INDEX ? 1.85 : 2.4) * (isMobile ? 1.16 : 1);
      scratch.flyPos.copy(scratch.city).normalize().multiplyScalar(dist);
      scratch.pos.lerp(scratch.flyPos, camBlend.current);
      scratch.tgt.lerp(scratch.flyTgt, camBlend.current);
    }
    cam.position.copy(scratch.pos);
    cam.lookAt(scratch.tgt);
  });

  // Hover "introduction" threads from the active node to its nearest neighbours
  // (and toward Cape Town) — rebuilt only when the active node changes.
  const threads = useMemo(() => {
    if (activeNode == null || coarse) return null;
    const start: LatLng =
      activeNode < CITIES.length ? CITIES[activeNode] : CAPE_TOWN;
    const targets: LatLng[] =
      activeNode < CITIES.length
        ? [...neighbours[activeNode].map((j) => CITIES[j]), CAPE_TOWN]
        : capeNeighbours.map((j) => CITIES[j]);
    const pos: number[] = [];
    for (const t of targets) {
      const pts = greatCircleArc(start, t, RADIUS * 1.01, 48);
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i];
        const q = pts[i + 1];
        pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [activeNode, coarse, neighbours, capeNeighbours]);
  useEffect(() => () => threads?.dispose(), [threads]);

  const activePos =
    activeNode == null
      ? null
      : activeNode < CITIES.length
        ? cityPos[activeNode]
        : capePos;
  const activeLabel =
    activeNode == null
      ? null
      : activeNode < CITIES.length
        ? {
            person: CITIES[activeNode].person ?? CITIES[activeNode].name,
            role: CITIES[activeNode].person ? CITIES[activeNode].role ?? "" : "",
          }
        : { person: CAPE_TOWN_NODE.person, role: CAPE_TOWN_NODE.role };

  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={fov}
        near={0.1}
        far={100}
        position={[0, 0.32, 4.35]}
      />
      <color attach="background" args={["#ffffff"]} />
      {/* Light editorial stage. No scene lights: the globe + atmosphere are
          custom shaders that light themselves from the sun direction. */}

      {/* Parallax group — gyroscopic tilt of the whole scene toward the cursor. */}
      <group ref={parallaxRef}>
        <Starfield count={isMobile ? 320 : 700} pausedRef={pausedRef} />

        {/* Globe group — scroll orientation + the cursor's drag/inertia layer. */}
        <group ref={worldRef}>
          {/* Invisible low-poly proxy: drives Html occlusion + the wake raycast. */}
          <mesh ref={occluderRef}>
            <sphereGeometry args={[RADIUS * 0.99, 32, 32]} />
            <meshBasicMaterial visible={false} />
          </mesh>

          <Globe
            radius={RADIUS}
            segments={isMobile ? 96 : 128}
            quality={quality}
            reduced={reduced}
            pausedRef={pausedRef}
            wakeRef={coarse ? undefined : wake}
          />
          <OrbitalRings pausedRef={pausedRef} />
          <CityPoints ref={cityPointsRef} radius={RADIUS} />
          <Arcs
            cities={CITIES}
            target={CAPE_TOWN}
            radius={RADIUS}
            reduced={reduced}
            pausedRef={pausedRef}
            onLand={onLand}
            hoverRef={arcHoverRef}
            suppressRef={capedRef}
          />
          <Pulses
            ref={pulsesRef}
            location={CAPE_TOWN}
            radius={RADIUS}
            pausedRef={pausedRef}
          />

          {/* Surfacing-faces gallery — a scroll-through timeline driven by the
              #conference section's own scroll (see Gallery). Replaces the pillars. */}
          <Gallery reduced={reduced} quality={quality} worldRef={worldRef} />

          {/* Hover "introduction" threads. */}
          {threads && (
            <lineSegments geometry={threads}>
              <lineBasicMaterial
                color="#e07b1a"
                transparent
                opacity={0.4}
                depthWrite={false}
              />
            </lineSegments>
          )}

          {/* Hovered node bloom. */}
          {activePos && (
            <mesh ref={hoverDotRef} position={[activePos.x, activePos.y, activePos.z]}>
              <sphereGeometry args={[0.012, 16, 16]} />
              <meshBasicMaterial
                color="#ffb066"
                transparent
                opacity={0.95}
                depthWrite={false}
              />
            </mesh>
          )}

          {/* Hovered/focused node label card (interaction-driven). */}
          {activePos && activeLabel && (
            <Html
              position={[activePos.x, activePos.y, activePos.z]}
              distanceFactor={6}
              occlude={[occluderRef]}
              zIndexRange={[40, 0]}
              className="pointer-events-none"
            >
              <div className="meet-card">
                <span>{activeLabel.person}</span>
                {activeLabel.role && (
                  <span className="meet-role">{activeLabel.role}</span>
                )}
              </div>
            </Html>
          )}
        </group>

        {/* Tagline word-satellites orbiting the globe (outside the globe group so
            their orbits stay steady, independent of the globe's scroll-spin). */}
        <WordSatellites pausedRef={pausedRef} reduced={reduced} />
      </group>

      {/* Bloom essentially off on white (threshold 1.0) — composer kept only so
          the custom shaders' linear output is encoded to sRGB correctly. */}
      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom
          intensity={0.2}
          luminanceThreshold={1.0}
          luminanceSmoothing={0.9}
          mipmapBlur
          radius={0.5}
        />
      </EffectComposer>
    </>
  );
}

export default function Scene(props: SceneProps) {
  const dpr = props.quality === "high" ? ([1, 2] as [number, number]) : 1;

  return (
    <Canvas
      dpr={dpr}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "default",
        preserveDrawingBuffer: true,
      }}
      frameloop={props.active ? "always" : "demand"}
    >
      <Stage {...props} />
    </Canvas>
  );
}
