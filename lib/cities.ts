import type { LatLng } from "./geo";

/**
 * The global origins whose "perspectives" stream toward Cape Town.
 *
 * A curated spread across the 27+ countries Counder spans — six continents, real
 * member-style hubs. Four of these carry verbatim labels from counder.com's own
 * "different worlds" copy and surface as revealed nodes in the hero.
 */
export interface City extends LatLng {
  name: string;
  /** Optional person label drawn from the live site copy. */
  person?: string;
  role?: string;
  /** Featured nodes get a labelled callout during the scroll reveal. */
  featured?: boolean;
}

export const CITIES: City[] = [
  // Featured — verbatim from the live "different worlds" section.
  { name: "New York", lat: 40.7128, lng: -74.006, person: "A Fortune 500 CEO", role: "New York", featured: true },
  { name: "Zurich", lat: 47.3769, lng: 8.5417, person: "A quantum computing professor", role: "Zurich", featured: true },
  { name: "São Paulo", lat: -23.5505, lng: -46.6333, person: "A family office principal", role: "São Paulo", featured: true },

  // The wider network — origins of the converging arcs.
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "Singapore", lat: 1.3521, lng: 103.8198 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "San Francisco", lat: 37.7749, lng: -122.4194 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Berlin", lat: 52.52, lng: 13.405 },
  { name: "Lagos", lat: 6.5244, lng: 3.3792 },
  { name: "Nairobi", lat: -1.2921, lng: 36.8219 },
  { name: "Sydney", lat: -33.8688, lng: 151.2093 },
  { name: "Toronto", lat: 43.6532, lng: -79.3832 },
  { name: "Paris", lat: 48.8566, lng: 2.3522 },
  { name: "Tel Aviv", lat: 32.0853, lng: 34.7818 },
  { name: "Hong Kong", lat: 22.3193, lng: 114.1694 },
  { name: "Buenos Aires", lat: -34.6037, lng: -58.3816 },
];

/**
 * Cape Town's own featured node — the destination. Listed separately because it
 * is the convergence point, not an arc origin.
 */
export const CAPE_TOWN_NODE = {
  name: "Cape Town",
  person: "A renowned architect",
  role: "Cape Town",
} as const;
