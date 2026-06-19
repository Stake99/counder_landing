"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

/**
 * "The network for collective understanding" — the tagline, scattered into
 * word-satellites that orbit the globe along the same three tilted planes as the
 * OrbitalRings (so the words ride the rings). Each word billboards to stay
 * readable as it travels, is occluded by the globe as it swings behind, and
 * fades on the far side. The core idea — "collective understanding" — glows amber.
 *
 * Lives beside the globe group (not inside it) so the satellites keep their own
 * steady orbits, independent of the globe's scroll-spin.
 */

interface WordDef {
  text: string;
  /** Orbit radius (rings sit at 1.32 / 1.5 / 1.72). */
  r: number;
  /** Orbit-plane tilt — shared with a ring so the word rides that ring. */
  tilt: [number, number, number];
  /** Starting angle around the orbit. */
  phase: number;
  /** Angular speed (sign = direction), matched per plane. */
  speed: number;
  size: number;
  accent?: boolean;
}

// Grouped onto the three ring planes; phases spaced so words don't collide.
const WORDS: WordDef[] = [
  { text: "The", r: 1.4, tilt: [1.18, 0.2, 0], phase: 0.0, speed: 0.07, size: 0.085 },
  { text: "network", r: 1.4, tilt: [1.18, 0.2, 0], phase: 1.35, speed: 0.07, size: 0.12 },
  { text: "for", r: 1.56, tilt: [1.05, -0.35, 0.3], phase: 2.7, speed: -0.058, size: 0.08 },
  { text: "collective", r: 1.56, tilt: [1.05, -0.35, 0.3], phase: 3.95, speed: -0.058, size: 0.12, accent: true },
  { text: "understanding", r: 1.78, tilt: [1.3, 0.5, -0.2], phase: 5.3, speed: 0.05, size: 0.12, accent: true },
];

const INK = "#0a0a0a";
const AMBER = "#e07b1a";

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function WordSatellites({
  pausedRef,
  reduced = false,
}: {
  pausedRef?: React.RefObject<boolean>;
  reduced?: boolean;
}) {
  const { camera } = useThree();
  const bbRefs = useRef<(THREE.Group | null)[]>([]);
  const textRefs = useRef<(THREE.Mesh | null)[]>([]);
  const dotRefs = useRef<(THREE.Mesh | null)[]>([]);
  const tRef = useRef(0);
  const configured = useRef(false);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const wp = useMemo(() => new THREE.Vector3(), []);
  const camDir = useMemo(() => new THREE.Vector3(), []);
  const eulers = useMemo(
    () => WORDS.map((w) => new THREE.Euler(w.tilt[0], w.tilt[1], w.tilt[2])),
    [],
  );

  useFrame((_, delta) => {
    const paused = pausedRef?.current;
    if (!paused && !reduced) tRef.current += delta;
    const t = tRef.current;

    // One-time: make the text materials transparent so we can fade the far side.
    if (!configured.current) {
      let ok = true;
      textRefs.current.forEach((m) => {
        const mat = (m as { material?: THREE.Material } | null)?.material;
        if (mat) {
          mat.transparent = true;
          mat.depthWrite = false;
        } else ok = false;
      });
      if (ok && textRefs.current.length === WORDS.length) configured.current = true;
    }

    camDir.copy(camera.position).normalize();

    WORDS.forEach((w, i) => {
      const bb = bbRefs.current[i];
      if (!bb) return;
      const a = w.phase + (reduced ? 0 : t * w.speed);
      tmp.set(Math.cos(a) * w.r, Math.sin(a) * w.r, 0).applyEuler(eulers[i]);
      bb.position.copy(tmp);

      // Fade as the satellite swings to the far side of the globe (depth
      // occlusion hides the rest); a touch of front-bias keeps words crisp.
      bb.getWorldPosition(wp);
      const facing = wp.lengthSq() > 1e-6 ? wp.normalize().dot(camDir) : 1;
      const vis = smoothstep(-0.15, 0.3, facing);

      const tm = (textRefs.current[i] as { material?: THREE.Material } | null)
        ?.material as THREE.Material | undefined;
      if (tm) tm.opacity = vis;
      const dm = (dotRefs.current[i] as { material?: THREE.Material } | null)
        ?.material as THREE.Material | undefined;
      if (dm) dm.opacity = vis * 0.9;
    });
  });

  return (
    <group>
      {WORDS.map((w, i) => (
        <Billboard
          key={w.text}
          ref={(el) => {
            bbRefs.current[i] = el;
          }}
        >
          {/* Satellite body — a small glowing node the word trails. */}
          <mesh
            ref={(el) => {
              dotRefs.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.011, 12, 12]} />
            <meshBasicMaterial
              color={w.accent ? AMBER : INK}
              transparent
              opacity={0.9}
              depthWrite={false}
            />
          </mesh>
          <Text
            ref={(el) => {
              textRefs.current[i] = el as unknown as THREE.Mesh;
            }}
            position={[0.05, 0, 0]}
            anchorX="left"
            anchorY="middle"
            fontSize={w.size}
            letterSpacing={-0.01}
            color={w.accent ? AMBER : INK}
            outlineWidth={0.004}
            outlineBlur={0.01}
            outlineColor="#ffffff"
            outlineOpacity={0.85}
          >
            {w.text}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}
