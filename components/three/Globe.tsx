"use client";

import { useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Cinematic dark Earth (Option 1).
 *
 * A photographic, layered planet — the one luminous centerpiece of an otherwise
 * black-&-white site. It is built in passes that read together as a premium
 * globe rather than a flat sphere:
 *
 *  SURFACE     NASA Blue-Marble albedo + a tangent-free normal map for terrain
 *              relief, lit by a movable sun. A custom shader does its own day/
 *              night lighting so we control the terminator exactly.
 *  NIGHT SIDE  Black-Marble city lights, blended in by `1 - day` so cities only
 *              glow on the hemisphere turned away from the sun; dawn/dusk glides
 *              across as the sun direction drifts.
 *  OCEAN GLINT A tight specular highlight masked to water (specular map), so a
 *              sun-glint travels across the oceans as the camera flies.
 *  CLOUDS      A separate transparent shell just above the surface, rotating a
 *              touch slower than the globe for parallax; lit by the same sun so
 *              clouds darken into night.
 *  ATMOSPHERE  A slightly larger back-side Fresnel shell — a thin blue rim with
 *              extra scattering toward the lit limb. Kept elegant, not a thick
 *              aura.
 *
 * All colour work is done in linear space (sRGB albedo/lights are decoded on
 * read); the final sRGB encode is left to the post pipeline. Bloom is tuned in
 * Scene so only the city lights, glint, and arcs glow — never the whole planet.
 */

const SUN_START = new THREE.Vector3(0.65, 0.25, 0.7).normalize();

/**
 * Surface vertex — carries world-space position/normal + an analytic tangent
 * basis (east/north/up) so the fragment can apply the equirectangular normal map
 * without screen-space derivatives (which need a GLSL1 extension and seam at the
 * ±180° meridian). The basis is exact for a UV sphere.
 */
const SURFACE_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  varying vec3 vLocalPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vLocalPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vec3 Nw = normalize(mat3(modelMatrix) * normal);
    vWorldNormal = Nw;
    // Pick a stable "up" away from the poles, then derive east/north.
    vec3 up = abs(Nw.y) > 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
    vTangent = normalize(cross(up, Nw));  // east  (increasing longitude / u)
    vBitangent = cross(Nw, vTangent);     // north (increasing latitude / v)
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SURFACE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uDay;
  uniform sampler2D uSpec;
  uniform sampler2D uNormalMap;
  uniform vec3 uSunDir;       // world-space, normalised
  uniform float uNormalScale; // 0 disables relief (mobile)
  uniform vec3 uWakePos;      // cursor hit on the sphere, object space (unit-ish)
  uniform float uWakeAmp;     // 0 when the cursor is off the globe
  uniform float uWakeT;       // seconds, drives the ripple
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vTangent;
  varying vec3 vBitangent;
  varying vec3 vLocalPos;
  varying vec2 vUv;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);

    // Relief from the normal map (skipped when uNormalScale == 0).
    vec3 Np = N;
    if (uNormalScale > 0.0) {
      vec3 mapN = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
      mapN.xy *= uNormalScale;
      mat3 tbn = mat3(normalize(vTangent), normalize(vBitangent), N);
      Np = normalize(tbn * mapN);
    }

    vec3 dayCol = pow(texture2D(uDay, vUv).rgb, vec3(2.2));   // sRGB -> linear
    float ocean = texture2D(uSpec, vUv).r;                    // white = water

    // Editorial daylight: a soft, wide terminator with a high floor so the
    // shaded hemisphere stays light enough to sit on a white page (no black
    // side) — the planet reads as a clean daylit globe, not a night Earth.
    float NdotL = dot(Np, L);
    float shade = mix(0.55, 1.12, smoothstep(-0.55, 0.65, NdotL));
    vec3 color = dayCol * shade;

    // Gentle limb darkening seats the sphere against the white background.
    float facing = max(dot(N, V), 0.0);
    color *= mix(0.78, 1.0, pow(facing, 0.5));

    // Subtle ocean sun-glint, kept restrained on the light theme.
    vec3 H = normalize(L + V);
    float spec =
      pow(max(dot(N, H), 0.0), 90.0) * ocean * smoothstep(0.0, 0.25, NdotL);
    color += vec3(1.0, 0.97, 0.9) * spec * 0.5;

    // Luminous cursor wake — a soft warm ring + ripple trailing the pointer
    // across the surface. Angular distance from the hit point keeps it round on
    // the sphere; the ripple is time-driven so it reads as energy, not paint.
    if (uWakeAmp > 0.001) {
      vec3 sp = normalize(vLocalPos);
      float ang = acos(clamp(dot(sp, normalize(uWakePos)), -1.0, 1.0));
      float core = exp(-pow(ang * 5.5, 2.0));                 // bright centre
      float ring = exp(-pow((ang - 0.16) * 7.0, 2.0));        // trailing ring
      float ripple = 0.5 + 0.5 * sin(ang * 26.0 - uWakeT * 5.0);
      float wake = (core * 0.85 + ring * ripple * 0.7) * uWakeAmp;
      color += vec3(1.0, 0.58, 0.18) * wake * 0.6;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Shared vertex for shells that only need a world normal + uv (clouds). */
const SHELL_VERT = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const CLOUDS_FRAG = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec3 uSunDir;
  uniform float uOpacity;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  void main() {
    vec3 N = normalize(vWorldNormal);
    float day = smoothstep(-0.08, 0.30, dot(N, normalize(uSunDir)));
    float c = dot(texture2D(uClouds, vUv).rgb, vec3(0.3333));  // white clouds
    // Keep only the thicker cloud masses so coverage stays sparse and clean.
    c = smoothstep(0.45, 0.95, c);
    float a = c * uOpacity * (0.16 + 0.84 * day);
    vec3 col = vec3(1.0) * (0.22 + 0.78 * day);
    gl_FragColor = vec4(col, a);
  }
`;

const ATMO_VERT = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const ATMO_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    // Back-side shell: a thin halo just outside the silhouette. Normal-blended
    // (not additive) so it reads as a soft blue ring on the white background.
    float fres = pow(1.0 - abs(dot(N, V)), 3.2);
    float scatter = smoothstep(-0.4, 0.6, dot(-N, normalize(uSunDir)));
    vec3 col = vec3(0.42, 0.60, 0.95);
    float a = fres * (0.22 + 0.42 * scatter);
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`;

export interface GlobeProps {
  radius?: number;
  /** Sphere tessellation — lowered on mobile for a cheaper silhouette. */
  segments?: number;
  /** Coarse quality tier — disables relief + thins clouds on mobile. */
  quality?: "low" | "high";
  /** Freeze the sun drift / cloud rotation for reduced motion. */
  reduced?: boolean;
  pausedRef?: React.RefObject<boolean>;
  /** Live cursor-wake state (object-space hit point + amplitude + time), fed by
   *  Scene's raycast. The surface shader renders a soft ring around `pos`. */
  wakeRef?: React.RefObject<{ pos: THREE.Vector3; amp: number; t: number }>;
}

export function Globe({
  radius = 1,
  segments = 128,
  quality = "high",
  reduced = false,
  pausedRef,
  wakeRef,
}: GlobeProps) {
  const gl = useThree((s) => s.gl);

  // Load the photographic Earth set (NASA Visible Earth / Blue Marble). We
  // sample raw and decode the sRGB albedo in-shader, so the default (linear)
  // texture colour space is exactly right; the only tweak is anisotropy for
  // crisp grazing angles — done in the load callback so we never mutate the
  // hook's return value. (The night/city-lights map is unused on the light
  // theme — the globe is rendered fully daylit.)
  const tex = useTexture(
    {
      uDay: "/textures/earth-day.jpg",
      uSpec: "/textures/earth-specular.jpg",
      uNormalMap: "/textures/earth-normal.jpg",
      uClouds: "/textures/earth-clouds.png",
    },
    (loaded) => {
      const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy?.() ?? 1);
      const arr = (Array.isArray(loaded) ? loaded : [loaded]) as THREE.Texture[];
      for (const t of arr) {
        t.anisotropy = aniso;
        t.needsUpdate = true;
      }
    },
  );

  const surfaceUniforms = useMemo(
    () => ({
      uDay: { value: tex.uDay },
      uSpec: { value: tex.uSpec },
      uNormalMap: { value: tex.uNormalMap },
      uSunDir: { value: SUN_START.clone() },
      uNormalScale: { value: quality === "low" ? 0.0 : 0.6 },
      uWakePos: { value: new THREE.Vector3(0, 0, 1) },
      uWakeAmp: { value: 0 },
      uWakeT: { value: 0 },
    }),
    [tex, quality],
  );

  const cloudUniforms = useMemo(
    () => ({
      uClouds: { value: tex.uClouds },
      uSunDir: { value: SUN_START.clone() },
      uOpacity: { value: quality === "low" ? 0.32 : 0.45 },
    }),
    [tex, quality],
  );

  const atmoUniforms = useMemo(
    () => ({ uSunDir: { value: SUN_START.clone() } }),
    [],
  );

  const cloudsRef = useRef<THREE.Group>(null);
  const surfaceMatRef = useRef<THREE.ShaderMaterial>(null);
  const sun = useRef(SUN_START.clone());
  const azimuth = useRef(Math.atan2(SUN_START.z, SUN_START.x));

  useFrame((_, delta) => {
    if (!reduced && !pausedRef?.current) {
      // Drift the sun so the terminator + glint glide across the surface.
      azimuth.current += delta * 0.02;
      sun.current
        .set(Math.cos(azimuth.current), 0.25, Math.sin(azimuth.current))
        .normalize();
      // Clouds drift a touch slower than the globe for parallax.
      if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.006;
    }
    surfaceUniforms.uSunDir.value.copy(sun.current);
    cloudUniforms.uSunDir.value.copy(sun.current);
    atmoUniforms.uSunDir.value.copy(sun.current);

    // Cursor wake — fed by Scene's per-frame raycast (object-space hit point).
    // Written through the material ref (not the memoised uniforms object).
    const w = wakeRef?.current;
    const sm = surfaceMatRef.current;
    if (w && sm) {
      sm.uniforms.uWakePos.value.copy(w.pos);
      sm.uniforms.uWakeAmp.value = w.amp;
      sm.uniforms.uWakeT.value = w.t;
    }
  });

  return (
    <group>
      {/* Surface — photographic daylit Earth with relief + ocean glint. */}
      <mesh>
        <sphereGeometry args={[radius, segments, segments]} />
        <shaderMaterial
          ref={surfaceMatRef}
          vertexShader={SURFACE_VERT}
          fragmentShader={SURFACE_FRAG}
          uniforms={surfaceUniforms}
        />
      </mesh>

      {/* Clouds — transparent shell just above the surface, own slow rotation. */}
      <group ref={cloudsRef}>
        <mesh>
          <sphereGeometry args={[radius * 1.006, segments, segments]} />
          <shaderMaterial
            vertexShader={SHELL_VERT}
            fragmentShader={CLOUDS_FRAG}
            uniforms={cloudUniforms}
            transparent
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Atmosphere — thin back-side Fresnel rim, normal-blended so the soft
          blue halo reads against the white background. */}
      <mesh scale={radius * 1.025}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          vertexShader={ATMO_VERT}
          fragmentShader={ATMO_FRAG}
          uniforms={atmoUniforms}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
