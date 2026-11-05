
/**
 * Karnataka Districts — Geospatial & Agricultural Reference Data
 *
 * Canonical district list: 30 districts from the ML model training data
 * (ml/yield_prediction.py SUPPORTED_DISTRICTS).
 *
 * Centroid coordinates: approximate geographic centroids for initial map
 * marker placement when a district is selected by name.
 * Source: OpenStreetMap Nominatim geocoding results + manual verification.
 *
 * Agro-climatic zones: Karnataka State Department of Agriculture (KSDA) /
 * University of Agricultural Sciences (UAS) Bengaluru official 10-zone
 * classification. Zone numbers and descriptions reflect the official
 * categorisation used in Karnataka agricultural planning documents.
 *
 * Annual rainfall normals (mm): 30-year long-period average (LPA) from
 * India Meteorological Department (IMD) district normals.
 * Source: IMD "District-wise Rainfall Normal" publication (IMD/HP/2021).
 * These are district-level climate normals, NOT farm-level measurements.
 *
 * Dominant soil groups: NBSS&LUP (National Bureau of Soil Survey and
 * Land Use Planning) district soil surveys for Karnataka.
 * Source: NBSS&LUP Soil Survey publications for Karnataka.
 */

/** @typedef {{ lat: number, lon: number }} Centroid */
/** @typedef {{ id: string, name: string, centroid: Centroid, zone: number, zoneName: string, annualRainfallNormalMm: number | null, dominantSoilGroups: string[], mlDistrictKey: string }} DistrictRecord */

/**
 * Agro-climatic zone descriptions (KSDA / UAS Bengaluru classification).
 * Source: "Agro-climatic Zones of Karnataka", University of Agricultural
 * Sciences, Bengaluru. Published by Karnataka State Department of Agriculture.
 */
export const AGRO_CLIMATIC_ZONES = {
  1: "North-East Transition Zone",
  2: "North-East Dry Zone",
  3: "North Dry Zone",
  4: "Central Dry Zone",
  5: "Eastern Dry Zone",
  6: "Southern Dry Zone",
  7: "Southern Transition Zone",
  8: "Hilly Zone",
  9: "Southern Transition Zone",
  10: "Coastal Zone",
};

/**
 * Karnataka district records.
 * mlDistrictKey must match exactly one key in SUPPORTED_DISTRICTS from
 * ml/yield_prediction.py for ML model compatibility.
 *
 * annualRainfallNormalMm = null indicates data is not available in
 * the current dataset and will display an unavailable-data state.
 *
 * @type {DistrictRecord[]}
 */
