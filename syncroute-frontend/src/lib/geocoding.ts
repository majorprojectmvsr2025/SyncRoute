// Multi-source geocoding: Nominatim (primary) + Photon (fallback)
// Both are free, no API key required. Nominatim has excellent Indian coverage.

export interface LocationSuggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    country?: string;
    state?: string;
    suburb?: string;
    road?: string;
    shop?: string;
    amenity?: string;
    building?: string;
  };
  importance?: number;
  formatted_address?: string;
}

export interface GeocodingResult {
  lat: number;
  lon: number;
  display_name: string;
}

// India center coordinates for biasing results
const INDIA_LAT = 20.5937;
const INDIA_LON = 78.9629;

// Nominatim — OpenStreetMap's official geocoder, excellent Indian coverage
async function searchNominatim(query: string): Promise<LocationSuggestion[]> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(query)}` +
      `&format=json&addressdetails=1&limit=10&countrycodes=in` +
      `&accept-language=en&dedupe=1` +
      `&viewbox=68.1,35.7,97.4,6.5&bounded=0`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SyncRoute/1.0",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();

    return (data as any[]).map((item: any) => {
      const addr = item.address || {};
      const name = item.name || addr.amenity || addr.building || "";
      const city = addr.city || addr.town || addr.village || addr.county || "";
      const state = addr.state || "";
      const country = addr.country || "";

      const nameParts: string[] = [name, city, state, country]
        .filter(Boolean)
        .filter((v, idx, arr) => arr.indexOf(v) === idx)
        .slice(0, 4);

      return {
        place_id: String(item.place_id),
        display_name: nameParts.join(", ") || item.display_name || query,
        lat: String(item.lat),
        lon: String(item.lon),
        type: item.type || item.class || "place",
        address: {
          city: addr.city || addr.town,
          town: addr.town,
          village: addr.village,
          suburb: addr.suburb || addr.neighbourhood,
          state: addr.state,
          country: addr.country,
          road: addr.road,
        },
        importance: item.importance,
      } as LocationSuggestion;
    });
  } catch (error) {
    console.error("Nominatim search error:", error);
    return [];
  }
}

// Photon (by Komoot) — fast, no rate limits, good coverage
async function searchPhoton(query: string): Promise<LocationSuggestion[]> {
  try {
    const url =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}` +
      `&limit=10&lang=en&lat=${INDIA_LAT}&lon=${INDIA_LON}` +
      `&bbox=68.1,6.5,97.4,35.7`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return [];

    const data = await response.json();

    return (data.features as any[]).map((f: any, i: number) => {
      const p = f.properties ?? {};
      const [lon, lat] = (f.geometry?.coordinates as [number, number]) ?? [0, 0];

      const name = p.name;
      const city = p.city ?? p.town ?? p.village;
      const state = p.state;
      const country = p.country;

      const nameParts: string[] = [name, city, state, country]
        .filter(Boolean)
        .filter((v, idx, arr) => arr.indexOf(v) === idx)
        .slice(0, 4) as string[];

      return {
        place_id: String(p.osm_id ?? `photon-${i}`),
        display_name: nameParts.join(", ") || query,
        lat: String(lat),
        lon: String(lon),
        type: p.osm_value ?? p.type ?? "place",
        address: {
          city: p.city ?? p.town,
          town: p.town,
          village: p.village,
          suburb: p.suburb ?? p.district,
          state: p.state,
          country: p.country,
          road: p.street,
        },
      } as LocationSuggestion;
    });
  } catch (error) {
    console.error("Photon search error:", error);
    return [];
  }
}

// Deduplicate results based on coordinates proximity (within ~200m)
function deduplicateResults(results: LocationSuggestion[]): LocationSuggestion[] {
  const seen: LocationSuggestion[] = [];
  for (const r of results) {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const isDup = seen.some((s) => {
      const sLat = parseFloat(s.lat);
      const sLon = parseFloat(s.lon);
      return Math.abs(lat - sLat) < 0.002 && Math.abs(lon - sLon) < 0.002;
    });
    if (!isDup) seen.push(r);
  }
  return seen;
}

export const searchLocations = async (query: string): Promise<LocationSuggestion[]> => {
  if (!query || query.length < 2) return [];

  try {
    // Query both sources in parallel for speed and coverage
    const [nominatimResults, photonResults] = await Promise.all([
      searchNominatim(query),
      searchPhoton(query),
    ]);

    // Merge: Nominatim first (generally better Indian coverage), then Photon extras
    const merged = [...nominatimResults, ...photonResults];

    // Deduplicate by proximity
    const deduped = deduplicateResults(merged);

    // Prioritize Indian results
    deduped.sort((a, b) => {
      const aIndia = a.address.country?.toLowerCase() === "india" ? 0 : 1;
      const bIndia = b.address.country?.toLowerCase() === "india" ? 0 : 1;
      return aIndia - bIndia;
    });

    return deduped.slice(0, 12);
  } catch (error) {
    console.error("Location search error:", error);
    return [];
  }
};

// Geocode a specific location string -> coordinates
export const geocodeLocation = async (query: string): Promise<GeocodingResult | null> => {
  try {
    const results = await searchLocations(query);
    if (results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon),
        display_name: results[0].display_name,
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

// Reverse geocode (coordinates -> address string)
export const reverseGeocode = async (lat: number, lon: number): Promise<string | null> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "SyncRoute/1.0" },
    });
    const data = await response.json();
    if (!data || data.error) return null;

    const addr = data.address || {};
    const parts: string[] = [
      data.name || addr.amenity || addr.building,
      addr.city || addr.town || addr.village,
      addr.state,
    ].filter(Boolean) as string[];
    return parts.join(", ") || null;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
};

// Get coordinates from location string
export const getCoordinates = async (
  location: string
): Promise<{ lat: number; lng: number; display_name: string } | null> => {
  const result = await geocodeLocation(location);
  if (result) {
    return { lat: result.lat, lng: result.lon, display_name: result.display_name };
  }
  return null;
};

// Format a suggestion into a clean readable label
export const formatLocationName = (suggestion: LocationSuggestion): string => {
  const { address } = suggestion;
  const name = suggestion.display_name.split(",")[0]?.trim();
  const city = address.city || address.town || address.village;
  const state = address.state;

  const parts = [name, city, state]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const result = parts.slice(0, 3).join(", ");
  return result.length > 55 ? result.substring(0, 52) + "..." : result;
};

// Classify the suggestion type for a badge label
export const getLocationType = (suggestion: LocationSuggestion): string => {
  const t = suggestion.type?.toLowerCase() ?? "";
  if (t.includes("railway") || t.includes("train") || t.includes("halt")) return "Station";
  if (t.includes("aerodrome") || t.includes("airport")) return "Airport";
  if (t.includes("bus_st") || t.includes("bus_stop")) return "Bus Stop";
  if (t.includes("university") || t.includes("college") || t.includes("school")) return "Education";
  if (t.includes("hospital") || t.includes("clinic")) return "Hospital";
  if (t.includes("city") || t.includes("town")) return "City";
  if (t.includes("village")) return "Village";
  if (t.includes("suburb") || t.includes("district") || t.includes("neighbourhood")) return "Area";
  if (t.includes("street") || t.includes("road") || t.includes("residential")) return "Street";
  if (suggestion.address.city || suggestion.address.town) return "Place";
  if (suggestion.address.village) return "Village";
  if (suggestion.address.suburb) return "Area";
  return "Location";
};
