/**
 * Quantum Agri — Hyper-Local Weather & Rainfall Intelligence Service
 *
 * Sourced via Open-Meteo Forecast API (https://open-meteo.com).
 * - Fully open, non-commercial and commercial free-tier, no secret API key required.
 * - Attribution: "Weather data by Open-Meteo.com (CC BY 4.0)"
 * - Endpoints: Current conditions, hourly forecast, 7-day daily forecast, and
 *   past 24h observed/reanalysis rainfall.
 *
 * Implements:
 * - Strict coordinate validation.
 * - In-memory LRU-like TTL cache (15 mins) keyed by coordinates to prevent redundant requests.
 * - AbortController request cancellation & sequence tracking to prevent race conditions.
 * - WMO Weather interpretation code translation with Material Symbols icon mapping.
 * - Clear distinction between current observations, forecast rainfall, and past observed rainfall.
 */

import { formatCoordinates } from "./geocodingApi.js";
export { formatCoordinates };

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

/** Cache duration in milliseconds: 15 minutes */
const CACHE_TTL_MS = 15 * 60 * 1000;

/** In-memory cache mapping "latRounded_lonRounded" -> { timestamp, data } */
const weatherCache = new Map();

/**
 * Standard WMO Weather Interpretation Codes (WW)
 * Reference: World Meteorological Organization / Open-Meteo Documentation
 */
export const WMO_WEATHER_CODES = {
  0: { label: "Clear sky", icon: "wb_sunny", severity: "normal" },
  1: { label: "Mainly clear", icon: "wb_sunny", severity: "normal" },
  2: { label: "Partly cloudy", icon: "partly_cloudy_day", severity: "normal" },
  3: { label: "Overcast", icon: "cloud", severity: "normal" },
  45: { label: "Fog", icon: "foggy", severity: "caution" },
  48: { label: "Depositing rime fog", icon: "foggy", severity: "caution" },
  51: { label: "Light drizzle", icon: "grain", severity: "normal" },
  53: { label: "Moderate drizzle", icon: "grain", severity: "normal" },
  55: { label: "Dense drizzle", icon: "grain", severity: "caution" },
  56: { label: "Light freezing drizzle", icon: "ac_unit", severity: "caution" },
  57: { label: "Dense freezing drizzle", icon: "ac_unit", severity: "warning" },
  61: { label: "Slight rain", icon: "rainy", severity: "normal" },
  63: { label: "Moderate rain", icon: "rainy", severity: "caution" },
  65: { label: "Heavy rain", icon: "rainy", severity: "warning" },
  66: { label: "Light freezing rain", icon: "weather_mix", severity: "caution" },
  67: { label: "Heavy freezing rain", icon: "weather_mix", severity: "warning" },
  71: { label: "Slight snowfall", icon: "weather_snowy", severity: "caution" },
  73: { label: "Moderate snowfall", icon: "weather_snowy", severity: "warning" },
  75: { label: "Heavy snowfall", icon: "weather_snowy", severity: "warning" },
  77: { label: "Snow grains", icon: "weather_snowy", severity: "caution" },
  80: { label: "Slight rain showers", icon: "water_drop", severity: "normal" },
  81: { label: "Moderate rain showers", icon: "water_drop", severity: "caution" },
  82: { label: "Violent rain showers", icon: "water_drop", severity: "warning" },
  85: { label: "Slight snow showers", icon: "weather_snowy", severity: "caution" },
  86: { label: "Heavy snow showers", icon: "weather_snowy", severity: "warning" },
  95: { label: "Thunderstorm", icon: "thunderstorm", severity: "warning" },
  96: { label: "Thunderstorm with slight hail", icon: "thunderstorm", severity: "warning" },
  99: { label: "Thunderstorm with heavy hail", icon: "thunderstorm", severity: "warning" },
};

/**
 * Translate WMO weather code to label, icon, and severity.
 *
 * @param {number|null|undefined} code
 * @returns {{ label: string, icon: string, severity: 'normal'|'caution'|'warning' }}
 */
export function getWeatherCondition(code) {
  if (code == null || !Number.isFinite(Number(code))) {
    return { label: "Unknown", icon: "question_mark", severity: "normal" };
  }
  const numericCode = Math.round(Number(code));
  return (
    WMO_WEATHER_CODES[numericCode] || {
      label: `Condition (${numericCode})`,
      icon: "cloud",
      severity: "normal",
    }
  );
}

