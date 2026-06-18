"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CITIES } from "@/lib/cities";
import { latLngToVector3 } from "@/lib/geo";

/**
 * Glowing origin points for the converging arcs — one instance per source city,
 * sitting just above the surface. Rendered as a single InstancedMesh so the
 * pointer can raycast it cheaply and read the hovered `instanceId` (→ city
 * index). Cape Town is intentionally omitted: its landing pulse + beacon (see
 * Pulses) stays the single brightest element on the globe.
 *
 * The hovered point's "bloom" is drawn separately by Scene (a HoverDot) so this
 * stays a static, allocation-free instanced draw.
 */
export const CityPoints = forwardRef<THREE.InstancedMesh, { radius?: number }>(
  function CityPoints({ radius = 1 }, ref) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    useImperativeHandle(ref, () => meshRef.current as THREE.InstancedMesh, []);

    const positions = useMemo(
      () => CITIES.map((c) => latLngToVector3(c.lat, c.lng, radius * 1.012)),
      [radius],
    );

    useLayoutEffect(() => {
      const mesh = meshRef.current;
      if (!mesh) return;
      const dummy = new THREE.Object3D();
      positions.forEach((p, i) => {
        dummy.position.copy(p);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }, [positions]);

    return (
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, CITIES.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.0058, 12, 12]} />
        <meshBasicMaterial
          color="#33373d"
          transparent
          opacity={0.7}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </instancedMesh>
    );
  },
);
