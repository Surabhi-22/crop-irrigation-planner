// Anonymous / guest storage key (unchanged — used by all existing calls)
const STORAGE_KEY = 'cropwise_farm_data';

// ── User-scoped storage helpers ───────────────────────────────────────────────
// Authenticated users get an isolated key so that one user's farm data is
// never visible to a different user (or to an unauthenticated guest) on the
// same browser.

/**
 * Returns the localStorage key scoped to an authenticated user ID.
 * @param {string} userId  - Supabase auth user UUID
 * @returns {string}
 */
function userScopedKey(userId) {
  return `cropwise_farm_data_${userId}`;
}

/**
 * Loads farm data for a specific authenticated user.
 * Returns null if the user has no saved data.
 * @param {string} userId
 * @returns {object|null}
 */
export function loadUserFarmData(userId) {
  if (!userId || typeof userId !== 'string') return null;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(userScopedKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isValidFarmData(parsed)) return parsed;
    console.warn('[FarmStorage] Discarding invalid user-scoped farm data for', userId, parsed);
    return null;
  } catch (err) {
    console.warn('[FarmStorage] Failed to read user farm data:', err);
    return null;
  }
}

/**
 * Persists valid farm data under the authenticated user's scoped key.
 * @param {string} userId
 * @param {object} data
 * @returns {boolean}
 */
export function saveUserFarmData(userId, data) {
  if (!userId || typeof userId !== 'string') return false;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    if (!isValidFarmData(data)) {
      console.error('[FarmStorage] Cannot save invalid farm data for user', userId, data);
      return false;
    }
    window.localStorage.setItem(userScopedKey(userId), JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('[FarmStorage] Failed to write user farm data:', err);
    return false;
  }
}

/**
 * Clears the authenticated user's scoped farm data from localStorage.
 * Does NOT touch the anonymous guest key.
 * @param {string} userId
 * @returns {boolean}
 */
export function clearUserFarmData(userId) {
  if (!userId || typeof userId !== 'string') return false;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(userScopedKey(userId));
    }
    return true;
  } catch (err) {
    console.error('[FarmStorage] Failed to clear user farm data:', err);
    return false;
  }
}

/**
 * Resolves the correct farm data to display when a user signs in.
 *
 * Priority:
 *  1. User already has saved data under their scoped key → return it.
 *  2. No user data but guest/anonymous data exists → migrate it (copy to
 *     user-scoped slot, erase the anonymous key so the next guest starts
 *     fresh) and return the migrated data.
 *  3. Nothing exists → return null.
 *
 * @param {string} userId
 * @returns {{ data: object|null, migrated: boolean }}
 */
export function resolveUserFarmData(userId) {
  if (!userId || typeof userId !== 'string') {
    return { data: null, migrated: false };
  }

  // 1. User already has their own saved data — use it.
  const existing = loadUserFarmData(userId);
  if (existing) {
    return { data: existing, migrated: false };
  }

  // 2. No user data — check for orphaned guest/anonymous data to migrate.
  const guestData = loadSavedFarmData(); // reads anonymous key
  if (guestData) {
    // Copy to user-scoped slot so the user keeps their pre-login farm data.
    saveUserFarmData(userId, guestData);
    // Erase anonymous slot so the next guest or different user starts clean.
    clearSavedFarmData();
    console.info('[FarmStorage] Migrated guest farm data to user', userId);
    return { data: guestData, migrated: true };
  }

  // 3. Nothing to load.
  return { data: null, migrated: false };
}

// ── Plan result storage (session-scoped persistence) ──────────────────────────
// Preserves generated agricultural plan results across navigation, page refreshes,
// and guest-to-authenticated sign-in transitions within the browser session.

const PLAN_STORAGE_KEY = 'cropwise_plan_result';

function userScopedPlanKey(userId) {
  return `cropwise_plan_result_${userId}`;
}

/**
 * Loads a saved plan result from sessionStorage.
 * @param {string|null} userId - Supabase user ID, or null/undefined for guest
 * @returns {object|null}
 */
export function loadSavedPlanResult(userId = null) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const key = userId ? userScopedPlanKey(userId) : PLAN_STORAGE_KEY;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    console.warn('[FarmStorage] Failed to read plan result from sessionStorage:', err);
    return null;
  }
}

/**
 * Persists a generated plan result to sessionStorage.
 * @param {object|null} planResult - Plan response object to store, or null to clear
 * @param {string|null} userId - Supabase user ID, or null/undefined for guest
 * @returns {boolean}
 */
export function savePlanResultToStorage(planResult, userId = null) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    const key = userId ? userScopedPlanKey(userId) : PLAN_STORAGE_KEY;
    if (!planResult) {
      window.sessionStorage.removeItem(key);
      return true;
    }
    window.sessionStorage.setItem(key, JSON.stringify(planResult));
    return true;
  } catch (err) {
    console.error('[FarmStorage] Failed to save plan result to sessionStorage:', err);
    return false;
  }
}

