/**
 * Quantum Agri — Water Optimization Page
 *
 * Implements a scientifically grounded, mathematically correct water-planning
 * interface. Avoids summing mutually exclusive alternative crop demands and
 * provides transparent scenarios, irrigation efficiency comparisons, and
 * verifiable assumptions.
 */

import { useState, useMemo } from "react";
import { loadFarmPreferences } from "../services/farmStorage";
import WaterSpeechControl from "../components/WaterSpeechControl";

// Standard physical constant: 1 mm depth over 1 acre = 4.0468564 m³
const MM_PER_ACRE_TO_M3 = 4.04686;

// Illustrative benchmark application efficiencies
const DEFAULT_EFFICIENCIES = {
  Drip: 0.90,          // 90%
  Sprinkler: 0.75,     // 75%
  "Surface/Flood": 0.55, // 55% (standard comparison baseline)
};
const BASELINE_METHOD = "Surface/Flood";

export default function WaterOptimization({
  planResult,
  farmData,
  userSavedFarmData,
  isDemonstrationPlan = false,
  loadingPlan = false,
  planError = null,
  onRecalculate,
  onEvaluatePlan,
  onGenerateDemo,
  onSwitchToRealPlan,
  onNavigate,
}) {
  // Load saved farm preferences for initial irrigation method choice
  const savedPrefs = useMemo(() => loadFarmPreferences(), []);
  const initialMethod = savedPrefs?.preferredIrrigationMethod || "Drip";

  const [selectedCropName, setSelectedCropName] = useState(null);
  const [activeMethod, setActiveMethod] = useState(initialMethod);
  const [showConfigEfficiencies, setShowConfigEfficiencies] = useState(false);
  const [efficiencies, setEfficiencies] = useState(DEFAULT_EFFICIENCIES);

  const isDemo = Boolean(
    isDemonstrationPlan ||
    planResult?.isDemonstration ||
    planResult?.isSimulated
  );
  const activeUserFarm = userSavedFarmData || farmData;

  // Available candidate crops from the plan result
  const candidateCrops = useMemo(
    () => planResult?.all_feasible_crops || [],
    [planResult?.all_feasible_crops]
  );
  const topRec = planResult?.top_recommendation;

  // Active crop being evaluated: user-selected or top recommendation
  const activeCrop = useMemo(() => {
    if (selectedCropName && candidateCrops.length > 0) {
      const found = candidateCrops.find(
        (c) => c.name.toLowerCase() === selectedCropName.toLowerCase()
      );
      if (found) return found;
    }
    return topRec || candidateCrops[0] || null;
  }, [selectedCropName, candidateCrops, topRec]);

  // Farm water supply parameters
  const availableSupply = planResult?.water?.total_available_m3 ?? farmData?.availableWaterM3 ?? 0;
  const areaAcres = planResult?.farm_area_acres ?? farmData?.areaAcres ?? 0;
  const expectedRainfallMm =
    planResult?.expected_rainfall_mm ??
    farmData?.expectedRainfallMm ??
    farmData?.rainfall ??
    650;
  const rainfallVolumeM3 = expectedRainfallMm * areaAcres * MM_PER_ACRE_TO_M3;

  // Water balance calculations for the active crop
  const waterBalance = useMemo(() => {
    if (!activeCrop) return null;

    const netDemandM3 = Math.max(0, Number(activeCrop.irrigation_req_m3) || 0);
    const allocatedM3 = Math.min(availableSupply, netDemandM3);
    const remainingM3 = Math.max(0, availableSupply - netDemandM3);
    const deficitM3 = Math.max(0, netDemandM3 - availableSupply);
    const surplusM3 = Math.max(0, availableSupply - netDemandM3);
    const allocationPct =
      availableSupply > 0
        ? Math.round((allocatedM3 / availableSupply) * 1000) / 10
        : netDemandM3 === 0
        ? 0
        : 100;
    const isSufficient = netDemandM3 <= availableSupply;

    return {
      cropName: activeCrop.name,
      waterReqMm: activeCrop.water_req_mm,
      netDemandM3,
      availableSupply,
      allocatedM3,
      remainingM3,
      deficitM3,
      surplusM3,
      allocationPct,
      isSufficient,
    };
  }, [activeCrop, availableSupply]);

  // Irrigation method comparison for the active crop's net demand
  const methodComparisons = useMemo(() => {
    if (!waterBalance) return [];

    const netReq = waterBalance.netDemandM3;
    const baselineEff = efficiencies[BASELINE_METHOD] || 0.55;
    const baselineGross = netReq > 0 ? netReq / baselineEff : 0;

    return Object.entries(efficiencies).map(([method, eff]) => {
      const isBase = method === BASELINE_METHOD;
      if (netReq <= 0) {
        return {
          method,
          effPct: Math.round(eff * 100),
          grossM3: 0,
          savingsM3: 0,
          savingsPct: 0,
          isBase,
          status: "Rain-fed (No Irrigation Needed)",
          isFeasible: true,
        };
      }

      const grossM3 = netReq / eff;
      const savingsM3 = Math.max(0, baselineGross - grossM3);
      const savingsPct = baselineGross > 0 ? (savingsM3 / baselineGross) * 100 : 0;
      const isFeasible = grossM3 <= availableSupply;

      return {
        method,
        effPct: Math.round(eff * 100),
        grossM3: Math.round(grossM3),
        savingsM3: Math.round(savingsM3),
        savingsPct: Math.round(savingsPct * 10) / 10,
        isBase,
        status: isFeasible
          ? "Sufficient Supply"
          : `Deficit: requires +${Math.round(grossM3 - availableSupply).toLocaleString()} m³`,
        isFeasible,
      };
    });
  }, [waterBalance, efficiencies, availableSupply]);

  // Reset custom efficiencies to standard agronomic engineering defaults
  function handleResetEfficiencies() {
    setEfficiencies(DEFAULT_EFFICIENCIES);
  }

  function handleEfficiencyChange(method, value) {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0 && num <= 100) {
      setEfficiencies((prev) => ({
        ...prev,
        [method]: num > 1 ? num / 100 : num,
      }));
    }
  }

  // ---------------------------------------------------------------------------
  // View 1A: Loading State when no previous plan is loaded
  // ---------------------------------------------------------------------------
  if (!planResult && loadingPlan) {
    return (
      <div className="water-opt-page">
        <div className="page-header">
          <div>
            <p className="breadcrumb">Workspace / Crop Planner / Water Optimization</p>
            <h1 className="page-title">Water Optimization</h1>
            <p className="page-subtitle">
              Evaluating crop irrigation requirements against your volumetric reserve.
            </p>
          </div>
        </div>

        <section className="panel empty-water-panel" aria-busy="true" aria-live="polite">
          <div className="empty-water-icon">
            <span className="material-symbols-outlined spin-icon" style={{ fontSize: "48px", color: "var(--color-primary, #059669)" }}>
              sync
            </span>
          </div>
          <h2>Evaluating Water Allocation Plan...</h2>
          <p className="empty-water-desc">
            Evaluating volumetric requirements and ICAR agronomic benchmarks for{" "}
            <strong>{activeUserFarm?.location || "My Farm"} ({activeUserFarm?.areaAcres || 5} ac)</strong>.
            Please wait...
          </p>
          <div className="empty-water-actions">
            <button type="button" className="primary-button" disabled>
              <span className="material-symbols-outlined spin-icon">sync</span>
              Evaluating Plan...
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // View 1B: Empty State (No Plan Available and not currently loading)
  // ---------------------------------------------------------------------------
  if (!planResult) {
    return (
      <div className="water-opt-page">
        <div className="page-header">
          <div>
            <p className="breadcrumb">Workspace / Crop Planner / Water Optimization</p>
            <h1 className="page-title">Water Optimization</h1>
            <p className="page-subtitle">
              Scientifically balance crop irrigation requirements against your volumetric reserve.
            </p>
          </div>
        </div>

        {planError && (
          <aside className="status-banner status-banner-error" role="alert" style={{ marginBottom: 20 }}>
            <span className="material-symbols-outlined status-banner-icon">error</span>
            <div className="status-banner-content">
              <h4>Planning Evaluation Error</h4>
              <p>{planError?.message || planError?.detail || "Failed to reach the planning service."}</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (activeUserFarm && onEvaluatePlan) {
                  onEvaluatePlan(activeUserFarm);
                } else if (onRecalculate) {
                  onRecalculate();
                }
              }}
              style={{ marginLeft: "auto" }}
            >
              Retry
            </button>
          </aside>
        )}

        <section className="panel empty-water-panel">
          <div className="empty-water-icon">
            <span className="material-symbols-outlined">water_drop</span>
          </div>
          <h2>No Farm Water Plan Evaluated Yet</h2>
          <p className="empty-water-desc">
            Water optimization requires your farm’s specific acreage, seasonal rainfall,
            and volumetric irrigation quota. Without an active farm plan, water balances
            cannot be computed reliably.
          </p>

          <div className="empty-water-actions">
            {activeUserFarm ? (
              <button
                id="evaluate-farm-water-btn"
                type="button"
                className="primary-button"
                onClick={() => {
                  if (onEvaluatePlan) {
                    onEvaluatePlan(activeUserFarm);
                  } else {
                    onRecalculate?.(activeUserFarm);
                  }
                }}
                disabled={loadingPlan}
              >
                <span className={`material-symbols-outlined ${loadingPlan ? "spin-icon" : ""}`}>
                  {loadingPlan ? "sync" : "analytics"}
                </span>
                {loadingPlan
                  ? `Evaluating Plan for ${activeUserFarm.location || "My Farm"}...`
                  : `Evaluate Plan for ${activeUserFarm.location || "My Farm"} (${activeUserFarm.areaAcres} ac)`}
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={() => onNavigate?.("My Farm")}
              >
                <span className="material-symbols-outlined">agriculture</span>
                Configure Farm Parameters First
              </button>
            )}

            <button
              id="generate-baseline-demo-btn"
              type="button"
              className="secondary-button"
              onClick={() => {
                if (onGenerateDemo) {
                  onGenerateDemo();
                } else {
                  onRecalculate?.(null, true);
                }
              }}
              disabled={loadingPlan}
              title="Run baseline demonstration plan"
            >
              <span className={`material-symbols-outlined ${loadingPlan ? "spin-icon" : ""}`}>
                {loadingPlan ? "sync" : "science"}
              </span>
              {loadingPlan ? "Generating Demonstration..." : "Generate Baseline Demonstration Plan"}
            </button>
          </div>

          <WaterSpeechControl
            planResult={planResult}
            farmData={farmData}
            activeCrop={activeCrop}
            activeMethod={activeMethod}
          />

          <div className="empty-water-notes">
            <span className="material-symbols-outlined">info</span>
            <span>
              Quantum Agri does not display simulated fallback figures. All volumetric metrics
              are derived directly from your input data and ICAR crop water benchmarks.
            </span>
          </div>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // View 2: Active Plan Result View
  // ---------------------------------------------------------------------------
  return (
    <div className="water-opt-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <p className="breadcrumb">Workspace / Crop Planner / Water Optimization</p>
          <h1 className="page-title">
            Water Optimization &amp; Allocation
            {isDemo && (
              <span className="top-badge" style={{ marginLeft: "10px", fontSize: "12px", verticalAlign: "middle" }}>
                Simulated Demo
              </span>
            )}
          </h1>
          <p className="page-subtitle">
            Evaluate volumetric supply, compare candidate crop demands, and optimize irrigation application efficiency.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => onNavigate?.("My Farm")}
            title="Update water reserve or acreage"
          >
            <span className="material-symbols-outlined">tune</span>
            Edit Farm Inputs
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => onRecalculate?.()}
            disabled={loadingPlan}
            title="Re-run planning evaluation"
          >
            <span className={`material-symbols-outlined ${loadingPlan ? "spin-icon" : ""}`}>
              {loadingPlan ? "sync" : "refresh"}
            </span>
            {loadingPlan ? "Recalculating..." : "Recalculate Water"}
          </button>
        </div>
      </div>

      {/* Prominent Demo / Simulated Alert Banner */}
      {isDemo && (
        <aside
          id="demo-plan-banner"
          className="farmer-alert-box info"
          style={{ marginBottom: "20px" }}
          role="status"
        >
          <span className="material-symbols-outlined farmer-alert-icon">science</span>
          <div className="farmer-alert-text" style={{ flex: 1 }}>
            <strong>SIMULATED BASELINE DEMONSTRATION PLAN:</strong>
            <span>
              This scenario is computed from standard ICAR benchmark data for a sample 5-acre farm
              in Bengaluru (Loamy soil, 4,000 m³ reserve). All volumetric results are simulated demonstrations.
              {activeUserFarm?.location && (
                <>
                  {" "}Your saved farm parameters for <strong>{activeUserFarm.location} ({activeUserFarm.areaAcres} ac)</strong> remain intact.
                </>
              )}
            </span>
          </div>
          {activeUserFarm && onEvaluatePlan && (
            <button
              id="switch-to-real-plan-btn"
              type="button"
              className="primary-button"
              style={{ fontSize: "13px", padding: "6px 14px", marginLeft: "12px", whiteSpace: "nowrap" }}
              onClick={() => {
                if (onSwitchToRealPlan) {
                  onSwitchToRealPlan();
                } else {
                  onEvaluatePlan(activeUserFarm);
                }
              }}
              disabled={loadingPlan}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                agriculture
              </span>
              Evaluate My Farm ({activeUserFarm.location || "My Farm"})
            </button>
          )}
        </aside>
      )}

      {planError && (
        <aside className="status-banner status-banner-error" role="alert" style={{ marginBottom: 20 }}>
          <span className="material-symbols-outlined status-banner-icon">error</span>
          <div className="status-banner-content">
            <h4>Plan Calculation Alert</h4>
            <p>{planError?.message || planError?.detail || "Unable to recalculate water plan."}</p>
          </div>
        </aside>
      )}

      {/* Spoken Water Results Assistant Bar */}
      <WaterSpeechControl
        planResult={planResult}
        farmData={farmData}
        activeCrop={activeCrop}
        activeMethod={activeMethod}
      />

      {/* Section A: Water Balance for Selected Crop */}
      <section className="panel water-balance-panel" aria-labelledby="heading-water-balance">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">VOLUMETRIC BALANCE</span>
            <h2 id="heading-water-balance">Scenario Water Balance</h2>
            <p>
              Volumetric allocation evaluated for <strong>{areaAcres} acres</strong> in{" "}
              <strong>{planResult?.location || farmData?.location || "Region"}</strong> (
              {planResult?.season || farmData?.season} season).
            </p>
          </div>

          {/* Crop Selector Control */}
          {candidateCrops.length > 1 && (
            <div className="crop-selector-control">
              <label htmlFor="crop-scenario-select">
                <span className="material-symbols-outlined">psychiatry</span>
                Evaluate Crop Scenario:
              </label>
              <select
                id="crop-scenario-select"
                value={activeCrop?.name || ""}
                onChange={(e) => setSelectedCropName(e.target.value)}
                className="crop-select-dropdown"
              >
                {candidateCrops.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} {c.name === topRec?.name ? "(Top Recommended)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {waterBalance && (
          <div className="water-balance-body">
            {/* Metric KPI Cards */}
            <div className="water-metrics-grid">
              <div className="water-metric-card">
                <div className="metric-header">
                  <span className="metric-label">Available Supply</span>
                  <span className="material-symbols-outlined metric-icon">water_drop</span>
                </div>
                <div className="metric-value">
                  {Math.round(waterBalance.availableSupply).toLocaleString()}{" "}
                  <span className="metric-unit">m³</span>
                </div>
                <span className="metric-caption">Total allocated farm reserve</span>
              </div>

              <div className="water-metric-card">
                <div className="metric-header">
                  <span className="metric-label">Net Irrigation Demand</span>
                  <span className="material-symbols-outlined metric-icon">psychiatry</span>
                </div>
                <div className="metric-value">
                  {Math.round(waterBalance.netDemandM3).toLocaleString()}{" "}
                  <span className="metric-unit">m³</span>
                </div>
                <span className="metric-caption">
                  For {activeCrop.name} ({areaAcres} ac)
                </span>
              </div>

              <div className="water-metric-card">
                <div className="metric-header">
                  <span className="metric-label">Allocated Water</span>
                  <span className="material-symbols-outlined metric-icon">task_alt</span>
                </div>
                <div className="metric-value">
                  {Math.round(waterBalance.allocatedM3).toLocaleString()}{" "}
                  <span className="metric-unit">m³</span>
                </div>
                <span className="metric-caption">
                  {waterBalance.allocationPct}% of available supply
                </span>
              </div>

              <div className={`water-metric-card ${waterBalance.deficitM3 > 0 ? "metric-alert-card" : "metric-success-card"}`}>
                <div className="metric-header">
                  <span className="metric-label">
                    {waterBalance.deficitM3 > 0 ? "Water Deficit" : "Remaining Buffer"}
                  </span>
                  <span className="material-symbols-outlined metric-icon">
                    {waterBalance.deficitM3 > 0 ? "warning" : "check_circle"}
                  </span>
                </div>
                <div className="metric-value">
                  {waterBalance.deficitM3 > 0
                    ? `-${Math.round(waterBalance.deficitM3).toLocaleString()}`
                    : `+${Math.round(waterBalance.surplusM3).toLocaleString()}`}{" "}
                  <span className="metric-unit">m³</span>
                </div>
                <span className="metric-caption">
                  {waterBalance.deficitM3 > 0
                    ? "Demand exceeds available supply"
                    : "Available buffer after crop irrigation"}
                </span>
              </div>
            </div>

            {/* Visual Allocation Progress Bar */}
            <div className="water-progress-section">
              <div className="water-progress-header">
                <div className="water-progress-status">
                  <span className="status-label">Allocation Utilization:</span>
                  <strong>{waterBalance.allocationPct}%</strong>
                  {waterBalance.deficitM3 > 0 ? (
                    <span className="deficit-chip">Deficit Warning</span>
                  ) : waterBalance.allocationPct <= 75 ? (
                    <span className="surplus-chip">Safe Buffer</span>
                  ) : (
                    <span className="moderate-chip">High Utilization</span>
                  )}
                </div>
                <div className="water-progress-remainder">
                  {waterBalance.deficitM3 > 0 ? (
                    <span>Requires <strong>+{Math.round(waterBalance.deficitM3).toLocaleString()} m³</strong> additional supply</span>
                  ) : (
                    <span>Buffer: <strong>{Math.round(waterBalance.remainingM3).toLocaleString()} m³</strong></span>
                  )}
                </div>
              </div>

              <div className="water-progress-bar-track">
                <div
                  className={`water-progress-bar-fill ${
                    waterBalance.deficitM3 > 0
                      ? "fill-deficit"
                      : waterBalance.allocationPct > 85
                      ? "fill-warning"
                      : "fill-safe"
                  }`}
                  style={{ width: `${Math.min(100, waterBalance.allocationPct)}%` }}
                />
              </div>
            </div>

            {/* Rainfall Contribution Note */}
            <div className="water-rainfall-banner">
              <span className="material-symbols-outlined banner-icon">cloud</span>
              <div className="banner-text">
                <strong>Precipitation Offset: </strong>
                <span>
                  Expected seasonal rainfall ({expectedRainfallMm} mm = ~
                  {Math.round(rainfallVolumeM3).toLocaleString()} m³ across {areaAcres} ac)
                  is subtracted from {activeCrop.name}&rsquo;s total water requirement (
                  {activeCrop.water_req_mm} mm), leaving a net supplemental requirement of{" "}
                  <strong>{Math.round(waterBalance.netDemandM3).toLocaleString()} m³</strong>.
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Section B: Candidate Crop Scenario Comparison */}
      <section className="panel candidate-comparison-panel" aria-labelledby="heading-crop-comparison">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">SCENARIO COMPARISON</span>
            <h2 id="heading-crop-comparison">Candidate Crop Demand Comparison</h2>
            <p>
              Compare irrigation requirements across feasible crops for your farm.
            </p>
          </div>
        </div>

        <div className="scenario-notice-banner">
          <span className="material-symbols-outlined">info</span>
          <p>
            <strong>Scenario Model:</strong> Candidate crops below represent <em>alternative</em> planning
            options for your entire {areaAcres}-acre farm. Their water demands are not summed together because
            they represent mutually exclusive choices, not simultaneous cultivation on the same land.
          </p>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Crop Option</th>
                <th>Total Need (mm)</th>
                <th>Net Irrigation (m³)</th>
                <th>Available Supply</th>
                <th>Net Balance (m³)</th>
                <th>Supply Status</th>
                <th>Scenario</th>
              </tr>
            </thead>
            <tbody>
              {candidateCrops.map((crop) => {
                const reqM3 = Math.max(0, Number(crop.irrigation_req_m3) || 0);
                const isSelected = activeCrop?.name === crop.name;
                const isTop = topRec?.name === crop.name;
                const balanceM3 = availableSupply - reqM3;
                const isSufficient = reqM3 <= availableSupply;

                return (
                  <tr key={crop.name} className={isSelected ? "highlighted-row" : ""}>
                    <td>
                      <div className="crop-cell-content">
                        <strong>{crop.name}</strong>
                        {isTop && <span className="top-badge">Top Recommendation</span>}
                        {isSelected && <span className="selected-badge">Active in Balance</span>}
                      </div>
                    </td>
                    <td>{crop.water_req_mm} mm</td>
                    <td>
                      <strong>{Math.round(reqM3).toLocaleString()} m³</strong>
                    </td>
                    <td>{Math.round(availableSupply).toLocaleString()} m³</td>
                    <td>
                      <span className={balanceM3 >= 0 ? "balance-positive" : "balance-negative"}>
                        {balanceM3 >= 0
                          ? `+${Math.round(balanceM3).toLocaleString()} m³`
                          : `-${Math.round(Math.abs(balanceM3)).toLocaleString()} m³`}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          reqM3 === 0
                            ? "pill-rainfed"
                            : isSufficient
                            ? "pill-sufficient"
                            : "pill-deficit"
                        }`}
                      >
                        {reqM3 === 0
                          ? "Rain-fed"
                          : isSufficient
                          ? "Sufficient"
                          : "Deficit"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`action-link-btn ${isSelected ? "action-active" : ""}`}
                        onClick={() => setSelectedCropName(crop.name)}
                      >
                        {isSelected ? "Active" : "Evaluate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section C: Irrigation Method Comparison */}
      <section className="panel irrigation-methods-panel" aria-labelledby="heading-irrigation-methods">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">EFFICIENCY COMPARISON</span>
            <h2 id="heading-irrigation-methods">Irrigation Method Comparison</h2>
            <p>
              Gross water withdrawal required by <strong>{activeCrop?.name || "selected crop"}</strong> under
              different irrigation delivery systems.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowConfigEfficiencies(!showConfigEfficiencies)}
          >
            <span className="material-symbols-outlined">tune</span>
            {showConfigEfficiencies ? "Hide Efficiencies" : "Adjust Efficiencies"}
          </button>
        </div>

        {/* Configurable Efficiency Inputs */}
        {showConfigEfficiencies && (
          <div className="efficiency-config-box">
            <div className="config-header">
              <h4>Configurable Application Efficiencies</h4>
              <button
                type="button"
                className="text-action-btn"
                onClick={handleResetEfficiencies}
              >
                Reset to Standards
              </button>
            </div>
            <p className="config-desc">
              Application efficiency represents the fraction of pumped water that reaches the crop root zone.
              Adjust assumptions to reflect your farm&rsquo;s field conditions.
            </p>
            <div className="efficiency-inputs-grid">
              {Object.entries(efficiencies).map(([method, eff]) => (
                <div key={method} className="eff-input-group">
                  <label htmlFor={`eff-input-${method}`}>{method}</label>
                  <div className="eff-input-wrapper">
                    <input
                      id={`eff-input-${method}`}
                      type="number"
                      min="10"
                      max="100"
                      step="1"
                      value={Math.round(eff * 100)}
                      onChange={(e) => handleEfficiencyChange(method, e.target.value)}
                    />
                    <span className="input-suffix">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Method Comparison Cards */}
        <div className="method-cards-grid">
          {methodComparisons.map((m) => {
            const isPreferred = activeMethod === m.method;

            return (
              <div
                key={m.method}
                className={`method-card ${isPreferred ? "method-card-preferred" : ""}`}
                onClick={() => setActiveMethod(m.method)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setActiveMethod(m.method);
                }}
              >
                <div className="method-card-header">
                  <div className="method-title-group">
                    <h3>{m.method}</h3>
                    {m.isBase && <span className="baseline-tag">Baseline</span>}
                    {isPreferred && <span className="preferred-tag">Preferred</span>}
                  </div>
                  <span className="eff-badge">{m.effPct}% Eff.</span>
                </div>

                <div className="method-card-metrics">
                  <div className="method-metric">
                    <span className="metric-label">Estimated Gross Withdrawal</span>
                    <span className="metric-number">
                      {m.grossM3.toLocaleString()} <span className="unit">m³</span>
                    </span>
                  </div>

                  <div className="method-metric">
                    <span className="metric-label">Water Savings vs Surface/Flood</span>
                    <span className={`metric-number ${m.savingsM3 > 0 ? "savings-positive" : ""}`}>
                      {m.savingsM3 > 0
                        ? `${m.savingsPct}% (${m.savingsM3.toLocaleString()} m³)`
                        : "0% (Baseline)"}
                    </span>
                  </div>
                </div>

                <div className="method-card-footer">
                  <span
                    className={`status-indicator ${
                      m.isFeasible ? "status-ok" : "status-warning"
                    }`}
                  >
                    <span className="material-symbols-outlined">
                      {m.isFeasible ? "check_circle" : "error"}
                    </span>
                    {m.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="sample-notice" style={{ marginTop: 16 }}>
          <strong>Formula Note:</strong> Gross Irrigation Withdrawal = Net Crop Irrigation Demand ÷ Application Efficiency.
          Savings are calculated relative to traditional Surface/Flood irrigation (55% baseline efficiency).
        </p>
      </section>

      {/* Section D: Data Quality and Agronomic Assumptions */}
      <section className="panel data-assumptions-panel" aria-labelledby="heading-assumptions">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">METHODOLOGY &amp; ASSUMPTIONS</span>
            <h2 id="heading-assumptions">Data Quality &amp; Agronomic Assumptions</h2>
            <p>
              Full transparency on input sources, physical constants, and calculation bounds.
            </p>
          </div>
        </div>

        <div className="assumptions-grid">
          <div className="assumption-card">
            <div className="assumption-header">
              <span className="material-symbols-outlined">person</span>
              <h4>User Farm Inputs</h4>
            </div>
            <ul>
              <li><strong>Farm Footprint:</strong> {areaAcres} acres {isDemo ? "(Sample Benchmark)" : ""}</li>
              <li><strong>Irrigation Supply:</strong> {Math.round(availableSupply).toLocaleString()} m³ {isDemo ? "(Sample Quota)" : ""}</li>
              <li><strong>Expected Rainfall:</strong> {expectedRainfallMm} mm (~{Math.round(rainfallVolumeM3).toLocaleString()} m³)</li>
              <li><strong>Agro-District:</strong> {planResult?.location || farmData?.location || "Not specified"} {isDemo ? "(Demonstration)" : ""}</li>
            </ul>
          </div>

          <div className="assumption-card">
            <div className="assumption-header">
              <span className="material-symbols-outlined">menu_book</span>
              <h4>Crop Benchmarks (ICAR)</h4>
            </div>
            <ul>
              <li><strong>Reference Source:</strong> ICAR Crop Production Manuals (2023–24)</li>
              <li><strong>Water Requirement:</strong> Seasonal ETc in millimetres (mm)</li>
              <li><strong>Net Demand:</strong> max(0, ETc - Expected Rainfall)</li>
              <li><strong>Scope:</strong> Benchmark estimates, not live sensor readings</li>
            </ul>
          </div>

          <div className="assumption-card">
            <div className="assumption-header">
              <span className="material-symbols-outlined">functions</span>
              <h4>Physical Conversions</h4>
            </div>
            <ul>
              <li><strong>Acre-to-m³ Factor:</strong> 1 mm over 1 acre = 4.04686 m³</li>
              <li><strong>Efficiency Formula:</strong> Gross = Net ÷ Efficiency Fraction</li>
              <li><strong>Baseline Reference:</strong> Surface/Flood at 55% application efficiency</li>
              <li><strong>Surplus Buffer:</strong> Supply − Net Demand (capped at 0)</li>
            </ul>
          </div>
        </div>

        <div className="assumptions-disclaimer">
          <span className="material-symbols-outlined">verified</span>
          <p>
            <strong>Disclaimer:</strong> All volumetric figures are calculated from reference agronomic models
            and user-provided farm boundaries. Field-level performance varies with soil infiltration rate,
            evapotranspiration, salinity, and delivery piping. These figures should be used as planning
            guidelines rather than precision metering.
          </p>
        </div>
      </section>
    </div>
  );
}
