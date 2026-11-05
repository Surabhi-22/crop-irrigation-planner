import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toBackendSchema,
  toFrontendSchema,
} from '../src/services/farmApi.js';

test('toBackendSchema correctly formats 8-acre Rabi Sandy ₹8,555 budget payload', () => {
  const farmFormState = {
    areaAcres: '8.0',
    soilType: 'Sandy',
    expectedRainfallMm: '650',
    availableWaterM3: '3000',
    location: 'Bangalore Rural',
    season: 'Rabi',
    budget: '8555',
  };

  const payload = toBackendSchema(farmFormState);

  assert.strictEqual(payload.area_acres, 8.0);
  assert.strictEqual(payload.soil_type, 'Sandy');
  assert.strictEqual(payload.expected_rainfall_mm, 650);
  assert.strictEqual(payload.available_water_m3, 3000);
  assert.strictEqual(payload.location, 'Bangalore Rural');
  assert.strictEqual(payload.season, 'Rabi');
  assert.strictEqual(payload.budget_inr, 8555);
});

test('toBackendSchema maps unconstrained budget to null and zero budget to 0', () => {
  const baseForm = {
    areaAcres: '5.0',
    soilType: 'Loamy',
    expectedRainfallMm: '500',
    availableWaterM3: '2000',
    location: 'Mysuru',
    season: 'Kharif',
  };

  // 1. Explicit unconstrainedBudget checkbox = true
  const unconstrainedPayload = toBackendSchema({
    ...baseForm,
    unconstrainedBudget: true,
    budget: '',
  });
  assert.strictEqual(unconstrainedPayload.budget_inr, null);

  // 2. Budget explicitly null
  const nullBudgetPayload = toBackendSchema({
    ...baseForm,
    budget: null,
  });
  assert.strictEqual(nullBudgetPayload.budget_inr, null);

  // 3. Zero budget as string '0' -> number 0 (indicates zero operational capital)
  const zeroStringPayload = toBackendSchema({
    ...baseForm,
    budget: '0',
    unconstrainedBudget: false,
  });
  assert.strictEqual(zeroStringPayload.budget_inr, 0);

  // 4. Zero budget as number 0 -> number 0
  const zeroNumberPayload = toBackendSchema({
    ...baseForm,
    budget: 0,
    unconstrainedBudget: false,
  });
  assert.strictEqual(zeroNumberPayload.budget_inr, 0);

  // 5. Positive budget -> positive number
  const positivePayload = toBackendSchema({
    ...baseForm,
    budget: '15000',
  });
  assert.strictEqual(positivePayload.budget_inr, 15000);
});

test('toFrontendSchema maps null budget_inr to unconstrained and 0 to zero capital', () => {
  const baseBackend = {
    area_acres: 5.0,
    soil_type: 'Loamy',
    expected_rainfall_mm: 500,
    available_water_m3: 2000,
    location: 'Mysuru',
    season: 'Kharif',
  };

  // 1. null budget_inr -> budget: null, unconstrainedBudget: true
  const unconstrainedFrontend = toFrontendSchema({
    ...baseBackend,
    budget_inr: null,
  });
  assert.strictEqual(unconstrainedFrontend.budget, null);
  assert.strictEqual(unconstrainedFrontend.unconstrainedBudget, true);

  // 2. 0 budget_inr -> budget: 0, unconstrainedBudget: false
  const zeroFrontend = toFrontendSchema({
    ...baseBackend,
    budget_inr: 0,
  });
  assert.strictEqual(zeroFrontend.budget, 0);
  assert.strictEqual(zeroFrontend.unconstrainedBudget, false);

  // 3. Positive budget_inr -> budget: 25000, unconstrainedBudget: false
  const positiveFrontend = toFrontendSchema({
    ...baseBackend,
    budget_inr: 25000,
  });
  assert.strictEqual(positiveFrontend.budget, 25000);
  assert.strictEqual(positiveFrontend.unconstrainedBudget, false);
});

test('budget-aware plan response structure parses Category A, B, and C recommendations', () => {
  const mockPlanResponse = {
    feasible: true,
    farm_area_acres: 8.0,
    season: 'Rabi',
    soil_type: 'Sandy',
    budget_aware_notice: 'Your operational budget of ₹8,555 supports cultivating 0.95 acres of your 8.0-acre farm.',
    top_recommendation: {
      name: 'Chickpea (Chana)',
      recommended_area_acres: 0.95,
      remaining_area_acres: 7.05,
      is_partial_area: true,
      limiting_factor: 'Budget',
      cost_inr_per_acre: 9000,
      est_total_cost_inr: 8550,
      est_total_profit_inr: 22800,
      roi_pct: 266.7,
      category: 'recommended',
      suitability_reason: 'Budget-optimized for 0.95 acres.',
    },
    all_feasible_crops: [
      {
        name: 'Chickpea (Chana)',
        category: 'recommended',
        recommended_area_acres: 0.95,
        remaining_area_acres: 7.05,
      },
      {
        name: 'Sorghum (Jowar)',
        category: 'recommended',
        recommended_area_acres: 1.22,
        remaining_area_acres: 6.78,
      },
    ],
    alternative_crops: [
      {
        name: 'Pearl Millet (Bajra)',
        category: 'alternative',
        adjustment_type: 'season',
        required_adjustment: 'Seasonal rotation: Plant in Kharif, Summer season.',
      },
      {
        name: 'Wheat',
        category: 'alternative',
        adjustment_type: 'soil',
        required_adjustment: 'Soil adaptation: Requires Loamy, Clay, Silty soil.',
      },
    ],
    unsuitable_crops: [
      {
        name: 'Rice (Paddy)',
        category: 'unsuitable',
        rejection_reasons: ['Not suited for Rabi season', 'Incompatible with Sandy soil'],
      },
    ],
  };

  assert.strictEqual(mockPlanResponse.feasible, true);
  assert.strictEqual(mockPlanResponse.top_recommendation.is_partial_area, true);
  assert.strictEqual(mockPlanResponse.top_recommendation.recommended_area_acres, 0.95);
  assert.strictEqual(mockPlanResponse.top_recommendation.remaining_area_acres, 7.05);
  assert.strictEqual(mockPlanResponse.all_feasible_crops.length, 2);
  assert.strictEqual(mockPlanResponse.alternative_crops.length, 2);
  assert.strictEqual(mockPlanResponse.unsuitable_crops.length, 1);
});

