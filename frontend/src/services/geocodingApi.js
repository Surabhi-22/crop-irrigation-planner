/**
 * Geocoding & Geolocation service for the Karnataka AgriMap feature.
 *
 * Provides:
 * 1. Device Geolocation via browser navigator.geolocation with high accuracy and timeout.
 * 2. Reverse geocoding via OpenStreetMap Nominatim API (https://nominatim.openstreetmap.org).
 * 3. Forward place search bounded to Karnataka, India.
 * 4. Error formatting for permission denial, timeout, and device unavailability.
 *
 * Attribution required by Nominatim usage policy:
 *   "Data © OpenStreetMap contributors, ODbL 1.0. https://osm.org/copyright"
 * Usage Policy: Max 1 request/second, meaningful User-Agent header, no bulk scraping.
 */

import { resolveDistrict } from "../data/karnatakaDistricts.js";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/** Karnataka bounding box: left, top, right, bottom (for Nominatim viewbox search) */
const KA_VIEWBOX = "74.0497,18.4467,78.5881,11.5945";

/** Standard application User-Agent header required by Nominatim usage policy */
const NOMINATIM_HEADERS = {
  "User-Agent": "QuantumAgri-CropIrrigationPlanner/0.2 (educational; contact: opensource)",
  Accept: "application/json",
};

// ── Geolocation API Helper ───────────────────────────────────────────────────

/**
 * Requests the current device coordinates via the standard browser Geolocation API.
 * Uses high accuracy, a 10s timeout, and a 30s cache limit.
 *
 * @param {PositionOptions} [options]
 * @returns {Promise<{
 *   lat: number,
 *   lon: number,
 *   accuracy: number,
 *   timestamp: number
 * }>}
 */
export function getCurrentDeviceLocation(options = {}, geolocationProvider = null) {
  return new Promise((resolve, reject) => {
    const geo =
      geolocationProvider ||
      (typeof window !== "undefined" && navigator?.geolocation
        ? navigator.geolocation
        : typeof navigator !== "undefined" && navigator.geolocation
        ? navigator.geolocation
        : null);

    if (!geo) {
      const err = new Error("Geolocation is not supported by your browser.");
      err.code = 0; // custom unsupported code
      return reject(err);
    }

    geo.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        resolve({
          lat: latitude,
          lon: longitude,
          accuracy: typeof accuracy === "number" ? Math.round(accuracy) : null,
          timestamp: position.timestamp || Date.now(),
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
        ...options,
      }
    );
  });
}

/**
 * Translates GeolocationPositionError codes into user-friendly messages.
 *
 * @param {GeolocationPositionError | Error} error
 * @returns {{ title: string, message: string, code: number }}
 */
export function parseGeolocationError(error) {
  if (!error) {
    return {
      title: "Location Detection Failed",
      message: "An unknown location error occurred. Please select your farm manually.",
      code: -1,
    };
  }

  const code = error.code !== undefined ? error.code : -1;

  switch (code) {
    case 1: // GeolocationPositionError.PERMISSION_DENIED
      return {
        title: "Location Permission Denied",
        message:
          "Browser location access was declined. You can enable it in your browser site settings, or search your village/town or click the map below to select your farm.",
        code: 1,
      };
    case 2: // GeolocationPositionError.POSITION_UNAVAILABLE
      return {
        title: "Location Unavailable",
        message:
          "Could not detect physical GPS position. Please ensure your device location services are enabled, or search manually.",
        code: 2,
      };
    case 3: // GeolocationPositionError.TIMEOUT
      return {
        title: "Location Request Timed Out",
        message:
          "The device request timed out while retrieving GPS coordinates. Please try again or pin your farm on the map.",
        code: 3,
      };
    case 0:
      return {
        title: "Geolocation Unsupported",
        message:
          "Your current browser does not support automatic location detection. Please use the search box or click on the map.",
        code: 0,
      };
    default:
      return {
        title: "Location Detection Failed",
        message:
          error.message ||
          "Unable to determine current position. Please select your farm manually.",
        code,
      };
  }
}

/**
 * Format latitude and longitude nicely (e.g. "12.9716° N, 77.5946° E").
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} [decimals=4]
 * @returns {string}
 */
