import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toBackendSchema,
  toFrontendSchema,
} from '../src/services/farmApi.js';
import { ApiError, NetworkError } from '../src/services/apiClient.js';

test('toBackendSchema maps camelCase frontend fields to snake_case backend fields', () => {
  const frontendData = {
    areaAcres: 5.5,
    soilType: 'Loamy',
    expectedRainfallMm: 650,
    availableWaterM3: 3000,
    location: '   Bengaluru Rural   ',
    season: 'Kharif',
    budget: 8500,
  };

  const backendPayload = toBackendSchema(frontendData);

  assert.deepEqual(backendPayload, {
    area_acres: 5.5,
    soil_type: 'Loamy',
    expected_rainfall_mm: 650,
    available_water_m3: 3000,
    location: 'Bengaluru Rural',
    season: 'Kharif',
    budget_inr: 8500,
  });
});

test('toBackendSchema coerces string numbers and trims whitespace', () => {
  const frontendData = {
    areaAcres: '10.2',
    soilType: '  Clay  ',
    expectedRainfallMm: '400',
    availableWaterM3: '2500',
    location: '  Mysuru  ',
    season: '  Rabi  ',
    budget: '12000',
  };

  const backendPayload = toBackendSchema(frontendData);

  assert.strictEqual(backendPayload.area_acres, 10.2);
  assert.strictEqual(backendPayload.soil_type, 'Clay');
  assert.strictEqual(backendPayload.expected_rainfall_mm, 400);
  assert.strictEqual(backendPayload.available_water_m3, 2500);
  assert.strictEqual(backendPayload.location, 'Mysuru');
  assert.strictEqual(backendPayload.season, 'Rabi');
  assert.strictEqual(backendPayload.budget_inr, 12000);
});

test('toBackendSchema rejects non-object or null data', () => {
  assert.throws(() => toBackendSchema(null), /Farm data is required/);
  assert.throws(() => toBackendSchema('string'), /Farm data is required/);
});

test('toFrontendSchema converts snake_case backend echo to camelCase frontend schema', () => {
  const backendEcho = {
    area_acres: 5.0,
    soil_type: 'Loamy',
    expected_rainfall_mm: 650.0,
    available_water_m3: 3000.0,
    location: 'Bengaluru',
    season: 'Kharif',
    budget_inr: 8500.0,
  };

  const frontendData = toFrontendSchema(backendEcho);

  assert.deepEqual(frontendData, {
    areaAcres: 5.0,
    soilType: 'Loamy',
    expectedRainfallMm: 650.0,
    availableWaterM3: 3000.0,
    location: 'Bengaluru',
    season: 'Kharif',
    budget: 8500.0,
  });
});

test('toFrontendSchema safely returns null for invalid input', () => {
  assert.strictEqual(toFrontendSchema(null), null);
  assert.strictEqual(toFrontendSchema(undefined), null);
  assert.strictEqual(toFrontendSchema(123), null);
});

test('ApiError parses FastAPI Pydantic 422 array of validation errors', () => {
  const pydanticBody = {
    detail: [
      {
        loc: ['body', 'area_acres'],
        msg: 'Input should be greater than 0',
        type: 'greater_than',
      },
      {
        loc: ['body', 'budget_inr'],
        msg: 'Input should be greater than or equal to 0',
        type: 'greater_than_equal',
      },
    ],
  };

  const error = new ApiError(422, 'Unprocessable Entity', pydanticBody);

  assert.strictEqual(error.status, 422);
  assert.strictEqual(
    error.message,
    'area_acres: Input should be greater than 0; budget_inr: Input should be greater than or equal to 0'
  );
});

test('ApiError parses single string detail or custom message', () => {
  const errorWithDetail = new ApiError(400, 'Bad Request', {
    detail: 'Invalid parameters provided.',
  });
  assert.strictEqual(errorWithDetail.message, 'Invalid parameters provided.');

  const errorWithMessage = new ApiError(400, 'Bad Request', {
    message: 'Farm validation rejected by server.',
  });
  assert.strictEqual(errorWithMessage.message, 'Farm validation rejected by server.');
});

test('NetworkError formats helpful message with target URL', () => {
  const netError = new NetworkError(new Error('Failed to fetch'), 'http://127.0.0.1:8000');
  assert.match(netError.message, /Unable to reach the server at http:\/\/127.0.0.1:8000/);

  const timeoutError = new NetworkError({ name: 'TimeoutError' }, 'http://127.0.0.1:8000');
  assert.match(timeoutError.message, /Request timed out/);
});

