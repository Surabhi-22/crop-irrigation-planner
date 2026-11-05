/**
 * Quantum Agri — Rainfall Forecast Chart Component
 *
 * Lightweight, zero-dependency SVG chart for visualizing:
 * 1. 24-Hour Hourly Precipitation (mm) & Probability (%) timeline.
 * 2. 7-Day Daily Expected Rainfall totals (mm) & Temperature range.
 *
 * Features:
 * - Dynamic view toggle between "Next 24 Hours" and "7-Day Outlook".
 * - Visual bar heights scaled with rainfall volume (mm).
 * - Color intensity scaling with rain intensity (light green -> deep emerald).
 * - Precipitation probability pills (%).
 * - Accessible SVG with ARIA labels and tabular fallback for screen readers.
 */

import { useState } from "react";

export default function RainfallChart({ hourlyData = [], dailyData = [] }) {
  const [viewMode, setViewMode] = useState("24h"); // "24h" | "7d"
  const [activeHoverItem, setActiveHoverItem] = useState(null);

  const isHourly = viewMode === "24h";
  const items = isHourly ? hourlyData.slice(0, 24) : dailyData.slice(0, 7);

  // Calculate dynamic maximum precipitation scale (minimum 5mm scale for readability)
  const maxRainMm = items.reduce((max, item) => {
    const val = isHourly ? item.precipitationMm : item.precipitationSumMm;
    return Math.max(max, val || 0);
  }, 0);

  const chartCeilingMm = Math.max(Math.ceil(maxRainMm * 1.25), 5);

  // SVG Chart Dimensions
  const svgWidth = 720;
  const svgHeight = 200;
  const paddingLeft = 44;
  const paddingRight = 16;
  const paddingTop = 32;
  const paddingBottom = 48;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const colWidth = items.length > 0 ? plotWidth / items.length : plotWidth;
  const barWidth = Math.max(Math.min(colWidth * 0.55, 32), 12);

  // Helper to map rainfall mm to Y coordinate
  function getY(mm) {
    const clamped = Math.min(Math.max(mm || 0, 0), chartCeilingMm);
    return paddingTop + plotHeight - (clamped / chartCeilingMm) * plotHeight;
  }

  // Grid tick lines
  const tickSteps = [0, Math.round(chartCeilingMm / 2), chartCeilingMm];

  return (
    <div className="rainfall-chart-card">
      <div className="rainfall-chart-header">
        <div className="rainfall-chart-title-group">
          <span className="material-symbols-outlined chart-header-icon">water_drop</span>
          <div>
            <h4 className="rainfall-chart-heading">
              {isHourly ? "Next 24 Hours Rain Forecast" : "7-Day Rainfall Outlook"}
            </h4>
            <p className="rainfall-chart-sub">
              {isHourly
                ? "Hourly expected rainfall volume (mm) and rain probability (%)"
                : "Daily cumulative precipitation (mm) and temperature extremes"}
            </p>
          </div>
        </div>

        {/* View Toggle Buttons */}
        <div className="chart-view-toggle" role="group" aria-label="Forecast timeframe">
          <button
            type="button"
            className={`chart-toggle-btn ${isHourly ? "active" : ""}`}
            onClick={() => {
              setViewMode("24h");
              setActiveHoverItem(null);
            }}
            aria-pressed={isHourly}
          >
            24 Hours (Hourly)
          </button>
          <button
            type="button"
            className={`chart-toggle-btn ${!isHourly ? "active" : ""}`}
            onClick={() => {
              setViewMode("7d");
              setActiveHoverItem(null);
            }}
            aria-pressed={!isHourly}
          >
            7 Days (Daily)
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="rainfall-chart-svg-container">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="rainfall-chart-svg"
          role="img"
          aria-label={
            isHourly
              ? "Hourly rainfall forecast chart for the next 24 hours"
              : "7-day daily rainfall forecast chart"
          }
        >
          {/* Background Grid Lines & Y-Axis Labels */}
          {tickSteps.map((tick) => {
            const y = getY(tick);
            return (
              <g key={`tick-${tick}`} className="chart-grid-line-group">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  className="chart-grid-line"
                  stroke="#e3e8e0"
                  strokeDasharray={tick === 0 ? "none" : "3,3"}
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="chart-axis-label font-tabular"
                  fill="#70796f"
                  fontSize="10"
                >
                  {tick} mm
                </text>
              </g>
            );
          })}

          {/* Render Bars for Each Column */}
          {items.map((item, index) => {
            const xCenter = paddingLeft + index * colWidth + colWidth / 2;
            const xBar = xCenter - barWidth / 2;

            const rainMm = isHourly ? item.precipitationMm : item.precipitationSumMm;
            const probPct = isHourly ? item.precipitationProbPct : item.precipitationProbMaxPct;
            const tempVal = isHourly ? item.tempC : null;

            const barY = getY(rainMm);
            const barHeight = Math.max(paddingTop + plotHeight - barY, rainMm > 0 ? 3 : 0);

            // Shading intensity: 0mm = subtle, >0 to 5 = medium green, >5 = deep emerald
            let barColor = "#e8f0e7";
            if (rainMm > 15) barColor = "#193c2d"; // very heavy
            else if (rainMm > 5) barColor = "#245c43"; // moderate
            else if (rainMm > 0) barColor = "#468162"; // light
            else if (probPct >= 40) barColor = "#c8ded0"; // potential light rain

            const isHovered = activeHoverItem === item;

            return (
              <g
                key={`col-${index}`}
                className="chart-column-group"
                onMouseEnter={() => setActiveHoverItem(item)}
                onMouseLeave={() => setActiveHoverItem(null)}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${isHourly ? item.hourLabel : item.dayLabel}: ${rainMm.toFixed(1)} mm, ${probPct}% probability`}
              >
                {/* Invisible hover target rectangle for generous hit area */}
                <rect
                  x={paddingLeft + index * colWidth}
                  y={paddingTop}
                  width={colWidth}
                  height={plotHeight + 35}
                  fill="transparent"
                  className="chart-hover-target"
                />

                {/* Rain Bar */}
                {rainMm > 0 ? (
                  <rect
                    x={xBar}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    rx="3"
                    ry="3"
                    fill={barColor}
                    className={`chart-bar ${isHovered ? "is-hovered" : ""}`}
                  />
                ) : (
                  // Zero rain indicator: small base pill if rain is zero
                  <circle
                    cx={xCenter}
                    cy={paddingTop + plotHeight - 2}
                    r="2.5"
                    fill={probPct >= 30 ? "#b7d1c2" : "#e3e8e0"}
                    className="chart-zero-dot"
                  />
                )}

                {/* Rain amount text above bar (if > 0 or hovered) */}
                {rainMm > 0 && (
                  <text
                    x={xCenter}
                    y={Math.max(barY - 6, 14)}
                    textAnchor="middle"
                    className="chart-bar-value font-tabular"
                    fill="#245c43"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {rainMm.toFixed(1)}
                  </text>
                )}

                {/* Temperature label above bar in 24h mode */}
                {isHourly && tempVal != null && (
                  <text
                    x={xCenter}
                    y={rainMm > 0 ? Math.max(barY - 18, 12) : paddingTop + plotHeight - 12}
                    textAnchor="middle"
                    className="chart-temp-label font-tabular"
                    fill="#70796f"
                    fontSize="9"
                  >
                    {Math.round(tempVal)}°
                  </text>
                )}

                {/* Time or Day Label on X-Axis */}
                <text
                  x={xCenter}
                  y={svgHeight - paddingBottom + 16}
                  textAnchor="middle"
                  className="chart-time-label"
                  fill="#202820"
                  fontSize="10"
                  fontWeight={item.isToday || item.isCurrent ? "700" : "500"}
                >
                  {isHourly ? item.hourLabel : item.dayLabel}
                </text>

                {/* Precipitation Probability Label below X-Axis */}
                {probPct > 0 && (
                  <text
                    x={xCenter}
                    y={svgHeight - paddingBottom + 30}
                    textAnchor="middle"
                    className="chart-prob-label font-tabular"
                    fill={probPct >= 50 ? "#245c43" : "#70796f"}
                    fontSize="9"
                    fontWeight={probPct >= 50 ? "700" : "500"}
                  >
                    {probPct}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Tooltip Card on Hover */}
      {activeHoverItem && (
        <div className="chart-tooltip-panel" role="status">
          <div className="chart-tooltip-col">
            <span className="tooltip-label">
              {isHourly ? `Hour: ${activeHoverItem.hourLabel}` : `Date: ${activeHoverItem.dayLabel}`}
            </span>
            <strong className="tooltip-val">{activeHoverItem.conditionText}</strong>
          </div>

          <div className="chart-tooltip-col">
            <span className="tooltip-label">Expected Rain</span>
            <strong className="tooltip-val font-tabular">
              {(isHourly
                ? activeHoverItem.precipitationMm
                : activeHoverItem.precipitationSumMm
              ).toFixed(1)}{" "}
              mm
            </strong>
          </div>

          <div className="chart-tooltip-col">
            <span className="tooltip-label">Rain Probability</span>
            <strong className="tooltip-val font-tabular">
              {isHourly
                ? activeHoverItem.precipitationProbPct
                : activeHoverItem.precipitationProbMaxPct}
              %
            </strong>
          </div>

          <div className="chart-tooltip-col">
            <span className="tooltip-label">Temperature</span>
            <strong className="tooltip-val font-tabular">
              {isHourly
                ? `${activeHoverItem.tempC}°C`
                : `${activeHoverItem.tempMinC}°C to ${activeHoverItem.tempMaxC}°C`}
            </strong>
          </div>
        </div>
      )}

      {/* Chart Legend Footer */}
      <div className="chart-legend-row">
        <div className="chart-legend-item">
          <span className="legend-swatch bar-rain"></span>
          <span>Forecast Rainfall (mm)</span>
        </div>
        <div className="chart-legend-item">
          <span className="legend-swatch bar-prob"></span>
          <span>Rain Probability (%)</span>
        </div>
        <div className="chart-legend-item">
          <span className="legend-swatch dot-zero"></span>
          <span>No Measurable Rain (Dry)</span>
        </div>
      </div>
    </div>
  );
}

