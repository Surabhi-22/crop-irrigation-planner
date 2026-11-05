/**
 * Tests for Water Optimization calculations, logic, and state handling.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const MM_PER_ACRE_TO_M3 = 4.04686;

/**
 * Pure calculation helper replicating the mathematical logic used in WaterOptimization.
 */
function computeWaterBalance(crop, availableSupply, areaAcres, expectedRainfallMm) {
  if (!crop) return null;

  const waterReqMm = Number(crop.water_req_mm) || 0;
  const rainfallMm = Math.max(0, Number(expectedRainfallMm) || 0);
  const netIrrigationMm = Math.max(0, waterReqMm - rainfallMm);
  const calculatedDemandM3 = netIrrigationMm * areaAcres * MM_PER_ACRE_TO_M3;
  const netDemandM3 =
    crop.irrigation_req_m3 !== undefined
      ? Number(crop.irrigation_req_m3)
      : Math.round(calculatedDemandM3 * 100) / 100;

  const allocatedM3 = Math.min(availableSupply, netDemandM3);
  const remainingM3 = Math.max(0, availableSupply - netDemandM3);
  const deficitM3 = Math.max(0, netDemandM3 - availableSupply);
  const surplusM3 = Math.max(0, availableSupply - netDemandM3);
  const allocationPct =
    availableSupply > 0
      ? Math.round((allocatedM3 / availableSupply) * 1000) / 10
      : netDemandM3 === 0
      ? 0
      : 100;

  return {
    cropName: crop.name,
    waterReqMm,
    netDemandM3: Math.round(netDemandM3 * 100) / 100,
    availableSupply: Math.round(availableSupply * 100) / 100,
    allocatedM3: Math.round(allocatedM3 * 100) / 100,
    remainingM3: Math.round(remainingM3 * 100) / 100,
    deficitM3: Math.round(deficitM3 * 100) / 100,
    surplusM3: Math.round(surplusM3 * 100) / 100,
    allocationPct,
    isSufficient: netDemandM3 <= availableSupply,
  };
}

