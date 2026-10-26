import { useState, useRef, useEffect } from "react";
import { validateFarm } from "../services/farmApi";
import { ApiError, NetworkError } from "../services/apiClient";

const DEFAULT_FARM = {
  area: "5",
  soilType: "Loamy",
  rainfall: "650",
  availableWater: "3000",
  location: "Bengaluru",
  season: "Kharif",
  budget: "100000",
};

export default function FarmForm({ onSubmit, onReset, initialData }) {
  const [farm, setFarm] = useState(() => ({
    area: initialData?.areaAcres ? String(initialData.areaAcres) : DEFAULT_FARM.area,
    soilType: initialData?.soilType || DEFAULT_FARM.soilType,
    rainfall:
      initialData?.expectedRainfallMm !== undefined
        ? String(initialData.expectedRainfallMm)
        : DEFAULT_FARM.rainfall,
    availableWater:
      initialData?.availableWaterM3 !== undefined
        ? String(initialData.availableWaterM3)
        : DEFAULT_FARM.availableWater,
    location: initialData?.location || DEFAULT_FARM.location,
    season: initialData?.season || DEFAULT_FARM.season,
    budget:
      initialData?.budget !== undefined
        ? String(initialData.budget)
        : DEFAULT_FARM.budget,
  }));

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverSuccess, setServerSuccess] = useState("");
  const [isModified, setIsModified] = useState(false);

  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFarm((previousFarm) => ({
      ...previousFarm,
      [name]: value,
    }));

    setIsModified(true);
    setError("");
    setServerSuccess("");
  }

  function handleResetToDefaults() {
    const confirmed = window.confirm(
      "Revert all agronomic parameters to the default baseline values?"
    );
    if (!confirmed) return;

    setFarm(DEFAULT_FARM);
    setIsModified(false);
    setError("");
    setServerSuccess("");

    if (typeof onReset === "function") {
      onReset();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    // Prevent duplicate submissions while request is in-flight
    if (isSubmitting) return;

    const area = Number(farm.area);
    const rainfall = Number(farm.rainfall);
    const availableWater = Number(farm.availableWater);
    const budget = Number(farm.budget);
    const trimmedLocation = (farm.location || "").trim();

    // ── Client-side validation ─────────────────────────────────────────
    if (
      !Number.isFinite(area) ||
      area <= 0 ||
      !Number.isFinite(rainfall) ||
      rainfall < 0 ||
      !Number.isFinite(availableWater) ||
      availableWater < 0 ||
      !Number.isFinite(budget) ||
      budget < 0
    ) {
      setError(
        "Please provide a positive cultivation area (> 0) and non-negative values for rainfall, available water, and operational budget."
      );
      return;
    }

    if (!trimmedLocation) {
      setError("Please specify a location or district name for your farm.");
      return;
    }

    const farmData = {
      areaAcres: area,
      soilType: farm.soilType,
      expectedRainfallMm: rainfall,
      availableWaterM3: availableWater,
      location: trimmedLocation,
      season: farm.season,
      budget,
    };

    // ── Server-side validation via FastAPI endpoint ─────────────────────
    setError("");
    setServerSuccess("");
    setIsSubmitting(true);

    try {
      const result = await validateFarm(farmData);
      const successMessage =
        result.message || "Farm parameters successfully validated by FastAPI server.";

      setServerSuccess(successMessage);
      setIsModified(false);
      setError("");

      timeoutRef.current = setTimeout(() => {
        setIsSubmitting(false);
        if (typeof onSubmit === "function") {
          onSubmit(result.data, successMessage);
        }
      }, 550);
    } catch (err) {
      setServerSuccess("");
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setError(`Validation error: ${err.message}`);
        } else {
          setError(`Server error (${err.status}): ${err.message}`);
        }
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while communicating with the backend.");
        console.error("[FarmForm] Unexpected error:", err);
      }
      setIsSubmitting(false);
    }
  }

  // ── Derived Live Summary Values ──────────────────────────────────────
  const areaNum = parseFloat(farm.area);
  const isAreaValid = !isNaN(areaNum) && areaNum > 0;

  const rainfallNum = parseFloat(farm.rainfall);
  const isRainfallValid = !isNaN(rainfallNum) && rainfallNum >= 0 && farm.rainfall !== "";

  const waterNum = parseFloat(farm.availableWater);
  const isWaterValid = !isNaN(waterNum) && waterNum >= 0 && farm.availableWater !== "";

  const budgetNum = parseFloat(farm.budget);
  const isBudgetValid = !isNaN(budgetNum) && budgetNum >= 0 && farm.budget !== "";

  const perAcreBudget =
    isAreaValid && isBudgetValid ? Math.round(budgetNum / areaNum) : null;

  const waterPerAcre =
    isAreaValid && isWaterValid ? Math.round(waterNum / areaNum) : null;

  const hasLocation = Boolean(farm.location && farm.location.trim());

  return (
    <div className="farm-details-workspace">
      {/* Top Configuration & Draft Control Bar */}
      <div className="farm-config-header">
        <div className="farm-config-header-info">
          <div className="farm-config-icon-badge">
            <span className="material-symbols-outlined">tune</span>
          </div>
          <div>
            <h2>Farm Configuration &amp; Agronomic Baseline</h2>
            <div className="farm-config-status">
              <span
                className={`status-dot ${isModified ? "draft" : "synced"}`}
              ></span>
              <span>
                {isModified
                  ? "Editing in-progress parameters (unsaved changes)"
                  : initialData
                  ? "Validated baseline active across workspace"
                  : "Ready for baseline parameter entry"}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="reset-defaults-button"
          onClick={handleResetToDefaults}
          disabled={isSubmitting}
          title="Revert form values to standard defaults"
        >
          <span className="material-symbols-outlined">restart_alt</span>
          Reset to Defaults
        </button>
      </div>

      {/* Responsive Two-Column Layout: Form (Left) & Live Summary (Right) */}
      <div className="farm-details-layout">
        {/* Left Column: Multi-Section Agronomic Form */}
        <div className="farm-form-column">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="farm-configuration-form"
          >
            {/* SECTION 1: Land & Location */}
            <section className="farm-section-card">
              <div className="section-header">
                <div className="section-title-wrap">
                  <span className="material-symbols-outlined section-icon">
                    share_location
                  </span>
                  <h3>Section 1: Land &amp; Location</h3>
                </div>
                <span className="section-badge">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px" }}
                  >
                    pin_drop
                  </span>
                  Geographic Boundary
                </span>
              </div>

              <div className="form-fields-grid">
                {/* Location or District */}
                <div className="form-group span-2">
                  <div className="label-row">
                    <label htmlFor="farm-location">
                      Location or District{" "}
                      <span className="required-star">*</span>
                    </label>
                    <span className="hint-pill">Agro-climatic zone</span>
                  </div>
                  <div className="input-with-icon">
                    <span className="material-symbols-outlined input-prefix-icon">
                      pin_drop
                    </span>
                    <input
                      id="farm-location"
                      type="text"
                      name="location"
                      value={farm.location}
                      onChange={handleChange}
                      placeholder="e.g. Bengaluru Rural, Karnataka"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <span className="field-helper">
                    Regional administrative district used to anchor seasonal rainfall and soil baselines.
                  </span>
                </div>

                {/* Cultivation Area */}
                <div className="form-group">
                  <div className="label-row">
                    <label htmlFor="cultivation-area">
                      Cultivation Area <span className="required-star">*</span>
                    </label>
                  </div>
                  <div className="input-with-addon">
                    <input
                      id="cultivation-area"
                      type="number"
                      name="area"
                      min="0.01"
                      step="any"
                      value={farm.area}
                      onChange={handleChange}
                      placeholder="e.g. 5.0"
                      disabled={isSubmitting}
                      required
                    />
                    <span className="input-suffix-addon">Acres</span>
                  </div>
                  <span className="field-helper">
                    Net operable tillage area under active cultivation (must be &gt; 0).
                  </span>
                </div>

                {/* Growing Season */}
                <div className="form-group">
                  <div className="label-row">
                    <label htmlFor="growing-season">
                      Growing Season <span className="required-star">*</span>
                    </label>
                  </div>
                  <div className="select-with-arrow">
                    <select
                      id="growing-season"
                      name="season"
                      value={farm.season}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    >
                      <option value="Kharif">Kharif (Monsoon Cycle / Jun–Nov)</option>
                      <option value="Rabi">Rabi (Winter Cycle / Nov–Apr)</option>
                      <option value="Summer">Summer (Zaid Cycle / Mar–Jun)</option>
                    </select>
                    <span className="material-symbols-outlined select-arrow">
                      unfold_more
                    </span>
                  </div>
                  <span className="field-helper">
                    Seasonal planting cycle dictating temperature regimes and crop life-cycles.
                  </span>
                </div>
              </div>
            </section>

            {/* SECTION 2: Soil & Hydrology */}
            <section className="farm-section-card">
              <div className="section-header">
                <div className="section-title-wrap">
                  <span className="material-symbols-outlined section-icon">
                    landscape
                  </span>
                  <h3>Section 2: Soil &amp; Hydrology</h3>
                </div>
                <span className="section-badge">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px" }}
                  >
                    water_drop
                  </span>
                  Soil &amp; Water Matrix
                </span>
              </div>

              <div className="form-fields-grid">
                {/* Soil Type */}
                <div className="form-group span-2">
                  <div className="label-row">
                    <label htmlFor="soil-type">
                      Soil Taxonomy &amp; Texture{" "}
                      <span className="required-star">*</span>
                    </label>
                    <span className="hint-pill">Hydrological Drainage</span>
                  </div>
                  <div className="select-with-arrow">
                    <select
                      id="soil-type"
                      name="soilType"
                      value={farm.soilType}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    >
                      <option value="Loamy">
                        Loamy — Balanced fertility, optimal percolation &amp; moisture holding
                      </option>
                      <option value="Clay">
                        Clay — Dense alluvial, high moisture retention, slow percolation
                      </option>
                      <option value="Sandy">
                        Sandy — Porous texture, rapid infiltration, frequent irrigation needed
                      </option>
                      <option value="Silty">
                        Silty — Fine texture, high nutrient availability, moderate drainage
                      </option>
                    </select>
                    <span className="material-symbols-outlined select-arrow">
                      unfold_more
                    </span>
                  </div>
                  <span className="field-helper">
                    Soil texture determines daily percolation losses, root aeration, and water-holding capacity.
                  </span>
                </div>

                {/* Expected Seasonal Rainfall */}
                <div className="form-group">
                  <div className="label-row">
                    <label htmlFor="expected-rainfall">
                      Expected Seasonal Rainfall{" "}
                      <span className="required-star">*</span>
                    </label>
                  </div>
                  <div className="input-with-addon">
                    <input
                      id="expected-rainfall"
                      type="number"
                      name="rainfall"
                      min="0"
                      step="any"
                      value={farm.rainfall}
                      onChange={handleChange}
                      placeholder="e.g. 650"
                      disabled={isSubmitting}
                      required
                    />
                    <span className="input-suffix-addon">mm</span>
                  </div>
                  <span className="field-helper">
                    Forecasted natural cumulative atmospheric precipitation.
                  </span>
                </div>

                {/* Available Irrigation Water */}
                <div className="form-group">
                  <div className="label-row">
                    <label htmlFor="available-water">
                      Available Irrigation Water{" "}
                      <span className="required-star">*</span>
                    </label>
                  </div>
                  <div className="input-with-addon">
                    <input
                      id="available-water"
                      type="number"
                      name="availableWater"
                      min="0"
                      step="any"
                      value={farm.availableWater}
                      onChange={handleChange}
                      placeholder="e.g. 3000"
                      disabled={isSubmitting}
                      required
                    />
                    <span className="input-suffix-addon">m³</span>
                  </div>
                  <span className="field-helper">
                    Total volumetric irrigation quota (canal rights, borewell, or surface pond).
                  </span>
                </div>
              </div>
            </section>

            {/* SECTION 3: Financial Constraints */}
            <section className="farm-section-card">
              <div className="section-header">
                <div className="section-title-wrap">
                  <span className="material-symbols-outlined section-icon">
                    account_balance_wallet
                  </span>
                  <h3>Section 3: Financial Constraints</h3>
                </div>
                <span className="section-badge">
                  Operating Currency: INR (₹)
                </span>
              </div>

              <div className="form-fields-grid">
                {/* Total Operational Budget */}
                <div className="form-group span-2">
                  <div className="label-row">
                    <label htmlFor="farm-budget">
                      Total Operational Budget{" "}
                      <span className="required-star">*</span>
                    </label>
                    {perAcreBudget !== null && (
                      <span className="hint-pill font-tabular">
                        ₹ {perAcreBudget.toLocaleString("en-IN")} / Acre
                      </span>
                    )}
                  </div>
                  <div className="input-with-addon">
                    <span className="input-prefix-addon">₹</span>
                    <input
                      id="farm-budget"
                      type="number"
                      name="budget"
                      min="0"
                      step="any"
                      value={farm.budget}
                      onChange={handleChange}
                      placeholder="e.g. 100000"
                      disabled={isSubmitting}
                      required
                      style={{ paddingLeft: "32px" }}
                    />
                    <span className="input-suffix-addon">INR</span>
                  </div>
                  <span className="field-helper">
                    Working capital allocated for seed acquisition, fertilizer amendments, tractor fuel, and irrigation energy.
                  </span>
                </div>
              </div>
            </section>

            {/* Validation Alerts */}
            {error && (
              <div className="farm-alert-box error" role="alert">
                <span className="material-symbols-outlined alert-icon">
                  error
                </span>
                <div className="alert-content">
                  <strong>Validation Notice</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {serverSuccess && (
              <div className="farm-alert-box success" role="status">
                <span className="material-symbols-outlined alert-icon">
                  task_alt
                </span>
                <div className="alert-content">
                  <strong>FastAPI Server Verified</strong>
                  <p>{serverSuccess}</p>
                </div>
              </div>
            )}

            {/* Sticky Action Bar */}
            <div className="farm-sticky-action-bar">
              <div className="action-bar-status">
                <span className="material-symbols-outlined status-icon">
                  {isSubmitting
                    ? "hourglass_top"
                    : serverSuccess
                    ? "verified"
                    : error
                    ? "warning"
                    : "info"}
                </span>
                <span>
                  {isSubmitting
                    ? "Transmitting parameters to FastAPI validation service…"
                    : serverSuccess
                    ? "All agronomic parameters validated against backend schemas."
                    : error
                    ? "Please correct the highlighted inputs before saving."
                    : "Ready to validate against regional agronomic schemas."}
                </span>
              </div>

              <div className="action-bar-buttons">
                <button
                  type="button"
                  className="farm-action-secondary"
                  onClick={handleResetToDefaults}
                  disabled={isSubmitting}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="farm-action-primary"
                  disabled={isSubmitting}
                >
                  <span className="material-symbols-outlined">
                    {isSubmitting ? "sync" : "save"}
                  </span>
                  <span>
                    {isSubmitting
                      ? "Validating…"
                      : serverSuccess
                      ? "Validated & Saved"
                      : "Save Farm Details"}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Live Real-Time Farm Summary Card */}
        <aside
          className="farm-summary-column"
          aria-label="Real-time farm summary"
        >
          <div className="farm-summary-card">
            {/* Summary Card Header */}
            <div className="summary-card-header">
              <div>
                <h3 className="summary-title">Real-Time Farm Summary</h3>
                <span className="summary-plot-id font-tabular">
                  {hasLocation
                    ? `PLOT • ${farm.location.trim().toUpperCase()}`
                    : "PLOT • UNCONFIGURED"}
                </span>
              </div>
              <div
                className={`summary-badge ${isModified ? "draft" : "synced"}`}
              >
                <span
                  className={`summary-badge-dot ${
                    isModified ? "draft" : "synced"
                  }`}
                ></span>
                {isModified ? "Live Preview" : "Parameters Synced"}
              </div>
            </div>

            {/* Key Metrics Preview List */}
            <div className="summary-metrics-list">
              <div className="summary-metric-row">
                <span className="metric-label">Operable Area</span>
                <span className="metric-value font-tabular">
                  {isAreaValid ? (
                    `${areaNum.toLocaleString()} Acres`
                  ) : (
                    <span className="placeholder-dash">—</span>
                  )}
                </span>
              </div>

              <div className="summary-metric-row">
                <span className="metric-label">Location / District</span>
                <span className="metric-value">
                  {hasLocation ? (
                    farm.location.trim()
                  ) : (
                    <span className="placeholder-dash">—</span>
                  )}
                </span>
              </div>

              <div className="summary-metric-row">
                <span className="metric-label">Growing Season</span>
                <span className="metric-value">
                  {farm.season || <span className="placeholder-dash">—</span>}
                </span>
              </div>

              <div className="summary-metric-row">
                <span className="metric-label">Soil Classification</span>
                <span className="metric-value">
                  {farm.soilType || <span className="placeholder-dash">—</span>}
                </span>
              </div>

              <div className="summary-metric-row">
                <span className="metric-label">Expected Rainfall</span>
                <span className="metric-value font-tabular">
                  {isRainfallValid ? (
                    `${rainfallNum.toLocaleString()} mm`
                  ) : (
                    <span className="placeholder-dash">—</span>
                  )}
                </span>
              </div>

              <div className="summary-metric-row">
                <span className="metric-label">Total Water Reserves</span>
                <div className="metric-value-group">
                  <span className="metric-value font-tabular">
                    {isWaterValid ? (
                      `${waterNum.toLocaleString()} m³`
                    ) : (
                      <span className="placeholder-dash">—</span>
                    )}
                  </span>
                  {waterPerAcre !== null && (
                    <span className="metric-subtext font-tabular">
                      ~{waterPerAcre.toLocaleString()} m³ / Acre
                    </span>
                  )}
                </div>
              </div>

              <div className="summary-metric-row">
                <span className="metric-label">Working Budget</span>
                <div className="metric-value-group">
                  <span className="metric-value font-tabular">
                    {isBudgetValid ? (
                      `₹ ${budgetNum.toLocaleString("en-IN")}`
                    ) : (
                      <span className="placeholder-dash">—</span>
                    )}
                  </span>
                  {perAcreBudget !== null && (
                    <span className="metric-subtext font-tabular">
                      ₹ {perAcreBudget.toLocaleString("en-IN")} / Acre
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Derived Intensity Tiles */}
            <div className="summary-quick-stats">
              <div className="quick-stat-tile">
                <span className="quick-stat-label">Water Allocation</span>
                <span className="quick-stat-value font-tabular">
                  {waterPerAcre !== null
                    ? `${waterPerAcre.toLocaleString()} m³/ac`
                    : "—"}
                </span>
                <span className="quick-stat-caption">Irrigation density</span>
              </div>
              <div className="quick-stat-tile">
                <span className="quick-stat-label">Capital Intensity</span>
                <span className="quick-stat-value font-tabular">
                  {perAcreBudget !== null
                    ? `₹ ${perAcreBudget.toLocaleString("en-IN")}/ac`
                    : "—"}
                </span>
                <span className="quick-stat-caption">Operating capital</span>
              </div>
            </div>

            {/* Parameter Readiness Checklist */}
            <div className="summary-checklist-section">
              <h4 className="checklist-heading">Parameter Readiness Check</h4>
              <ul className="readiness-list">
                <li
                  className={`readiness-item ${
                    isAreaValid && hasLocation ? "ready" : "pending"
                  }`}
                >
                  <span className="material-symbols-outlined check-icon">
                    {isAreaValid && hasLocation
                      ? "check_circle"
                      : "radio_button_unchecked"}
                  </span>
                  <span>Land boundary &amp; district identified</span>
                </li>
                <li
                  className={`readiness-item ${
                    farm.soilType && farm.season ? "ready" : "pending"
                  }`}
                >
                  <span className="material-symbols-outlined check-icon">
                    {farm.soilType && farm.season
                      ? "check_circle"
                      : "radio_button_unchecked"}
                  </span>
                  <span>Soil texture &amp; seasonal cycle selected</span>
                </li>
                <li
                  className={`readiness-item ${
                    isWaterValid && isRainfallValid ? "ready" : "pending"
                  }`}
                >
                  <span className="material-symbols-outlined check-icon">
                    {isWaterValid && isRainfallValid
                      ? "check_circle"
                      : "radio_button_unchecked"}
                  </span>
                  <span>Hydrological reserves &amp; rainfall set</span>
                </li>
                <li
                  className={`readiness-item ${
                    isBudgetValid ? "ready" : "pending"
                  }`}
                >
                  <span className="material-symbols-outlined check-icon">
                    {isBudgetValid
                      ? "check_circle"
                      : "radio_button_unchecked"}
                  </span>
                  <span>Operating capital quota established</span>
                </li>
              </ul>
            </div>

            {/* Workspace Integration Notice */}
            <div className="summary-integration-note">
              <span className="material-symbols-outlined note-icon">hub</span>
              <p>
                Saving parameters updates active constraints across Crop Recommendations, Water Optimization, and Scenario Lab.
              </p>
            </div>

            {/* Subtle Expandable Validated Schema JSON */}
            {initialData && (
              <details className="saved-schema-accordion">
                <summary className="saved-schema-summary">
                  <span className="material-symbols-outlined">data_object</span>
                  <span>Active Workspace Schema (JSON)</span>
                </summary>
                <pre className="saved-schema-pre">
                  {JSON.stringify(initialData, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}