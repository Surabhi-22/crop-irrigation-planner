/**
 * Quantum Agri — Hyper-Local Weather & Rainfall Intelligence Panel
 *
 * Provides real-time weather and rainfall intelligence for the farmer's confirmed
 * field coordinates.
 *
 * Implements:
 * 1. Live Weather: Current temp, feels-like, humidity, condition, wind, precipitation.
 * 2. Rainfall Intelligence: 24h hourly forecast, 7-day daily forecast, and
 *    yesterday's observed rainfall (strictly distinguished from forecast).
 * 3. Weather-Based Irrigation Insights: Actionable agronomic advisory contextualized
 *    by farm soil type and rainfall probability.
 * 4. Stale-Response Protection: Uses sequence counters & AbortController to prevent
 *    race conditions when the farmer pins new locations.
 * 5. Manual Refresh: Fast cache-bypass refresh action.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchFarmWeather,
  formatCoordinates,
  clearWeatherCache,
} from "../services/weatherApi";
import { generateIrrigationInsights, ADVISORY_STATUS } from "../services/irrigationInsights";
import RainfallChart from "./RainfallChart";

export default function WeatherPanel({
  farmCoords,
  locationConfirmed,
  locationName = "",
  farmData = null,
}) {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Stale-response tracking ref
  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef(null);

  /**
   * Loads weather for the confirmed coordinates.
   */
  const loadWeather = useCallback(
    (coords, isManualRefresh = false) => {
      if (!coords || coords.lat == null || coords.lon == null) {
        return;
      }

      // Increment sequence counter to identify this specific request
      const seq = ++requestSeqRef.current;

      // Abort previous in-flight request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Defer state updates to microtask to prevent cascading synchronous renders
      Promise.resolve().then(() => {
        if (seq !== requestSeqRef.current) return;

        if (isManualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        fetchFarmWeather({
          lat: coords.lat,
          lon: coords.lon,
          forceRefresh: isManualRefresh,
          signal: abortControllerRef.current.signal,
          timeoutMs: 12000,
        })
          .then((data) => {
            if (seq === requestSeqRef.current) {
              setWeatherData(data);
              setError(null);
              setLastUpdated(new Date());
            }
          })
          .catch((err) => {
            if (seq === requestSeqRef.current) {
              if (!err.isAbort) {
                setError(err.message || "Failed to retrieve hyper-local weather forecast.");
              }
            }
          })
          .finally(() => {
            if (seq === requestSeqRef.current) {
              setLoading(false);
              setRefreshing(false);
            }
          });
      });
    },
    []
  );

  // Trigger weather fetch when coordinates are confirmed or changed
  useEffect(() => {
    if (locationConfirmed && farmCoords && farmCoords.lat != null && farmCoords.lon != null) {
      loadWeather(farmCoords, false);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [locationConfirmed, farmCoords, loadWeather]);

  function handleManualRefresh() {
    if (farmCoords && locationConfirmed) {
      clearWeatherCache(farmCoords.lat, farmCoords.lon);
      loadWeather(farmCoords, true);
    }
  }

  // Derive irrigation insights
  const irrigationInsights = weatherData
    ? generateIrrigationInsights(weatherData, farmData)
    : null;

  // ── Render Case 1: Location not yet confirmed ─────────────────────────────
  if (!locationConfirmed || !farmCoords) {
    return (
      <section className="weather-intelligence-section" aria-label="Weather Intelligence">
        <div className="weather-section-header">
          <div className="weather-header-title">
            <span className="material-symbols-outlined weather-header-icon">partly_cloudy_day</span>
            <div>
              <h3>Automated Weather &amp; Rainfall Intelligence</h3>
              <p>Hyper-local micro-climate observations and 7-day precipitation forecasts.</p>
            </div>
          </div>
          <span className="weather-badge-status pending">Location Required</span>
        </div>

        <div className="weather-empty-card">
          <div className="weather-empty-icon-wrap">
            <span className="material-symbols-outlined">pin_drop</span>
          </div>
          <div className="weather-empty-content">
            <h4>No Farm Location Confirmed Yet</h4>
            <p>
              Pin your field on the <strong>Karnataka AgriMap</strong> above or use <em>"Use My Current Location"</em>, then click <strong>"Confirm Farm Location"</strong> to load real-time micro-climate weather and rainfall intelligence.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="weather-intelligence-section" aria-label="Weather Intelligence">
      {/* ── Section Header & Controls ──────────────────────────────────────── */}
      <div className="weather-section-header">
        <div className="weather-header-title">
          <span className="material-symbols-outlined weather-header-icon">partly_cloudy_day</span>
          <div>
            <div className="weather-title-row">
              <h3>Automated Weather &amp; Rainfall Intelligence</h3>
              <span className="weather-live-tag">
                <span className="weather-live-dot" aria-hidden="true"></span>
                Real-Time Forecast
              </span>
            </div>
            <p className="weather-header-sub">
              Sourced for confirmed field coordinates:{" "}
              <strong>{formatCoordinates(farmCoords.lat, farmCoords.lon, 4)}</strong>
              {locationName ? ` (${locationName})` : ""}
            </p>
          </div>
        </div>

        <div className="weather-header-actions">
          {lastUpdated && (
            <span className="weather-updated-pill" title="Time when weather forecast was last retrieved">
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>schedule</span>
              Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
            </span>
          )}

          <button
            type="button"
            className={`weather-refresh-btn ${refreshing ? "loading" : ""}`}
            onClick={handleManualRefresh}
            disabled={loading || refreshing}
            title="Fetch latest forecast from Open-Meteo"
            aria-label="Refresh weather data"
          >
            <span className={`material-symbols-outlined ${refreshing ? "spin-icon" : ""}`}>
              sync
            </span>
            <span>{refreshing ? "Updating…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* ── Loading Skeleton / State ────────────────────────────────────────── */}
      {loading && !weatherData && (
        <div className="weather-loading-card" aria-busy="true">
          <span className="material-symbols-outlined spin-icon weather-loading-spinner">
            progress_activity
          </span>
          <p className="weather-loading-title">Retrieving hyper-local weather &amp; rainfall forecast…</p>
          <span className="weather-loading-sub">Connecting to Open-Meteo numerical weather prediction API</span>
        </div>
      )}

      {/* ── Error Banner & Retry Action ─────────────────────────────────────── */}
      {error && (
        <div className="weather-alert-card error" role="alert">
          <span className="material-symbols-outlined alert-icon">cloud_off</span>
          <div className="alert-body">
            <strong>Unable to Load Weather Forecast</strong>
            <p>{error}</p>
            <button
              type="button"
              className="weather-retry-btn"
              onClick={() => loadWeather(farmCoords, true)}
            >
              <span className="material-symbols-outlined">refresh</span>
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* ── Loaded Weather Content ──────────────────────────────────────────── */}
      {weatherData && (
        <div className="weather-dashboard-body">
          {/* ── FEATURE 1: Current Weather Summary ─────────────────────────── */}
          <div className="weather-current-grid">
            {/* Primary Current Conditions Card */}
            <div className="weather-current-card">
              <div className="current-card-top">
                <span className="current-card-eyebrow">CURRENT OBSERVATIONS</span>
                <span className="current-card-time font-tabular">
                  {new Date(weatherData.current.time).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>

              <div className="current-temp-hero">
                <span className="material-symbols-outlined current-weather-icon" aria-hidden="true">
                  {weatherData.current.icon}
                </span>
                <div className="temp-hero-text">
                  <div className="temp-hero-number font-tabular">
                    {weatherData.current.tempC != null ? `${weatherData.current.tempC}°` : "—"}
                    <span className="temp-unit">C</span>
                  </div>
                  <div className="temp-hero-condition">
                    {weatherData.current.conditionText}
                  </div>
                </div>
              </div>

              <div className="current-apparent-row">
                <span>Feels like:</span>
                <strong className="font-tabular">
                  {weatherData.current.feelsLikeC != null
                    ? `${weatherData.current.feelsLikeC}°C`
                    : "—"}
                </strong>
                <span className="apparent-divider">•</span>
                <span>Current Precip:</span>
                <strong className="font-tabular">
                  {weatherData.current.precipitationMm != null
                    ? `${weatherData.current.precipitationMm.toFixed(1)} mm`
                    : "0.0 mm"}
                </strong>
              </div>
            </div>

            {/* Micro-climate Metrics Tiles */}
            <div className="weather-metrics-panel">
              {/* Relative Humidity */}
              <div className="weather-metric-tile">
                <div className="metric-tile-header">
                  <span className="material-symbols-outlined metric-icon">humidity_mid</span>
                  <span className="metric-name">Relative Humidity</span>
                </div>
                <div className="metric-tile-val font-tabular">
                  {weatherData.current.humidityPct != null ? `${weatherData.current.humidityPct}%` : "—"}
                </div>
                <span className="metric-tile-sub">
                  {weatherData.current.humidityPct >= 70
                    ? "High moisture"
                    : weatherData.current.humidityPct <= 35
                    ? "Dry atmospheric air"
                    : "Moderate humidity"}
                </span>
              </div>

              {/* Wind Speed */}
              <div className="weather-metric-tile">
                <div className="metric-tile-header">
                  <span className="material-symbols-outlined metric-icon">air</span>
                  <span className="metric-name">Wind Speed</span>
                </div>
                <div className="metric-tile-val font-tabular">
                  {weatherData.current.windSpeedKmh != null
                    ? `${weatherData.current.windSpeedKmh} km/h`
                    : "—"}
                </div>
                <span className="metric-tile-sub">
                  {weatherData.current.windSpeedKmh > 25
                    ? "Breezy (spraying caution)"
                    : "Favorable for spraying"}
                </span>
              </div>

              {/* Next 24h Rain Expected */}
              <div className="weather-metric-tile highlight">
                <div className="metric-tile-header">
                  <span className="material-symbols-outlined metric-icon">water_drop</span>
                  <span className="metric-name">Next 24h Rainfall</span>
                </div>
                <div className="metric-tile-val font-tabular">
                  {weatherData.summary.next24hPrecipMm.toFixed(1)} mm
                </div>
                <span className="metric-tile-sub">
                  Max probability: <strong>{weatherData.summary.next24hMaxProbPct}%</strong>
                </span>
              </div>

              {/* 7-Day Cumulative Rain */}
              <div className="weather-metric-tile">
                <div className="metric-tile-header">
                  <span className="material-symbols-outlined metric-icon">calendar_month</span>
                  <span className="metric-name">7-Day Rain Total</span>
                </div>
                <div className="metric-tile-val font-tabular">
                  {weatherData.summary.next7DaysTotalPrecipMm.toFixed(1)} mm
                </div>
                <span className="metric-tile-sub">Cumulative forecast volume</span>
              </div>
            </div>
          </div>

          {/* ── FEATURE 4: Weather-Based Irrigation Insights ───────────────── */}
          {irrigationInsights && (
            <div className={`irrigation-insight-card insight-${irrigationInsights.badgeClass}`}>
              <div className="insight-card-header">
                <div className="insight-badge-row">
                  <span className="material-symbols-outlined insight-header-icon">
                    {irrigationInsights.status === ADVISORY_STATUS.DRAINAGE_ALERT
                      ? "warning"
                      : irrigationInsights.status === ADVISORY_STATUS.HOLD
                      ? "pause_circle"
                      : irrigationInsights.status === ADVISORY_STATUS.MONITOR
                      ? "visibility"
                      : "check_circle"}
                  </span>
                  <span className="insight-section-title">Weather-Based Irrigation Insights</span>
                </div>

                <span className={`advisory-status-badge badge-${irrigationInsights.badgeClass}`}>
                  {irrigationInsights.badgeText}
                </span>
              </div>

              <div className="insight-card-body">
                <h4 className="insight-headline">{irrigationInsights.headline}</h4>
                <p className="insight-summary">{irrigationInsights.summary}</p>

                <div className="insight-action-box">
                  <span className="material-symbols-outlined action-icon">lightbulb</span>
                  <div className="action-text">
                    <strong>Recommended Irrigation Action:</strong>
                    <span>{irrigationInsights.actionItem}</span>
                  </div>
                </div>

                {/* Soil-specific nuance note */}
                {irrigationInsights.soilNote && (
                  <div className="insight-soil-note">
                    <span className="material-symbols-outlined soil-icon">landscape</span>
                    <p>{irrigationInsights.soilNote}</p>
                  </div>
                )}

                {/* Transparent Agronomic Disclaimer */}
                <p className="insight-disclaimer">
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>info</span>
                  <span>{irrigationInsights.disclaimer}</span>
                </p>
              </div>
            </div>
          )}

          {/* ── FEATURE 2: Rainfall Forecast Intelligence & Chart ──────────── */}
          <div className="weather-rainfall-section">
            {/* Visual SVG Chart: Hourly & Daily toggles */}
            <RainfallChart
              hourlyData={weatherData.hourly}
              dailyData={weatherData.daily}
            />

            {/* 7-Day Forecast Grid */}
            <div className="daily-forecast-container">
              <div className="daily-forecast-header">
                <span className="material-symbols-outlined">date_range</span>
                <h5>7-Day Weather &amp; Precipitation Forecast</h5>
              </div>

              <div className="daily-forecast-cards-grid">
                {weatherData.daily.map((day) => (
                  <div
                    key={day.date}
                    className={`daily-forecast-card ${day.isToday ? "is-today" : ""}`}
                  >
                    <span className="daily-card-day">{day.dayLabel}</span>
                    <span className="material-symbols-outlined daily-card-icon" aria-hidden="true">
                      {day.icon}
                    </span>
                    <span className="daily-card-condition" title={day.conditionText}>
                      {day.conditionText}
                    </span>

                    <div className="daily-card-temps font-tabular">
                      <span className="temp-max" title="Maximum daily temperature">
                        {day.tempMaxC != null ? `${day.tempMaxC}°` : "—"}
                      </span>
                      <span className="temp-divider">/</span>
                      <span className="temp-min" title="Minimum daily temperature">
                        {day.tempMinC != null ? `${day.tempMinC}°` : "—"}
                      </span>
                    </div>

                    {/* Expected rainfall mm */}
                    <div className="daily-card-rain font-tabular">
                      <span className="material-symbols-outlined rain-icon">water_drop</span>
                      <strong>{day.precipitationSumMm.toFixed(1)} mm</strong>
                    </div>

                    {/* Rain probability pill */}
                    {day.precipitationProbMaxPct > 0 && (
                      <span
                        className={`daily-prob-pill ${
                          day.precipitationProbMaxPct >= 50 ? "high" : "low"
                        }`}
                      >
                        {day.precipitationProbMaxPct}% rain
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Observed Rainfall (strictly distinguished from forecast) */}
            {weatherData.recentObserved && (
              <div className="recent-observed-card">
                <div className="observed-header">
                  <div className="observed-title-group">
                    <span className="material-symbols-outlined observed-icon">history</span>
                    <div>
                      <span className="observed-label">RECENT OBSERVED RAINFALL (PAST 24 HOURS)</span>
                      <h6>Yesterday's Measured Rainfall: {weatherData.recentObserved.precipitationSumMm.toFixed(1)} mm</h6>
                    </div>
                  </div>
                  <span className="observed-source-badge">Observed Reanalysis</span>
                </div>
                <p className="observed-text">
                  Yesterday's atmospheric reanalysis recorded{" "}
                  <strong>{weatherData.recentObserved.precipitationSumMm.toFixed(1)} mm</strong> of total precipitation at these coordinates with temperatures between{" "}
                  <strong>{weatherData.recentObserved.tempMinC}°C</strong> and{" "}
                  <strong>{weatherData.recentObserved.tempMaxC}°C</strong>.
                  <br />
                  <span className="observed-clarification">
                    Notice: This represents past measured/reanalysis precipitation from {weatherData.recentObserved.source}, distinguished from future forecast predictions.
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* ── Data Source Attribution & Reference Notice ─────────────────── */}
          <div className="weather-footer-attribution">
            <span className="material-symbols-outlined attribution-icon">verified</span>
            <p>
              Weather and rainfall forecasts are powered by{" "}
              <a
                href="https://open-meteo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="attribution-link"
              >
                Open-Meteo.com
              </a>{" "}
              (CC BY 4.0 license). Atmospheric models are updated every 1–3 hours. District-level annual rainfall normal values shown in the separate reference card above represent 30-year IMD climate averages, whereas this panel provides real-time point-specific forecasts for your exact farm field.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
