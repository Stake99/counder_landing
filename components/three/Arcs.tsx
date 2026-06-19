"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { greatCircleArc, type LatLng } from "@/lib/geo";
import type { City } from "@/lib/cities";

/**
 * Great-circle connection arcs from every origin city converging on Cape Town,
 * each carrying a travelling "comet" of light. All arcs are packed into a single
 * LineSegments geometry and animated entirely on the GPU (one draw call), with a
 * lightweight CPU mirror of the head position used only to fire a landing pulse
 * when a comet reaches Cape Town.
 */

const ARC_SEGMENTS = 80;

const VERT = /* glsl */ `
  attribute float aProgress;  // 0 at origin → 1 at Cape Town
  attribute float aPhase;     // per-arc stagger
  attribute float aCity;      // origin-city index (for hover highlight)
  uniform float uTime;
  uniform float uSpeed;
  uniform float uTail;
  varying float vGlow;
  varying float vProgress;
  varying float vCity;

  void main() {
    float head = fract(uTime * uSpeed + aPhase);
    float d = head - aProgress;                 // >0 = behind the head (the tail)
    float tail = exp(-pow(max(d, 0.0) / uTail, 2.0));
    float headSpike = exp(-pow(abs(d) / (uTail * 0.4), 2.0));
    vGlow = max(tail, headSpike);
    vProgress = aProgress;
    vCity = aCity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColorWarm;
  uniform float uBase;
  uniform float uGlobalAlpha;
  uniform float uHoverCity;   // -1 = none
  uniform float uHoverMix;    // 0..1, fades the hover emphasis in
  varying float vGlow;
  varying float vProgress;
  varying float vCity;

  void main() {
    // Warm the line as it nears Cape Town — the convergence accent.
    vec3 col = mix(uColor, uColorWarm, smoothstep(0.4, 1.0, vProgress));
    // Deepen the comet core a touch for contrast on the white stage.
    col *= (1.0 - 0.18 * vGlow);
    // Normal-blended: the faint resting path (uBase) keeps the whole network of
    // connections visible; the comet head rises in opacity as it travels.
    float a = (uBase + vGlow * 0.95) * uGlobalAlpha;

    // Hover-to-meet: when a node is hovered, its arc brightens and warms while
    // the rest dim back, so the connection to that person reads instantly.
    float isHovered = step(abs(vCity - uHoverCity), 0.5);
    float emphasis = mix(1.0, mix(0.32, 1.0, isHovered), uHoverMix);
    a *= emphasis;
    col = mix(col, uColorWarm, isHovered * uHoverMix * 0.5);
    a += isHovered * uHoverMix * 0.25;

    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`;

export interface ArcsProps {
  cities: City[];
  target: LatLng;
  radius?: number;
  speed?: number;
  reduced?: boolean;
  pausedRef?: React.RefObject<boolean>;
  onLand?: () => void;
  /** Index of the hovered origin city (-1 = none) — its arc is emphasised. */
  hoverRef?: React.RefObject<number>;
  /** When true, fade the whole convergence out (e.g. while the Cape Town map is
   *  open) and stop firing landing pulses; un-set to ramp it back in. */
  suppressRef?: React.RefObject<boolean>;
}

export function Arcs({
  cities,
  target,
  radius = 1,
  speed = 0.14,
  reduced = false,
  pausedRef,
  onLand,
  hoverRef,
  suppressRef,
}: ArcsProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const prevHeads = useRef<number[]>([]);
  const tRef = useRef(0);

  const { geometry, phases } = useMemo(() => {
    const positions: number[] = [];
    const progress: number[] = [];
    const phaseAttr: number[] = [];
    const cityAttr: number[] = [];
    const phases: number[] = [];

    cities.forEach((city, ci) => {
      const pts = greatCircleArc(city, target, radius, ARC_SEGMENTS);
      const phase = ci / cities.length; // even stagger around the loop
      phases.push(phase);

      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        progress.push(i / (pts.length - 1), (i + 1) / (pts.length - 1));
        phaseAttr.push(phase, phase);
        cityAttr.push(ci, ci);
      }
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    g.setAttribute("aProgress", new THREE.Float32BufferAttribute(progress, 1));
    g.setAttribute("aPhase", new THREE.Float32BufferAttribute(phaseAttr, 1));
    g.setAttribute("aCity", new THREE.Float32BufferAttribute(cityAttr, 1));
    return { geometry: g, phases };
  }, [cities, target, radius]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: reduced ? 3.0 : 0 },
      uSpeed: { value: speed },
      uTail: { value: 0.2 },
      uBase: { value: 0.22 },
      uGlobalAlpha: { value: reduced ? 1 : 0 }, // faded in by Scene choreography
      uColor: { value: new THREE.Color("#6b7480") },     // quiet slate resting line
      uColorWarm: { value: new THREE.Color("#e07b1a") }, // deep amber at Cape Town
      uHoverCity: { value: -1 },
      uHoverMix: { value: 0 },
    }),
    [reduced, speed],
  );

  useFrame((_, delta) => {
    const mat = matRef.current;
    if (!mat) return;

    // Hover emphasis — works even when motion is reduced/paused.
    const hover = hoverRef?.current ?? -1;
    mat.uniforms.uHoverCity.value = hover;
    const targetMix = hover >= 0 ? 1 : 0;
    mat.uniforms.uHoverMix.value +=
      (targetMix - mat.uniforms.uHoverMix.value) * Math.min(1, delta * 6);

    if (reduced || pausedRef?.current) return;

    const suppressed = suppressRef?.current ?? false;

    tRef.current += delta;
    const t = tRef.current;
    mat.uniforms.uTime.value = t;

    // Global alpha: ramp UP from black over ~2.2s so the convergence "arrives"
    // rather than popping in; when suppressed (Cape Town map open), fade DOWN
    // quickly so the beaming stops. (Reduced motion starts at 1.)
    const a = mat.uniforms.uGlobalAlpha;
    const target = suppressed ? 0 : 1;
    if (a.value < target) a.value = Math.min(target, a.value + delta / 2.2);
    else if (a.value > target) a.value = Math.max(target, a.value - delta * 2.4);

    // No new landing pulses while suppressed.
    if (suppressed) return;

    // CPU mirror: detect comet arrivals to fire landing pulses.
    if (prevHeads.current.length !== phases.length) {
      prevHeads.current = phases.map(() => 0);
    }
    for (let i = 0; i < phases.length; i++) {
      const head = (t * speed + phases[i]) % 1;
      if (head < prevHeads.current[i] - 1e-4) onLand?.();
      prevHeads.current[i] = head;
    }
  });

  return (
    <lineSegments geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </lineSegments>
  );
}