export const KARNATAKA_DISTRICTS = [
  {
    id: "bagalkote",
    name: "Bagalkote",
    centroid: { lat: 16.1691, lon: 75.6965 },
    zone: 3,
    zoneName: AGRO_CLIMATIC_ZONES[3],
    annualRainfallNormalMm: 586,
    dominantSoilGroups: ["Red loamy", "Black cotton"],
    mlDistrictKey: "BAGALKOTE",
  },
  {
    id: "ballari",
    name: "Ballari",
    centroid: { lat: 15.1394, lon: 76.9214 },
    zone: 5,
    zoneName: AGRO_CLIMATIC_ZONES[5],
    annualRainfallNormalMm: 548,
    dominantSoilGroups: ["Red sandy loam", "Black cotton"],
    mlDistrictKey: "BALLARI",
  },
  {
    id: "bangalore-rural",
    name: "Bangalore Rural",
    centroid: { lat: 13.2257, lon: 77.5666 },
    zone: 6,
    zoneName: AGRO_CLIMATIC_ZONES[6],
    annualRainfallNormalMm: 860,
    dominantSoilGroups: ["Red laterite", "Red sandy"],
    mlDistrictKey: "BANGALORE RURAL",
  },
  {
    id: "belagavi",
    name: "Belagavi",
    centroid: { lat: 15.8497, lon: 74.4977 },
    zone: 1,
    zoneName: AGRO_CLIMATIC_ZONES[1],
    annualRainfallNormalMm: 811,
    dominantSoilGroups: ["Black cotton", "Medium black"],
    mlDistrictKey: "BELAGAVI",
  },
  {
    id: "bengaluru-urban",
    name: "Bengaluru Urban",
    centroid: { lat: 12.9716, lon: 77.5946 },
    zone: 6,
    zoneName: AGRO_CLIMATIC_ZONES[6],
    annualRainfallNormalMm: 970,
    dominantSoilGroups: ["Red laterite", "Sandy loam"],
    mlDistrictKey: "BENGALURU URBAN",
  },
  {
    id: "bidar",
    name: "Bidar",
    centroid: { lat: 17.9104, lon: 77.5199 },
    zone: 1,
    zoneName: AGRO_CLIMATIC_ZONES[1],
    annualRainfallNormalMm: 805,
    dominantSoilGroups: ["Black cotton", "Medium black"],
    mlDistrictKey: "BIDAR",
  },
  {
    id: "chamarajanagara",
    name: "Chamarajanagara",
    centroid: { lat: 11.9261, lon: 76.9437 },
    zone: 6,
    zoneName: AGRO_CLIMATIC_ZONES[6],
    annualRainfallNormalMm: 810,
    dominantSoilGroups: ["Red loamy", "Sandy loam"],
    mlDistrictKey: "CHAMARAJANAGARA",
  },
  {
    id: "chikkaballapura",
    name: "Chikkaballapura",
    centroid: { lat: 13.4355, lon: 77.7315 },
    zone: 5,
    zoneName: AGRO_CLIMATIC_ZONES[5],
    annualRainfallNormalMm: 730,
    dominantSoilGroups: ["Red sandy loam", "Red loamy"],
    mlDistrictKey: "CHIKKABALLAPURA",
  },
  {
    id: "chikkamagaluru",
    name: "Chikkamagaluru",
    centroid: { lat: 13.3161, lon: 75.7720 },
    zone: 8,
    zoneName: AGRO_CLIMATIC_ZONES[8],
    annualRainfallNormalMm: 1873,
    dominantSoilGroups: ["Red laterite", "Red loamy"],
    mlDistrictKey: "CHIKKAMAGALURU",
  },
  {
    id: "chitradurga",
    name: "Chitradurga",
    centroid: { lat: 14.2251, lon: 76.3980 },
    zone: 4,
    zoneName: AGRO_CLIMATIC_ZONES[4],
    annualRainfallNormalMm: 546,
    dominantSoilGroups: ["Red loamy", "Sandy loam"],
    mlDistrictKey: "CHITRADURGA",
  },
  {
    id: "dakshina-kannada",
    name: "Dakshina Kannada",
    centroid: { lat: 12.8438, lon: 75.2479 },
    zone: 10,
    zoneName: AGRO_CLIMATIC_ZONES[10],
    annualRainfallNormalMm: 3767,
    dominantSoilGroups: ["Red laterite", "Coastal alluvial"],
    mlDistrictKey: "DAKSHINA KANNADA",
  },
  {
    id: "davangere",
    name: "Davangere",
    centroid: { lat: 14.4644, lon: 75.9218 },
    zone: 4,
    zoneName: AGRO_CLIMATIC_ZONES[4],
    annualRainfallNormalMm: 683,
    dominantSoilGroups: ["Medium black", "Red loamy"],
    mlDistrictKey: "DAVANGERE",
  },
  {
    id: "dharwad",
    name: "Dharwad",
    centroid: { lat: 15.4589, lon: 75.0078 },
    zone: 3,
    zoneName: AGRO_CLIMATIC_ZONES[3],
    annualRainfallNormalMm: 750,
    dominantSoilGroups: ["Medium black", "Black cotton"],
    mlDistrictKey: "DHARWAD",
  },
  {
    id: "gadag",
    name: "Gadag",
    centroid: { lat: 15.4272, lon: 75.6210 },
    zone: 3,
    zoneName: AGRO_CLIMATIC_ZONES[3],
    annualRainfallNormalMm: 622,
    dominantSoilGroups: ["Black cotton", "Medium black"],
    mlDistrictKey: "GADAG",
  },
  {
    id: "hassan",
    name: "Hassan",
    centroid: { lat: 13.0072, lon: 76.1004 },
    zone: 7,
    zoneName: AGRO_CLIMATIC_ZONES[7],
    annualRainfallNormalMm: 1166,
    dominantSoilGroups: ["Red loamy", "Red laterite"],
    mlDistrictKey: "HASSAN",
  },
  {
    id: "haveri",
    name: "Haveri",
    centroid: { lat: 14.7939, lon: 75.3998 },
    zone: 3,
    zoneName: AGRO_CLIMATIC_ZONES[3],
    annualRainfallNormalMm: 777,
    dominantSoilGroups: ["Black cotton", "Medium black"],
    mlDistrictKey: "HAVERI",
  },
  {
    id: "kalaburagi",
    name: "Kalaburagi",
    centroid: { lat: 17.3297, lon: 76.8200 },
    zone: 2,
    zoneName: AGRO_CLIMATIC_ZONES[2],
    annualRainfallNormalMm: 701,
    dominantSoilGroups: ["Black cotton", "Medium black"],
    mlDistrictKey: "KALABURAGI",
  },
  {
    id: "kodagu",
    name: "Kodagu",
    centroid: { lat: 12.4209, lon: 75.7398 },
    zone: 8,
    zoneName: AGRO_CLIMATIC_ZONES[8],
    annualRainfallNormalMm: 2649,
    dominantSoilGroups: ["Red laterite", "Red loamy"],
    mlDistrictKey: "KODAGU",
  },
  {
    id: "kolar",
    name: "Kolar",
    centroid: { lat: 13.1357, lon: 78.1294 },
    zone: 5,
    zoneName: AGRO_CLIMATIC_ZONES[5],
    annualRainfallNormalMm: 770,
    dominantSoilGroups: ["Red sandy loam", "Red loamy"],
    mlDistrictKey: "KOLAR",
  },
  {
    id: "koppal",
    name: "Koppal",
    centroid: { lat: 15.3511, lon: 76.1548 },
    zone: 4,
    zoneName: AGRO_CLIMATIC_ZONES[4],
    annualRainfallNormalMm: 515,
    dominantSoilGroups: ["Red loamy", "Black cotton"],
    mlDistrictKey: "KOPPAL",
  },
  {
    id: "mandya",
    name: "Mandya",
    centroid: { lat: 12.5218, lon: 76.8951 },
    zone: 6,
    zoneName: AGRO_CLIMATIC_ZONES[6],
    annualRainfallNormalMm: 748,
    dominantSoilGroups: ["Black cotton", "Red loamy"],
    mlDistrictKey: "MANDYA",
  },
  {
    id: "mysuru",
    name: "Mysuru",
    centroid: { lat: 12.2958, lon: 76.6394 },
    zone: 6,
    zoneName: AGRO_CLIMATIC_ZONES[6],
    annualRainfallNormalMm: 876,
    dominantSoilGroups: ["Red loamy", "Black cotton"],
    mlDistrictKey: "MYSURU",
  },
  {
    id: "raichur",
    name: "Raichur",
    centroid: { lat: 16.2014, lon: 77.3566 },
    zone: 2,
    zoneName: AGRO_CLIMATIC_ZONES[2],
    annualRainfallNormalMm: 582,
    dominantSoilGroups: ["Black cotton", "Medium black"],
    mlDistrictKey: "RAICHUR",
  },
  {
    id: "ramanagara",
    name: "Ramanagara",
    centroid: { lat: 12.7157, lon: 77.2823 },
    zone: 6,
    zoneName: AGRO_CLIMATIC_ZONES[6],
    annualRainfallNormalMm: 855,
    dominantSoilGroups: ["Red loamy", "Sandy loam"],
    mlDistrictKey: "RAMANAGARA",
  },
  {
    id: "shivamogga",
    name: "Shivamogga",
    centroid: { lat: 13.9299, lon: 75.5681 },
    zone: 8,
    zoneName: AGRO_CLIMATIC_ZONES[8],
    annualRainfallNormalMm: 1770,
    dominantSoilGroups: ["Red laterite", "Red loamy"],
    mlDistrictKey: "SHIVAMOGGA",
  },
  {
    id: "tumakuru",
    name: "Tumakuru",
    centroid: { lat: 13.3409, lon: 77.1010 },
    zone: 6,
    zoneName: AGRO_CLIMATIC_ZONES[6],
    annualRainfallNormalMm: 742,
    dominantSoilGroups: ["Red sandy loam", "Red loamy"],
    mlDistrictKey: "TUMAKURU",
  },
  {
    id: "udupi",
    name: "Udupi",
    centroid: { lat: 13.3409, lon: 74.7421 },
    zone: 10,
    zoneName: AGRO_CLIMATIC_ZONES[10],
    annualRainfallNormalMm: 4102,
    dominantSoilGroups: ["Red laterite", "Coastal alluvial"],
    mlDistrictKey: "UDUPI",
  },
  {
    id: "uttara-kannada",
    name: "Uttara Kannada",
    centroid: { lat: 14.7769, lon: 74.7552 },
    zone: 10,
    zoneName: AGRO_CLIMATIC_ZONES[10],
    annualRainfallNormalMm: 2987,
    dominantSoilGroups: ["Red laterite", "Coastal alluvial"],
    mlDistrictKey: "UTTARA KANNADA",
  },
  {
    id: "vijayapura",
    name: "Vijayapura",
    centroid: { lat: 16.8302, lon: 75.7100 },
    zone: 2,
    zoneName: AGRO_CLIMATIC_ZONES[2],
    annualRainfallNormalMm: 562,
    dominantSoilGroups: ["Black cotton", "Medium black"],
    mlDistrictKey: "VIJAYAPURA",
  },
  {
    id: "yadagiri",
    name: "Yadagiri",
    centroid: { lat: 16.7710, lon: 77.1385 },
    zone: 2,
    zoneName: AGRO_CLIMATIC_ZONES[2],
    annualRainfallNormalMm: 608,
    dominantSoilGroups: ["Black cotton", "Medium black"],
    mlDistrictKey: "YADAGIRI",
  },
];

