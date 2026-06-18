import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Strict Mode double-invokes effects in dev, which makes React Three
  // Fiber mount → unmount → remount the <Canvas>. On the unmount R3F calls
  // `forceContextLoss()`, and the dev remount is left with a dead WebGL context
  // (the hero would fall back to its static frame in dev only — production is
  // unaffected). Disabling Strict Mode keeps a single, stable GL context so the
  // 3D hero renders in `next dev` too. See NOTES.md.
  reactStrictMode: false,
};

export default nextConfig;
