import * as THREE from "three";

/**
 * Geographic helpers for the hero globe.
 *
 * Convention: latitude/longitude in degrees, sphere of `radius` centred at the
 * origin. We use the standard equirectangular → sphere mapping so it lines up
 * with the `earth-water.png` land mask (which is plate-carrée: x = lng, y = lat).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Convert lat/lng to a point on a sphere.
 *
 * The longitude offset (`-90°`, i.e. `+Math.PI/2` below... see derivation) keeps
 * the canonical equirectangular texture seam at the back of the globe and puts
 * (lat 0, lng 0) — the Gulf of Guinea — on the +Z face. Tuned to match the
 * `earth-water.png` orientation used by the dot sampler.
 */
export function latLngToVector3(
  lat: number,
  lng: number,
  radius: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180); // polar angle from +Y
  const theta = (lng + 180) * (Math.PI / 180); // azimuth

  out.set(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
  return out;
}

/**
 * Build a great-circle arc between two lat/lng points, lifted off the surface
 * into a smooth parabola-like bow. Returns evenly-spaced points.
 *
 * The arc height scales with angular distance so short hops stay flat and
 * long-haul connections bow dramatically — the visual language of "perspectives
 * travelling across the world to converge".
 */
export function greatCircleArc(
  start: LatLng,
  end: LatLng,
  radius: number,
  segments = 64,
  maxLift = 0.55,
): THREE.Vector3[] {
  const startV = latLngToVector3(start.lat, start.lng, radius);
  const endV = latLngToVector3(end.lat, end.lng, radius);

  // Angular distance between the two surface points (0..PI).
  const angle = startV.angleTo(endV);
  // Lift proportional to distance, eased so mid-range arcs read best.
  const lift = 1 + maxLift * Math.sin(Math.min(angle / Math.PI, 1) * Math.PI);

  const points: THREE.Vector3[] = [];
  const slerp = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Spherical interpolation along the great circle…
    slerp.copy(startV).lerp(endV, t);
    if (slerp.lengthSq() === 0) slerp.copy(startV);
    slerp.normalize();
    // …then push outward by a smooth height profile (0 at ends, max at middle).
    const h = Math.sin(t * Math.PI); // 0 → 1 → 0
    const r = radius * (1 + (lift - 1) * h);
    points.push(slerp.multiplyScalar(r));
  }
  return points;
}

/** Cape Town — the convergence point for every arc. */
export const CAPE_TOWN: LatLng = { lat: -33.9249, lng: 18.4241 };
