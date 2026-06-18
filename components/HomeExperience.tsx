"use client";

import { ScrollProgressProvider } from "@/components/ScrollProgress";
import { GlobeBackground } from "@/components/GlobeBackground";
import { GlobeNodeList } from "@/components/GlobeNodeList";
import { GalleryFacesList } from "@/components/GalleryFacesList";
import { GalleryCaptions } from "@/components/GalleryCaptions";
import { Particles } from "@/components/Particles";
import { VideoTransition } from "@/components/VideoTransition";
import { Nav } from "@/components/sections/Nav";
import { Hero } from "@/components/sections/Hero";
import { Pillars } from "@/components/sections/Pillars";
import { Presenting } from "@/components/sections/Presenting";
import { Footer } from "@/components/sections/Footer";

/**
 * The home experience: a single persistent globe background flown through on
 * scroll, with the content sections layered over it. Everything shares one
 * global scroll progress (ScrollProgressProvider) so the camera journey and the
 * content reveals read as one coordinated sequence.
 *
 *   z-0  globe canvas (fixed)      → the journey
 *   z-1  particle drift (fixed)    → atmospheric depth
 *   z-2  video (fixed)             → crossfades in over the globe at the resolve
 *   z-10 #content (scrolls over)   → hero · pillars · presenting · resolve
 *   z-30 gallery captions (fixed)  → words that surface with the faces gallery
 *   z-50 nav (fixed)
 */
export function HomeExperience() {
  return (
    <ScrollProgressProvider>
      <GlobeBackground />
      <Particles />
      <VideoTransition />
      <Nav />
      <GlobeNodeList />
      <GalleryFacesList />
      <GalleryCaptions />
      <main id="content" className="relative z-10">
        <Hero />
        <Pillars />
        <Presenting />
        <Footer />
      </main>
    </ScrollProgressProvider>
  );
}
