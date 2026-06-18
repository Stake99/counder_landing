"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Soft concentric orbital rings encircling the globe — a direct echo of the
 * Counder rings logo. Kept very quiet (low opacity, slow drift) so they frame
 * the globe without competing with the converging arcs.
 */

interface RingDef {
  radius: number;
  tilt: [number, number, number];
  opacity: number;
  speed: number;
}

const RINGS: RingDef[] = [
  { radius: 1.32, tilt: [1.18, 0.2, 0], opacity: 0.42, speed: 0.02 },
  { radius: 1.5, tilt: [1.05, -0.35, 0.3], opacity: 0.3, speed: -0.015 },
  { radius: 1.72, tilt: [1.3, 0.5, -0.2], opacity: 0.2, speed: 0.01 },
];

export function OrbitalRings({
  pausedRef,
}: {
  pausedRef?: React.RefObject<boolean>;
}) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((_, delta) => {
    if (pausedRef?.current) return;
    RINGS.forEach((r, i) => {
      const m = refs.current[i];
      if (m) m.rotation.z += delta * r.speed;
    });
  });

  return (
    <group>
      {RINGS.map((r, i) => (
        <mesh
          key={i}
          rotation={r.tilt}
          ref={(m) => {
            refs.current[i] = m;
          }}
        >
          <ringGeometry args={[r.radius, r.radius + 0.012, 128]} />
          <meshBasicMaterial
            color="#0a0a0a"
            transparent
            opacity={r.opacity}
            side={THREE.DoubleSide}
            blending={THREE.NormalBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
