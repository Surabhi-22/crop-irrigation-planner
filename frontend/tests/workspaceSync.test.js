import test from "node:test";
import assert from "node:assert/strict";

import {
  loadSavedFarmData,
  saveFarmDataToStorage,
  loadUserFarmData,
  saveUserFarmData,
  clearUserFarmData,
  resolveUserFarmData,
  loadSavedPlanResult,
  savePlanResultToStorage,
  migrateGuestPlanToUser,
  getExportableWorkspaceData,
} from "../src/services/farmStorage.js";

// Mock localStorage and sessionStorage for Node test environment
const localStore = {};
const sessionStore = {};

globalThis.window = {
  localStorage: {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(localStore, key) ? localStore[key] : null),
    setItem: (key, val) => {
      localStore[key] = String(val);
    },
    removeItem: (key) => {
      delete localStore[key];
    },
    clear: () => {
      for (const k of Object.keys(localStore)) delete localStore[k];
    },
  },
  sessionStorage: {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(sessionStore, key) ? sessionStore[key] : null),
    setItem: (key, val) => {
      sessionStore[key] = String(val);
    },
    removeItem: (key) => {
      delete sessionStore[key];
    },
    clear: () => {
      for (const k of Object.keys(sessionStore)) delete sessionStore[k];
    },
  },
  location: {
    origin: "http://localhost:5173",
  },
};

function resetAllStorage() {
  globalThis.window.localStorage.clear();
  globalThis.window.sessionStorage.clear();
}

const sampleGuestFarm = {
  areaAcres: 4.5,
  soilType: "Loamy",
  expectedRainfallMm: 720,
  availableWaterM3: 3500,
  location: "Mandya, Karnataka",
  season: "Kharif",
  budget: 85000,
};

const sampleUserAFarm = {
  areaAcres: 10,
  soilType: "Clay",
  expectedRainfallMm: 600,
  availableWaterM3: 8000,
  location: "Dharwad, Karnataka",
  season: "Rabi",
  budget: 200000,
};

const sampleUserBFarm = {
  areaAcres: 3,
  soilType: "Sandy",
  expectedRainfallMm: 500,
  availableWaterM3: 2000,
  location: "Kolar, Karnataka",
  season: "Summer",
  budget: 50000,
};

const samplePlanResult = {
  farm_area_acres: 4.5,
  expected_rainfall_mm: 720,
  all_feasible_crops: [
    {
      name: "Ragi (Finger Millet)",
      gross_margin_per_acre: 32000,
      total_gross_margin: 144000,
      irrigation_req_m3: 1800,
    },
  ],
  top_recommendation: {
    name: "Ragi (Finger Millet)",
  },
  isDemonstration: false,
  isSimulated: false,
};

test("Scenario 1: Guest opens workspace with clean storage", () => {
  resetAllStorage();
  const guestData = loadSavedFarmData();
  const guestPlan = loadSavedPlanResult(null);

  assert.strictEqual(guestData, null, "Unconfigured guest starts with null saved farm data");
  assert.strictEqual(guestPlan, null, "Unconfigured guest starts with null saved plan");
});

test("Scenario 2: Guest saves farm details into anonymous storage", () => {
  resetAllStorage();
  const saved = saveFarmDataToStorage(sampleGuestFarm);
  assert.strictEqual(saved, true, "Farm data successfully saved to anonymous storage");

  const loaded = loadSavedFarmData();
  assert.deepEqual(loaded, sampleGuestFarm, "Loaded guest farm matches saved values");

  // Verify it is in anonymous key, not user-scoped key
  assert.strictEqual(localStore["cropwise_farm_data"], JSON.stringify(sampleGuestFarm));
  assert.strictEqual(localStore["cropwise_farm_data_user_123"], undefined);
});

test("Scenario 3: Guest generates a crop plan and stores it in session storage", () => {
  resetAllStorage();
  const savedPlan = savePlanResultToStorage(samplePlanResult, null);
  assert.strictEqual(savedPlan, true, "Plan successfully saved to guest session storage");

  const loadedPlan = loadSavedPlanResult(null);
  assert.deepEqual(loadedPlan, samplePlanResult, "Loaded plan matches generated plan");
  assert.strictEqual(sessionStore["cropwise_plan_result"], JSON.stringify(samplePlanResult));
});

