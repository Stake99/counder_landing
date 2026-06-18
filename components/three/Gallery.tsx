"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Image, useTexture } from "@react-three/drei";
import * as THREE from "three";

import {
  GALLERY_TILES,
  tileLatLng,
  type GalleryTileDef,
} from "@/lib/gallery";
import { CAPE_TOWN, greatCircleArc, latLngToVector3 } from "@/lib/geo";

/**
 * The surfacing-faces gallery (replaces the old text "pillar" cards across the
 * 0.25–0.55 scroll range). Each tile is a photo anchored in 3D to a real city;
 * as the camera flies through, tiles pop out from the surface along the normal,
 * hold, then fade — the network's faces surfacing from the planet, each lighting
 * a connector arc toward Cape Town as it joins. Scroll is the master timeline;
 * Cape Town stays the focal point (tiles fade out before the convergence).
 *
 * Rendered in-scene (textured planes via drei <Image> in <Billboard>) so tiles
 * stay anchored to their city, face the camera, and are occluded when their city
 * rotates to the far side. Mounted inside the globe group so they rotate with it.
 */

const RADIUS = 1;
const LIFT_BASE = 0.18; // height above the surface at Cape Town (emergence)
const LIFT_POP = 0.34; // extra outward push toward the camera at full presence
const RAMP = 0.06; // local-scroll width of each fade edge
const TILE_W = 0.64;
const TILE_H = 0.5;
const CENTER_MAX = 0.55; // how far a tile drifts toward screen-centre at its hold

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// easeOutBack — overshoot for the "pop".
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const setOpacity = (o: THREE.Object3D | null, v: number) => {
  const m = (o as { material?: THREE.Material } | null)?.material;
  if (m) m.opacity = v;
};

export interface GalleryProps {
  reduced: boolean;
  quality: "low" | "high";
  /** The globe group — used to convert the screen-centre target into the tiles'
   *  rotating local space so a held tile can drift toward the middle of frame. */
  worldRef: React.RefObject<THREE.Group | null>;
}

export function Gallery({ reduced, quality, worldRef }: GalleryProps) {
  const isMobile = quality === "low";
  const gl = useThree((s) => s.gl);

  const tiles = useMemo(
    () => GALLERY_TILES.slice(0, isMobile ? 4 : GALLERY_TILES.length),
    [isMobile],
  );
  const urls = useMemo(() => tiles.map((t) => t.url), [tiles]);

  // Preload all tile textures up front (suspends once with the rest of the scene).
  const textures = useTexture(urls, (loaded) => {
    const arr = (Array.isArray(loaded) ? loaded : [loaded]) as THREE.Texture[];
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy?.() ?? 1);
    for (const t of arr) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
      t.needsUpdate = true;
    }
  });
  const texArr = (Array.isArray(textures) ? textures : [textures]) as THREE.Texture[];

  // Gallery progress is the #conference section's OWN scroll-through (0→1),
  // not the global journey — so tiles read as a slow timeline you scroll
  // through, decoupled from the camera's speed. 0 when the section's top hits
  // the top of the viewport, 1 when its bottom reaches the bottom.
  // Every picture surfaces at the SAME spot — the 3rd tile's city (São Paulo) —
  // so faces cycle through one consistent position rather than scattering.
  const anchorCity = GALLERY_TILES[2].city;

  const easedRef = useRef(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  useFrame((_, delta) => {
    if (!sectionRef.current) {
      sectionRef.current = document.getElementById("conference");
    }
    const sec = sectionRef.current;
    let target = 0;
    if (sec) {
      const rect = sec.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const denom = rect.height - vh;
      target = denom > 0 ? THREE.MathUtils.clamp(-rect.top / denom, 0, 1) : 0;
    }
    easedRef.current += (target - easedRef.current) * Math.min(1, delta * 4);
  });

  return (
    <group>
      {tiles.map((t, i) => (
        <GalleryTile
          key={t.key}
          tile={t}
          anchorCity={anchorCity}
          texture={texArr[i]}
          easedRef={easedRef}
          reduced={reduced}
          worldRef={worldRef}
        />
      ))}
    </group>
  );
}