test('ApiError parses structured infeasible plan object in detail', () => {
  const infeasiblePayload = {
    detail: {
      error: 'infeasible_plan',
      message: 'All compatible crops exceed your allocated budget.',
      suggestions: ['Increase total budget to at least ₹35,000.'],
      farm: { area_acres: 5.0, budget_inr: 8500.0 },
    },
  };

  const error = new ApiError(422, 'Unprocessable Entity', infeasiblePayload);
  assert.strictEqual(error.status, 422);
  assert.strictEqual(
    error.message,
    'All compatible crops exceed your allocated budget.'
  );
  assert.strictEqual(error.body.detail.error, 'infeasible_plan');
  assert.deepEqual(error.body.detail.suggestions, [
    'Increase total budget to at least ₹35,000.',
  ]);
});

test('generatePlan is an exported async function', async () => {
  const { generatePlan } = await import('../src/services/farmApi.js');
  assert.strictEqual(typeof generatePlan, 'function');
});

test('toBackendSchema maps alternative keys from FarmForm (area, rainfall, availableWater, budget_inr)', () => {
  const formRawData = {
    area: '7.5',
    soil_type: 'Clay',
    rainfall: '550',
    availableWater: '4200',
    location: 'Mysuru',
    season: 'Rabi',
    budget_inr: 50000,
  };

  const payload = toBackendSchema(formRawData);
  assert.deepEqual(payload, {
    area_acres: 7.5,
    soil_type: 'Clay',
    expected_rainfall_mm: 550,
    available_water_m3: 4200,
    location: 'Mysuru',
    season: 'Rabi',
    budget_inr: 50000,
  });
});

test('generatePlan payload preparation ensures strictly positive area and non-negative parameters', () => {
  const farmData = {
    areaAcres: 5.0,
    soilType: 'Loamy',
    expectedRainfallMm: 650.0,
    availableWaterM3: 5000.0,
    location: 'Bengaluru',
    season: 'Kharif',
    budget: 100000.0,
  };

  const payload = toBackendSchema(farmData);
  assert.strictEqual(payload.area_acres, 5.0);
  assert.strictEqual(payload.soil_type, 'Loamy');
  assert.strictEqual(payload.expected_rainfall_mm, 650.0);
  assert.strictEqual(payload.available_water_m3, 5000.0);
  assert.strictEqual(payload.location, 'Bengaluru');
  assert.strictEqual(payload.season, 'Kharif');
  assert.strictEqual(payload.budget_inr, 100000.0);
});

test('toBackendSchema handles snake_case properties as fallbacks without NaN', () => {
  const backendLikeData = {
    area_acres: 5.0,
    soil_type: 'Clay',
    expected_rainfall_mm: 700.0,
    available_water_m3: 3500.0,
    location: 'Dharwad',
    season: 'Rabi',
    budget_inr: 80000.0,
  };

  const payload = toBackendSchema(backendLikeData);
  assert.strictEqual(payload.area_acres, 5.0);
  assert.strictEqual(payload.soil_type, 'Clay');
  assert.strictEqual(payload.expected_rainfall_mm, 700.0);
  assert.strictEqual(payload.available_water_m3, 3500.0);
  assert.strictEqual(payload.location, 'Dharwad');
  assert.strictEqual(payload.season, 'Rabi');
  assert.strictEqual(payload.budget_inr, 80000.0);
});

test('generatePlan payload structure satisfies backend validation expectations', () => {
  const farmInput = {
    areaAcres: 8.0,
    soilType: 'Black',
    expectedRainfallMm: 500,
    availableWaterM3: 2000,
    location: 'Dharwad',
    season: 'Rabi',
    budget: 50000,
  };

  const payload = toBackendSchema(farmInput);
  assert.strictEqual(typeof payload.area_acres, 'number');
  assert.ok(payload.area_acres > 0);
  assert.strictEqual(typeof payload.soil_type, 'string');
  assert.strictEqual(typeof payload.expected_rainfall_mm, 'number');
  assert.strictEqual(typeof payload.available_water_m3, 'number');
  assert.strictEqual(typeof payload.location, 'string');
  assert.strictEqual(typeof payload.season, 'string');
  assert.strictEqual(typeof payload.budget_inr, 'number');
  assert.ok(payload.budget_inr > 0);
});



