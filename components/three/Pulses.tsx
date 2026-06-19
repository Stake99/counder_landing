"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { latLngToVector3, type LatLng } from "@/lib/geo";

/**
 * Concentric ring-pings at Cape Town — the brand rings motif, fired whenever an
 * arc's comet completes. A small fixed pool of rings is recycled; the parent
 * grabs a ref and calls `trigger()` on each landing.
 *
 * A steady beacon (core dot + faint halo) marks Cape Town at all times.
 */

export interface PulsesHandle {
  trigger: () => void;
}

interface PulsesProps {
  location: LatLng;
  radius?: number;
  poolSize?: number;
  color?: string;
  pausedRef?: React.RefObject<boolean>;
}

const LIFETIME = 4.8; // seconds for a ping to expand and fade (slower, gentler)
const MAX_SCALE = 0.1; // peak ring radius (world units, ~globe-relative)

export const Pulses = forwardRef<PulsesHandle, PulsesProps>(function Pulses(
  {
    location,
    radius = 1,
    poolSize = 8,
    color = "#e07b1a",
    pausedRef,
  },
  ref,
) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lives = useRef<number[]>(Array(poolSize).fill(Infinity)); // Infinity = idle
  const cursor = useRef(0);

  // Cape Town placement + tangent orientation (ring plane flush to the surface).
  const { position, quaternion } = useMemo(() => {
    const pos = latLngToVector3(location.lat, location.lng, radius * 1.006);
    const normal = pos.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal,
    );
    return { position: pos, quaternion: quat };
  }, [location, radius]);

  const colorObj = useMemo(() => new THREE.Color(color), [color]);

  useImperativeHandle(ref, () => ({
    trigger: () => {
      const i = cursor.current % poolSize;
      lives.current[i] = 0;
      cursor.current++;
    },
  }));

  useFrame((_, delta) => {
    if (pausedRef?.current) return;
    for (let i = 0; i < poolSize; i++) {
      const mesh = ringRefs.current[i];
      if (!mesh) continue;
      const life = lives.current[i];
      if (life === Infinity) {
        mesh.visible = false;
        continue;
      }
      const next = life + delta;
      lives.current[i] = next;
      const t = next / LIFETIME;
      if (t >= 1) {
        lives.current[i] = Infinity;
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic expansion
      const s = 0.04 + eased * MAX_SCALE;
      mesh.scale.setScalar(s);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - t) * 0.9;
    }
  });

  return (
    <group ref={groupRef} position={position} quaternion={quaternion}>
      {/* Steady beacon core */}
      <mesh>
        <circleGeometry args={[0.012, 24]} />
        <meshBasicMaterial
          color={colorObj}
          transparent
          opacity={0.95}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Faint steady halo */}
      <mesh>
        <ringGeometry args={[0.022, 0.03, 48]} />
        <meshBasicMaterial
          color={colorObj}
          transparent
          opacity={0.35}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Ping pool */}
      {Array.from({ length: poolSize }).map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            ringRefs.current[i] = m;
          }}
          visible={false}
        >
          <ringGeometry args={[0.85, 1, 64]} />
          <meshBasicMaterial
            color={colorObj}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            blending={THREE.NormalBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
});
