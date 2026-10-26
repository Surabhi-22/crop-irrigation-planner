import { useState } from "react";

export default function PlanResults({
  plan,
  loading,
  error,
  onRegenerate,
  onEditFarm,
}) {
  const [viewMode, setViewMode] = useState("cards");

  if (loading) {
    return (
      <div className="plan-results-loading panel" role="status" aria-live="polite">
        <div className="loading-spinner-wrap">
          <div className="loading-pulse-ring" />
          <span className="material-symbols-outlined spin-icon">psychology</span>
        </div>
        <h3>Creating Your Farm Plan...</h3>
        <p>
          Calculating crop suitability, water quotas, and profit forecasts based on your farm conditions.
        </p>
      </div>
    );
  }

  if (error) {
    const is422Infeasible =
      error.status === 422 ||
      error.body?.detail?.error === "infeasible_plan" ||
      error.body?.error === "infeasible_plan";

    const infeasibleData = error.body?.detail || error.body || {};
    const suggestions = infeasibleData.suggestions || [];
    const reason = infeasibleData.message || error.message;

    return (
      <div className="plan-results-error panel" role="alert">
        <div className="plan-error-header">
          <div className="error-icon-badge">
            <span className="material-symbols-outlined">
              {is422Infeasible ? "warning" : "error"}
            </span>
          </div>
          <div>
            <span className="eyebrow">
              {is422Infeasible ? "FARM CONDITIONS NOTICE" : "PLANNING ERROR"}
            </span>
            <h2>
              {is422Infeasible
                ? "No Crops Match All Conditions Yet"
                : "Unable to Create Farm Plan"}
            </h2>
          </div>
        </div>

        <p className="plan-error-reason">{reason}</p>

        {suggestions.length > 0 && (
          <div className="plan-suggestions-box">
            <h4>Simple Tips to Find Suitable Crops:</h4>
            <ul>
              {suggestions.map((item, idx) => (
                <li key={idx}>
                  <span className="material-symbols-outlined">lightbulb</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="plan-error-actions">
          {onEditFarm && (
            <button type="button" className="primary-button" onClick={onEditFarm}>
              Update Farm Details →
            </button>
          )}
          {onRegenerate && (
            <button
              type="button"
              className="secondary-button"
              onClick={(e) => {
                e.preventDefault();
                onRegenerate();
              }}
              disabled={loading}
            >
              <span className={`material-symbols-outlined ${loading ? "spin-icon" : ""}`}>
                {loading ? "sync" : "refresh"}
              </span>
              {loading ? "Checking Farm Plan..." : "Try Again"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  const {
    farm_area_acres,
    season,
    location,
    soil_type,
    water,
    top_recommendation,
    all_feasible_crops = [],
    planning_notes = [],
    data_source,
    disclaimer,
  } = plan;

  const hasFeasibleCrops = Boolean(top_recommendation && all_feasible_crops.length > 0);

  if (!hasFeasibleCrops) {
    return (
      <div className="plan-results-error panel" role="alert">
        <div className="plan-error-header">
          <div className="error-icon-badge">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <span className="eyebrow">FARM CONDITIONS NOTICE</span>
            <h2>No Crops Match All Conditions Yet</h2>
          </div>
        </div>

        <p className="plan-error-reason">
          No crops met all feasibility criteria (Season, Soil, Water, Budget) for your farm. Try adjusting your water quota or budget.
        </p>

        <div className="plan-error-actions">
          {onEditFarm && (
            <button type="button" className="primary-button" onClick={onEditFarm}>
              Update Farm Details →
            </button>
          )}
          {onRegenerate && (
            <button
              type="button"
              className="secondary-button"
              onClick={(e) => {
                e.preventDefault();
                onRegenerate();
              }}
              disabled={loading}
            >
              <span className={`material-symbols-outlined ${loading ? "spin-icon" : ""}`}>
                {loading ? "sync" : "refresh"}
              </span>
              {loading ? "Checking Farm Plan..." : "Try Again"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="plan-results-container">
      {/* Top Header Panel */}
      <section className="panel plan-hero-panel">
        <div className="plan-hero-header">
          <div>
            <div className="plan-status-pill feasible">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Farm Plan Ready</span>
            </div>
            <h2>
              Top Recommended Crop: {top_recommendation.name}
            </h2>
            <p className="plan-hero-sub">
              Calculated for <strong>{farm_area_acres} acres</strong> of{" "}
              <strong>{soil_type}</strong> soil in <strong>{location}</strong> (
              {season} Season).
            </p>
          </div>

          <div className="plan-header-controls">
            {onRegenerate && (
              <button
                className="secondary-button plan-recalc-btn"
                onClick={onRegenerate}
                title="Recalculate plan with current parameters"
              >
                <span className="material-symbols-outlined">refresh</span>
                Recalculate Plan
              </button>
            )}
          </div>
        </div>

        {/* Top Recommendation Highlight Card */}
        {top_recommendation && (
          <div className="top-rec-card">
            <div className="top-rec-main">
              <div className="top-rec-badge-row">
                <span className="rec-rank-badge">
                  <span className="material-symbols-outlined">eco</span> #1 Highest Return
                </span>
                <span className="crop-duration-pill">
                  ⏱ {top_recommendation.duration_days} days
                </span>
                <span className="crop-season-pill">{top_recommendation.season}</span>
              </div>

              <h3 className="top-rec-name">{top_recommendation.name}</h3>
              <p className="top-rec-notes">{top_recommendation.notes}</p>

              <div className="top-rec-metrics">
                <div className="rec-metric-item highlight-profit">
                  <span className="metric-lbl">Est. Net Profit</span>
                  <strong className="metric-val tnum">
                    ₹{Math.round(top_recommendation.est_total_profit_inr).toLocaleString("en-IN")}
                  </strong>
                  <span className="metric-sub">
                    ₹{Math.round(top_recommendation.est_total_profit_inr / farm_area_acres).toLocaleString("en-IN")} / acre
                  </span>
                </div>

                <div className="rec-metric-item">
                  <span className="metric-lbl">Est. Total Harvest</span>
                  <strong className="metric-val tnum">
                    {top_recommendation.est_total_yield_tonnes.toFixed(1)} tonnes
                  </strong>
                  <span className="metric-sub">
                    {top_recommendation.yield_t_per_acre} t/ac expected yield
                  </span>
                </div>

                <div className="rec-metric-item">
                  <span className="metric-lbl">Est. Total Revenue</span>
                  <strong className="metric-val tnum">
                    ₹{Math.round(top_recommendation.est_total_revenue_inr).toLocaleString("en-IN")}
                  </strong>
                  <span className="metric-sub">Gross income</span>
                </div>

                <div className="rec-metric-item">
                  <span className="metric-lbl">Est. Cultivation Cost</span>
                  <strong className="metric-val tnum">
                    ₹{Math.round(top_recommendation.est_total_cost_inr).toLocaleString("en-IN")}
                  </strong>
                  <span className="metric-sub">
                    ₹{top_recommendation.cost_inr_per_acre.toLocaleString("en-IN")} / ac
                  </span>
                </div>

                <div className="rec-metric-item">
                  <span className="metric-lbl">Water Needed</span>
                  <strong className="metric-val tnum">
                    {Math.round(top_recommendation.irrigation_req_m3).toLocaleString("en-IN")} m³
                  </strong>
                  <span className="metric-sub">
                    {top_recommendation.water_req_mm} mm seasonal need
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Water Resource Balance Section */}
      {water && (
        <section className="panel water-allocation-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">WATER USAGE</span>
              <h2>Water Available vs. Water Needed</h2>
              <p>
                How much of your available irrigation water is needed for this crop plan.
              </p>
            </div>
            <span className="panel-icon">💧</span>
          </div>

          <div className="water-bar-wrapper">
            <div className="water-bar-labels">
              <span>
                <strong>Water Used:</strong> {Math.round(water.allocated_m3).toLocaleString("en-IN")} m³ (
                {water.allocation_pct}%)
              </span>
              <span>
                <strong>Remaining Water Buffer:</strong> {Math.round(water.remaining_m3).toLocaleString("en-IN")} m³
              </span>
            </div>
            <div
              className="water-progress-track"
              role="progressbar"
              aria-valuenow={water.allocation_pct}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                className="water-progress-fill"
                style={{ width: `${Math.min(100, water.allocation_pct)}%` }}
              />
            </div>
          </div>

          <div className="water-stats-row">
            <div className="water-stat-cell">
              <span className="stat-label">Total Water Quota</span>
              <strong className="stat-val tnum">{water.total_available_m3.toLocaleString("en-IN")} m³</strong>
            </div>
            <div className="water-stat-cell">
              <span className="stat-label">Expected Rain Volume</span>
              <strong className="stat-val tnum">{water.expected_rainfall_m3.toLocaleString("en-IN")} m³</strong>
            </div>
            <div className="water-stat-cell">
              <span className="stat-label">Irrigation Needed</span>
              <strong className="stat-val tnum">{water.allocated_m3.toLocaleString("en-IN")} m³</strong>
            </div>
            <div className="water-stat-cell">
              <span className="stat-label">Remaining Water Buffer</span>
              <strong className="stat-val tnum">{water.remaining_m3.toLocaleString("en-IN")} m³</strong>
            </div>
          </div>
        </section>
      )}

      {/* Feasible Crops Comparative Section */}
      {all_feasible_crops.length > 0 && (
        <section className="panel feasible-crops-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">RECOMMENDED CROPS</span>
              <h2>Suitable Crop Options ({all_feasible_crops.length})</h2>
              <p>
                All crops suitable for your land, season, water, and budget. Ranked by estimated profit.
              </p>
            </div>

            <div className="view-mode-toggle" role="tablist" aria-label="Crop display view">
              <button
                type="button"
                className={`toggle-btn ${viewMode === "cards" ? "active" : ""}`}
                onClick={() => setViewMode("cards")}
                aria-pressed={viewMode === "cards"}
              >
                <span className="material-symbols-outlined">grid_view</span>
                Cards
              </button>
              <button
                type="button"
                className={`toggle-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                aria-pressed={viewMode === "table"}
              >
                <span className="material-symbols-outlined">table_chart</span>
                Table
              </button>
            </div>
          </div>

          {viewMode === "cards" ? (
            /* ── Readable Cards View ────────────────────────────── */
            <div className="crop-recommendations-grid">
              {all_feasible_crops.map((crop, index) => {
                const isTop = index === 0;
                return (
                  <article
                    key={crop.name}
                    className={`crop-rec-card ${isTop ? "top-card" : ""}`}
                  >
                    <div className="crop-rec-card-header">
                      <div className="crop-rec-badge-row">
                        <span className={`crop-rec-rank ${isTop ? "top-rank" : ""}`}>
                          #{index + 1} {isTop ? "Top Pick" : "Option"}
                        </span>
                        <span className="crop-duration-pill">
                          ⏱ {crop.duration_days} days
                        </span>
                        {crop.season && (
                          <span className="crop-season-pill">{crop.season}</span>
                        )}
                      </div>
                      <h3 className="crop-rec-title">{crop.name}</h3>
                      {crop.notes && <p className="crop-rec-notes">{crop.notes}</p>}
                    </div>

                    <div className="crop-rec-profit-box">
                      <span className="profit-label">Expected Net Profit</span>
                      <strong className="profit-value tnum">
                        ₹{Math.round(crop.est_total_profit_inr).toLocaleString("en-IN")}
                      </strong>
                      <span className="profit-sub">
                        ₹{Math.round(crop.est_total_profit_inr / farm_area_acres).toLocaleString("en-IN")} per acre
                      </span>
                    </div>

                    <div className="crop-rec-details-grid">
                      <div className="rec-detail-cell">
                        <span className="detail-label">🌾 Est. Harvest</span>
                        <strong className="detail-val tnum">
                          {crop.est_total_yield_tonnes.toFixed(1)} t
                        </strong>
                        <span className="detail-sub">({crop.yield_t_per_acre} t/ac)</span>
                      </div>

                      <div className="rec-detail-cell">
                        <span className="detail-label">💵 Est. Cost</span>
                        <strong className="detail-val tnum">
                          ₹{Math.round(crop.est_total_cost_inr).toLocaleString("en-IN")}
                        </strong>
                        <span className="detail-sub">(₹{crop.cost_inr_per_acre.toLocaleString("en-IN")}/ac)</span>
                      </div>

                      <div className="rec-detail-cell">
                        <span className="detail-label">📈 Revenue</span>
                        <strong className="detail-val tnum">
                          ₹{Math.round(crop.est_total_revenue_inr).toLocaleString("en-IN")}
                        </strong>
                      </div>

                      <div className="rec-detail-cell">
                        <span className="detail-label">💧 Water Needed</span>
                        <strong className="detail-val tnum">
                          {Math.round(crop.irrigation_req_m3).toLocaleString("en-IN")} m³
                        </strong>
                        <span className="detail-sub">({crop.water_req_mm} mm)</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* ── Comparative Table View ────────────────────────── */
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank &amp; Crop</th>
                    <th>Duration</th>
                    <th>Water Req.</th>
                    <th>Est. Harvest</th>
                    <th>Est. Cost</th>
                    <th>Est. Revenue</th>
                    <th>Est. Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {all_feasible_crops.map((crop, index) => {
                    const isTop = index === 0;
                    return (
                      <tr
                        key={crop.name}
                        className={isTop ? "highlight-row" : ""}
                      >
                        <td>
                          <div className="crop-cell-title">
                            <span className={`rank-dot ${isTop ? "top-rank" : ""}`}>
                              {index + 1}
                            </span>
                            <div>
                              <strong>{crop.name}</strong>
                              {isTop && <span className="top-badge">Top Pick</span>}
                            </div>
                          </div>
                        </td>
                        <td>{crop.duration_days} days</td>
                        <td className="tnum">
                          {Math.round(crop.irrigation_req_m3).toLocaleString("en-IN")} m³
                          <span className="sub-unit"> ({crop.water_req_mm} mm)</span>
                        </td>
                        <td className="tnum">
                          {crop.est_total_yield_tonnes.toFixed(1)} t
                          <span className="sub-unit"> ({crop.yield_t_per_acre} t/ac)</span>
                        </td>
                        <td className="tnum">
                          ₹{Math.round(crop.est_total_cost_inr).toLocaleString("en-IN")}
                        </td>
                        <td className="tnum">
                          ₹{Math.round(crop.est_total_revenue_inr).toLocaleString("en-IN")}
                        </td>
                        <td className="tnum profit-cell">
                          <strong>
                            ₹{Math.round(crop.est_total_profit_inr).toLocaleString("en-IN")}
                          </strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Planning Notes & Ag-intelligence Metadata */}
      {planning_notes.length > 0 && (
        <section className="panel planning-notes-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ENGINE AUDIT LOG</span>
              <h3>Planning Notes & Hydrological Observations</h3>
            </div>
            <span className="panel-icon">notes</span>
          </div>
          <ul className="notes-list">
            {planning_notes.map((note, idx) => (
              <li key={idx}>
                <span className="material-symbols-outlined note-bullet">info</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Official Disclaimer & Source Footnote */}
      <footer className="plan-disclaimer-card">
        <div className="disclaimer-header">
          <span className="material-symbols-outlined">verified</span>
          <strong>Data Source: {data_source}</strong>
        </div>
        <p>{disclaimer}</p>
      </footer>
    </div>
  );
}
