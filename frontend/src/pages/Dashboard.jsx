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
  const feasibleCrops =
    planResult?.all_feasible_crops || planResult?.feasible_crops || [];
  const feasibleCount = feasibleCrops.length;

  let feasibilityStatus;
  let feasibilityDescription;

  if (loadingPlan) {
    feasibilityStatus = "Calculating...";
    feasibilityDescription = "Evaluating crop suitability...";
  } else if (planResult && feasibleCount > 0) {
    feasibilityStatus = "Plan Ready";
    feasibilityDescription = `${feasibleCount} crop(s) meet all conditions`;
  } else if (planError || (planResult && feasibleCount === 0)) {
    feasibilityStatus = "Needs Adjustment";
    feasibilityDescription = "No crops match all conditions; update farm parameters";
  } else {
    feasibilityStatus = "Not Generated";
    feasibilityDescription = "Click button below to find crops";
  }

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
      title: "Land Area",
      value: farmData ? `${farmData.areaAcres} Acres` : "5 Acres",
      description: farmData
        ? `Location: ${farmData.location || "Custom"}`
        : "Standard baseline area (sample)",
      icon: "▧",
    },
    {
      title: "Available Water",
      value: farmData
        ? `${farmData.availableWaterM3.toLocaleString()} m³`
        : "3,000 m³",
      description: farmData
        ? "Seasonal water quota"
        : "Standard baseline water quota",
      icon: "💧",
    },
    {
      title: "Expected Rain",
      value: farmData
        ? `${farmData.expectedRainfallMm.toLocaleString()} mm`
        : "650 mm",
      description: farmData
        ? `Season: ${farmData.season}`
        : "Standard monsoon rainfall",
      icon: "☀",
    },
    {
      title: "Feasible Crops",
      value: feasibilityStatus,
      description: feasibilityDescription,
      icon: "✳",
    },
  ];

  return (
    <div className="dashboard-content">
      <header className="page-header">
        <div>
          <p className="breadcrumb">Workspace / Home</p>
          <h1 className="page-title">Quantum Agri Farm Planner</h1>
          <p className="page-subtitle">
            Smarter Farming. Better Harvests.
          </p>
        </div>

        <div className="workspace-status">
          <span className="status-dot" />
          {farmData
            ? `Active Farm: ${farmData.location || "Configured"} (${farmData.season})`
            : "Demo Farm Profile (Ready to customize)"}
        </div>
      </header>

      <section className="hero-banner">
        <div className="hero-content">
          <span className="eyebrow">SIMPLE &amp; SMART CROP PLANNING</span>

          <h2>Plan your next harvest with confidence.</h2>

          <p>
            Find the most profitable crops suited for your soil, rainfall, water supply,
            and budget — with exact cost and harvest estimates.
          </p>

          <div className="hero-actions">
            <button
              id="generate-plan-btn"
              type="button"
              className="primary-button hero-plan-cta"
              onClick={handleGenerateClick}
              disabled={loadingPlan}
              aria-busy={loadingPlan}
            >
              <span className={`material-symbols-outlined ${loadingPlan ? "spin-icon" : ""}`}>
                {loadingPlan ? "sync" : "analytics"}
              </span>
              <span>
                {loadingPlan
                  ? "Creating Your Farm Plan..."
                  : planResult && feasibleCount > 0
                  ? "Re-run My Farm Plan"
                  : "Create My Farm Plan"}
              </span>
            </button>

            <button
              className="secondary-button"
              onClick={() => onNavigate("My Farm")}
            >
              {farmData ? "Update Farm Details" : "Enter Farm Details"} <span>→</span>
            </button>
          </div>

          {/* Inline immediate feedback in hero */}
          {loadingPlan && (
            <div className="hero-plan-feedback loading" role="status" aria-live="polite">
              <span className="material-symbols-outlined spin-icon">sync</span>
              <span>Calculating crop suitability, water needs, and net profit for your farm...</span>
            </div>
          )}

          {!loadingPlan && (planError || (planResult && feasibleCount === 0)) && (
            <div className="hero-plan-feedback error" role="alert">
              <span className="material-symbols-outlined">warning</span>
              <div className="feedback-text">
                <strong>Farm Planning Notice:</strong>{" "}
                <span>
                  {planError?.body?.detail?.message ||
                    planError?.message ||
                    "No crops match all current farm conditions. Try adjusting your water quota or budget."}
                </span>
              </div>
              <button
                type="button"
                className="feedback-scroll-btn"
                onClick={() => onNavigate("My Farm")}
              >
                Adjust Farm Details →
              </button>
            </div>
          )}

          {!loadingPlan && planResult && feasibleCount > 0 && (
            <div className="hero-plan-feedback success">
              <span className="material-symbols-outlined">check_circle</span>
              <div className="feedback-text">
                <strong>Plan Ready:</strong> Top crop is{" "}
                <strong>{planResult.top_recommendation?.name}</strong> with{" "}
                {feasibleCount} suitable crop option(s).
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
                View Crop Plan Below ↓
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
            onClick={() => onNavigate("My Farm")}
          >
            {farmData ? "Update farm details" : "Configure farm"} <span>→</span>
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
            onClick={() => onNavigate("Crop Planner")}
          >
            Explore water planning →
          </button>
        </article>
      </section>

      {!planResult && (
        <section className="panel crop-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">GENERIC REFERENCE BENCHMARKS</span>
              <h2>General regional crop benchmarks</h2>
              <p>
                Standard agronomic benchmark data for regional reference only.
                This is not a personalized farm plan — click &ldquo;Create My Farm Plan&rdquo; above to calculate actual feasibility.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => onNavigate("Crop Planner")}
            >
              View benchmark table →
            </button>
          </div>

          <div className="crop-grid">
            {defaultCrops.map((crop) => (
              <article className="crop-card" key={crop.name}>
                <div className="crop-card-top">
                  <div className="crop-symbol">🌿</div>
                  <span className="crop-type">{crop.type} (Reference)</span>
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
            <strong>General Reference Only:</strong> Crop durations and water categories are standard ICAR benchmarks.
            Click &ldquo;Create My Farm Plan&rdquo; above to run real feasibility checks against your farm conditions.
          </p>
        </section>
      )}

      <footer className="dashboard-footer">
        <span>Quantum Agri · Crop & Irrigation Planner</span>
        <span>Smarter Farming. Better Harvests.</span>
      </footer>
    </div>
  );
}