/**
 * Map from ML model canonical district key (uppercase) to DistrictRecord.
 * Used to look up district metadata from the ML-compatible district name.
 */
export const DISTRICT_BY_ML_KEY = Object.fromEntries(
  KARNATAKA_DISTRICTS.map((d) => [d.mlDistrictKey, d])
);

/**
 * Map from lowercase district name to DistrictRecord.
 * Supports flexible name-based lookup.
 */
export const DISTRICT_BY_NAME = Object.fromEntries(
  KARNATAKA_DISTRICTS.map((d) => [d.name.toLowerCase(), d])
);

/**
 * Karnataka state bounding box for Leaflet map bounds.
 * Source: Survey of India / OpenStreetMap Karnataka administrative boundary.
 * Format: [[south, west], [north, east]]
 */
export const KARNATAKA_BOUNDS = [
  [11.5945, 74.0497],
  [18.4467, 78.5881],
];

/** Karnataka geographic centre (approximate) for initial map view. */
export const KARNATAKA_CENTER = [15.3173, 75.7139];

/** Initial zoom level that shows the full Karnataka state comfortably. */
export const KARNATAKA_ZOOM = 7;

/**
 * District name aliases: maps alternate/old spellings to canonical ML key.
 * Mirrors DISTRICT_MAPPING from ml/yield_prediction.py.
 */