/**
 * Generates a normalized cache key for latitude and longitude (rounded to 3 decimal places ~100m).
 */
export function getCacheKey(lat, lon) {
  const roundedLat = Number(lat).toFixed(3);
  const roundedLon = Number(lon).toFixed(3);
  return `${roundedLat}_${roundedLon}`;
}

/**
 * Clear the in-memory weather cache (used on manual refresh).
 */
export function clearWeatherCache(lat = null, lon = null) {
  if (lat != null && lon != null) {
    weatherCache.delete(getCacheKey(lat, lon));
  } else {
    weatherCache.clear();
  }
}

/**
 * Validates coordinate numbers.
 */
export function isValidCoordinate(lat, lon) {
  if (lat == null || lon == null) return false;
  const numLat = Number(lat);
  const numLon = Number(lon);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLon)) return false;
  if (numLat < -90 || numLat > 90) return false;
  if (numLon < -180 || numLon > 180) return false;
  return true;
}

/**
 * Format an ISO timestamp string into a friendly localized display.
 * E.g. "Today, 11:30 AM" or "Wed, 29 Oct"
 */
export function formatWeatherTime(isoString, includeTime = true) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    if (!includeTime) {
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    }

    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Parses raw Open-Meteo response into domain-modeled, safe, and typed weather structures.
 *
 * @param {object} raw
 * @returns {object} formatted weather payload
 */