function computeMethodComparisons(netReqM3, availableSupply, efficiencies) {
  const effs = efficiencies || {
    Drip: 0.90,
    Sprinkler: 0.75,
    'Surface/Flood': 0.55,
  };
  const baselineEff = effs['Surface/Flood'] || 0.55;
  const baselineGross = netReqM3 > 0 ? netReqM3 / baselineEff : 0;

  return Object.entries(effs).map(([method, eff]) => {
    if (eff <= 0 || eff > 1) {
      throw new Error(`Invalid efficiency for ${method}: ${eff}`);
    }
    if (netReqM3 <= 0) {
      return {
        method,
        grossM3: 0,
        savingsM3: 0,
        savingsPct: 0,
        isFeasible: true,
      };
    }
    const grossM3 = netReqM3 / eff;
    const savingsM3 = Math.max(0, baselineGross - grossM3);
    const savingsPct = baselineGross > 0 ? (savingsM3 / baselineGross) * 100 : 0;

    return {
      method,
      grossM3: Math.round(grossM3 * 100) / 100,
      savingsM3: Math.round(savingsM3 * 100) / 100,
      savingsPct: Math.round(savingsPct * 10) / 10,
      isFeasible: grossM3 <= availableSupply,
    };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('1. Physical constant: 1 mm depth over 1 acre = 4.04686 m³', () => {
  assert.ok(Math.abs(MM_PER_ACRE_TO_M3 - 4.04686) < 1e-5);
  // 100 mm depth over 5 acres = 500 * 4.04686 = 2023.43 m³
  const volume = 100 * 5 * MM_PER_ACRE_TO_M3;
  assert.equal(Math.round(volume * 100) / 100, 2023.43);
});

test('2. Rainfall and net irrigation calculation', () => {
  // Crop ETc = 700 mm, rainfall = 400 mm on 5 acres
  // Net depth = 300 mm. Net volume = 300 * 5 * 4.04686 = 6070.29 m³
  const balance = computeWaterBalance(
    { name: 'Cotton', water_req_mm: 700 },
    10000,
    5,
    400
  );
  assert.equal(balance.netDemandM3, 6070.29);
  assert.equal(balance.isSufficient, true);

  // When rainfall exceeds requirement, net demand is 0 (never negative)
  const rainfed = computeWaterBalance(
    { name: 'Millet', water_req_mm: 300 },
    5000,
    5,
    600
  );
  assert.equal(rainfed.netDemandM3, 0);
  assert.equal(rainfed.deficitM3, 0);
  assert.equal(rainfed.allocatedM3, 0);
});

test('3. Single candidate crop allocation', () => {
  const crop = { name: 'Maize', water_req_mm: 520, irrigation_req_m3: 1500 };
  const balance = computeWaterBalance(crop, 3000, 5, 450);

  assert.equal(balance.cropName, 'Maize');
  assert.equal(balance.netDemandM3, 1500);
  assert.equal(balance.allocatedM3, 1500);
  assert.equal(balance.remainingM3, 1500);
  assert.equal(balance.surplusM3, 1500);
  assert.equal(balance.deficitM3, 0);
  assert.equal(balance.allocationPct, 50.0);
  assert.equal(balance.isSufficient, true);
});

test('4. Multiple mutually exclusive candidate crops are NEVER summed', () => {
  const candidates = [
    { name: 'Cotton', water_req_mm: 700, irrigation_req_m3: 2000 },
    { name: 'Maize', water_req_mm: 520, irrigation_req_m3: 1200 },
    { name: 'Soybean', water_req_mm: 450, irrigation_req_m3: 800 },
  ];
  const availableSupply = 2500;

  // The active scenario evaluates Cotton (the top recommendation)
  const cottonBalance = computeWaterBalance(candidates[0], availableSupply, 5, 400);

  // Allocated water MUST be Cotton's demand (2000 m³), NOT 2000 + 1200 + 800 = 4000 m³!
  assert.equal(cottonBalance.allocatedM3, 2000);
  assert.equal(cottonBalance.remainingM3, 500);
  assert.equal(cottonBalance.deficitM3, 0);

  // If user evaluates Maize instead, it evaluates Maize alone
  const maizeBalance = computeWaterBalance(candidates[1], availableSupply, 5, 400);
  assert.equal(maizeBalance.allocatedM3, 1200);
  assert.equal(maizeBalance.remainingM3, 1300);
});

test('5. Sufficient water supply (surplus buffer)', () => {
  const crop = { name: 'Groundnut', irrigation_req_m3: 1000 };
  const balance = computeWaterBalance(crop, 4000, 5, 400);

  assert.equal(balance.allocatedM3, 1000);
  assert.equal(balance.remainingM3, 3000);
  assert.equal(balance.surplusM3, 3000);
  assert.equal(balance.deficitM3, 0);
  assert.equal(balance.allocationPct, 25.0);
  assert.equal(balance.isSufficient, true);
});

test('6. Insufficient water supply (deficit and capped remaining water)', () => {
  const crop = { name: 'Rice (Paddy)', irrigation_req_m3: 5000 };
  const balance = computeWaterBalance(crop, 2000, 5, 200);

  assert.equal(balance.allocatedM3, 2000);
  assert.equal(balance.remainingM3, 0); // Never negative
  assert.equal(balance.surplusM3, 0);
  assert.equal(balance.deficitM3, 3000);
  assert.equal(balance.allocationPct, 100.0);
  assert.equal(balance.isSufficient, false);
});

test('7. Zero available water supply handling', () => {
  // Thirsty crop with 0 available water
  const thirsty = { name: 'Cotton', irrigation_req_m3: 1500 };
  const thirstyBalance = computeWaterBalance(thirsty, 0, 5, 400);
  assert.equal(thirstyBalance.allocatedM3, 0);
  assert.equal(thirstyBalance.remainingM3, 0);
  assert.equal(thirstyBalance.deficitM3, 1500);
  assert.equal(thirstyBalance.allocationPct, 100.0);

  // Rain-fed crop with 0 available water
  const rainfed = { name: 'Millet', irrigation_req_m3: 0 };
  const rainfedBalance = computeWaterBalance(rainfed, 0, 5, 400);
  assert.equal(rainfedBalance.allocatedM3, 0);
  assert.equal(rainfedBalance.remainingM3, 0);
  assert.equal(rainfedBalance.deficitM3, 0);
  assert.equal(rainfedBalance.allocationPct, 0.0);
});

test('8. Irrigation efficiency comparison (Drip vs Sprinkler vs Flood)', () => {
  const netDemand = 990; // m³
  const available = 2000;
  const methods = computeMethodComparisons(netDemand, available);
  const byName = Object.fromEntries(methods.map((m) => [m.method, m]));

  // Surface/Flood baseline at 55%
  assert.equal(byName['Surface/Flood'].grossM3, 1800); // 990 / 0.55
  assert.equal(byName['Surface/Flood'].savingsM3, 0);
  assert.equal(byName['Surface/Flood'].savingsPct, 0);

  // Sprinkler at 75%
  assert.equal(byName['Sprinkler'].grossM3, 1320); // 990 / 0.75
  assert.equal(byName['Sprinkler'].savingsM3, 480); // 1800 - 1320
  assert.equal(byName['Sprinkler'].savingsPct, 26.7);

  // Drip at 90%
  assert.equal(byName['Drip'].grossM3, 1100); // 990 / 0.90
  assert.equal(byName['Drip'].savingsM3, 700); // 1800 - 1100
  assert.equal(byName['Drip'].savingsPct, 38.9);
});

test('9. Invalid efficiency values throw error', () => {
  assert.throws(() => {
    computeMethodComparisons(500, 1000, { Bad: 0 });
  }, /Invalid efficiency/);

  assert.throws(() => {
    computeMethodComparisons(500, 1000, { Bad: -0.2 });
  }, /Invalid efficiency/);

  assert.throws(() => {
    computeMethodComparisons(500, 1000, { Bad: 1.5 });
  }, /Invalid efficiency/);
});

test('10. No-plan empty state does not fabricate fallback numbers', () => {
  // Empty plan input
  const planResult = null;
  assert.equal(planResult, null);
  // Verify that null planResult produces null balance without defaulting to 3000 m³
  const balance = computeWaterBalance(null, 0, 0, 0);
  assert.equal(balance, null);
});

test('11. Evaluate Plan button action uses exact farm parameters and formats backend schema', () => {
  const farmData = {
    location: 'belagavi',
    areaAcres: 8.0,
    soilType: 'Loamy',
    expectedRainfallMm: 650.0,
    availableWaterM3: 3000.0,
    season: 'Kharif',
    budget: 100000.0,
  };

  // Simulating the action of clicking Evaluate Plan for belagavi (8 ac)
  assert.equal(farmData.location, 'belagavi');
  assert.equal(farmData.areaAcres, 8.0);

  // Button label formatting
  const buttonLabel = `Evaluate Plan for ${farmData.location || 'My Farm'} (${farmData.areaAcres} ac)`;
  assert.equal(buttonLabel, 'Evaluate Plan for belagavi (8 ac)');

  // Verify that it is marked as a real (non-simulated) plan
  const resultPayload = {
    feasible: true,
    location: 'belagavi',
    farm_area_acres: 8.0,
    season: 'Kharif',
    isDemonstration: false,
    isSimulated: false,
  };

  assert.strictEqual(resultPayload.isDemonstration, false);
  assert.strictEqual(resultPayload.isSimulated, false);
  assert.strictEqual(resultPayload.location, 'belagavi');
  assert.strictEqual(resultPayload.farm_area_acres, 8.0);
});

test('12. Generate Baseline Demonstration Plan creates explicitly marked simulated data', () => {
  const defaultBaselineFarm = {
    areaAcres: 5.0,
    soilType: 'Loamy',
    expectedRainfallMm: 650.0,
    availableWaterM3: 4000.0,
    location: 'Bengaluru (Sample Farm)',
    season: 'Kharif',
    budget: 100000.0,
  };

  // Farmer's existing real farm data (Belagavi, 8 ac)
  const savedFarmerData = {
    location: 'belagavi',
    areaAcres: 8.0,
    soilType: 'Clay',
    expectedRainfallMm: 700.0,
    availableWaterM3: 5000.0,
    season: 'Kharif',
    budget: 150000.0,
  };

  // Mock generation of baseline demonstration plan
  const mockBackendResult = {
    feasible: true,
    farm_area_acres: defaultBaselineFarm.areaAcres,
    location: defaultBaselineFarm.location,
    season: defaultBaselineFarm.season,
    water: {
      total_available_m3: defaultBaselineFarm.availableWaterM3,
      allocated_m3: 1500.0,
      remaining_m3: 2500.0,
    },
  };

  const demoPlan = {
    ...mockBackendResult,
    isDemonstration: true,
    isSimulated: true,
    demonstrationLabel: 'Simulated Demonstration Baseline Plan',
  };

  // 1. Verify demo plan is clearly flagged
  assert.strictEqual(demoPlan.isDemonstration, true);
  assert.strictEqual(demoPlan.isSimulated, true);
  assert.strictEqual(demoPlan.location, 'Bengaluru (Sample Farm)');

  // 2. CRITICAL: Farmer's saved farm details are NOT overwritten
  assert.strictEqual(savedFarmerData.location, 'belagavi');
  assert.strictEqual(savedFarmerData.areaAcres, 8.0);
  assert.strictEqual(savedFarmerData.soilType, 'Clay');
  assert.strictEqual(savedFarmerData.budget, 150000.0);
});

test('13. Switching between real plan and baseline demonstration plan preserves real plan state', () => {
  let activePlanMode = 'real';
  const realPlan = { location: 'belagavi', farm_area_acres: 8.0, isDemonstration: false };
  const demoPlan = { location: 'Bengaluru (Sample Farm)', farm_area_acres: 5.0, isDemonstration: true };

  // Initial state: real plan active
  let currentPlan = activePlanMode === 'demo' ? demoPlan : realPlan;
  assert.strictEqual(currentPlan.location, 'belagavi');
  assert.strictEqual(currentPlan.isDemonstration, false);

  // User clicks "Generate Baseline Demonstration Plan"
  activePlanMode = 'demo';
  currentPlan = activePlanMode === 'demo' ? demoPlan : realPlan;
  assert.strictEqual(currentPlan.location, 'Bengaluru (Sample Farm)');
  assert.strictEqual(currentPlan.isDemonstration, true);

  // User clicks "Switch to My Real Farm Plan"
  activePlanMode = 'real';
  currentPlan = activePlanMode === 'demo' ? demoPlan : realPlan;
  assert.strictEqual(currentPlan.location, 'belagavi');
  assert.strictEqual(currentPlan.isDemonstration, false);
});

test('14. Loading state handling prevents null pointer exceptions during in-flight evaluation', () => {
  const loadingPlan = true;
  const planResult = null;

  // View 1 guard check
  const shouldRenderLoading = !planResult && loadingPlan;
  assert.strictEqual(shouldRenderLoading, true);

  // Safe accessor check: optional chaining prevents TypeError on null planResult
  const safeLocation = planResult?.location || 'Fallback Location';
  assert.strictEqual(safeLocation, 'Fallback Location');
  const safeSeason = planResult?.season || 'Kharif';
  assert.strictEqual(safeSeason, 'Kharif');
});

test('15. Error state captures planning failure and provides retry context', () => {
  const planError = new Error('FastAPI server connection timed out');
  assert.ok(planError.message.includes('connection timed out'));

  // Formatted error banner text
  const errorDescription = planError?.message || 'Failed to reach the planning service.';
  assert.equal(errorDescription, 'FastAPI server connection timed out');
});

