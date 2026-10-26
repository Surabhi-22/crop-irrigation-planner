/**
 * API Client for Crop & Irrigation Planner backend.
 *
 * Uses the native fetch API — no external dependencies.
 * Base URL defaults to http://127.0.0.1:8000 and can be overridden
 * via the VITE_API_BASE_URL environment variable.
 */

const RAW_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://127.0.0.1:8000';

// Strip any trailing slash to avoid double-slash route issues (e.g., http://127.0.0.1:8000//api/v1/...)
const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

/**
 * Custom error class for API responses with non-2xx status codes.
 * Carries the HTTP status, status text, and parsed response body.
 */
export class ApiError extends Error {
  /**
   * @param {number} status     - HTTP status code
   * @param {string} statusText - HTTP status text
   * @param {*}      body       - Parsed JSON response body (or null)
   */
  constructor(status, statusText, body) {
    let message = `API Error ${status}: ${statusText}`;

    if (body?.detail) {
      if (Array.isArray(body.detail)) {
        // FastAPI / Pydantic validation errors (array of objects)
        const fieldErrors = body.detail.map((err) => {
          const field =
            err.loc?.slice(1).join('.') || err.loc?.join('.') || 'parameter';
          return `${field}: ${err.msg}`;
        });
        message = fieldErrors.join('; ');
      } else if (typeof body.detail === 'string') {
        message = body.detail;
      } else if (typeof body.detail === 'object' && body.detail !== null) {
        if (body.detail.message) {
          message = body.detail.message;
        } else if (body.detail.error) {
          message = String(body.detail.error);
        }
      }
    } else if (body?.message) {
      message = body.message;
    } else if (body?.error) {
      message = typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
    }

    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/**
 * Custom error class for network failures (backend unreachable, timeout, CORS, DNS).
 */
export class NetworkError extends Error {
  constructor(originalError, targetUrl = API_BASE_URL) {
    const isTimeout =
      originalError?.name === 'TimeoutError' ||
      originalError?.name === 'AbortError';

    const message = isTimeout
      ? `Request timed out. The backend server at ${targetUrl} did not respond within the time limit.`
      : `Unable to reach the server at ${targetUrl}. Please check that the FastAPI backend is running and try again.`;

    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
    this.targetUrl = targetUrl;
  }
}

/**
 * Sends a JSON request to the backend API with an optional timeout.
 *
 * @param {string} path    - API path (e.g. "/api/v1/farm/validate")
 * @param {object} options - Fetch options override
 * @param {string} [options.method='GET'] - HTTP method
 * @param {*}      [options.body]         - Request body (will be JSON-serialized)
 * @param {object} [options.headers]      - Additional headers
 * @param {number} [options.timeoutMs=15000] - Request timeout in milliseconds
 * @returns {Promise<*>} Parsed JSON response
 * @throws {ApiError}     On non-2xx HTTP responses
 * @throws {NetworkError} On network/connection failures or timeouts
 */
export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    timeoutMs = 15000,
    ...rest
  } = options;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  // Configure abort signal for timeout safety
  let controller = null;
  let signal = options.signal;

  if (!signal && typeof AbortController !== 'undefined') {
    controller = new AbortController();
    signal = controller.signal;
  }

  let timer = null;
  if (controller && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  const fetchOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
    signal,
    ...rest,
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    throw new NetworkError(err, API_BASE_URL);
  } finally {
    if (timer) clearTimeout(timer);
  }

  // Attempt to parse JSON regardless of status (FastAPI returns JSON error payloads)
  let responseBody = null;
  try {
    responseBody = await response.json();
  } catch {
    // Response body was not valid JSON
  }

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText, responseBody);
  }

  return responseBody;
}

/**
 * Convenience: POST JSON to an API path.
 *
 * @param {string} path - API path
 * @param {*}      data - Request payload
 * @param {object} [options] - Additional options
 * @returns {Promise<*>} Parsed JSON response
 */
export function postJson(path, data, options = {}) {
  return apiRequest(path, { method: 'POST', body: data, ...options });
}

/**
 * Convenience: GET an API path.
 *
 * @param {string} path - API path
 * @param {object} [options] - Additional options
 * @returns {Promise<*>} Parsed JSON response
 */
export function getJson(path, options = {}) {
  return apiRequest(path, { method: 'GET', ...options });
}

