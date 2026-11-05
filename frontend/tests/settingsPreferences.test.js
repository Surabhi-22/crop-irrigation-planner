import test from "node:test";
import assert from "node:assert/strict";

import {
  loadFarmPreferences,
  saveFarmPreferences,
  getExportableWorkspaceData,
  DEFAULT_FARM_PREFERENCES,
  VALID_IRRIGATION_METHODS,
  saveFarmDataToStorage,
} from "../src/services/farmStorage.js";

import {
  updateUserProfile,
  sendPasswordReset,
  signOut,
} from "../src/lib/supabaseClient.js";

// Mock localStorage for Node test runner
const mockStore = {};
globalThis.window = {
  localStorage: {
    getItem: (key) => mockStore[key] || null,
    setItem: (key, val) => {
      mockStore[key] = String(val);
    },
    removeItem: (key) => {
      delete mockStore[key];
    },
    clear: () => {
      for (const k of Object.keys(mockStore)) delete mockStore[k];
    },
  },
  location: {
    origin: "http://localhost:5173",
  },
};

test("loadFarmPreferences returns defaults when storage is empty", () => {
  globalThis.window.localStorage.clear();
  const prefs = loadFarmPreferences();
  assert.deepEqual(prefs, DEFAULT_FARM_PREFERENCES);
});

test("saveFarmPreferences persists and retrieves valid preferences", () => {
  globalThis.window.localStorage.clear();
  const updated = saveFarmPreferences({
    defaultLocation: "Nashik, Maharashtra",
    defaultSoilType: "Clay",
    preferredIrrigationMethod: "Sprinkler",
  });

  assert.strictEqual(updated, true);

  const loaded = loadFarmPreferences();
  assert.strictEqual(loaded.defaultLocation, "Nashik, Maharashtra");
  assert.strictEqual(loaded.defaultSoilType, "Clay");
  assert.strictEqual(loaded.preferredIrrigationMethod, "Sprinkler");
  assert.strictEqual(loaded.measurementUnits, "Acres / m³");
});

test("saveFarmPreferences sanitizes invalid soil type and irrigation method", () => {
  globalThis.window.localStorage.clear();
  // Pass invalid soil and irrigation method
  saveFarmPreferences({
    defaultLocation: "   ",
    defaultSoilType: "NonExistentSoil",
    preferredIrrigationMethod: "InvalidMethod",
  });

  const loaded = loadFarmPreferences();
  assert.strictEqual(loaded.defaultLocation, DEFAULT_FARM_PREFERENCES.defaultLocation);
  assert.strictEqual(loaded.defaultSoilType, DEFAULT_FARM_PREFERENCES.defaultSoilType);
  assert.strictEqual(loaded.preferredIrrigationMethod, DEFAULT_FARM_PREFERENCES.preferredIrrigationMethod);
});

test("VALID_IRRIGATION_METHODS contains Drip, Sprinkler, and Surface/Flood", () => {
  assert.ok(VALID_IRRIGATION_METHODS.includes("Drip"));
  assert.ok(VALID_IRRIGATION_METHODS.includes("Sprinkler"));
  assert.ok(VALID_IRRIGATION_METHODS.includes("Surface/Flood"));
});

test("getExportableWorkspaceData returns structured backup with empty farm flags", () => {
  globalThis.window.localStorage.clear();
  const exportData = getExportableWorkspaceData();

  assert.strictEqual(exportData.application, "Quantum Agri");
  assert.strictEqual(exportData.version, "0.1.1");
  assert.strictEqual(typeof exportData.exportedAt, "string");
  assert.strictEqual(exportData.hasActiveFarm, false);
  assert.strictEqual(exportData.farmData, null);
  assert.ok(exportData.preferences !== undefined);
});

test("getExportableWorkspaceData includes active farm when saved", () => {
  globalThis.window.localStorage.clear();
  const sampleFarm = {
    areaAcres: 10,
    soilType: "Loamy",
    expectedRainfallMm: 600,
    availableWaterM3: 5000,
    location: "Pune",
    season: "Kharif",
    budget: 150000,
  };

  saveFarmDataToStorage(sampleFarm);
  const exportData = getExportableWorkspaceData();

  assert.strictEqual(exportData.hasActiveFarm, true);
  assert.strictEqual(exportData.farmData.areaAcres, 10);
  assert.strictEqual(exportData.farmData.location, "Pune");
});

test("updateUserProfile falls back safely without unhandled exceptions", async () => {
  const result = await updateUserProfile({ data: { full_name: "Test User" } });
  assert.ok(result !== undefined);
});

test("sendPasswordReset falls back safely without unhandled exceptions", async () => {
  const result = await sendPasswordReset("test@example.com");
  assert.ok(result !== undefined);
});

test("signOut executes safely without unhandled exceptions", async () => {
  const result = await signOut();
  assert.ok(result !== undefined);
});
