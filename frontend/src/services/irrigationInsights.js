/**
 * Quantum Agri — Weather-Based Irrigation Insights Engine
 *
 * Translates hyper-local weather and rainfall forecasts into actionable agronomic
 * irrigation guidance, contextualized by the farm's soil type and location.
 *
 * Core Principles:
 * 1. Grounded in Forecast Data: Considers 24h/48h expected rain (mm) and probability (%).
 * 2. Prudent Agronomic Advisory: Never tells farmers to blindly skip irrigation based
 *    only on cloud forecasts. Explains risks of over-watering vs water stress.
 * 3. Soil Contextualization: Tailors drainage and retention notes based on the
 *    farm's specific soil type (Loamy, Clay, Sandy, Silty).
 * 4. Transparent Disclaimers: Clearly notes that actual decisions require in-field
 *    inspection of root-zone soil moisture and crop growth stage.
 */

export const ADVISORY_STATUS = {
  HOLD: "HOLD",
  MONITOR: "MONITOR",
  PROCEED: "PROCEED",
  DRAINAGE_ALERT: "DRAINAGE_ALERT",
};

/**
 * Generates structured irrigation insights based on weather data and farm parameters.
 *
 * @param {object} weatherData - Parsed weather data from weatherApi.js
 * @param {object} [farmData] - Active farm parameters (soilType, areaAcres, etc.)
 * @returns {object} Irrigation insight model
 */
