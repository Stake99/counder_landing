"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Ambient starfield for depth — dark points scattered in a spherical shell well
 * behind the globe, with a slow drift. Rendered as bold round dots that read on
 * the white stage.
 */
export function Starfield({
  count = 700,
  pausedRef,
}: {
  count?: number;
  pausedRef?: React.RefObject<boolean>;
}) {
  const ref = useRef<THREE.Points>(null);

  const { positions, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    // Deterministic index hash → 0..1 (pure; keeps the memo render-safe and the
    // field stable across renders, unlike Math.random()).
    const rand = (n: number) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
      return x - Math.floor(x);
    };
    for (let i = 0; i < count; i++) {
      // Random direction, radius in a far shell.
      const v = new THREE.Vector3(
        rand(i * 3) - 0.5,
        rand(i * 3 + 1) - 0.5,
        rand(i * 3 + 2) - 0.5,
      ).normalize();
      const r = 6 + rand(i * 7 + 1) * 10;
      positions.set([v.x * r, v.y * r, v.z * r], i * 3);
      sizes[i] = rand(i * 13 + 2);
    }
    return { positions, sizes };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uPixelRatio: {
        value:
          typeof window !== "undefined"
            ? Math.min(window.devicePixelRatio, 2)
            : 1,
      },
    }),
    [],
  );

  useFrame((_, delta) => {
    if (pausedRef?.current) return;
    if (ref.current) ref.current.rotation.y += delta * 0.004;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={/* glsl */ `
          attribute float aSize;
          uniform float uPixelRatio;
          varying float vA;
          void main() {
            vA = 0.4 + aSize * 0.6;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (1.4 + aSize * 3.0) * uPixelRatio;
          }
        `}
        fragmentShader={/* glsl */ `
          varying float vA;
          void main() {
            // Soft round dot; dark slate so it reads boldly on the white stage.
            float d = length(gl_PointCoord - 0.5);
            float alpha = (1.0 - smoothstep(0.35, 0.5, d)) * vA * 0.9;
            gl_FragColor = vec4(vec3(0.06, 0.07, 0.10), alpha);
          }
        `}
      />
    </points>
  );
}
