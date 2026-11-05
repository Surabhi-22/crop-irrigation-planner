/**
 * Farm API service — connects the frontend FarmForm to the
 * FastAPI POST /api/v1/farm/validate endpoint.
 *
 * Handles field-name mapping between the frontend camelCase schema
 * and the backend snake_case Pydantic schema.
 */

import { postJson, ApiError } from './apiClient.js';

const VALIDATE_PATH = '/api/v1/farm/validate';

/**
 * Maps frontend farm data (camelCase) to the backend FarmInput schema (snake_case).
 *
 * Frontend fields   →  Backend fields
 * ──────────────────────────────────
 * areaAcres         →  area_acres
 * soilType          →  soil_type
 * expectedRainfallMm→  expected_rainfall_mm
 * availableWaterM3  →  available_water_m3
 * location          →  location
 * season            →  season
 * budget            →  budget_inr
 *
 * @param {object} frontendData - Farm data as produced by FarmForm
 * @returns {object} Payload matching the backend FarmInput schema
 */
export function toBackendSchema(frontendData) {
  if (!frontendData || typeof frontendData !== 'object') {
    throw new Error('Farm data is required and must be an object.');
  }

  const area =
    frontendData.areaAcres !== undefined
      ? frontendData.areaAcres
      : frontendData.area !== undefined
      ? frontendData.area
      : frontendData.area_acres;
  const rainfall =
    frontendData.expectedRainfallMm !== undefined
      ? frontendData.expectedRainfallMm
      : frontendData.rainfall !== undefined
      ? frontendData.rainfall
      : frontendData.expected_rainfall_mm;
  const water =
    frontendData.availableWaterM3 !== undefined
      ? frontendData.availableWaterM3
      : frontendData.availableWater !== undefined
      ? frontendData.availableWater
      : frontendData.available_water_m3;
  const isUnconstrained =
    frontendData.unconstrainedBudget === true ||
    frontendData.isBudgetUnconstrained === true ||
    frontendData.budget === null ||
    frontendData.budget === 'unconstrained';

  let budgetVal;
  if (isUnconstrained) {
    budgetVal = null;
  } else {
    const rawBudget =
      frontendData.budget !== undefined
        ? frontendData.budget
        : frontendData.budget_inr;
    budgetVal =
      rawBudget === '' || rawBudget === null || rawBudget === undefined
        ? null
        : Number(rawBudget);
  }

  return {
    area_acres: Number(area),
    soil_type: String(frontendData.soilType || frontendData.soil_type || '').trim(),
    expected_rainfall_mm: Number(rainfall),
    available_water_m3: Number(water),
    location: String(frontendData.location || '').trim(),
    season: String(frontendData.season || '').trim(),
    budget_inr: budgetVal,
  };
}

/**
 * Maps the backend FarmInput echo (snake_case) back to the frontend schema (camelCase).
 *
 * @param {object} backendData - Validated data echoed back by the API
 * @returns {object|null} Data in the frontend schema, or null if input invalid
 */
export function toFrontendSchema(backendData) {
  if (!backendData || typeof backendData !== 'object') {
    return null;
  }

  const isUnconstrained = backendData.budget_inr === null || backendData.budget_inr === undefined;

  return {
    areaAcres: Number(backendData.area_acres),
    soilType: String(backendData.soil_type),
    expectedRainfallMm: Number(backendData.expected_rainfall_mm),
    availableWaterM3: Number(backendData.available_water_m3),
    location: String(backendData.location || ''),
    season: String(backendData.season),
    budget: isUnconstrained ? null : Number(backendData.budget_inr),
    unconstrainedBudget: isUnconstrained,
  };
}

/**
 * Sends farm data to the backend validation endpoint.
 *
 * @param {object} farmData - Frontend farm data object (camelCase keys)
 * @returns {Promise<{valid: boolean, message: string, data: object}>}
 *   Resolves with the full FarmValidationResponse; the `data` field
 *   is converted back to frontend (camelCase) keys.
 * @throws {import('./apiClient.js').ApiError}     On validation / server errors or validation failure
 * @throws {import('./apiClient.js').NetworkError}  On connection failures
 */
export async function validateFarm(farmData) {
  const payload = toBackendSchema(farmData);
  const response = await postJson(VALIDATE_PATH, payload);

  // Validate the server's response structure to guarantee no silent failure
  if (!response || typeof response !== 'object') {
    throw new ApiError(500, 'Invalid Response', {
      detail: 'Server returned an empty or invalid response.',
    });
  }

  if (response.valid !== true) {
    const errorMsg =
      response.message || 'Server rejected farm parameters as invalid.';
    throw new ApiError(400, 'Validation Rejected', {
      detail: errorMsg,
      message: errorMsg,
    });
  }

  if (!response.data) {
    throw new ApiError(500, 'Malformed Response', {
      detail: 'Server response is missing validated farm data.',
    });
  }

  // Convert the echoed validated data back to frontend schema
  const mappedData = toFrontendSchema(response.data);
  if (!mappedData) {
    throw new ApiError(500, 'Data Mapping Failed', {
      detail: 'Failed to process validated farm parameters from server.',
    });
  }

  return {
    valid: true,
    message: response.message || 'Farm input parameters are valid and normalized.',
    data: mappedData,
  };
}

const GENERATE_PLAN_PATH = '/api/v1/plan/generate';

/**
 * Sends farm data to the planning endpoint to generate a full crop and water allocation plan.
 *
 * @param {object} farmData - Frontend farm data object (camelCase keys)
 * @returns {Promise<object>} Parsed PlanResponse from backend
 * @throws {import('./apiClient.js').ApiError} On validation/infeasibility/server errors
 * @throws {import('./apiClient.js').NetworkError} On connection failures
 */
export async function generatePlan(farmData) {
  const payload = toBackendSchema(farmData);
  const response = await postJson(GENERATE_PLAN_PATH, payload);

  if (!response || typeof response !== 'object') {
    throw new ApiError(500, 'Invalid Response', {
      detail: 'Server returned an empty or invalid plan response.',
    });
  }

  return response;
}