/**
 * Clears saved plan result from sessionStorage.
 * @param {string|null} userId
 * @returns {boolean}
 */
export function clearSavedPlanResult(userId = null) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    const key = userId ? userScopedPlanKey(userId) : PLAN_STORAGE_KEY;
    window.sessionStorage.removeItem(key);
    return true;
  } catch (err) {
    console.error('[FarmStorage] Failed to clear plan result from sessionStorage:', err);
    return false;
  }
}

/**
 * Migrates a guest plan result to the authenticated user's session slot.
 * @param {string} userId
 */
export function migrateGuestPlanToUser(userId) {
  if (!userId || typeof userId !== 'string') return;
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const guestPlan = loadSavedPlanResult(null);
    if (guestPlan) {
      savePlanResultToStorage(guestPlan, userId);
      clearSavedPlanResult(null);
      console.info('[FarmStorage] Migrated guest plan result to user', userId);
    }
  } catch (err) {
    console.warn('[FarmStorage] Failed to migrate guest plan:', err);
  }
}

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

// ── Farm Preferences Storage ─────────────────────────────────────────────────

const PREFERENCES_STORAGE_KEY = 'quantum_agri_farm_preferences';

export const VALID_IRRIGATION_METHODS = ['Drip', 'Sprinkler', 'Surface/Flood'];

export const DEFAULT_FARM_PREFERENCES = {
  defaultLocation: 'Bengaluru',
  defaultSoilType: 'Loamy',
  preferredIrrigationMethod: 'Drip',
  measurementUnits: 'Acres / m³',
};

/**
 * Loads farm preferences from localStorage.
 * Falls back to default values if not configured or invalid.
 */
export function loadFarmPreferences() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_FARM_PREFERENCES };
    }

    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_FARM_PREFERENCES };
    }

    const parsed = JSON.parse(raw);
    return {
      defaultLocation:
        typeof parsed.defaultLocation === 'string' && parsed.defaultLocation.trim()
          ? parsed.defaultLocation.trim()
          : DEFAULT_FARM_PREFERENCES.defaultLocation,
      defaultSoilType:
        typeof parsed.defaultSoilType === 'string' && VALID_SOILS.includes(parsed.defaultSoilType)
          ? parsed.defaultSoilType
          : DEFAULT_FARM_PREFERENCES.defaultSoilType,
      preferredIrrigationMethod:
        typeof parsed.preferredIrrigationMethod === 'string' &&
        VALID_IRRIGATION_METHODS.includes(parsed.preferredIrrigationMethod)
          ? parsed.preferredIrrigationMethod
          : DEFAULT_FARM_PREFERENCES.preferredIrrigationMethod,
      measurementUnits: DEFAULT_FARM_PREFERENCES.measurementUnits,
    };
  } catch (error) {
    console.warn('[FarmStorage] Failed to load preferences, using defaults:', error);
    return { ...DEFAULT_FARM_PREFERENCES };
  }
}

/**
 * Persists farm preferences to localStorage.
 */
export function saveFarmPreferences(preferences) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    const current = loadFarmPreferences();
    const updated = {
      defaultLocation:
        typeof preferences?.defaultLocation === 'string' && preferences.defaultLocation.trim()
          ? preferences.defaultLocation.trim()
          : current.defaultLocation,
      defaultSoilType:
        typeof preferences?.defaultSoilType === 'string' &&
        VALID_SOILS.includes(preferences.defaultSoilType)
          ? preferences.defaultSoilType
          : current.defaultSoilType,
      preferredIrrigationMethod:
        typeof preferences?.preferredIrrigationMethod === 'string' &&
        VALID_IRRIGATION_METHODS.includes(preferences.preferredIrrigationMethod)
          ? preferences.preferredIrrigationMethod
          : current.preferredIrrigationMethod,
      measurementUnits: DEFAULT_FARM_PREFERENCES.measurementUnits,
    };

    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error('[FarmStorage] Failed to save preferences:', error);
    return false;
  }
}

/**
 * Retrieves a structured snapshot of stored farm data and preferences for JSON export.
 * @param {string|null} userId - Supabase user ID, or null/undefined for guest
 */
export function getExportableWorkspaceData(userId = null) {
  const farm = userId ? loadUserFarmData(userId) : loadSavedFarmData();
  const preferences = loadFarmPreferences();

  return {
    application: 'Quantum Agri',
    version: '0.1.1',
    exportedAt: new Date().toISOString(),
    farmData: farm,
    preferences,
    hasActiveFarm: Boolean(farm),
  };
}