test("Scenario 4: Guest signs into a new Supabase account — migration occurs", () => {
  resetAllStorage();
  // 1. Guest saves farm and generates plan
  saveFarmDataToStorage(sampleGuestFarm);
  savePlanResultToStorage(samplePlanResult, null);

  const userId = "supabase-user-uuid-1";

  // 2. User signs in: resolveUserFarmData migrates data
  const { data: migratedFarm, migrated } = resolveUserFarmData(userId);
  assert.strictEqual(migrated, true, "Migration flag is true for first-time login with guest data");
  assert.deepEqual(migratedFarm, sampleGuestFarm, "Migrated farm data matches guest farm data");

  // 3. Anonymous key is cleared so subsequent guests don't see it
  assert.strictEqual(loadSavedFarmData(), null, "Anonymous key is cleared after migration");

  // 4. User-scoped key contains the migrated data
  const userSavedFarm = loadUserFarmData(userId);
  assert.deepEqual(userSavedFarm, sampleGuestFarm, "User-scoped slot holds migrated farm");

  // 5. Migrate guest plan to user
  migrateGuestPlanToUser(userId);
  const userPlan = loadSavedPlanResult(userId);
  assert.deepEqual(userPlan, samplePlanResult, "User plan now holds migrated plan");
  assert.strictEqual(loadSavedPlanResult(null), null, "Anonymous plan is cleared after migration");
});

test("Scenario 5: Authenticated user sees correct farm data", () => {
  resetAllStorage();
  const userId = "supabase-user-uuid-existing";

  // Pre-seed user data
  saveUserFarmData(userId, sampleUserAFarm);

  // Authenticated user loads their data
  const { data: resolved, migrated } = resolveUserFarmData(userId);
  assert.strictEqual(migrated, false, "Existing user data is not marked as newly migrated");
  assert.deepEqual(resolved, sampleUserAFarm, "User sees their own pre-existing farm data");
});

test("Scenario 6: Refreshing the page preserves the correct authenticated data", () => {
  resetAllStorage();
  const userId = "supabase-user-uuid-refresh";

  saveUserFarmData(userId, sampleUserAFarm);
  savePlanResultToStorage(samplePlanResult, userId);

  // Simulate full page reload (reading directly from storage using user ID)
  const reloadedFarm = loadUserFarmData(userId);
  const reloadedPlan = loadSavedPlanResult(userId);

  assert.deepEqual(reloadedFarm, sampleUserAFarm, "Farm data preserved across reload");
  assert.deepEqual(reloadedPlan, samplePlanResult, "Plan result preserved across reload");
});

test("Scenario 7: Signing out does not expose authenticated data to a new guest", () => {
  resetAllStorage();
  const userId = "supabase-user-uuid-signout";

  // User A had their farm saved under their scoped key
  saveUserFarmData(userId, sampleUserAFarm);
  savePlanResultToStorage(samplePlanResult, userId);

  // User signs out: anonymous slot was never populated by user A
  const guestFarm = loadSavedFarmData();
  const guestPlan = loadSavedPlanResult(null);

  assert.strictEqual(guestFarm, null, "Guest cannot see signed-out user's farm data");
  assert.strictEqual(guestPlan, null, "Guest cannot see signed-out user's plan result");

  // User A's data remains safely in user A's slot for next time they log in
  assert.deepEqual(loadUserFarmData(userId), sampleUserAFarm);
  assert.deepEqual(loadSavedPlanResult(userId), samplePlanResult);
});

test("Scenario 8: Signing into another account does not show previous account's details", () => {
  resetAllStorage();
  const userA = "user-alpha-uuid";
  const userB = "user-beta-uuid";

  // User A configures a farm
  saveUserFarmData(userA, sampleUserAFarm);

  // User B signs in for the first time
  const { data: userBData } = resolveUserFarmData(userB);
  assert.strictEqual(userBData, null, "User B does NOT see User A's farm data");

  // User B configures their own farm
  saveUserFarmData(userB, sampleUserBFarm);

  // Verify strict isolation
  assert.deepEqual(loadUserFarmData(userA), sampleUserAFarm, "User A's data intact");
  assert.deepEqual(loadUserFarmData(userB), sampleUserBFarm, "User B's data intact and isolated");
  assert.notDeepEqual(loadUserFarmData(userA), loadUserFarmData(userB), "User A and B data are distinct");
});

test("Scenario 9: Workspace data export uses authenticated user data when provided", () => {
  resetAllStorage();
  const userA = "user-export-uuid";
  saveUserFarmData(userA, sampleUserAFarm);

  const exported = getExportableWorkspaceData(userA);
  assert.strictEqual(exported.hasActiveFarm, true);
  assert.deepEqual(exported.farmData, sampleUserAFarm);

  const guestExported = getExportableWorkspaceData(null);
  assert.strictEqual(guestExported.hasActiveFarm, false);
  assert.strictEqual(guestExported.farmData, null);
});

test("Scenario 10: Clear farm data only clears the target user's slot", () => {
  resetAllStorage();
  const userA = "user-clear-1";
  const userB = "user-clear-2";

  saveUserFarmData(userA, sampleUserAFarm);
  saveUserFarmData(userB, sampleUserBFarm);

  // Clear user A's farm
  clearUserFarmData(userA);

  assert.strictEqual(loadUserFarmData(userA), null, "User A farm is cleared");
  assert.deepEqual(loadUserFarmData(userB), sampleUserBFarm, "User B farm remains completely unaffected");
});

