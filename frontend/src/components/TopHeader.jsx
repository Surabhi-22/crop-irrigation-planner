/**
 * Shared TopHeader component for Quantum Agri.
 *
 * Displays the current page title, contextual subtitle, active farm location
 * and season (when saved in farmData), and a "New Farm Plan" quick action.
 */

const PAGE_METADATA = {
  Home: {
    title: "Farmer Dashboard",
    subtitle: "Plan better crops and use every drop of water wisely.",
  },
  Overview: {
    title: "Farmer Dashboard",
    subtitle: "Plan better crops and use every drop of water wisely.",
  },
  Dashboard: {
    title: "Farmer Dashboard",
    subtitle: "Plan better crops and use every drop of water wisely.",
  },
  "My Farm": {
    title: "My Farm Details",
    subtitle: "Configure your land size, soil type, water reserve, and budget.",
  },
  "Farm Details": {
    title: "My Farm Details",
    subtitle: "Configure your land size, soil type, water reserve, and budget.",
  },
  "Crop Planner": {
    title: "Crop & Irrigation Planner",
    subtitle: "Compare suitable crops, check water limits, and view estimated profits.",
  },
  "Crop Recommendations": {
    title: "Crop & Irrigation Planner",
    subtitle: "Compare candidate crops against soil chemistry, water requirements, and benchmark returns.",
  },
  "Water Optimization": {
    title: "Water Optimization",
    subtitle: "Plan volumetric irrigation allocation within seasonal canal and groundwater quotas.",
  },
  "Market Insights": {
    title: "Market Insights",
    subtitle: "Regional wholesale commodity pricing signals and trade trends compiled from APMC markets.",
  },
  "Scenario Lab": {
    title: "Scenario Lab",
    subtitle: "Interactive parameter stress-testing, drought sensitivity, and operational risk simulation.",
  },
  "My Plans": {
    title: "My Saved Plans",
    subtitle: "View and review previously generated farm plans.",
  },
  "Planning History": {
    title: "My Saved Plans",
    subtitle: "Historical farm planning sessions and configuration records stored on this workstation.",
  },
  Settings: {
    title: "Settings & Preferences",
    subtitle: "Workspace configuration, measurement units, and agro-ecological district parameters.",
  },
};

export default function TopHeader({ activePage, farmData, onNavigate }) {
  const meta = PAGE_METADATA[activePage] || {
    title: activePage,
    subtitle: "Quantum Agri workspace.",
  };

  return (
    <header className="top-header" role="banner">
      <div className="header-left">
        <div className="header-title-group">
          <p className="header-breadcrumb">Workspace / {activePage}</p>
          <h1 className="header-title">{meta.title}</h1>
          <p className="header-subtitle">{meta.subtitle}</p>
        </div>
      </div>

      <div className="header-right">
        {/* Context badges - only displayed when relevant farmData is available */}
        {farmData?.location && (
          <div className="header-context-badge" title="Active plot location">
            <span className="material-symbols-outlined header-badge-icon" aria-hidden="true">
              location_on
            </span>
            <div className="header-badge-copy">
              <span className="header-badge-label">Farm Location</span>
              <span className="header-badge-value">{farmData.location}</span>
            </div>
          </div>
        )}

        {farmData?.season && (
          <div className="header-context-badge" title="Cultivation cycle">
            <span className="material-symbols-outlined header-badge-icon" aria-hidden="true">
              calendar_today
            </span>
            <div className="header-badge-copy">
              <span className="header-badge-label">Season Cycle</span>
              <span className="header-badge-value">{farmData.season}</span>
            </div>
          </div>
        )}

        {!farmData && (
          <div className="header-context-badge sample-badge" title="Using baseline sample values">
            <span className="status-dot" aria-hidden="true"></span>
            <div className="header-badge-copy">
              <span className="header-badge-label">Workspace Mode</span>
              <span className="header-badge-value">Sample / Demo</span>
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <button
          type="button"
          className="header-action-button"
          onClick={() => onNavigate("My Farm")}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            add_circle
          </span>
          <span>{farmData ? "Edit Farm Plan" : "Create Farm Plan"}</span>
        </button>
      </div>
    </header>
  );
}
