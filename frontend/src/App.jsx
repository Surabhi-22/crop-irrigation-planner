import { useState } from "react";

import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import FarmForm from "./components/FarmForm";
import Dashboard from "./pages/Dashboard";
import PlanResults from "./components/PlanResults";
import { generatePlan } from "./services/farmApi";
import {
  loadSavedFarmData,
  saveFarmDataToStorage,
  clearSavedFarmData,
} from "./services/farmStorage";

// Auth
import { useAuth } from "./context/AuthContext";
import { signOut } from "./lib/supabaseClient";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

import "./App.css";

const defaultBaselineFarm = {
  areaAcres: 5.0,
  soilType: "Loamy",
  expectedRainfallMm: 650.0,
  availableWaterM3: 5000.0,
  location: "Bengaluru",
  season: "Kharif",
  budget: 100000.0,
};

function App() {
  // ── Auth state ────────────────────────────────────────
  const { user, loading: authLoading, authError, clearAuthError } = useAuth();
  // "login" | "signup" | "forgot"
  const [authView, setAuthView] = useState(() => {
    try {
      const intent =
        typeof window !== "undefined"
          ? sessionStorage.getItem("quantum_agri_auth_intent")
          : null;
      if (intent === "signup") return "signup";
    } catch {
      // ignore
    }
    return "login";
  });

  // ── App page state ────────────────────────────────────
  const [activePage, setActivePage] = useState("Home");
  const [plannerSubTab, setPlannerSubTab] = useState("recommendations");

  const [farmData, setFarmData] = useState(() => loadSavedFarmData());
  const [notification, setNotification] = useState(null);

  const [planResult, setPlanResult] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState(null);

  function handleNavigate(page) {
    if (page === "Water Optimization") {
      setActivePage("Crop Planner");
      setPlannerSubTab("water");
    } else if (page === "Market Insights") {
      setActivePage("Crop Planner");
      setPlannerSubTab("market");
    } else if (page === "Scenario Lab") {
      setActivePage("Crop Planner");
      setPlannerSubTab("scenario");
    } else if (page === "Crop Recommendations" || page === "Crop Planner") {
      setActivePage("Crop Planner");
      setPlannerSubTab("recommendations");
    } else if (page === "Farm Details" || page === "My Farm") {
      setActivePage("My Farm");
    } else if (page === "Planning History" || page === "My Plans") {
      setActivePage("My Plans");
    } else if (page === "Dashboard" || page === "Overview" || page === "Home") {
      setActivePage("Home");
    } else {
      setActivePage(page);
    }
  }

  async function handleGeneratePlan(overrideData) {
    const isFarmObject =
      overrideData &&
      typeof overrideData === "object" &&
      !overrideData.nativeEvent &&
      !overrideData.target &&
      (overrideData.areaAcres !== undefined ||
        overrideData.area !== undefined ||
        overrideData.area_acres !== undefined);

    const savedFarm = loadSavedFarmData();
    const dataToPlan =
      (isFarmObject ? overrideData : null) || savedFarm || farmData || defaultBaselineFarm;

    setLoadingPlan(true);
    setPlanError(null);

    // Guaranteed minimum visual feedback duration (350ms) so fast localhost responses
    // show a visible loading state to users
    const minDelay = new Promise((resolve) => setTimeout(resolve, 350));

    try {
      const [result] = await Promise.all([
        generatePlan(dataToPlan),
        minDelay,
      ]);
      setPlanResult(result);
      setPlanError(null);
    } catch (err) {
      await minDelay;
      setPlanError(err);
      setPlanResult(null);
    } finally {
      setLoadingPlan(false);
    }
  }

  function handleFarmSubmit(data, message) {
    setFarmData(data);
    saveFarmDataToStorage(data);
    setNotification(
      message || "Farm details successfully saved to workspace."
    );
    // Automatically trigger agricultural plan evaluation for the updated farm
    handleGeneratePlan(data);
    setActivePage("Crop Planner");
    setPlannerSubTab("recommendations");
  }

  function handleFarmReset() {
    clearSavedFarmData();
    setFarmData(null);
    setPlanResult(null);
    setPlanError(null);
    setNotification(null);
  }

  function renderCropPlannerContent() {
    return (
      <div className="page-content">
        {/* Simplified Sub-Navigation Pills */}
        <div className="planner-subnav-bar" role="tablist" aria-label="Crop Planner Sections">
          <button
            type="button"
            className={`subnav-pill ${plannerSubTab === "recommendations" ? "active" : ""}`}
            onClick={() => setPlannerSubTab("recommendations")}
            role="tab"
            aria-selected={plannerSubTab === "recommendations"}
          >
            <span className="material-symbols-outlined">psychiatry</span>
            Recommended Crops
          </button>
          <button
            type="button"
            className={`subnav-pill ${plannerSubTab === "water" ? "active" : ""}`}
            onClick={() => setPlannerSubTab("water")}
            role="tab"
            aria-selected={plannerSubTab === "water"}
          >
            <span className="material-symbols-outlined">water_drop</span>
            Water Planning
          </button>
          <button
            type="button"
            className={`subnav-pill ${plannerSubTab === "market" ? "active" : ""}`}
            onClick={() => setPlannerSubTab("market")}
            role="tab"
            aria-selected={plannerSubTab === "market"}
          >
            <span className="material-symbols-outlined">trending_up</span>
            Market Trends
          </button>
          <button
            type="button"
            className={`subnav-pill ${plannerSubTab === "scenario" ? "active" : ""}`}
            onClick={() => setPlannerSubTab("scenario")}
            role="tab"
            aria-selected={plannerSubTab === "scenario"}
          >
            <span className="material-symbols-outlined">science</span>
            Scenario Lab
          </button>
        </div>

        {plannerSubTab === "recommendations" && (
          <div>
            <div className="page-header">
              <div>
                <p className="breadcrumb">Workspace / Crop Planner</p>
                <h1 className="page-title">Crop Recommendations</h1>
                <p className="page-subtitle">
                  Compare candidate crops against your soil, rainfall, water supply, and budget.
                </p>
              </div>

              <button
                type="button"
                className="primary-button hero-plan-cta"
                onClick={() => handleGeneratePlan()}
                disabled={loadingPlan}
              >
                <span className={`material-symbols-outlined ${loadingPlan ? "spin-icon" : ""}`}>
                  {loadingPlan ? "sync" : "analytics"}
                </span>
                <span>
                  {loadingPlan
                    ? "Checking Farm Plan..."
                    : planResult
                    ? "Re-run Farm Plan"
                    : "Create My Farm Plan"}
                </span>
              </button>
            </div>

            {loadingPlan || planError || planResult ? (
              <PlanResults
                plan={planResult}
                loading={loadingPlan}
                error={planError}
                onRegenerate={() => handleGeneratePlan()}
                onEditFarm={() => handleNavigate("My Farm")}
              />
            ) : (
              <section className="panel">
                <div className="farmer-alert-box info" style={{ marginBottom: "20px" }}>
                  <span className="material-symbols-outlined farmer-alert-icon">info</span>
                  <div className="farmer-alert-text">
                    <strong>General Reference Data Only:</strong>
                    <span>
                      The benchmark crops below are standard national ICAR guidelines, not your personalized farm recommendations.
                      To calculate which crops are feasible for your specific soil ({farmData ? farmData.soilType : "Loamy"}), water reserve ({farmData ? `${farmData.availableWaterM3.toLocaleString()} m³` : "3,000 m³"}), and budget ({farmData ? `₹${farmData.budget.toLocaleString()}` : "₹1,00,000"}), click <strong>&ldquo;Create My Farm Plan&rdquo;</strong> above.
                    </span>
                  </div>
                </div>

                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">GENERIC REFERENCE BENCHMARKS</span>
                    <h2>General Regional Crop Reference Matrix (ICAR Data)</h2>
                    <p>
                      Standard regional agronomic benchmarks for comparison. This is generic reference data and is NOT a personalized recommendation for your farm.
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => handleNavigate("My Farm")}
                  >
                    {farmData ? "Edit Farm Parameters" : "Configure Farm"} →
                  </button>
                </div>

                <h3>General Agronomic Reference Benchmarks</h3>
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Crop</th>
                        <th>Category</th>
                        <th>Duration</th>
                        <th>Water Demand</th>
                        <th>Benchmark Yield</th>
                        <th>Est. Gross Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Rice (Paddy)</strong></td>
                        <td>Grain (Reference)</td>
                        <td>120–150 days</td>
                        <td>High (~1,150 mm)</td>
                        <td>2.0 t/ac</td>
                        <td>₹42,000 / ac</td>
                      </tr>
                      <tr>
                        <td><strong>Wheat</strong></td>
                        <td>Cereal (Reference)</td>
                        <td>110–140 days</td>
                        <td>Medium (~450 mm)</td>
                        <td>1.8 t/ac</td>
                        <td>₹40,950 / ac</td>
                      </tr>
                      <tr>
                        <td><strong>Maize</strong></td>
                        <td>Grain (Reference)</td>
                        <td>90–120 days</td>
                        <td>Medium (~520 mm)</td>
                        <td>2.0 t/ac</td>
                        <td>₹40,000 / ac</td>
                      </tr>
                      <tr>
                        <td><strong>Pearl Millets</strong></td>
                        <td>Cereal (Reference)</td>
                        <td>75–100 days</td>
                        <td>Low (~280 mm)</td>
                        <td>0.9 t/ac</td>
                        <td>₹21,150 / ac</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="sample-notice">
                  <strong>Reference Information:</strong> Generic benchmark figures from ICAR crop production guides. Click &ldquo;Create My Farm Plan&rdquo; above to run 4-gate feasibility checking (Season, Soil, Water, Budget) and view your verified crop plan.
                </p>
              </section>
            )}
          </div>
        )}

        {plannerSubTab === "water" && (
          <div>
            <div className="page-header">
              <div>
                <p className="breadcrumb">Workspace / Crop Planner / Water</p>
                <h1 className="page-title">Water Optimization</h1>
                <p className="page-subtitle">
                  Plan irrigation within your available volumetric water budget.
                </p>
              </div>

              <button
                className="secondary-button"
                onClick={() => handleGeneratePlan()}
                disabled={loadingPlan}
              >
                <span className="material-symbols-outlined">refresh</span>
                {loadingPlan ? "Recalculating..." : "Recalculate Water"}
              </button>
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">VOLUMETRIC BALANCE</span>
                  <h2>Available irrigation water</h2>
                  <p>
                    {farmData
                      ? `Calculated for ${farmData.areaAcres} acres in ${farmData.location || "your farm"} (${farmData.season} season).`
                      : "Displaying baseline demonstration water budget."}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => handleNavigate("My Farm")}
                >
                  Configure water availability →
                </button>
              </div>

              <div className="water-summary">
                <strong>
                  {planResult?.water
                    ? `${Math.round(planResult.water.allocated_m3).toLocaleString()} m³ / ${Math.round(planResult.water.total_available_m3).toLocaleString()} m³`
                    : farmData
                    ? `${farmData.availableWaterM3.toLocaleString()} m³`
                    : "3,000 m³"}
                </strong>
                <span>
                  {planResult?.water
                    ? `Allocated ${planResult.water.allocation_pct}% of irrigation reserve (${Math.round(planResult.water.remaining_m3).toLocaleString()} m³ remaining)`
                    : farmData
                    ? `From your saved farm details (${farmData.areaAcres} acres · ${farmData.soilType} soil · ${farmData.season} season)`
                    : "Example value — enter your farm details to customize it"}
                </span>
              </div>

              {planResult?.water && (
                <div className="water-bar-wrapper" style={{ margin: "20px 0" }}>
                  <div className="water-bar-labels">
                    <span><strong>Allocated:</strong> {planResult.water.allocation_pct}%</span>
                    <span><strong>Remaining Buffer:</strong> {Math.round(planResult.water.remaining_m3).toLocaleString()} m³</span>
                  </div>
                  <div className="water-progress-track">
                    <div
                      className="water-progress-fill"
                      style={{ width: `${Math.min(100, planResult.water.allocation_pct)}%` }}
                    />
                  </div>
                </div>
              )}

              <h3>Simulated Source Breakdown (Sample Reference)</h3>
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Source Type</th>
                      <th>Share</th>
                      <th>Estimated Quota</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Canal Entitlement</strong></td>
                      <td>60%</td>
                      <td>
                        {farmData
                          ? `${Math.round(farmData.availableWaterM3 * 0.6).toLocaleString()} m³`
                          : "1,800 m³"}
                      </td>
                      <td>Permissible</td>
                    </tr>
                    <tr>
                      <td><strong>Borewell / Aquifer Reserve</strong></td>
                      <td>40%</td>
                      <td>
                        {farmData
                          ? `${Math.round(farmData.availableWaterM3 * 0.4).toLocaleString()} m³`
                          : "1,200 m³"}
                      </td>
                      <td>Permissible</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="sample-notice">
                <strong>Disclaimer:</strong> Source breakdown is illustrative based on standard regional canal and aquifer models.
              </p>
            </section>
          </div>
        )}

        {plannerSubTab === "market" && (
          <div>
            <div className="page-header">
              <div>
                <p className="breadcrumb">Workspace / Crop Planner / Market</p>
                <h1 className="page-title">Market Insights</h1>
                <p className="page-subtitle">
                  Regional commodity pricing signals and trade trends.
                </p>
              </div>
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">REGIONAL AG-EXCHANGE SIGNALS</span>
                  <h2>Commodity price signals (Sample)</h2>
                  <p>Historical trends compiled from regional APMC wholesale markets.</p>
                </div>
              </div>

              <div className="signals-grid">
                <div className="signal-card">
                  <div>
                    <h4>Millet Export Surge</h4>
                    <p>
                      Growing export demand for drought-tolerant super-grains is driving a <strong>+14% spot premium</strong> on regional grain exchanges.
                    </p>
                  </div>
                  <span className="signal-tag">Signal: High Liquidity</span>
                </div>

                <div className="signal-card">
                  <div>
                    <h4>Maize Processing Demand</h4>
                    <p>
                      Feedmill forward contracts indicate minimum floor prices across Q3, providing low price volatility and steady off-take.
                    </p>
                  </div>
                  <span className="signal-tag">Signal: Low Volatility</span>
                </div>
              </div>

              <p className="sample-notice">
                <strong>Disclaimer:</strong> Illustrative trend data compiled for demonstration based on benchmark modal prices.
              </p>
            </section>
          </div>
        )}

        {plannerSubTab === "scenario" && (
          <div>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">STRESS-TESTING LABORATORY</span>
                  <h2>Agricultural Scenario Simulation</h2>
                  <p>
                    Evaluate farm resilience under simulated climate, water, and market stresses.
                  </p>
                </div>
                <span className="panel-icon">
                  <span className="material-symbols-outlined">science</span>
                </span>
              </div>

              <div className="signals-grid">
                <div className="signal-card">
                  <div>
                    <h4>Hydrological Stress Simulation</h4>
                    <p>
                      Simulate a <strong>-25% deficit</strong> in seasonal precipitation and test if your saved water quota ({farmData ? `${farmData.availableWaterM3.toLocaleString()} m³` : "3,000 m³"}) sustains current crop rotations.
                    </p>
                  </div>
                  <span className="signal-tag">Parametric Test</span>
                </div>

                <div className="signal-card">
                  <div>
                    <h4>Working Capital Shock</h4>
                    <p>
                      Model a <strong>+20% cost spike</strong> across seed stock and energy inputs against your available budget ({farmData ? `₹${farmData.budget.toLocaleString()}` : "₹8,500"}).
                    </p>
                  </div>
                  <span className="signal-tag">Sensitivity Analysis</span>
                </div>
              </div>

              <p className="sample-notice">
                <strong>Disclaimer:</strong> Scenario simulations evaluate farm resilience against climatic deficit and cost inflation.
              </p>
            </section>
          </div>
        )}
      </div>
    );
  }

  function renderPage() {
    switch (activePage) {
      case "Home":
      case "Overview":
      case "Dashboard":
        return (
          <Dashboard
            onNavigate={handleNavigate}
            farmData={farmData}
            planResult={planResult}
            loadingPlan={loadingPlan}
            planError={planError}
            onGeneratePlan={() => handleGeneratePlan()}
          />
        );

      case "My Farm":
      case "Farm Details":
        return (
          <div className="page-content farm-details-page-content">
            <FarmForm
              key={
                farmData
                  ? `${farmData.areaAcres}-${farmData.soilType}-${farmData.availableWaterM3}-${farmData.season}`
                  : "empty"
              }
              onSubmit={handleFarmSubmit}
              onReset={handleFarmReset}
              initialData={farmData}
            />
          </div>
        );

      case "Crop Planner":
      case "Crop Recommendations":
      case "Water Optimization":
      case "Market Insights":
      case "Scenario Lab":
        return renderCropPlannerContent();

      case "My Plans":
      case "Planning History":
        return (
          <div className="page-content">
            <div className="page-header">
              <div>
                <p className="breadcrumb">Workspace / My Plans</p>
                <h1 className="page-title">My Plans</h1>
                <p className="page-subtitle">
                  Review your saved farm plans and previous recommendations.
                </p>
              </div>
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">SESSION RECORDS</span>
                  <h2>Saved farm plans</h2>
                  <p>Plans stored locally on this workstation.</p>
                </div>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Plan Name</th>
                      <th>Location</th>
                      <th>Area</th>
                      <th>Season</th>
                      <th>Water Budget</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>
                          {farmData
                            ? `Plan (${farmData.location || "Custom"})`
                            : "Default Baseline Plan"}
                        </strong>
                      </td>
                      <td>{farmData ? farmData.location || "Local" : "Bengaluru"}</td>
                      <td>{farmData ? `${farmData.areaAcres} ac` : "5.0 ac"}</td>
                      <td>{farmData ? farmData.season : "Kharif"}</td>
                      <td>
                        {farmData
                          ? `${farmData.availableWaterM3.toLocaleString()} m³`
                          : "3,000 m³"}
                      </td>
                      <td><span className="crop-type">Active in Session</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="sample-notice">
                Session history is stored locally in your browser (localStorage). Cloud database synchronization will be connected with backend integration.
              </p>
            </section>
          </div>
        );

      case "Settings":
        return (
          <div className="page-content">
            <div className="page-header">
              <div>
                <p className="breadcrumb">Workspace / Settings</p>
                <h1 className="page-title">Settings</h1>
                <p className="page-subtitle">
                  Workspace configuration and ag-district preferences.
                </p>
              </div>
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">PREFERENCES</span>
                  <h2>Workspace configuration</h2>
                  <p>Standard settings for regional agronomic calculations.</p>
                </div>
              </div>

              <div className="settings-list">
                <div className="setting-item">
                  <div>
                    <strong>Unit of Measure</strong>
                    <span>Cultivation area in acres, water volume in cubic meters (m³)</span>
                  </div>
                  <span className="crop-type">Acres / m³</span>
                </div>

                <div className="setting-item">
                  <div>
                    <strong>Agro-Ecological District</strong>
                    <span>GIS Zone 4B (Semi-Arid Central Plateau)</span>
                  </div>
                  <span className="crop-type">Zone 4B</span>
                </div>

                <div className="setting-item">
                  <div>
                    <strong>Theme Mode</strong>
                    <span>Clean agricultural light palette (#F7F9F6)</span>
                  </div>
                  <span className="crop-type">Standard Light</span>
                </div>

                <div className="setting-item">
                  <div>
                    <strong>Data Storage</strong>
                    <span>Encrypted browser local storage with schema validation</span>
                  </div>
                  <span className="crop-type">Browser LocalStorage</span>
                </div>
              </div>

              <p className="sample-notice">
                Application settings are active for this browser profile. Backend user account settings will be enabled when authentication is deployed.
              </p>
            </section>
          </div>
        );

      default:
        return (
          <Dashboard
            onNavigate={handleNavigate}
            farmData={farmData}
            planResult={planResult}
            loadingPlan={loadingPlan}
            planError={planError}
            onGeneratePlan={() => handleGeneratePlan()}
          />
        );
    }
  }

  // ── Auth gate ─────────────────────────────────────────

  // 1. Session restore in progress — show a minimal spinner
  if (authLoading) {
    return (
      <div className="auth-splash" aria-label="Loading Quantum Agri" aria-busy="true">
        <div className="auth-splash-inner">
          <div className="auth-brand-icon">
            <span className="material-symbols-outlined">eco</span>
          </div>
          <p className="auth-splash-name">Quantum Agri</p>
          <span className="auth-spinner auth-spinner--lg" aria-hidden="true" />
        </div>
      </div>
    );
  }

  // 2. No active session — show auth pages
  if (!user) {
    if (authView === "signup")
      return (
        <SignupPage
          onNavigateToLogin={() => {
            clearAuthError?.();
            try {
              sessionStorage.removeItem("quantum_agri_auth_intent");
            } catch {
              // ignore
            }
            setAuthView("login");
          }}
          onAuthSuccess={() => {
            try {
              sessionStorage.removeItem("quantum_agri_auth_intent");
            } catch {
              // ignore
            }
          }}
          oauthError={authError}
        />
      );
    if (authView === "forgot")
      return (
        <ForgotPasswordPage
          onNavigateToLogin={() => {
            clearAuthError?.();
            try {
              sessionStorage.removeItem("quantum_agri_auth_intent");
            } catch {
              // ignore
            }
            setAuthView("login");
          }}
        />
      );
    // Default: login
    return (
      <LoginPage
        onNavigateToSignup={() => {
          clearAuthError?.();
          try {
            sessionStorage.setItem("quantum_agri_auth_intent", "signup");
          } catch {
            // ignore
          }
          setAuthView("signup");
        }}
        onNavigateToForgot={() => {
          clearAuthError?.();
          try {
            sessionStorage.removeItem("quantum_agri_auth_intent");
          } catch {
            // ignore
          }
          setAuthView("forgot");
        }}
        onAuthSuccess={() => {
          try {
            sessionStorage.removeItem("quantum_agri_auth_intent");
          } catch {
            // ignore
          }
          setAuthView("login");
        }}
        oauthError={authError}
      />
    );
  }

  // 3. Authenticated — render full app
  async function handleLogout() {
    await signOut();
    // AuthContext will detect the session change and re-render to auth pages
  }

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        farmData={farmData}
        user={user}
        onLogout={handleLogout}
      />

      <div className="app-main-wrapper">
        <TopHeader
          activePage={activePage}
          farmData={farmData}
          onNavigate={handleNavigate}
          user={user}
          onLogout={handleLogout}
        />

        <main className="main-content">
          {notification && (
            <aside className="workspace-notification" role="status">
              <div className="notification-content">
                <span className="notification-badge">✓ Verified</span>
                <span>{notification}</span>
              </div>
              <button
                type="button"
                className="notification-dismiss"
                onClick={() => setNotification(null)}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </aside>
          )}
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;