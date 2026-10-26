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

const pages = [
  "Overview",
  "Dashboard",
  "Farm Details",
  "Crop Recommendations",
  "Water Optimization",
  "Market Insights",
  "Scenario Lab",
  "Planning History",
  "Settings",
];

function App() {
  // ── Auth state ────────────────────────────────────────
  const { user, loading: authLoading } = useAuth();
  // "login" | "signup" | "forgot"
  const [authView, setAuthView] = useState("login");

  // ── App page state ────────────────────────────────────
  const [activePage, setActivePage] = useState("Overview");

  const [farmData, setFarmData] = useState(() => loadSavedFarmData());
  const [notification, setNotification] = useState(null);

  const [planResult, setPlanResult] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState(null);

  async function handleGeneratePlan(overrideData) {
    const dataToPlan = overrideData || farmData || defaultBaselineFarm;
    setLoadingPlan(true);
    setPlanError(null);

    try {
      const result = await generatePlan(dataToPlan);
      setPlanResult(result);
    } catch (err) {
      setPlanError(err);
    } finally {
      setLoadingPlan(false);
    }
  }

  function handleFarmSubmit(data, message) {
    setFarmData(data);
    saveFarmDataToStorage(data);
    setNotification(
      message || "Farm parameters successfully validated by server and saved to workspace."
    );
    // Automatically trigger agricultural plan evaluation for the updated farm
    handleGeneratePlan(data);
    setActivePage("Dashboard");
  }

  function handleFarmReset() {
    clearSavedFarmData();
    setFarmData(null);
    setPlanResult(null);
    setPlanError(null);
    setNotification(null);
  }

  function renderPage() {
    switch (activePage) {
      case "Overview":
      case "Dashboard":
        return (
          <Dashboard
            onNavigate={setActivePage}
            farmData={farmData}
            planResult={planResult}
            loadingPlan={loadingPlan}
            planError={planError}
            onGeneratePlan={() => handleGeneratePlan()}
          />
        );

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

      case "Crop Recommendations":
        return (
          <div className="page-content">
            <div className="page-header">
              <div>
                <p className="breadcrumb">Workspace / Crop Recommendations</p>
                <h1 className="page-title">Crop Recommendations</h1>
                <p className="page-subtitle">
                  Compare candidate crops against your farm conditions.
                </p>
              </div>

              <button
                className="primary-button hero-plan-cta"
                onClick={() => handleGeneratePlan()}
                disabled={loadingPlan}
              >
                <span className="material-symbols-outlined">
                  {loadingPlan ? "sync" : "analytics"}
                </span>
                <span>
                  {loadingPlan
                    ? "Evaluating Engine..."
                    : planResult
                    ? "Re-run Evaluation"
                    : "Run Agronomic Evaluation"}
                </span>
              </button>
            </div>

            {loadingPlan || planError || planResult ? (
              <PlanResults
                plan={planResult}
                loading={loadingPlan}
                error={planError}
                onRegenerate={() => handleGeneratePlan()}
                onEditFarm={() => setActivePage("Farm Details")}
              />
            ) : (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">FIELD PROFILE</span>
                    <h2>
                      {farmData
                        ? `Farm Profile: ${farmData.location || "Custom"}`
                        : "Demonstration Farm Profile"}
                    </h2>
                    <p>
                      {farmData
                        ? `${farmData.areaAcres} acres · ${farmData.soilType} soil · ${farmData.availableWaterM3.toLocaleString()} m³ water · ${farmData.season} season · ₹${farmData.budget.toLocaleString()} budget`
                        : "Using standard baseline inputs (5.0 acres, Loamy soil, 5,000 m³ water). Configure your farm in Farm Details to customize."}
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => setActivePage("Farm Details")}
                  >
                    {farmData ? "Edit parameters" : "Configure farm"} →
                  </button>
                </div>

                <h3>Agronomic Reference Matrix (Sample Reference Data)</h3>
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
                        <td>Grain</td>
                        <td>120–150 days</td>
                        <td>High (~1,150 mm)</td>
                        <td>2.0 t/ac</td>
                        <td>₹42,000 / ac</td>
                      </tr>
                      <tr>
                        <td><strong>Wheat</strong></td>
                        <td>Cereal</td>
                        <td>110–140 days</td>
                        <td>Medium (~450 mm)</td>
                        <td>1.8 t/ac</td>
                        <td>₹40,950 / ac</td>
                      </tr>
                      <tr>
                        <td><strong>Maize</strong></td>
                        <td>Grain</td>
                        <td>90–120 days</td>
                        <td>Medium (~520 mm)</td>
                        <td>2.0 t/ac</td>
                        <td>₹40,000 / ac</td>
                      </tr>
                      <tr>
                        <td><strong>Pearl Millets</strong></td>
                        <td>Cereal (Drought-Resilient)</td>
                        <td>75–100 days</td>
                        <td>Low (~280 mm)</td>
                        <td>0.9 t/ac</td>
                        <td>₹21,150 / ac</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="sample-notice">
                  Click &ldquo;Run Agronomic Evaluation&rdquo; above to run real 4-gate feasibility checking (Season, Soil, Water, Budget) against ICAR benchmark datasets.
                </p>
              </section>
            )}
          </div>
        );

      case "Water Optimization":
        return (
          <div className="page-content">
            <div className="page-header">
              <div>
                <p className="breadcrumb">Workspace / Water Optimization</p>
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
                  onClick={() => setActivePage("Farm Details")}
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
                    : "5,000 m³"}
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
                <strong>Disclaimer:</strong> Source breakdown is illustrative. Dynamic mathematical water allocation models (linear programming / knapsack water optimization) will be connected during the optimization phase.
              </p>
            </section>
          </div>
        );

      case "Market Insights":
        return (
          <div className="page-content">
            <div className="page-header">
              <div>
                <p className="breadcrumb">Workspace / Market Insights</p>
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
                <strong>Disclaimer:</strong> Illustrative trend data compiled for demonstration. Live Agmarknet / APMC API services will be integrated in later phases.
              </p>
            </section>
          </div>
        );

      case "Scenario Lab":
        return (
          <div className="page-content">
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
                <strong>Disclaimer:</strong> Scenario Lab simulation models will connect in subsequent phases. Real-time Monte Carlo yield simulations and linear sensitivity calculations will be integrated with the optimization engine.
              </p>
            </section>
          </div>
        );

      case "Planning History":
        return (
          <div className="page-content">
            <div className="page-header">
              <div>
                <p className="breadcrumb">Workspace / Planning History</p>
                <h1 className="page-title">Planning History</h1>
                <p className="page-subtitle">
                  Review historical farm planning sessions and saved configurations.
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
        return <Dashboard onNavigate={setActivePage} farmData={farmData} />;
    }
  }

  // ── Auth gate ─────────────────────────────────────────

  // 1. Session restore in progress — show a minimal spinner
  if (authLoading) {
    return (
      <div className="auth-splash" aria-label="Loading CropWise" aria-busy="true">
        <div className="auth-splash-inner">
          <div className="auth-brand-icon">
            <span className="material-symbols-outlined">eco</span>
          </div>
          <p className="auth-splash-name">CropWise</p>
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
          onNavigateToLogin={() => setAuthView("login")}
          onAuthSuccess={() => setAuthView("login")}
        />
      );
    if (authView === "forgot")
      return (
        <ForgotPasswordPage
          onNavigateToLogin={() => setAuthView("login")}
        />
      );
    // Default: login
    return (
      <LoginPage
        onNavigateToSignup={() => setAuthView("signup")}
        onNavigateToForgot={() => setAuthView("forgot")}
        onAuthSuccess={() => setAuthView("login")}
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
        onNavigate={(page) => {
          if (pages.includes(page)) {
            setActivePage(page);
          }
        }}
        farmData={farmData}
        user={user}
        onLogout={handleLogout}
      />

      <div className="app-main-wrapper">
        <TopHeader
          activePage={activePage}
          farmData={farmData}
          onNavigate={setActivePage}
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