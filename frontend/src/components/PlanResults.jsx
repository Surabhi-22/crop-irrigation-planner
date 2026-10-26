export default function PlanResults({
  plan,
  loading,
  error,
  onRegenerate,
  onEditFarm,
}) {

  if (loading) {
    return (
      <div className="plan-results-loading panel" role="status" aria-live="polite">
        <div className="loading-spinner-wrap">
          <div className="loading-pulse-ring" />
          <span className="material-symbols-outlined spin-icon">psychology</span>
        </div>
        <h3>Evaluating Agricultural Intelligence Engine...</h3>
        <p>
          Running 4-gate agronomic feasibility checks (Season · Soil · Water · Budget)
          against ICAR benchmark models.
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
              {is422Infeasible ? "AGRONOMIC CONSTRAINT VIOLATION" : "EXECUTION ERROR"}
            </span>
            <h2>
              {is422Infeasible
                ? "No Feasible Crop Configuration Found"
                : "Unable to Generate Agricultural Plan"}
            </h2>
          </div>
        </div>

        <p className="plan-error-reason">{reason}</p>

        {suggestions.length > 0 && (
          <div className="plan-suggestions-box">
            <h4>Recommended Adjustments to Achieve Feasibility:</h4>
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
            <button className="primary-button" onClick={onEditFarm}>
              Adjust Farm Parameters →
            </button>
          )}
          {onRegenerate && (
            <button className="secondary-button" onClick={onRegenerate}>
              <span className="material-symbols-outlined">refresh</span>
              Retry Planning
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

  return (
    <div className="plan-results-container">
      {/* Top Header Panel */}
      <section className="panel plan-hero-panel">
        <div className="plan-hero-header">
          <div>
            <div className="plan-status-pill feasible">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Agronomically Feasible Plan</span>
            </div>
            <h2>
              Optimal Crop Strategy: {top_recommendation ? top_recommendation.name : "N/A"}
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
                Recalculate
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
                  <span className="metric-lbl">Est. Net Profit (Full Area)</span>
                  <strong className="metric-val tnum">
                    ₹{Math.round(top_recommendation.est_total_profit_inr).toLocaleString("en-IN")}
                  </strong>
                  <span className="metric-sub">
                    ₹{Math.round(top_recommendation.est_total_profit_inr / farm_area_acres).toLocaleString("en-IN")} / ac
                  </span>
                </div>

                <div className="rec-metric-item">
                  <span className="metric-lbl">Est. Total Revenue</span>
                  <strong className="metric-val tnum">
                    ₹{Math.round(top_recommendation.est_total_revenue_inr).toLocaleString("en-IN")}
                  </strong>
                  <span className="metric-sub">
                    {top_recommendation.est_total_yield_tonnes.toFixed(1)} tonnes harvested
                  </span>
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
                  <span className="metric-lbl">Supplemental Irrigation</span>
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
              <span className="eyebrow">HYDROLOGICAL BALANCE</span>
              <h2>Water Allocation & Quota Utilization</h2>
              <p>
                Dynamic allocation of volumetric irrigation reserve against crop transpiration demand.
              </p>
            </div>
            <span className="panel-icon">💧</span>
          </div>

          <div className="water-bar-wrapper">
            <div className="water-bar-labels">
              <span>
                <strong>Allocated:</strong> {Math.round(water.allocated_m3).toLocaleString("en-IN")} m³ (
                {water.allocation_pct}%)
              </span>
              <span>
                <strong>Remaining Reserve:</strong> {Math.round(water.remaining_m3).toLocaleString("en-IN")} m³
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
              <span className="stat-label">Total Reserve Quota</span>
              <strong className="stat-val tnum">{water.total_available_m3.toLocaleString("en-IN")} m³</strong>
            </div>
            <div className="water-stat-cell">
              <span className="stat-label">Expected Rainfall Volume</span>
              <strong className="stat-val tnum">{water.expected_rainfall_m3.toLocaleString("en-IN")} m³</strong>
            </div>
            <div className="water-stat-cell">
              <span className="stat-label">Supplemental Irrigation Needed</span>
              <strong className="stat-val tnum">{water.allocated_m3.toLocaleString("en-IN")} m³</strong>
            </div>
            <div className="water-stat-cell">
              <span className="stat-label">Safe Unallocated Buffer</span>
              <strong className="stat-val tnum">{water.remaining_m3.toLocaleString("en-IN")} m³</strong>
            </div>
          </div>
        </section>
      )}

      {/* Feasible Crops Comparative Matrix */}
      {all_feasible_crops.length > 0 && (
        <section className="panel feasible-crops-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">COMPARATIVE BENCHMARK MATRIX</span>
              <h2>All Feasible Crop Options ({all_feasible_crops.length})</h2>
              <p>
                All crops meeting season, soil type, irrigation limits, and budget thresholds.
                Ranked by estimated net return.
              </p>
            </div>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank & Crop</th>
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
