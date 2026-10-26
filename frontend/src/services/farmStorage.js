const STORAGE_KEY = 'cropwise_farm_data';

export const DEFAULT_SAMPLE_FARM = {
  areaAcres: 5,
  soilType: 'Loamy',
  expectedRainfallMm: 650,
  availableWaterM3: 3000,
  location: 'Bengaluru (Sample)',
  season: 'Kharif',
  budget: 100000,
};

const VALID_SOILS = ['Loamy', 'Clay', 'Sandy', 'Silty'];
const VALID_SEASONS = ['Kharif', 'Rabi', 'Summer'];

/**
 * Validates whether an object conforms to the expected FarmData schema.
 * Rejects undefined, null, non-objects, missing/invalid types, and out-of-range numbers.
 */
export function isValidFarmData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  const {
    areaAcres,
    soilType,
    expectedRainfallMm,
    availableWaterM3,
    location,
    season,
    budget,
  } = data;

  if (typeof areaAcres !== 'number' || !Number.isFinite(areaAcres) || areaAcres <= 0) {
    return false;
  }

  if (typeof soilType !== 'string' || !VALID_SOILS.includes(soilType)) {
    return false;
  }

  if (typeof expectedRainfallMm !== 'number' || !Number.isFinite(expectedRainfallMm) || expectedRainfallMm < 0) {
    return false;
  }

  if (typeof availableWaterM3 !== 'number' || !Number.isFinite(availableWaterM3) || availableWaterM3 < 0) {
    return false;
  }

  if (typeof location !== 'string') {
    return false;
  }

  if (typeof season !== 'string' || !VALID_SEASONS.includes(season)) {
    return false;
  }

  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0) {
    return false;
  }

  return true;
}

/**
 * Safely retrieves and validates stored farm data from localStorage.
 * Returns null if data is absent, corrupted, or schema-invalid.
 */
export function loadSavedFarmData() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (isValidFarmData(parsed)) {
      return parsed;
    }

    console.warn('[FarmStorage] Discarding invalid stored farm data:', parsed);
    return null;
  } catch (error) {
    console.warn('[FarmStorage] Failed to read from localStorage:', error);
    return null;
  }
}

/**
 * Safely persists valid farm data to localStorage.
 */
export function saveFarmDataToStorage(data) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    if (!isValidFarmData(data)) {
      console.error('[FarmStorage] Cannot save invalid farm data:', data);
      return false;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('[FarmStorage] Failed to write to localStorage:', error);
    return false;
  }
}

/**
 * Clears saved farm data from localStorage.
 */
export function clearSavedFarmData() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return true;
  } catch (error) {
    console.error('[FarmStorage] Failed to clear localStorage:', error);
    return false;
  }
}
