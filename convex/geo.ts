// Minimal zip centroid table covering the demo footprint. Distance between
// two unknown zips degrades to a prefix heuristic, then to "unknown", which
// the matcher reports instead of silently excluding.
const ZIP_GEO: Record<string, { lat: number; lng: number; city: string; state: string }> = {
  "94103": { lat: 37.7726, lng: -122.4099, city: "San Francisco", state: "CA" },
  "94110": { lat: 37.7485, lng: -122.4156, city: "San Francisco", state: "CA" },
  "94612": { lat: 37.8097, lng: -122.2712, city: "Oakland", state: "CA" },
  "94301": { lat: 37.4443, lng: -122.1497, city: "Palo Alto", state: "CA" },
  "95112": { lat: 37.3541, lng: -121.8836, city: "San Jose", state: "CA" },
  "95814": { lat: 38.5805, lng: -121.4939, city: "Sacramento", state: "CA" },
  "90012": { lat: 34.0614, lng: -118.2385, city: "Los Angeles", state: "CA" },
  "92101": { lat: 32.7194, lng: -117.1628, city: "San Diego", state: "CA" },
  "98101": { lat: 47.6114, lng: -122.3305, city: "Seattle", state: "WA" },
  "97205": { lat: 45.5203, lng: -122.6890, city: "Portland", state: "OR" },
  "10001": { lat: 40.7506, lng: -73.9971, city: "New York", state: "NY" },
  "60601": { lat: 41.8858, lng: -87.6229, city: "Chicago", state: "IL" },
  "78701": { lat: 30.2705, lng: -97.7426, city: "Austin", state: "TX" },
  "80202": { lat: 39.7491, lng: -104.9973, city: "Denver", state: "CO" },
  "02108": { lat: 42.3577, lng: -71.0656, city: "Boston", state: "MA" },
  "30303": { lat: 33.7524, lng: -84.3891, city: "Atlanta", state: "GA" },
  "85004": { lat: 33.4512, lng: -112.0685, city: "Phoenix", state: "AZ" },
  "75201": { lat: 32.7876, lng: -96.7994, city: "Dallas", state: "TX" },
};

export function zipInfo(zip: string) {
  return ZIP_GEO[zip] ?? null;
}

function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/** Miles between two zips, or null when neither table nor prefix can say. */
export function milesBetweenZips(zipA: string, zipB: string): number | null {
  const a = ZIP_GEO[zipA];
  const b = ZIP_GEO[zipB];
  if (a && b) return Math.round(haversineMiles(a, b));
  // Same 3-digit prefix means the same USPS sectional center, ~30mi radius.
  if (zipA.slice(0, 3) === zipB.slice(0, 3)) return 30;
  return null;
}