export const DISTRICT_ALIASES = {
  BAGALKOT: "BAGALKOTE",
  BELLARY: "BALLARI",
  BELGAUM: "BELAGAVI",
  CHAMARAJANAGAR: "CHAMARAJANAGARA",
  CHIKBALLAPUR: "CHIKKABALLAPURA",
  CHIKMAGALUR: "CHIKKAMAGALURU",
  "DAKSHIN KANNAD": "DAKSHINA KANNADA",
  GULBARGA: "KALABURAGI",
  MYSORE: "MYSURU",
  SHIMOGA: "SHIVAMOGGA",
  TUMKUR: "TUMAKURU",
  "UTTAR KANNAD": "UTTARA KANNADA",
  BIJAPUR: "VIJAYAPURA",
  YADGIR: "YADAGIRI",
};

/**
 * Resolve a district name string (any casing, old or new spelling)
 * to a canonical DistrictRecord, or return null if not found.
 *
 * @param {string} name
 * @returns {DistrictRecord | null}
 */
export function resolveDistrict(name) {
  if (!name) return null;
  const upper = name.trim().toUpperCase();
  // Check alias table first
  const canonical = DISTRICT_ALIASES[upper] || upper;
  return DISTRICT_BY_ML_KEY[canonical] || null;
}

/**
 * Validates that coordinates fall within the broad Karnataka bounding box.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
export function isWithinKarnataka(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  const [[minLat, minLon], [maxLat, maxLon]] = KARNATAKA_BOUNDS;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

/**
 * Finds the nearest canonical Karnataka district to a given lat/lon pair
 * based on geographic centroid distance.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {DistrictRecord | null}
 */
export function findNearestDistrict(lat, lon) {
  if (!isWithinKarnataka(lat, lon)) return null;
  let nearest = null;
  let minDistanceSq = Infinity;
  for (const d of KARNATAKA_DISTRICTS) {
    if (!d.centroid) continue;
    const dLat = d.centroid.lat - lat;
    const dLon = d.centroid.lon - lon;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      nearest = d;
    }
  }
  return nearest;
}