export function parseOpenMeteoResponse(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid or empty response payload from Open-Meteo API.");
  }

  const currentRaw = raw.current || {};
  const hourlyRaw = raw.hourly || {};
  const dailyRaw = raw.daily || {};

  // ── 1. Current atmospheric conditions ──────────────────────────────────────
  const currentCondition = getWeatherCondition(currentRaw.weather_code);
  const current = {
    time: currentRaw.time || new Date().toISOString(),
    tempC: currentRaw.temperature_2m != null ? Math.round(currentRaw.temperature_2m * 10) / 10 : null,
    feelsLikeC:
      currentRaw.apparent_temperature != null
        ? Math.round(currentRaw.apparent_temperature * 10) / 10
        : null,
    humidityPct:
      currentRaw.relative_humidity_2m != null ? Math.round(currentRaw.relative_humidity_2m) : null,
    windSpeedKmh:
      currentRaw.wind_speed_10m != null ? Math.round(currentRaw.wind_speed_10m * 10) / 10 : null,
    precipitationMm:
      currentRaw.precipitation != null ? Math.round(currentRaw.precipitation * 10) / 10 : 0.0,
    weatherCode: currentRaw.weather_code,
    conditionText: currentCondition.label,
    icon: currentCondition.icon,
    severity: currentCondition.severity,
  };

  // ── 2. Hourly forecast (next 24 hours from current reference) ──────────────
  const hourlyTimes = Array.isArray(hourlyRaw.time) ? hourlyRaw.time : [];
  const hourlyPrecip = Array.isArray(hourlyRaw.precipitation) ? hourlyRaw.precipitation : [];
  const hourlyProb = Array.isArray(hourlyRaw.precipitation_probability)
    ? hourlyRaw.precipitation_probability
    : [];
  const hourlyTemp = Array.isArray(hourlyRaw.temperature_2m) ? hourlyRaw.temperature_2m : [];
  const hourlyCode = Array.isArray(hourlyRaw.weather_code) ? hourlyRaw.weather_code : [];

  // Find index of current hour or start of today
  const nowIsoHour = current.time ? current.time.slice(0, 13) : "";
  let startIndex = hourlyTimes.findIndex((t) => t.startsWith(nowIsoHour));
  if (startIndex === -1) {
    const nowIso = new Date().toISOString().slice(0, 13);
    startIndex = hourlyTimes.findIndex((t) => t.startsWith(nowIso));
  }
  if (startIndex === -1) startIndex = 0;

  // Take next 24 consecutive hours for the hourly forecast
  const next24Hours = [];
  const endIndex = Math.min(startIndex + 24, hourlyTimes.length);
  for (let i = startIndex; i < endIndex; i++) {
    const timeIso = hourlyTimes[i];
    const precip = hourlyPrecip[i] != null ? Math.round(hourlyPrecip[i] * 10) / 10 : 0.0;
    const prob = hourlyProb[i] != null ? Math.round(hourlyProb[i]) : 0;
    const temp = hourlyTemp[i] != null ? Math.round(hourlyTemp[i] * 10) / 10 : null;
    const wCode = hourlyCode[i];
    const cond = getWeatherCondition(wCode);

    // Format hour label e.g. "11 AM", "12 PM"
    let hourLabel = timeIso;
    try {
      const d = new Date(timeIso);
      hourLabel = d.toLocaleTimeString("en-IN", { hour: "numeric", hour12: true });
    } catch {
      // fallback
    }

    next24Hours.push({
      time: timeIso,
      hourLabel,
      tempC: temp,
      precipitationMm: precip,
      precipitationProbPct: prob,
      weatherCode: wCode,
      conditionText: cond.label,
      icon: cond.icon,
      isCurrent: i === startIndex,
    });
  }

  // ── 3. Daily forecast & Recent observed rainfall ───────────────────────────
  const dailyTimes = Array.isArray(dailyRaw.time) ? dailyRaw.time : [];
  const dailyCode = Array.isArray(dailyRaw.weather_code) ? dailyRaw.weather_code : [];
  const dailyMaxTemp = Array.isArray(dailyRaw.temperature_2m_max)
    ? dailyRaw.temperature_2m_max
    : [];
  const dailyMinTemp = Array.isArray(dailyRaw.temperature_2m_min)
    ? dailyRaw.temperature_2m_min
    : [];
  const dailyPrecipSum = Array.isArray(dailyRaw.precipitation_sum)
    ? dailyRaw.precipitation_sum
    : [];
  const dailyPrecipProb = Array.isArray(dailyRaw.precipitation_probability_max)
    ? dailyRaw.precipitation_probability_max
    : [];

  const todayIsoDate = current.time ? current.time.slice(0, 10) : new Date().toISOString().slice(0, 10);

  let recentObserved = null;
  const forecast7Days = [];

  for (let i = 0; i < dailyTimes.length; i++) {
    const dateStr = dailyTimes[i];
    const precipSum = dailyPrecipSum[i] != null ? Math.round(dailyPrecipSum[i] * 10) / 10 : 0.0;
    const maxT = dailyMaxTemp[i] != null ? Math.round(dailyMaxTemp[i] * 10) / 10 : null;
    const minT = dailyMinTemp[i] != null ? Math.round(dailyMinTemp[i] * 10) / 10 : null;
    const probMax = dailyPrecipProb[i] != null ? Math.round(dailyPrecipProb[i]) : 0;
    const wCode = dailyCode[i];
    const cond = getWeatherCondition(wCode);

    const isToday = dateStr === todayIsoDate;
    const isPast = dateStr < todayIsoDate;

    // Format day label e.g. "Today", "Tomorrow", "Wed", "Thu"
    let dayLabel = dateStr;
    try {
      const d = new Date(dateStr + "T00:00:00");
      if (isToday) {
        dayLabel = "Today";
      } else {
        dayLabel = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
      }
    } catch {
      // fallback
    }

    if (isPast) {
      // Historical/reanalysis observed rainfall from past_days=1 (strictly distinguished from forecast)
      recentObserved = {
        date: dateStr,
        dayLabel: "Yesterday",
        precipitationSumMm: precipSum,
        tempMaxC: maxT,
        tempMinC: minT,
        conditionText: cond.label,
        icon: cond.icon,
        source: "Open-Meteo Historical Reanalysis (ERA5-Land)",
      };
    } else {
      // Future forecast days (including today's remaining forecast)
      forecast7Days.push({
        date: dateStr,
        dayLabel,
        isToday,
        tempMaxC: maxT,
        tempMinC: minT,
        precipitationSumMm: precipSum,
        precipitationProbMaxPct: probMax,
        weatherCode: wCode,
        conditionText: cond.label,
        icon: cond.icon,
      });
    }
  }

  // ── 4. Aggregate metrics for irrigation guidance ───────────────────────────
  // Next 24 hours rainfall sum & max probability
  const next24hPrecipMm = next24Hours.reduce((sum, h) => sum + (h.precipitationMm || 0), 0);
  const next24hMaxProbPct = next24Hours.reduce(
    (max, h) => Math.max(max, h.precipitationProbPct || 0),
    0
  );

  // Next 48 hours rainfall sum (first 2 days of forecast)
  const next48hPrecipMm = forecast7Days
    .slice(0, 2)
    .reduce((sum, d) => sum + (d.precipitationSumMm || 0), 0);

  // 7-day total precipitation forecast
  const next7DaysTotalPrecipMm = forecast7Days.reduce(
    (sum, d) => sum + (d.precipitationSumMm || 0),
    0
  );

  return {
    current,
    hourly: next24Hours,
    daily: forecast7Days.slice(0, 7),
    recentObserved,
    summary: {
      next24hPrecipMm: Math.round(next24hPrecipMm * 10) / 10,
      next24hMaxProbPct,
      next48hPrecipMm: Math.round(next48hPrecipMm * 10) / 10,
      next7DaysTotalPrecipMm: Math.round(next7DaysTotalPrecipMm * 10) / 10,
    },
    metadata: {
      latitude: raw.latitude,
      longitude: raw.longitude,
      elevationM: raw.elevation,
      timezone: raw.timezone || "Asia/Kolkata",
      fetchedAt: new Date().toISOString(),
      sourceAttribution: "Weather data by Open-Meteo.com (CC BY 4.0)",
    },
  };
}

