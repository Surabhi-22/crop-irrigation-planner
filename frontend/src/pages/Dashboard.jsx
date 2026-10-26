import { useRef } from "react";
import PlanResults from "../components/PlanResults";

const defaultCrops = [
  {
    name: "Rice",
    type: "Grain",
    water: "High",
    duration: "120–150 days",
    suitability: "Season-dependent",
  },
  {
    name: "Wheat",
    type: "Cereal",
    water: "Medium",
    duration: "110–140 days",
    suitability: "Season-dependent",
  },
  {
    name: "Maize",
    type: "Grain",
    water: "Medium",
    duration: "90–120 days",
    suitability: "Season-dependent",
  },
  {
    name: "Millets",
    type: "Cereal",
    water: "Low",
    duration: "75–100 days",
    suitability: "Potentially water-efficient",
  },
];

export default function Dashboard({
  onNavigate,
  farmData,
  planResult,
  loadingPlan,
  planError,
  onGeneratePlan,
}) {
  const planSectionRef = useRef(null);
  const feasibleCount = planResult?.all_feasible_crops?.length;

  const handleGenerateClick = () => {
    if (typeof onGeneratePlan === "function") {
      onGeneratePlan();
    }
    // Smoothly reveal results/feedback section
    setTimeout(() => {
      planSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const metrics = [
    {
      title: "Cultivation Area",
      value: farmData ? `${farmData.areaAcres} acres` : "5 acres",
      description: farmData
        ? `Saved area${farmData.location ? ` (${farmData.location})` : ""}`
        : "Example cultivation area (sample)",
      icon: "▧",
    },
    {
      title: "Available Water",
      value: farmData
        ? `${farmData.availableWaterM3.toLocaleString()} m³`
        : "3,000 m³",
      description: farmData
        ? "Saved irrigation quota"
        : "Example available water (sample)",
      icon: "💧",
    },
    {
      title: "Expected Rainfall",
      value: farmData
        ? `${farmData.expectedRainfallMm.toLocaleString()} mm`
        : "650 mm",
      description: farmData
        ? `Seasonal norm (${farmData.season})`
        : "Example seasonal rainfall (sample)",
      icon: "☀",
    },
    {
      title: "Feasible Options",
      value: planResult ? String(feasibleCount) : "4",
      description: planResult
        ? `${feasibleCount} crop(s) satisfy all gates`
        : "Reference cultivars available",
      icon: "✳",
    },
  ];

  return (
    <div className="dashboard-content">
      <header className="page-header">
        <div>
          <p className="breadcrumb">Workspace / Dashboard</p>
          <h1 className="page-title">Crop & Irrigation Planner</h1>
          <p className="page-subtitle">
            Plan better crops. Use every drop wisely.
          </p>
        </div>

        <div className="workspace-status">
          <span className="status-dot" />
          {farmData
            ? `Active Farm: ${farmData.location || "Configured"} (${farmData.season})`
            : "Planning workspace (Sample Mode)"}
        </div>
      </header>

      <section className="hero-banner">
        <div className="hero-content">
          <span className="eyebrow">AGRICULTURAL INTELLIGENCE WORKSPACE</span>

          <h2>Plan crops with real agronomic models.</h2>

          <p>
            Evaluate crop suitability, allocate volumetric water quotas, and compute
            indicative yields and net margins based on ICAR benchmark standards.
          </p>

          <div className="hero-actions">
            <button
              id="generate-plan-btn"
              className="primary-button hero-plan-cta"
              onClick={handleGenerateClick}
              disabled={loadingPlan}
              aria-busy={loadingPlan}
            >
              <span className="material-symbols-outlined">
                {loadingPlan ? "sync" : "analytics"}
              </span>
              <span>
                {loadingPlan
                  ? "Evaluating Feasibility..."
                  : planResult
                  ? "Re-run Crop & Water Plan"
                  : "Generate Crop & Irrigation Plan"}
              </span>
            </button>

            <button
              className="secondary-button"
              onClick={() => onNavigate("Farm Details")}
            >
              {farmData ? "Edit Farm Parameters" : "Configure Farm"} <span>→</span>
            </button>
          </div>

          {/* Inline immediate feedback in hero */}
          {loadingPlan && (
            <div className="hero-plan-feedback loading" role="status" aria-live="polite">
              <span className="material-symbols-outlined spin-icon">sync</span>
              <span>Evaluating 4-gate agronomic feasibility against ICAR models...</span>
            </div>
          )}

          {!loadingPlan && planError && (
            <div className="hero-plan-feedback error" role="alert">
              <span className="material-symbols-outlined">warning</span>
              <div className="feedback-text">
                <strong>Agronomic Constraint Notice:</strong>{" "}
                <span>
                  {planError.body?.detail?.message ||
                    planError.message ||
                    "Unable to find feasible crops under current constraints."}
                </span>
              </div>
              <button
                type="button"
                className="feedback-scroll-btn"
                onClick={() =>
                  planSectionRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
              >
                View Suggestions ↓
              </button>
            </div>
          )}

          {!loadingPlan && planResult && (
            <div className="hero-plan-feedback success">
              <span className="material-symbols-outlined">check_circle</span>
              <div className="feedback-text">
                <strong>Plan Generated:</strong> Top recommendation is{" "}
                <strong>{planResult.top_recommendation?.name}</strong> (
                {planResult.all_feasible_crops?.length} passing options).
              </div>
              <button
                type="button"
                className="feedback-scroll-btn"
                onClick={() =>
                  planSectionRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
              >
                View Plan Breakdown ↓
              </button>
            </div>
          )}
        </div>

        <div className="hero-decoration" aria-hidden="true">
          <span>🌱</span>
          <span>🌾</span>
          <span>🍃</span>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Farm overview">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.title}>
            <div className="metric-heading">
              <span className="metric-icon">{metric.icon}</span>
              <span>{metric.title}</span>
            </div>

            <div className="metric-value">{metric.value}</div>
            <p className="metric-description">{metric.description}</p>
          </article>
        ))}
      </section>

      {/* Real Plan Results View when Loading, Errored, or Computed */}
      {(loadingPlan || planError || planResult) && (
        <section
          ref={planSectionRef}
          id="plan-results"
          className="dashboard-plan-section"
        >
          <PlanResults
            plan={planResult}
            loading={loadingPlan}
            error={planError}
            onRegenerate={onGeneratePlan}
            onEditFarm={() => onNavigate("Farm Details")}
          />
        </section>
      )}

      <section className="dashboard-grid">
        <article className="panel farm-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">FARM CONFIGURATION</span>
              <h2>{farmData ? "Your farm summary" : "Tell us about your farm"}</h2>
              <p>
                {farmData
                  ? `Configured for ${farmData.location || "your farm"} (${farmData.soilType} soil).`
                  : "Start by entering your farm's conditions."}
              </p>
            </div>

            <span className="panel-icon">⌘</span>
          </div>

          <div className="farm-summary">
            <div>
              <span>{farmData ? "Cultivation area" : "Example cultivation area"}</span>
              <strong>{farmData ? `${farmData.areaAcres} acres` : "5 acres"}</strong>
            </div>

            <div>
              <span>{farmData ? "Water reserve" : "Example water reserve"}</span>
              <strong>
                {farmData
                  ? `${farmData.availableWaterM3.toLocaleString()} m³`
                  : "3,000 m³"}
              </strong>
            </div>

            <div>
              <span>{farmData ? "Seasonal rainfall" : "Example rainfall"}</span>
              <strong>
                {farmData
                  ? `${farmData.expectedRainfallMm.toLocaleString()} mm`
                  : "650 mm"}
              </strong>
            </div>

            {farmData && (
              <>
                <div>
                  <span>Soil classification</span>
                  <strong>{farmData.soilType}</strong>
                </div>
                <div>
                  <span>Working budget</span>
                  <strong>₹{farmData.budget.toLocaleString()}</strong>
                </div>
              </>
            )}
          </div>

          <p className="sample-notice">
            {farmData
              ? "Displaying your saved farm parameters. You can edit them at any time in Farm Details."
              : "These are demonstration values. Enter your farm details to customize and optimize."}
          </p>

          <button
            className="primary-button"
            onClick={() => onNavigate("Farm Details")}
          >
            {farmData ? "Edit farm details" : "Configure farm"} <span>→</span>
          </button>
        </article>

        <article className="panel water-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">RESOURCE OVERVIEW</span>
              <h2>Water planning</h2>
              <p>Plan crop choices around available water.</p>
            </div>

            <span className="panel-icon">💧</span>
          </div>

          <div className="water-visual">
            <div className="water-ring">
              <div>
                <strong>
                  {farmData
                    ? farmData.availableWaterM3.toLocaleString()
                    : "3,000"}
                </strong>
                <span>m³ {farmData ? "quota" : "available"}</span>
              </div>
            </div>
          </div>

          <p className="sample-notice">
            {farmData
              ? `Water quota for ${farmData.areaAcres} acres in ${farmData.season} season.`
              : "Demonstration water budget."}
          </p>

          <button
            className="secondary-button"
            onClick={() => onNavigate("Water Optimization")}
          >
            Explore water planning →
          </button>
        </article>
      </section>

      {!planResult && (
        <section className="panel crop-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">CROP EXPLORER</span>
              <h2>Compare reference crop options</h2>
              <p>
                Initial reference information. Suitability must be evaluated
                using farm conditions and model outputs.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => onNavigate("Crop Recommendations")}
            >
              View recommendations →
            </button>
          </div>

          <div className="crop-grid">
            {defaultCrops.map((crop) => (
              <article className="crop-card" key={crop.name}>
                <div className="crop-card-top">
                  <div className="crop-symbol">🌿</div>
                  <span className="crop-type">{crop.type}</span>
                </div>

                <h3>{crop.name}</h3>

                <div className="crop-detail">
                  <span>Relative water demand</span>
                  <strong>{crop.water}</strong>
                </div>

                <div className="crop-detail">
                  <span>Example duration</span>
                  <strong>{crop.duration}</strong>
                </div>

                <p className="crop-note">{crop.suitability}</p>
              </article>
            ))}
          </div>

          <p className="sample-notice">
            Crop durations and water-demand categories are indicative examples.
            Click &ldquo;Generate Crop &amp; Irrigation Plan&rdquo; above to run real feasibility checks.
          </p>
        </section>
      )}

      <footer className="dashboard-footer">
        <span>CropWise · Crop & Irrigation Planner</span>
        <span>Predict. Optimize. Grow Smarter.</span>
      </footer>
    </div>
  );
}