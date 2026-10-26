/**
 * Shared Sidebar component for Quantum Agri.
 *
 * Implements simplified 5-item navigation:
 * Home, My Farm, Crop Planner, My Plans, Settings
 */

const navigationItems = [
  { label: "Home", icon: "home", aliases: ["Overview", "Dashboard"] },
  { label: "My Farm", icon: "agriculture", aliases: ["Farm Details"] },
  { label: "Crop Planner", icon: "psychiatry", aliases: ["Crop Recommendations", "Water Optimization", "Market Insights", "Scenario Lab"] },
  { label: "My Plans", icon: "inventory_2", aliases: ["Planning History"] },
  { label: "Settings", icon: "settings", aliases: [] },
];

export default function Sidebar({ activePage, onNavigate, farmData, user, onLogout }) {
  const isItemActive = (item) => {
    if (activePage === item.label) return true;
    if (item.aliases && item.aliases.includes(activePage)) return true;
    return false;
  };

  return (
    <aside className="sidebar" aria-label="Main Navigation">
      <div className="sidebar-top">
        {/* Brand Header */}
        <div className="brand">
          <div className="brand-icon">
            <span className="material-symbols-outlined" aria-hidden="true">
              eco
            </span>
          </div>

          <div className="brand-text">
            <h2>Quantum Agri</h2>
            <p>AGRICULTURAL INTELLIGENCE</p>
          </div>
        </div>

        {/* Farm Context Indicator */}
        <div
          className="farm-context-card"
          onClick={() => onNavigate("My Farm")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              onNavigate("My Farm");
            }
          }}
          title="Click to view or edit farm details"
        >
          <div className="farm-context-inner">
            <div className="farm-context-icon">
              <span className="material-symbols-outlined" aria-hidden="true">
                agriculture
              </span>
            </div>
            <div className="farm-context-info">
              <span className="farm-context-title">
                {farmData?.location || "My Farm"}
              </span>
              <span className="farm-context-subtitle">
                {farmData
                  ? `${farmData.areaAcres} Acres • ${farmData.season}`
                  : "5.0 Acres • Sample Profile"}
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined context-arrow" aria-hidden="true">
            chevron_right
          </span>
        </div>

        {/* Section Label */}
        <p className="sidebar-label">WORKSPACE</p>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const active = isItemActive(item);
            return (
              <button
                key={item.label}
                type="button"
                className={`nav-item ${active ? "active" : ""}`}
                onClick={() => onNavigate(item.label)}
                aria-current={active ? "page" : undefined}
              >
                <span className="material-symbols-outlined nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer — user account + logout */}
      <div className="sidebar-footer">
        {user ? (
          <div className="sidebar-user">
            <div className="sidebar-user-info">
              <div className="sidebar-user-avatar">
                {user.email?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="sidebar-user-details">
                <span className="sidebar-user-email" title={user.email}>
                  {user.email}
                </span>
                <span className="sidebar-user-plan">Quantum Agri</span>
              </div>
            </div>
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out of Quantum Agri"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        ) : (
          <div className="footer-status-pill">
            <span className="status-dot" aria-hidden="true"></span>
            <span>{farmData ? "Local Storage Synced" : "Sample Demo Mode"}</span>
          </div>
        )}
        <p className="footer-meta">
          {farmData
            ? `${farmData.areaAcres} acres active in session.`
            : "Configure farm details to personalize plans."}
        </p>
      </div>
    </aside>
  );
}