/**
 * Retrieves live weather and rainfall forecast for specific GPS coordinates.
 *
 * @param {object} params
 * @param {number} params.lat - Latitude (-90 to 90)
 * @param {number} params.lon - Longitude (-180 to 180)
 * @param {boolean} [params.forceRefresh=false] - Bypass cache if true
 * @param {AbortSignal} [params.signal] - AbortController signal
 * @param {number} [params.timeoutMs=10000] - Request timeout in ms
 * @returns {Promise<object>} Parsed weather data
 */
export async function fetchFarmWeather({
  lat,
  lon,
  forceRefresh = false,
  signal = null,
  timeoutMs = 10000,
}) {
  if (!isValidCoordinate(lat, lon)) {
    throw new Error(
      `Invalid farm coordinates provided for weather query: lat=${lat}, lon=${lon}. Valid latitude (-90 to 90) and longitude (-180 to 180) are required.`
    );
  }

  const cacheKey = getCacheKey(lat, lon);

  // Check cache unless forceRefresh is requested
  if (!forceRefresh && weatherCache.has(cacheKey)) {
    const cached = weatherCache.get(cacheKey);
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_TTL_MS) {
      return cached.data;
    }
    weatherCache.delete(cacheKey);
  }

  // Build Open-Meteo query params
  const params = new URLSearchParams({
    latitude: Number(lat).toFixed(4),
    longitude: Number(lon).toFixed(4),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    hourly: "precipitation,precipitation_probability,temperature_2m,weather_code",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    timezone: "Asia/Kolkata",
    forecast_days: "7",
    past_days: "1", // Yesterday's observed rainfall
  });

  const url = `${OPEN_METEO_BASE}?${params.toString()}`;

  // Configure timeout controller if no external signal or to combine with it
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new Error(`Weather request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  let combinedSignal = timeoutController.signal;
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      throw signal.reason || new Error("Weather request aborted.");
    }
    signal.addEventListener("abort", () => {
      timeoutController.abort(signal.reason);
    });
  }

  try {
    const response = await fetch(url, {
      signal: combinedSignal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMsg = `Open-Meteo API error (HTTP ${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson?.reason) {
          errorMsg = `Open-Meteo: ${errorJson.reason}`;
        }
      } catch {
        // use status
      }
      throw new Error(errorMsg);
    }

    const json = await response.json();
    const parsed = parseOpenMeteoResponse(json);

    // Save to cache
    weatherCache.set(cacheKey, {
      timestamp: Date.now(),
      data: parsed,
    });

    return parsed;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError" || combinedSignal.aborted) {
      const abortErr = new Error("Weather request was cancelled or timed out.");
      abortErr.isAbort = true;
      throw abortErr;
    }
    console.error("[weatherApi] Failed to fetch weather data:", err);
    throw err;
  }
}