export function generateIrrigationInsights(weatherData, farmData = null) {
  if (!weatherData || !weatherData.current) {
    return {
      status: ADVISORY_STATUS.PROCEED,
      badgeText: "Awaiting Weather Data",
      badgeClass: "neutral",
      headline: "Weather Data Unavailable",
      summary: "Connect and confirm your farm location to generate weather-based irrigation insights.",
      actionItem: "Select and confirm your farm location on Karnataka AgriMap.",
      soilNote: null,
      rainfallSummary: null,
      metrics: null,
      disclaimer: "Confirm farm location to enable weather-based agronomic insights.",
    };
  }

  const { current, summary } = weatherData;

  const next24hPrecip = summary?.next24hPrecipMm || 0;
  const next24hProb = summary?.next24hMaxProbPct || 0;
  const next48hPrecip = summary?.next48hPrecipMm || 0;
  const next7DaysTotal = summary?.next7DaysTotalPrecipMm || 0;
  const currentPrecip = current.precipitationMm || 0;
  const weatherCode = current.weatherCode || 0;

  const soilType = farmData?.soilType || "Loamy";

  // Check for thunderstorm or extreme heavy rain codes
  const isStorm = [95, 96, 99].includes(weatherCode) || next24hPrecip >= 35;
  const isHeavyRain =
    (next24hPrecip >= 12 && next24hProb >= 50) ||
    (next48hPrecip >= 18 && next24hProb >= 50);
  const isModerateRain = (next24hPrecip >= 5 || next48hPrecip >= 10) && next24hProb >= 40;
  const isCurrentlyRaining = currentPrecip > 0.5 || [61, 63, 65, 80, 81, 82].includes(weatherCode);

  let status;
  let badgeText;
  let badgeClass;
  let headline;
  let actionItem;
  let summaryText;

  if (isStorm) {
    status = ADVISORY_STATUS.DRAINAGE_ALERT;
    badgeText = "Heavy Rain & Drainage Alert";
    badgeClass = "alert";
    headline = "Storm / Heavy Rain Expected — Inspect Field Drainage";
    actionItem = "Suspend all irrigation immediately and ensure field runoff channels are open.";
    summaryText = `High rainfall intensity is forecast (${next24hPrecip.toFixed(1)} mm expected within 24 hours). Avoid running pumps or canal gates to prevent crop root asphyxiation, bed scouring, and soil erosion.`;
  } else if (isCurrentlyRaining || isHeavyRain) {
    status = ADVISORY_STATUS.HOLD;
    badgeText = "Hold / Postpone Irrigation";
    badgeClass = "hold";
    headline = isCurrentlyRaining
      ? "Active Precipitation — Hold Irrigation Cycles"
      : "Significant Rainfall Imminent — Hold Irrigation";
    actionItem = "Pause planned watering cycles and inspect topsoil moisture after the rain event.";
    summaryText = `${next24hPrecip.toFixed(1)} mm of rainfall is predicted over the next 24 hours with a ${next24hProb}% probability. Applying irrigation ahead of substantial rain risks surface runoff, waterlogging, and fertilizer leaching.`;
  } else if (isModerateRain) {
    status = ADVISORY_STATUS.MONITOR;
    badgeText = "Monitor Field Before Watering";
    badgeClass = "monitor";
    headline = "Moderate Rainfall Forecast — Check Root Zone Moisture";
    actionItem = "Check top 10–15 cm of soil moisture before starting pumps or opening canal gates.";
    summaryText = `Scattered rainfall of approximately ${next24hPrecip.toFixed(1)} mm is forecast (up to ${next48hPrecip.toFixed(1)} mm over 48 hours). If crops are not exhibiting water stress, delaying non-urgent irrigation can conserve water without compromising plant health.`;
  } else {
    status = ADVISORY_STATUS.PROCEED;
    badgeText = "Proceed with Planned Schedule";
    badgeClass = "proceed";
    headline = "Dry Conditions Forecast — Maintain Irrigation Schedule";
    actionItem = "Continue scheduled irrigation according to crop growth stage and soil needs.";
    summaryText = `Minimal or no rainfall is forecast over the next 48 hours (less than ${Math.max(next48hPrecip, 1.0).toFixed(1)} mm expected). Maintain regular irrigation cycles to replenish soil moisture depleted by crop evapotranspiration.`;
  }

  // ── Soil-specific nuance ───────────────────────────────────────────────────
  let soilNote;
  switch (soilType) {
    case "Clay":
      soilNote =
        "Clay Soil Consideration: Clay retains moisture exceptionally well but exhibits slow infiltration. If heavy rain occurs on pre-irrigated clay beds, waterlogging can persist for days, suffocating root systems. Prioritize holding irrigation when rain probability exceeds 50%.";
      break;
    case "Sandy":
      soilNote =
        "Sandy Soil Consideration: Sandy soils drain rapidly with minimal moisture-holding capacity. While waterlogging risk is minimal, soluble nitrogen and potassium leach rapidly during downpours. Re-check root-zone moisture 24–48 hours after rain ends.";
      break;
    case "Silty":
      soilNote =
        "Silty Soil Consideration: Silty soil holds moderate moisture but is prone to surface capping/crusting when impacted by heavy rain drops. Ensure proper drainage gradients to avoid surface pooling.";
      break;
    case "Loamy":
    default:
      soilNote =
        "Loamy Soil Consideration: Loamy soil offers optimal water retention and steady drainage. Natural rainfall should infiltrate smoothly; monitor for 1–2 days of post-rain moisture reserve.";
      break;
  }

  return {
    status,
    badgeText,
    badgeClass,
    headline,
    actionItem,
    summary: summaryText,
    soilNote,
    rainfallSummary: {
      next24hMm: next24hPrecip,
      next24hProbPct: next24hProb,
      next48hMm: next48hPrecip,
      next7DaysMm: next7DaysTotal,
      currentPrecipMm: currentPrecip,
    },
    metrics: {
      tempC: current.tempC,
      humidityPct: current.humidityPct,
      windSpeedKmh: current.windSpeedKmh,
      conditionText: current.conditionText,
    },
    disclaimer:
      "Agronomic Weather Advisory: Forecasts are based on atmospheric models (Open-Meteo), not in-ground moisture probes. Field-level visual inspection of soil at 10–15 cm root depth is recommended before altering irrigation pump schedules.",
  };
}