function GalleryTile({
  tile,
  anchorCity,
  texture,
  easedRef,
  reduced,
  worldRef,
}: {
  tile: GalleryTileDef;
  anchorCity: string;
  texture: THREE.Texture;
  easedRef: React.RefObject<number>;
  reduced: boolean;
  worldRef: React.RefObject<THREE.Group | null>;
}) {
  const { camera } = useThree();

  // All tiles share one anchor city, so every picture appears at the same spot.
  const dir = useMemo(() => {
    const ll = tileLatLng(anchorCity);
    return latLngToVector3(ll.lat, ll.lng, 1).normalize();
  }, [anchorCity]);
  // Cape Town direction — every picture surfaces from / recedes to this point.
  const capeDir = useMemo(
    () => latLngToVector3(CAPE_TOWN.lat, CAPE_TOWN.lng, 1).normalize(),
    [],
  );

  // Connector arc from the shared anchor city to Cape Town.
  const connectorGeo = useMemo(() => {
    const pts = greatCircleArc(tileLatLng(anchorCity), CAPE_TOWN, RADIUS * 1.012, 48);
    const pos: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [anchorCity]);
  useEffect(() => () => connectorGeo.dispose(), [connectorGeo]);

  const bbRef = useRef<THREE.Group>(null);
  const imgRef = useRef<THREE.Mesh>(null);
  const frameRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const dotRef = useRef<THREE.Mesh>(null);
  const connRef = useRef<THREE.LineSegments>(null);

  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpCam = useMemo(() => new THREE.Vector3(), []);
  const tmpDir = useMemo(() => new THREE.Vector3(), []);
  const tmpAnchor = useMemo(() => new THREE.Vector3(), []);
  const tmpFwd = useMemo(() => new THREE.Vector3(), []);
  const tmpCenter = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const bb = bbRef.current;
    if (!bb) return;
    const s = easedRef.current ?? 0;
    const start = tile.start;
    const end = tile.start + tile.dur;
    const appear = smoothstep(start, start + RAMP, s);
    const disappear = smoothstep(end - RAMP, end, s);
    const presence = appear * (1 - disappear);

    // Hide tiles whose city has rotated to the far side of the globe.
    bb.getWorldPosition(tmpPos);
    const facing =
      tmpPos.lengthSq() > 1e-6
        ? tmpPos.normalize().dot(tmpCam.copy(camera.position).normalize())
        : 1;
    const vis = presence * smoothstep(0.0, 0.28, facing);

    // Scale: reduced motion fades only (constant scale); otherwise pop + leave.
    const scale = reduced
      ? tile.baseScale
      : easeOutBack(appear) * (1 - disappear) * smoothstep(0.0, 0.28, facing) *
        tile.baseScale;
    bb.scale.setScalar(Math.max(0.0001, scale));

    // Travel from the coverage point: each picture surfaces at Cape Town and
    // slides out along the surface to its city as it fades in, then recedes back
    // to Cape Town as it fades out. (Reduced motion: hold at the city, fade only.)
    const reach = reduced ? 1 : presence;
    tmpDir.copy(capeDir).lerp(dir, reach);
    if (tmpDir.lengthSq() < 1e-8) tmpDir.copy(dir);
    tmpDir.normalize();
    const lift = reduced ? LIFT_BASE : (LIFT_BASE + LIFT_POP) * reach;
    tmpAnchor.copy(tmpDir).multiplyScalar(RADIUS + lift);

    // Drift toward screen-centre while the tile holds — it leaves the globe and
    // comes to the middle of frame to take its moment, then drifts back out.
    const centering = reduced ? 0 : presence * CENTER_MAX;
    const world = worldRef.current;
    if (centering > 0.001 && world) {
      camera.getWorldDirection(tmpFwd);
      const camDist = camera.position.length();
      tmpCenter.copy(camera.position).addScaledVector(tmpFwd, camDist * 0.5);
      world.worldToLocal(tmpCenter); // screen-centre target in the globe's local space
      tmpAnchor.lerp(tmpCenter, centering);
    }
    bb.position.copy(tmpAnchor);
    bb.visible = vis > 0.002;

    setOpacity(imgRef.current, vis);
    setOpacity(frameRef.current, vis * 0.55);
    setOpacity(ringRef.current, vis * 0.4);
    setOpacity(connRef.current, vis * 0.4);
    if (dotRef.current) {
      setOpacity(dotRef.current, vis * 0.95);
      dotRef.current.scale.setScalar(0.5 + vis * 0.8);
    }
  });

  return (
    <group>
      <Billboard ref={bbRef} visible={false}>
        {/* Brand ring echo behind the tile. */}
        <mesh ref={ringRef} position={[0, 0, -0.02]}>
          <ringGeometry args={[TILE_W * 0.62, TILE_W * 0.66, 64]} />
          <meshBasicMaterial color="#e07b1a" transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* Luminous frame (thin warm border). */}
        <mesh ref={frameRef} position={[0, 0, -0.005]}>
          <planeGeometry args={[TILE_W + 0.03, TILE_H + 0.03]} />
          <meshBasicMaterial color="#e07b1a" transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* The photo. (drei <Image> is a 3D textured plane, not an <img>; the
            name/role lives as real text in the GalleryFacesList.) */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image
          ref={imgRef}
          texture={texture}
          scale={[TILE_W, TILE_H]}
          radius={0.05}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </Billboard>

      {/* Anchor point on the city — brightens as the tile surfaces. */}
      <mesh
        ref={dotRef}
        position={[dir.x * RADIUS * 1.005, dir.y * RADIUS * 1.005, dir.z * RADIUS * 1.005]}
      >
        <sphereGeometry args={[0.01, 12, 12]} />
        <meshBasicMaterial color="#ffb066" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Connector arc to Cape Town. */}
      <lineSegments ref={connRef} geometry={connectorGeo}>
        <lineBasicMaterial color="#e07b1a" transparent opacity={0} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
