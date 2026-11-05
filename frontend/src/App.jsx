import { useState, useEffect } from "react";

import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import FarmForm from "./components/FarmForm";
import Dashboard from "./pages/Dashboard";
import PlanResults from "./components/PlanResults";
import { generatePlan } from "./services/farmApi";
import { getJson } from "./services/apiClient";
import {
  loadSavedFarmData,
  saveFarmDataToStorage,
  clearSavedFarmData,
  loadUserFarmData,
  saveUserFarmData,
  clearUserFarmData,
  resolveUserFarmData,
  loadSavedPlanResult,
  savePlanResultToStorage,
  clearSavedPlanResult,
  migrateGuestPlanToUser,
} from "./services/farmStorage";

// Auth
import { useAuth } from "./context/AuthContext";
import { signOut } from "./lib/supabaseClient";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import SettingsPage from "./pages/SettingsPage";
import WaterOptimization from "./pages/WaterOptimization";

import "./App.css";

const defaultBaselineFarm = {
  areaAcres: 5.0,
  soilType: "Loamy",
  expectedRainfallMm: 650.0,
  availableWaterM3: 4000.0,
  location: "Bengaluru (Sample Farm)",
  season: "Kharif",
  budget: 100000.0,
};

function App() {
  // ── Auth state ────────────────────────────────────────
  const { user, loading: authLoading, authError, clearAuthError, setAuthSession } = useAuth();
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

  const [isGuest, setIsGuest] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        sessionStorage.getItem("quantum_agri_guest_mode") === "true"
      );
    } catch {
      return false;
    }
  });

  // ── App page state ────────────────────────────────────
  const [activePage, setActivePage] = useState("Home");
  const [plannerSubTab, setPlannerSubTab] = useState("recommendations");

  const [farmData, setFarmData] = useState(() => {
    return loadSavedFarmData();
  });
  const [notification, setNotification] = useState(null);

  // Separate real farm plan vs simulated baseline demonstration plan
  const [realPlanResult, setRealPlanResult] = useState(() => {
    return loadSavedPlanResult(null);
  });
  const [demoPlanResult, setDemoPlanResult] = useState(null);
  const [isDemoActive, setIsDemoActive] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState(null);

  const planResult = isDemoActive ? demoPlanResult : realPlanResult;

  // ── Sync farm data & plan result with auth state ──────────────────────────
  useEffect(() => {
    if (authLoading) return;

    if (user?.id) {
      // 1. Authenticated: load user-scoped farm data or migrate guest data if first login
      const { data: resolvedData, migrated } = resolveUserFarmData(user.id);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFarmData(resolvedData);
      if (migrated) {
        setNotification("Guest farm workspace was successfully linked to your account.");
      }

      // 2. Migrate guest plan if present, then load user plan from sessionStorage
      migrateGuestPlanToUser(user.id);
      const userPlan = loadSavedPlanResult(user.id);
      if (userPlan) {
        setRealPlanResult(userPlan);
      }

      // 3. Ensure guest mode flag is cleared now that user is authenticated
      try {
        sessionStorage.removeItem("quantum_agri_guest_mode");
      } catch {
        // ignore
      }
      setIsGuest(false);
    } else if (isGuest) {
      // Guest mode: load anonymous farm data and plan result
      setFarmData(loadSavedFarmData());
      const guestPlan = loadSavedPlanResult(null);
      if (guestPlan) {
        setRealPlanResult(guestPlan);
      }
    } else {
      // Logged out / unauthenticated: reset in-memory data to avoid leaking across accounts/guests
      setFarmData(null);
      setRealPlanResult(null);
      setDemoPlanResult(null);
      setIsDemoActive(false);
    }
  }, [user?.id, isGuest, authLoading]);

  // Background cloud backend warm-up: pings Render health endpoint on initial app load
  useEffect(() => {
    getJson("/api/v1/health", { timeoutMs: 30000, retries: 0 }).catch(() => {
      // Ignored: silent cloud instance spin-up in background
    });
  }, []);

  function handleNavigate(page) {
    if (page === "Water Optimization") {
      setActivePage("Water Optimization");
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

    const savedFarm = user?.id ? loadUserFarmData(user.id) : loadSavedFarmData();
    const dataToPlan =
      (isFarmObject ? overrideData : null) || farmData || savedFarm || defaultBaselineFarm;

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
      const mappedResult = {
        ...result,
        isDemonstration: false,
        isSimulated: false,
      };
      setRealPlanResult(mappedResult);
      savePlanResultToStorage(mappedResult, user?.id || null);
      setIsDemoActive(false);
      setPlanError(null);
    } catch (err) {
      await minDelay;
      setPlanError(err);
      // Keep previous plan if already loaded so error banner shows inline
    } finally {
      setLoadingPlan(false);
    }
  }

  async function handleGenerateBaselineDemo() {
    setLoadingPlan(true);
    setPlanError(null);

    const minDelay = new Promise((resolve) => setTimeout(resolve, 400));

    try {
      const [result] = await Promise.all([
        generatePlan(defaultBaselineFarm),
        minDelay,
      ]);
      const demoResult = {
        ...result,
        location: "Bengaluru (Sample Farm)",
        isDemonstration: true,
        isSimulated: true,
        demonstrationLabel: "Simulated Demonstration Baseline Plan",
      };
      setDemoPlanResult(demoResult);
      setIsDemoActive(true);
      setPlanError(null);
    } catch (err) {
      await minDelay;
      setPlanError(err);
    } finally {
      setLoadingPlan(false);
    }
  }

  function handleSwitchToRealPlan() {
    if (realPlanResult) {
      setIsDemoActive(false);
    } else if (farmData) {
      handleGeneratePlan(farmData);
    }
  }

  function handleFarmSubmit(data, message) {
    setFarmData(data);
    if (user?.id) {
      saveUserFarmData(user.id, data);
    } else {
      saveFarmDataToStorage(data);
    }
    setNotification(
      message || "Farm details successfully saved to workspace."
    );
    // Automatically trigger agricultural plan evaluation for the updated farm
    handleGeneratePlan(data);
    setActivePage("Crop Planner");
    setPlannerSubTab("recommendations");
  }

  function handleFarmReset() {
    if (user?.id) {
      clearUserFarmData(user.id);
      clearSavedPlanResult(user.id);
    } else {
      clearSavedFarmData();
      clearSavedPlanResult(null);
    }
    setFarmData(null);
    setRealPlanResult(null);
    setDemoPlanResult(null);
    setIsDemoActive(false);
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
          <WaterOptimization
            planResult={planResult}
            farmData={isDemoActive ? defaultBaselineFarm : farmData}
            userSavedFarmData={farmData}
            isDemonstrationPlan={isDemoActive}
            loadingPlan={loadingPlan}
            planError={planError}
            onRecalculate={(data) => {
              if (isDemoActive) {
                handleGenerateBaselineDemo();
              } else {
                handleGeneratePlan(data || farmData);
              }
            }}
            onEvaluatePlan={(data) => handleGeneratePlan(data || farmData)}
            onGenerateDemo={() => handleGenerateBaselineDemo()}
            onSwitchToRealPlan={() => handleSwitchToRealPlan()}
            onNavigate={handleNavigate}
          />
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
          <SettingsPage
            onNavigate={handleNavigate}
            onFarmReset={handleFarmReset}
            onNotification={(msg) => setNotification(msg)}
            onSignOut={handleLogout}
          />
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

  // 2. No active session and not in guest demo mode — show auth pages
  if (!user && !isGuest) {
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
          onAuthSuccess={(newSession) => {
            try {
              sessionStorage.removeItem("quantum_agri_auth_intent");
            } catch {
              // ignore
            }
            if (newSession) {
              setAuthSession?.(newSession);
            }
            setAuthView("login");
            setActivePage("Home");
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
        onContinueAsGuest={() => {
          try {
            sessionStorage.setItem("quantum_agri_guest_mode", "true");
          } catch {
            // ignore
          }
          setIsGuest(true);
        }}
        oauthError={authError}
      />
    );
  }

  // 3. Authenticated or Guest — render full app
  async function handleLogout() {
    try {
      sessionStorage.removeItem("quantum_agri_guest_mode");
      sessionStorage.removeItem("quantum_agri_auth_intent");
    } catch {
      // ignore
    }
    setIsGuest(false);
    setFarmData(null);
    setRealPlanResult(null);
    setDemoPlanResult(null);
    setIsDemoActive(false);
    setPlanError(null);
    setNotification(null);
    await signOut();
    // AuthContext will detect the session change and re-render to auth pages
  }

  function handleCreateAccountFromGuest() {
    try {
      sessionStorage.removeItem("quantum_agri_guest_mode");
      sessionStorage.setItem("quantum_agri_auth_intent", "signup");
    } catch {
      // ignore
    }
    setIsGuest(false);
    setAuthView("signup");
  }

  function handleSignInFromGuest() {
    try {
      sessionStorage.removeItem("quantum_agri_guest_mode");
      sessionStorage.removeItem("quantum_agri_auth_intent");
    } catch {
      // ignore
    }
    setIsGuest(false);
    setAuthView("login");
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
          {isGuest && !user && (
            <div className="guest-mode-banner" role="status" id="guest-mode-banner">
              <div className="guest-banner-left">
                <span className="material-symbols-outlined guest-banner-icon" aria-hidden="true">
                  info
                </span>
                <span>
                  You are viewing a <strong>Guest Demo Workspace</strong>. Save your plans and cloud sync by creating an account.
                </span>
              </div>
              <div className="guest-banner-actions">
                <button
                  type="button"
                  id="guest-create-account-btn"
                  className="guest-banner-btn-primary"
                  onClick={handleCreateAccountFromGuest}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  id="guest-sign-in-btn"
                  className="guest-banner-btn-secondary"
                  onClick={handleSignInFromGuest}
                >
                  Sign In
                </button>
              </div>
            </div>
          )}
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

          {/* Floating Voice Assistant Quick Trigger */}
          <button
            type="button"
            id="floating-voice-launcher-btn"
            className="floating-voice-launcher-btn"
            onClick={() => handleNavigate("My Farm")}
            title="Open Voice Dictation Assistant"
            aria-label="Open Voice Dictation Assistant"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              mic
            </span>
            <span className="floating-voice-text">Voice Assistant</span>
          </button>
        </main>
      </div>
    </div>
  );
}

export default App;