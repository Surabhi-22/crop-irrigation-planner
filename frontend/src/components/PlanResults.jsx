import { useState } from "react";
import PlanSpeechControl from "./PlanSpeechControl";

export default function PlanResults({
  plan,
  loading,
  error,
  onRegenerate,
  onEditFarm,
}) {
  const [viewMode, setViewMode] = useState("cards");
  const [showUnsuitable, setShowUnsuitable] = useState(false);

  if (loading) {
    return (
      <div className="plan-results-loading panel" role="status" aria-live="polite">
        <div className="loading-spinner-wrap">
          <div className="loading-pulse-ring" />
          <span className="material-symbols-outlined spin-icon">psychology</span>
        </div>
        <h3>Creating Your Farm Plan...</h3>
        <p>
          Calculating budget-aware crop feasibility, water quotas, and profit forecasts based on your farm conditions.
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
    alternative_crops = [],
    unsuitable_crops = [],
    budget_aware_notice,
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

  const isPartialPlan = Boolean(top_recommendation?.is_partial_area);

  return (
    <div className="plan-results-container">
      {/* ── Farmer-Friendly Budget-Aware Notification Banner ── */}
      {isPartialPlan && (
        <section className="panel budget-aware-banner" role="region" aria-label="Budget-Aware Cultivation Notice">
          <div className="budget-aware-header">
            <div className="banner-icon-badge">
              <span className="material-symbols-outlined">savings</span>
            </div>
            <div>
              <span className="eyebrow">PRACTICAL SIZING ADVICE</span>
              <h2>Budget-Aware Cultivation Plan</h2>
            </div>
          </div>

          <p className="budget-aware-text">
            {budget_aware_notice ||
              `Your operational budget supports cultivating ${top_recommendation.recommended_area_acres} acres of your ${farm_area_acres}-acre land. Rather than rejecting your plan, Quantum Agri has optimized a profitable partial-parcel plan.`}
          </p>

          <div className="budget-parcel-chips">
            <div className="parcel-chip">
              <span className="chip-label">Total Land</span>
              <strong className="chip-val">{farm_area_acres} Acres</strong>
            </div>
            <div className="parcel-chip highlight-chip">
              <span className="chip-label">Recommended Cultivated</span>
              <strong className="chip-val">{top_recommendation.recommended_area_acres} Acres</strong>
            </div>
            <div className="parcel-chip">
              <span className="chip-label">Fallow / Buffer Land</span>
              <strong className="chip-val">{top_recommendation.remaining_area_acres} Acres</strong>
            </div>
            <div className="parcel-chip">
              <span className="chip-label">Planned Cost</span>
              <strong className="chip-val">₹{Math.round(top_recommendation.est_total_cost_inr).toLocaleString("en-IN")}</strong>
            </div>
            {top_recommendation.remaining_budget_inr > 0 && (
              <div className="parcel-chip">
                <span className="chip-label">Remaining Budget</span>
                <strong className="chip-val">₹{Math.round(top_recommendation.remaining_budget_inr).toLocaleString("en-IN")}</strong>
              </div>
            )}
            <div className="parcel-chip full-cost-chip">
              <span className="chip-label">Full 8-Acre Budget Needed</span>
              <strong className="chip-val">₹{Math.round(top_recommendation.full_area_cost_inr).toLocaleString("en-IN")}</strong>
            </div>
          </div>
        </section>
      )}

      {/* ── Top Header Panel ── */}
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
              Calculated for{" "}
              <strong>
                {top_recommendation.recommended_area_acres || farm_area_acres} acres
              </strong>{" "}
              {isPartialPlan && `(of ${farm_area_acres} total acres) `}
              of <strong>{soil_type}</strong> soil in <strong>{location}</strong> (
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

        {/* Audio Spoken Summary for Crop Recommendations */}
        <PlanSpeechControl planResult={plan} />

        {/* Top Recommendation Highlight Card */}
        {top_recommendation && (
          <div className="top-rec-card">
            <div className="top-rec-main">
              <div className="top-rec-badge-row">
                <span className="rec-rank-badge">
                  <span className="material-symbols-outlined">eco</span> #1 Highest Return
                </span>
                <span className="category-pill recommended">
                  <span className="material-symbols-outlined">check</span> Recommended
                </span>
                {top_recommendation.is_partial_area && (
                  <span className="parcel-badge partial">
                    🌾 {top_recommendation.recommended_area_acres} ac parcel
                  </span>
                )}
                <span className="crop-duration-pill">
                  ⏱ {top_recommendation.duration_days} days
                </span>
                <span className="crop-season-pill">{top_recommendation.season}</span>
              </div>

              <h3 className="top-rec-name">{top_recommendation.name}</h3>
              <p className="top-rec-notes">{top_recommendation.notes}</p>

              {top_recommendation.suitability_reason && (
                <div className="why-this-crop-box">
                  <span className="why-title">
                    <span className="material-symbols-outlined">help_outline</span> Why this crop?
                  </span>
                  <p>{top_recommendation.suitability_reason}</p>
                </div>
              )}

              <div className="top-rec-metrics">
                <div className="rec-metric-item highlight-profit">
                  <span className="metric-lbl">Est. Net Profit</span>
                  <strong className="metric-val tnum">
                    ₹{Math.round(top_recommendation.est_total_profit_inr).toLocaleString("en-IN")}
                  </strong>
                  <span className="metric-sub">
                    ROI: {top_recommendation.roi_pct}%
                  </span>
                </div>

                <div className="rec-metric-item">
                  <span className="metric-lbl">Cultivated Land</span>
                  <strong className="metric-val tnum">
                    {top_recommendation.recommended_area_acres || farm_area_acres} ac
                  </strong>
                  <span className="metric-sub">
                    {top_recommendation.is_partial_area
                      ? `${top_recommendation.remaining_area_acres} ac remaining`
                      : "100% full farm area"}
                  </span>
                </div>

                <div className="rec-metric-item">
                  <span className="metric-lbl">Est. Total Harvest</span>
                  <strong className="metric-val tnum">
                    {top_recommendation.est_total_yield_tonnes.toFixed(2)} tonnes
                  </strong>
                  <span className="metric-sub">
                    {top_recommendation.yield_t_per_acre} t/ac benchmark
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
                    {top_recommendation.water_req_mm} mm total demand
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Water Resource Balance Section ── */}
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

          <div className="rainfall-qualification-box">
            <span className="material-symbols-outlined note-icon">info</span>
            <p>
              <strong>Precipitation Accounting Note:</strong> Baseline calculations assume forecasted seasonal rainfall ({Math.round(water.expected_rainfall_m3).toLocaleString("en-IN")} m³ across {farm_area_acres} acres) contributes directly to crop water demand. Actual effective rainfall retention depends on local soil infiltration rates, slope, and rain intensity.
            </p>
          </div>
        </section>
      )}

      {/* ── Category A: Feasible Crops Section (Recommended) ── */}
      {all_feasible_crops.length > 0 && (
        <section className="panel feasible-crops-panel">
          <div className="panel-heading">
            <div>
              <div className="category-header-title">
                <span className="eyebrow">CATEGORY A: FEASIBLE</span>
                <span className="category-pill recommended">Recommended</span>
              </div>
              <h2>Suitable Crop Options ({all_feasible_crops.length})</h2>
              <p>
                All crops suitable for your land, season, water, and budget. Ranked by estimated net profit.
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
            /* ── Cards View ────────────────────────────── */
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
                        <span className="category-pill recommended">Recommended</span>
                        {crop.is_partial_area && (
                          <span className="parcel-badge partial">
                            {crop.recommended_area_acres} ac parcel
                          </span>
                        )}
                        <span className="crop-duration-pill">
                          ⏱ {crop.duration_days} days
                        </span>
                        {crop.season && (
                          <span className="crop-season-pill">{crop.season}</span>
                        )}
                      </div>
                      <h3 className="crop-rec-title">{crop.name}</h3>
                      {crop.notes && <p className="crop-rec-notes">{crop.notes}</p>}

                      {crop.suitability_reason && (
                        <div className="why-this-crop-box-compact">
                          <strong>Why this crop?</strong> {crop.suitability_reason}
                        </div>
                      )}
                    </div>

                    <div className="crop-rec-profit-box">
                      <span className="profit-label">Expected Net Profit</span>
                      <strong className="profit-value tnum">
                        ₹{Math.round(crop.est_total_profit_inr).toLocaleString("en-IN")}
                      </strong>
                      <span className="profit-sub">
                        ROI: {crop.roi_pct}% • {crop.recommended_area_acres || farm_area_acres} acres
                      </span>
                    </div>

                    <div className="crop-rec-details-grid">
                      <div className="rec-detail-cell">
                        <span className="detail-label">🌾 Est. Harvest</span>
                        <strong className="detail-val tnum">
                          {crop.est_total_yield_tonnes.toFixed(2)} t
                        </strong>
                        <span className="detail-sub">({crop.yield_t_per_acre} t/ac)</span>
                      </div>

                      <div className="rec-detail-cell">
                        <span className="detail-label">💵 Cultivation Cost</span>
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
                        <span className="detail-sub">Gross value</span>
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
                    <th>Status</th>
                    <th>Cultivated Area</th>
                    <th>Duration</th>
                    <th>Water Req.</th>
                    <th>Est. Harvest</th>
                    <th>Est. Cost</th>
                    <th>Est. Revenue</th>
                    <th>Est. Net Profit</th>
                    <th>ROI</th>
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
                        <td>
                          <span className="category-pill recommended-small">Recommended</span>
                        </td>
                        <td>
                          <strong>{crop.recommended_area_acres || farm_area_acres} ac</strong>
                          {crop.is_partial_area && (
                            <span className="sub-unit"> ({crop.remaining_area_acres} ac left)</span>
                          )}
                        </td>
                        <td>{crop.duration_days} days</td>
                        <td className="tnum">
                          {Math.round(crop.irrigation_req_m3).toLocaleString("en-IN")} m³
                          <span className="sub-unit"> ({crop.water_req_mm} mm)</span>
                        </td>
                        <td className="tnum">
                          {crop.est_total_yield_tonnes.toFixed(2)} t
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
                        <td className="tnum">
                          <strong>{crop.roi_pct}%</strong>
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

      {/* ── Category B: Alternative Crops Section ── */}
      {alternative_crops.length > 0 && (
        <section className="panel alternative-crops-panel">
          <div className="panel-heading">
            <div>
              <div className="category-header-title">
                <span className="eyebrow">CATEGORY B: ADAPTIVE OPTIONS</span>
                <span className="category-pill alternative">Alternative</span>
              </div>
              <h2>Alternative Recommendations ({alternative_crops.length})</h2>
              <p>
                Crops that could become feasible with clearly quantified adjustments (seasonal rotation, soil conditioning, or budget scaling).
              </p>
            </div>
            <span className="panel-icon">swap_horizontal_circle</span>
          </div>

          <div className="alternative-crops-grid">
            {alternative_crops.map((alt) => (
              <article key={alt.name} className="alt-crop-card">
                <div className="alt-card-header">
                  <div className="crop-rec-badge-row">
                    <span className="category-pill alternative">Alternative</span>
                    <span className="adj-type-pill">
                      {alt.adjustment_type === "season" && "🔄 Season Rotation"}
                      {alt.adjustment_type === "soil" && "🌱 Soil Conditioning"}
                      {alt.adjustment_type === "budget" && "💰 Budget Required"}
                      {alt.adjustment_type === "water" && "💧 Water Supply"}
                    </span>
                    <span className="crop-duration-pill">⏱ {alt.duration_days} days</span>
                  </div>
                  <h3 className="alt-crop-title">{alt.name}</h3>
                </div>

                <div className="adjustment-box">
                  <span className="adj-label">
                    <span className="material-symbols-outlined">lightbulb</span> Required Adjustment
                  </span>
                  <p className="adj-text">{alt.required_adjustment}</p>
                </div>

                {alt.why_alternative && (
                  <p className="why-alt-text">
                    <strong>Why consider:</strong> {alt.why_alternative}
                  </p>
                )}

                <div className="alt-card-footer">
                  <span><strong>Cost:</strong> ₹{alt.cost_inr_per_acre.toLocaleString("en-IN")}/ac</span>
                  <span><strong>Water:</strong> {alt.water_req_mm} mm</span>
                  <span><strong>Yield:</strong> {alt.yield_t_per_acre} t/ac</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Category C: Unsuitable Crops Section (Collapsible / Transparent) ── */}
      {unsuitable_crops.length > 0 && (
        <section className="panel unsuitable-crops-panel">
          <div className="unsuitable-toggle-header" onClick={() => setShowUnsuitable(!showUnsuitable)} role="button" tabIndex={0}>
            <div>
              <div className="category-header-title">
                <span className="eyebrow">CATEGORY C: INCOMPATIBLE</span>
                <span className="category-pill unsuitable">Not Suitable</span>
              </div>
              <h3>
                Agronomically Unsuitable Crops ({unsuitable_crops.length})
              </h3>
              <p className="unsuitable-subtitle">
                Crops that fail core agronomic constraints (season, soil, or extreme water needs). Click to {showUnsuitable ? "hide" : "view"} why these were ruled out.
              </p>
            </div>
            <span className="material-symbols-outlined accordion-icon">
              {showUnsuitable ? "expand_less" : "expand_more"}
            </span>
          </div>

          {showUnsuitable && (
            <div className="unsuitable-crops-list">
              {unsuitable_crops.map((u) => (
                <div key={u.name} className="unsuitable-item-row">
                  <div className="unsuitable-name-col">
                    <strong>{u.name}</strong>
                    <span className="category-pill unsuitable-small">Not Suitable</span>
                  </div>
                  <ul className="unsuitable-reasons-list">
                    {u.rejection_reasons.map((r, idx) => (
                      <li key={idx}>
                        <span className="material-symbols-outlined reason-bullet">cancel</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Planning Notes & Ag-intelligence Metadata ── */}
      {planning_notes.length > 0 && (
        <section className="panel planning-notes-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ENGINE AUDIT LOG</span>
              <h3>Planning Notes &amp; Hydrological Observations</h3>
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

      {/* ── Official Disclaimer & Source Footnote ── */}
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