export function formatCoordinates(lat, lon, decimals = 4) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "—";
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(decimals)}° ${latDir}, ${Math.abs(lon).toFixed(decimals)}° ${lonDir}`;
}

/**
 * Format accuracy meters nicely (e.g. "±15 m").
 *
 * @param {number|null} meters
 * @returns {string}
 */
export function formatAccuracy(meters) {
  if (meters == null || !Number.isFinite(meters)) return "";
  if (meters >= 1000) {
    return `±${(meters / 1000).toFixed(1)} km`;
  }
  return `±${Math.round(meters)} m`;
}

// ── Reverse Geocoding ────────────────────────────────────────────────────────

/**
 * Reverse geocode a lat/lon coordinate into structured address components.
 * Returns displayName, village, taluk, district, and state.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{
 *   displayName: string,
 *   village: string | null,
 *   suburb: string | null,
 *   taluk: string | null,
 *   district: string | null,
 *   state: string | null,
 *   country: string | null,
 *   raw: object
 * } | null>}
 */
export async function reverseGeocode(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    addressdetails: "1",
    zoom: "13", // Sub-district/village precision
  });

  const url = `${NOMINATIM_BASE}/reverse?${params}`;

  try {
    const response = await fetch(url, { headers: NOMINATIM_HEADERS });

    if (!response.ok) {
      console.warn("[geocodingApi] Reverse geocode HTTP error:", response.status);
      return null;
    }

    const data = await response.json();
    if (!data || !data.address) return null;

    const addr = data.address;

    // Extract district component with fallbacks common in Indian OSM hierarchy
    const district =
      addr.county ||
      addr.state_district ||
      addr.district ||
      null;

    // Extract taluk / subdistrict / town
    const taluk =
      addr.subdistrict ||
      addr.municipality ||
      addr.suburb ||
      addr.town ||
      addr.village ||
      null;

    const village =
      addr.village ||
      addr.hamlet ||
      addr.isolated_dwelling ||
      addr.neighbourhood ||
      null;

    return {
      displayName: data.display_name || "",
      village,
      suburb: addr.suburb || null,
      taluk,
      district,
      state: addr.state || null,
      country: addr.country || null,
      raw: addr,
    };
  } catch (err) {
    console.warn("[geocodingApi] Reverse geocode request failed:", err);
    return null;
  }
}

// ── Forward Place Search ─────────────────────────────────────────────────────

/**
 * Forward geocode a place name within Karnataka.
 * Includes instant matching for canonical Karnataka district names.
 *
 * @param {string} query — place name, district, taluk, or village
 * @returns {Promise<Array<{ lat: number, lon: number, displayName: string, isDistrictCentroid?: boolean }>>}
 */
export async function searchPlace(query) {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();

  // Instant local match for known Karnataka districts
  const directDistrict = resolveDistrict(cleanQ);
  const localMatches = [];
  if (directDistrict && directDistrict.centroid) {
    localMatches.push({
      lat: directDistrict.centroid.lat,
      lon: directDistrict.centroid.lon,
      displayName: `${directDistrict.name} District, Karnataka, India`,
      districtName: directDistrict.name,
      osmId: `local-${directDistrict.id}`,
      isDistrictCentroid: true,
    });
  }

  // Also query OSM Nominatim for villages, towns, and landmarks
  const params = new URLSearchParams({
    q: `${cleanQ}, Karnataka, India`,
    format: "jsonv2",
    viewbox: KA_VIEWBOX,
    bounded: "1",
    limit: "5",
    addressdetails: "1",
    countrycodes: "in",
  });

  const url = `${NOMINATIM_BASE}/search?${params}`;

  try {
    const response = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!response.ok) return localMatches;

    const results = await response.json();
    if (!Array.isArray(results)) return localMatches;

    const remoteMatches = results.map((r) => {
      const addr = r.address || {};
      const district = addr.county || addr.state_district || addr.district || null;
      return {
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        displayName: r.display_name || cleanQ,
        districtName: district,
        osmId: String(r.osm_id),
        isDistrictCentroid: false,
      };
    });

    // Merge: Put exact district match first if found, deduplicate close coordinates
    const combined = [...localMatches];
    for (const item of remoteMatches) {
      const alreadyHas = combined.some(
        (c) => Math.abs(c.lat - item.lat) < 0.02 && Math.abs(c.lon - item.lon) < 0.02
      );
      if (!alreadyHas) {
        combined.push(item);
      }
    }

    return combined.slice(0, 5);
  } catch (err) {
    console.warn("[geocodingApi] Forward search network error:", err);
    return localMatches;
  }
}

/**
 * Minimal debounce utility.
 *
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
