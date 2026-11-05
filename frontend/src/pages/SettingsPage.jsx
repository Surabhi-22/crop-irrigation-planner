/**
 * Quantum Agri — Settings & Preferences Page
 *
 * Provides functional workspace configuration divided into:
 *   1. My Profile — Real Supabase user information with editable display name
 *   2. Farm Preferences — Local agronomic defaults (location, soil, irrigation method)
 *   3. Account & Security — Provider details, password reset, and secure sign-out
 *   4. Workspace Data — JSON backup export and local cache management
 */

import { useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  getVoiceDiagnostics,
  SUPPORTED_LANGUAGES,
} from "../services/voiceService";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import {
  updateUserProfile,
  sendPasswordReset,
  signOut,
} from "../lib/supabaseClient";
import {
  loadFarmPreferences,
  saveFarmPreferences,
  getExportableWorkspaceData,
  clearSavedFarmData,
  loadSavedFarmData,
  saveFarmDataToStorage,
  loadUserFarmData,
  saveUserFarmData,
  clearUserFarmData,
  VALID_IRRIGATION_METHODS,
} from "../services/farmStorage";

export default function SettingsPage({ onNavigate, onFarmReset, onNotification, onSignOut }) {
  const { user } = useAuth();

  // ── Profile State ──────────────────────────────────────────────────────────
  const userFullName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "";

  const [customDisplayName, setCustomDisplayName] = useState(null);
  const displayName =
    customDisplayName !== null ? customDisplayName : userFullName;

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Derived profile details
  const userEmail = user?.email || "No email available";
  const isGoogle =
    user?.app_metadata?.provider === "google" ||
    user?.app_metadata?.providers?.includes("google") ||
    Boolean(user?.user_metadata?.avatar_url);

  const isEmailVerified = Boolean(
    user?.email_confirmed_at || user?.confirmed_at || isGoogle
  );

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Active Member";

  const avatarUrl = user?.user_metadata?.avatar_url;
  const userInitial = (displayName || userEmail || "U")
    .charAt(0)
    .toUpperCase();

  // ── Farm Preferences State ─────────────────────────────────────────────────
  const [farmPrefs, setFarmPrefs] = useState(() => loadFarmPreferences());
  const [prefsSuccess, setPrefsSuccess] = useState("");
  const [prefsError, setPrefsError] = useState("");
  const [applyToCurrentFarm, setApplyToCurrentFarm] = useState(false);

  // ── Account & Security State ───────────────────────────────────────────────
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  // ── Workspace Export State ─────────────────────────────────────────────────
  const [exportSuccess, setExportSuccess] = useState("");
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");

  // ── Voice Preferences & Diagnostics State ─────────────────────────────────
  const { language: globalLang, setLanguage: setGlobalLang } = useLanguage();
  const voiceDiagnostics = useMemo(() => getVoiceDiagnostics(), []);
  const voiceLang = globalLang || "en-IN";
  const [voiceTestFeedback, setVoiceTestFeedback] = useState("");

  const { isSynthesisSupported, isSpeaking, speak, stopSpeaking } = useVoiceAssistant({
    defaultLanguage: voiceLang,
  });

  function handleTestSpokenVoice() {
    setVoiceTestFeedback("");
    if (!isSynthesisSupported) {
      setVoiceTestFeedback("Speech synthesis is not supported in this browser.");
      return;
    }

    const testPhrases = {
      "en-IN": "Quantum Agri smart voice assistant is ready to help you plan your crops and optimize water.",
      "hi-IN": "क्वांटम एग्री स्मार्ट वॉयस सहायक फसल योजना और जल अनुकूलन के लिए तैयार है।",
      "kn-IN": "ಕ್ವಾಂಟಮ್ ಅಗ್ರಿ ಧ್ವನಿ ಸಹಾಯಕ ಬೆಳೆ ಯೋಜನೆ ಮತ್ತು ನೀರಿನ ಆಪ್ಟಿಮೈಸೇಶನ್‌ಗೆ ಸಿದ್ಧವಾಗಿದೆ.",
    };

    const phrase = testPhrases[voiceLang] || testPhrases["en-IN"];
    speak(phrase, {
      lang: voiceLang,
      onStart: () => setVoiceTestFeedback("Playing sample voice output…"),
      onEnd: () => setVoiceTestFeedback("Audio test completed successfully."),
      onError: (err) => setVoiceTestFeedback(`Voice playback error: ${err.message}`),
    });
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    const trimmed = displayName.trim();
    if (!trimmed) {
      setProfileError("Display name cannot be empty.");
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const { data, error } = await updateUserProfile({
        data: { full_name: trimmed, name: trimmed },
      });

      if (error) {
        setProfileError(error.message || "Failed to update profile.");
      } else {
        const updatedName =
          data?.user?.user_metadata?.full_name || trimmed;
        setCustomDisplayName(updatedName);
        setProfileSuccess("Display name updated successfully.");
        if (typeof onNotification === "function") {
          onNotification("Profile updated successfully.");
        }
      }
    } catch (err) {
      setProfileError(err?.message || "An unexpected error occurred.");
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  function handleSavePreferences(e) {
    e.preventDefault();
    setPrefsError("");
    setPrefsSuccess("");

    const success = saveFarmPreferences(farmPrefs);
    if (!success) {
      setPrefsError("Failed to save preferences to local storage.");
      return;
    }

    // Optionally sync default location/soil to the currently active farm
    if (applyToCurrentFarm) {
      const currentFarm = user?.id ? loadUserFarmData(user.id) : loadSavedFarmData();
      if (currentFarm) {
        const updated = {
          ...currentFarm,
          location: farmPrefs.defaultLocation,
          soilType: farmPrefs.defaultSoilType,
        };
        if (user?.id) {
          saveUserFarmData(user.id, updated);
        } else {
          saveFarmDataToStorage(updated);
        }
      }
    }

    setPrefsSuccess("Farm preferences saved to your local browser storage.");
    if (typeof onNotification === "function") {
      onNotification("Farm preferences saved.");
    }
  }

  async function handlePasswordReset() {
    if (!userEmail || userEmail === "No email available") {
      setSecurityError("No registered email address found for this account.");
      return;
    }

    setIsSendingReset(true);
    setSecuritySuccess("");
    setSecurityError("");

    try {
      const { error } = await sendPasswordReset(userEmail);
      if (error) {
        setSecurityError(error.message || "Failed to send password reset email.");
      } else {
        setSecuritySuccess(
          `Password reset link sent to ${userEmail}. Please check your inbox and spam folder.`
        );
      }
    } catch (err) {
      setSecurityError(err?.message || "Unable to send password reset link.");
    } finally {
      setIsSendingReset(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      try {
        sessionStorage.removeItem("quantum_agri_auth_intent");
        sessionStorage.removeItem("quantum_agri_guest_mode");
      } catch {
        // ignore
      }
      await signOut();
      if (typeof onSignOut === "function") {
        onSignOut();
      } else if (typeof onNavigate === "function") {
        onNavigate("Home");
      }
    } catch (err) {
      console.error("[Settings] Sign out error:", err);
      setIsSigningOut(false);
    }
  }

  function handleExportData() {
    setExportSuccess("");
    const data = getExportableWorkspaceData(user?.id);
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `quantum_agri_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportSuccess(
      data.hasActiveFarm
        ? "Workspace data exported with your saved farm details."
        : "Workspace preferences exported (no saved farm parameters were present)."
    );
  }

  function handleResetWorkspace() {
    if (user?.id) {
      clearUserFarmData(user.id);
    } else {
      clearSavedFarmData();
    }
    if (typeof onFarmReset === "function") {
      onFarmReset();
    }
    setResetConfirming(false);
    setResetSuccess("Saved farm details have been cleared from this browser.");
    if (typeof onNotification === "function") {
      onNotification("Workspace cache reset.");
    }
  }

  return (
    <div className="page-content settings-page">
      {/* ── Page Header ───────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <p className="breadcrumb">Workspace / Settings</p>
          <h1 className="page-title">Settings &amp; Preferences</h1>
          <p className="page-subtitle">
            Manage your authenticated account, regional farm defaults, and local workspace data.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {/* ── SECTION 1: My Profile ─────────────────────────────── */}
        <section className="panel settings-panel" aria-labelledby="settings-profile-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">IDENTITY &amp; AUTHENTICATION</span>
              <h2 id="settings-profile-title">My Profile</h2>
              <p>Your authenticated identity and personal details managed through Supabase.</p>
            </div>
            <span className="material-symbols-outlined panel-header-icon">
              account_circle
            </span>
          </div>

          <div className="profile-identity-card">
            <div className="profile-avatar-wrap">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="profile-avatar-img"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="profile-avatar-fallback">{userInitial}</div>
              )}
            </div>

            <div className="profile-identity-info">
              <div className="profile-name-row">
                <h3 className="profile-display-name">
                  {displayName || "Quantum Agri Farmer"}
                </h3>
                <span
                  className={`profile-provider-pill ${isGoogle ? "provider-google" : "provider-email"}`}
                >
                  <span className="material-symbols-outlined">
                    {isGoogle ? "verified_user" : "mail"}
                  </span>
                  {isGoogle ? "Google OAuth" : "Email Account"}
                </span>
              </div>

              <div className="profile-meta-tags">
                <span className="profile-meta-item">
                  <span className="material-symbols-outlined">mail</span>
                  {userEmail}
                </span>

                <span
                  className={`profile-meta-item verification-badge ${isEmailVerified ? "verified" : "unverified"}`}
                >
                  <span className="material-symbols-outlined">
                    {isEmailVerified ? "check_circle" : "pending"}
                  </span>
                  {isEmailVerified ? "Email Verified" : "Pending Verification"}
                </span>

                <span className="profile-meta-item">
                  <span className="material-symbols-outlined">calendar_today</span>
                  Member since {memberSince}
                </span>
              </div>
            </div>
          </div>

          {profileSuccess && (
            <div className="auth-success-banner settings-feedback" role="status">
              <span className="material-symbols-outlined">check_circle</span>
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="auth-error-banner settings-feedback" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="settings-form">
            <div className="form-group">
              <label htmlFor="settings-display-name">Display Name</label>
              <div className="input-with-action">
                <input
                  id="settings-display-name"
                  type="text"
                  className="form-input"
                  value={displayName}
                  onChange={(e) => {
                    setCustomDisplayName(e.target.value);
                    setProfileError("");
                    setProfileSuccess("");
                  }}
                  placeholder="e.g. Surabhi Chourasiya"
                  disabled={isUpdatingProfile}
                  maxLength={60}
                />
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isUpdatingProfile || !displayName.trim()}
                >
                  {isUpdatingProfile ? (
                    <>
                      <span className="material-symbols-outlined spin-icon">
                        sync
                      </span>
                      Updating…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">save</span>
                      Update Name
                    </>
                  )}
                </button>
              </div>
              <span className="field-helper">
                This name is stored in your Supabase profile metadata and appears in your planning reports.
              </span>
            </div>
          </form>
        </section>

        {/* ── SECTION 2: Farm Preferences ───────────────────────── */}
        <section className="panel settings-panel" aria-labelledby="settings-farm-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">REGIONAL DEFAULTS</span>
              <h2 id="settings-farm-title">Farm Preferences</h2>
              <p>Default agricultural values used to prefill new planning calculations.</p>
            </div>
            <span className="material-symbols-outlined panel-header-icon">
              agriculture
            </span>
          </div>

          <div className="settings-local-notice">
            <span className="material-symbols-outlined">info</span>
            <div>
              <strong>Local Browser Storage:</strong>
              <p>
                Farm preferences are saved securely in your current browser profile. They help prefill new farm plans and do not sync across different devices.
              </p>
            </div>
          </div>

          {prefsSuccess && (
            <div className="auth-success-banner settings-feedback" role="status">
              <span className="material-symbols-outlined">check_circle</span>
              <span>{prefsSuccess}</span>
            </div>
          )}

          {prefsError && (
            <div className="auth-error-banner settings-feedback" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{prefsError}</span>
            </div>
          )}

          <form onSubmit={handleSavePreferences} className="settings-form">
            <div className="settings-form-grid">
              {/* Default Location */}
              <div className="form-group">
                <label htmlFor="pref-location">Default Farm Location / District</label>
                <input
                  id="pref-location"
                  type="text"
                  className="form-input"
                  value={farmPrefs.defaultLocation}
                  onChange={(e) => {
                    setFarmPrefs((p) => ({
                      ...p,
                      defaultLocation: e.target.value,
                    }));
                    setPrefsSuccess("");
                  }}
                  placeholder="e.g. Nashik, Maharashtra"
                />
                <span className="field-helper">
                  Primary agricultural district for seasonal rainfall calculations.
                </span>
              </div>

              {/* Default Soil Type */}
              <div className="form-group">
                <label htmlFor="pref-soil">Dominant Soil Type</label>
                <div className="select-with-arrow">
                  <select
                    id="pref-soil"
                    value={farmPrefs.defaultSoilType}
                    onChange={(e) => {
                      setFarmPrefs((p) => ({
                        ...p,
                        defaultSoilType: e.target.value,
                      }));
                      setPrefsSuccess("");
                    }}
                  >
                    <option value="Loamy">Loamy (High fertility &amp; balanced drainage)</option>
                    <option value="Clay">Clay (High water retention, heavier texture)</option>
                    <option value="Sandy">Sandy (High aeration, rapid water drainage)</option>
                    <option value="Silty">Silty (Fine texture, high moisture capacity)</option>
                  </select>
                  <span className="material-symbols-outlined select-arrow">
                    unfold_more
                  </span>
                </div>
                <span className="field-helper">
                  Default soil texture matching your farm profile.
                </span>
              </div>

              {/* Preferred Irrigation Method */}
              <div className="form-group">
                <label htmlFor="pref-irrigation">Preferred Irrigation Method</label>
                <div className="select-with-arrow">
                  <select
                    id="pref-irrigation"
                    value={farmPrefs.preferredIrrigationMethod}
                    onChange={(e) => {
                      setFarmPrefs((p) => ({
                        ...p,
                        preferredIrrigationMethod: e.target.value,
                      }));
                      setPrefsSuccess("");
                    }}
                  >
                    {VALID_IRRIGATION_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method === "Drip"
                          ? "Drip Irrigation (High efficiency: ~90%)"
                          : method === "Sprinkler"
                          ? "Sprinkler System (Medium efficiency: ~75%)"
                          : "Surface / Furrow Flood (Standard efficiency: ~55%)"}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined select-arrow">
                    unfold_more
                  </span>
                </div>
                <span className="field-helper">
                  Used for water quota efficiency comparisons in the Water section.
                </span>
              </div>

              {/* Units of Measure (Indian Standard) */}
              <div className="form-group">
                <label htmlFor="pref-units">Measurement Units</label>
                <input
                  id="pref-units"
                  type="text"
                  className="form-input"
                  value="Acres (Land Area) · Cubic Meters / m³ (Water Volume)"
                  disabled
                  readOnly
                />
                <span className="field-helper">
                  Quantum Agri is calibrated to ICAR agronomic benchmarks in acres and volumetric m³.
                </span>
              </div>
            </div>

            <div className="settings-checkbox-wrap">
              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={applyToCurrentFarm}
                  onChange={(e) => setApplyToCurrentFarm(e.target.checked)}
                />
                <span>
                  Apply default location &amp; soil type to the currently active farm workspace
                </span>
              </label>
            </div>

            <div className="settings-actions">
              <button type="submit" className="primary-button">
                <span className="material-symbols-outlined">save</span>
                Save Farm Preferences
              </button>
            </div>
          </form>
        </section>

        {/* ── SECTION 3: Smart Voice & Audio Assistant ─────────── */}
        <section id="settings-voice-section" className="panel settings-panel" aria-labelledby="settings-voice-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">SPEECH &amp; ACCESSIBILITY</span>
              <h2 id="settings-voice-title">Smart Voice Assistant &amp; Audio</h2>
              <p>Configure speech recognition language, text-to-speech feedback, and check browser compatibility.</p>
            </div>
            <span className="material-symbols-outlined panel-header-icon">
              record_voice_over
            </span>
          </div>

          <div className="security-cards-list">
            {/* Speech Recognition Diagnostics Card */}
            <div className="security-card">
              <div className="security-card-icon">
                <span className="material-symbols-outlined">
                  {voiceDiagnostics.recognitionSupported ? "mic" : "mic_off"}
                </span>
              </div>
              <div className="security-card-body">
                <h4>Speech Recognition (Voice-to-Text)</h4>
                <p>
                  Status:{" "}
                  <strong>
                    {voiceDiagnostics.recognitionSupported
                      ? "Available in this browser"
                      : "Unsupported in this browser"}
                  </strong>
                  . {voiceDiagnostics.recognitionNotes}
                </p>
                <span className="field-helper">
                  Supports English, Hindi, and Kannada voice dictation in Google Chrome and Microsoft Edge.
                </span>
              </div>
              <div className="security-card-action">
                <span
                  className={`profile-provider-pill ${
                    voiceDiagnostics.recognitionSupported ? "provider-google" : "provider-email"
                  }`}
                >
                  <span className="material-symbols-outlined">
                    {voiceDiagnostics.recognitionSupported ? "check_circle" : "info"}
                  </span>
                  {voiceDiagnostics.recognitionSupported ? "Active" : "Unavailable"}
                </span>
              </div>
            </div>

            {/* Speech Synthesis Diagnostics Card */}
            <div className="security-card">
              <div className="security-card-icon">
                <span className="material-symbols-outlined">
                  {voiceDiagnostics.synthesisSupported ? "volume_up" : "volume_off"}
                </span>
              </div>
              <div className="security-card-body">
                <h4>Speech Synthesis (Text-to-Speech)</h4>
                <p>
                  Status:{" "}
                  <strong>
                    {voiceDiagnostics.synthesisSupported
                      ? "Available in this browser"
                      : "Unsupported in this browser"}
                  </strong>
                  . {voiceDiagnostics.synthesisNotes}
                </p>
                <span className="field-helper">
                  Used by &ldquo;Listen to Results&rdquo; on the Water Optimization page.
                </span>
              </div>
              <div className="security-card-action">
                <span
                  className={`profile-provider-pill ${
                    voiceDiagnostics.synthesisSupported ? "provider-google" : "provider-email"
                  }`}
                >
                  <span className="material-symbols-outlined">
                    {voiceDiagnostics.synthesisSupported ? "check_circle" : "info"}
                  </span>
                  {voiceDiagnostics.synthesisSupported ? "Active" : "Unavailable"}
                </span>
              </div>
            </div>
          </div>

          {/* Voice Language Selector & Audio Test */}
          <div className="settings-form" style={{ marginTop: "24px" }}>
            <div className="settings-form-grid">
              <div className="form-group">
                <label htmlFor="pref-voice-language">Preferred Voice Language</label>
                <div className="select-with-arrow">
                  <select
                    id="pref-voice-language"
                    value={voiceLang}
                    onChange={(e) => {
                      const next = e.target.value;
                      setGlobalLang(next);
                      setVoiceTestFeedback("");
                      if (isSpeaking) stopSpeaking();
                    }}
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label} ({lang.nativeLabel})
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined select-arrow">
                    unfold_more
                  </span>
                </div>
                <span className="field-helper">
                  Default language for spoken water summaries and farm planning voice dictation. Changing voice language does not alter agricultural calculation algorithms.
                </span>
              </div>

              <div className="form-group">
                <label>Audio Playback Test</label>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", height: "42px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleTestSpokenVoice}
                    disabled={!voiceDiagnostics.synthesisSupported}
                  >
                    <span className="material-symbols-outlined">
                      {isSpeaking ? "stop" : "play_arrow"}
                    </span>
                    {isSpeaking ? "Stop Test" : "Test Spoken Voice"}
                  </button>
                  {voiceTestFeedback && (
                    <span className="field-helper" style={{ margin: 0, fontWeight: 500 }}>
                      {voiceTestFeedback}
                    </span>
                  )}
                </div>
                <span className="field-helper">
                  Listen to a short test sentence in your selected voice language.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 3: Account & Security ─────────────────────── */}
        <section className="panel settings-panel" aria-labelledby="settings-security-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">CREDENTIALS &amp; SESSIONS</span>
              <h2 id="settings-security-title">Account &amp; Security</h2>
              <p>Authentication methods, credential management, and session control.</p>
            </div>
            <span className="material-symbols-outlined panel-header-icon">
              security
            </span>
          </div>

          {securitySuccess && (
            <div className="auth-success-banner settings-feedback" role="status">
              <span className="material-symbols-outlined">mark_email_read</span>
              <span>{securitySuccess}</span>
            </div>
          )}

          {securityError && (
            <div className="auth-error-banner settings-feedback" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{securityError}</span>
            </div>
          )}

          <div className="security-cards-list">
            {/* Provider Details Card */}
            <div className="security-card">
              <div className="security-card-icon">
                <span className="material-symbols-outlined">
                  {isGoogle ? "lock" : "vpn_key"}
                </span>
              </div>
              <div className="security-card-body">
                <h4>Authentication Method</h4>
                {isGoogle ? (
                  <p>
                    Your account is securely authenticated using <strong>Google OAuth</strong>. Multi-factor authentication, security alerts, and password recovery are managed directly via your Google Account.
                  </p>
                ) : (
                  <p>
                    Your account uses standard <strong>Email &amp; Password</strong> authentication via Supabase Auth.
                  </p>
                )}
              </div>
              <div className="security-card-action">
                {isGoogle ? (
                  <a
                    href="https://myaccount.google.com/security"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="secondary-button"
                  >
                    <span className="material-symbols-outlined">open_in_new</span>
                    Google Security
                  </a>
                ) : (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handlePasswordReset}
                    disabled={isSendingReset}
                  >
                    <span className="material-symbols-outlined">
                      {isSendingReset ? "sync" : "lock_reset"}
                    </span>
                    {isSendingReset ? "Sending…" : "Reset Password"}
                  </button>
                )}
              </div>
            </div>

            {/* Session Management & Sign Out Card */}
            <div className="security-card">
              <div className="security-card-icon danger-icon">
                <span className="material-symbols-outlined">logout</span>
              </div>
              <div className="security-card-body">
                <h4>Sign Out of Current Session</h4>
                <p>
                  End your authenticated session on this device. You can sign back in at any time with Google or your email credentials.
                </p>
              </div>
              <div className="security-card-action">
                <button
                  type="button"
                  className="secondary-button danger-button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  <span className="material-symbols-outlined">logout</span>
                  {isSigningOut ? "Signing out…" : "Sign Out"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 4: App Preferences & Workspace Data ───────── */}
        <section className="panel settings-panel" aria-labelledby="settings-data-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">STORAGE &amp; BACKUP</span>
              <h2 id="settings-data-title">Workspace Data &amp; Export</h2>
              <p>Export your agronomic parameters or reset your local browser cache.</p>
            </div>
            <span className="material-symbols-outlined panel-header-icon">
              database
            </span>
          </div>

          {exportSuccess && (
            <div className="auth-success-banner settings-feedback" role="status">
              <span className="material-symbols-outlined">download_done</span>
              <span>{exportSuccess}</span>
            </div>
          )}

          {resetSuccess && (
            <div className="auth-success-banner settings-feedback" role="status">
              <span className="material-symbols-outlined">check_circle</span>
              <span>{resetSuccess}</span>
            </div>
          )}

          <div className="security-cards-list">
            {/* Export JSON Card */}
            <div className="security-card">
              <div className="security-card-icon">
                <span className="material-symbols-outlined">file_download</span>
              </div>
              <div className="security-card-body">
                <h4>Export Workspace Configuration (.json)</h4>
                <p>
                  Downloads a structured JSON file containing your saved farm dimensions, soil classification, water reserves, budget, and local preferences.
                </p>
              </div>
              <div className="security-card-action">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleExportData}
                >
                  <span className="material-symbols-outlined">download</span>
                  Export JSON
                </button>
              </div>
            </div>

            {/* Reset Workspace Card */}
            <div className="security-card">
              <div className="security-card-icon danger-icon">
                <span className="material-symbols-outlined">delete_forever</span>
              </div>
              <div className="security-card-body">
                <h4>Clear Saved Farm Workspace</h4>
                <p>
                  Clears the active farm inputs and crop planning calculations stored in this browser. Your Supabase user account remains completely unaffected.
                </p>

                {resetConfirming && (
                  <div className="settings-confirm-box">
                    <p>
                      <strong>Are you sure?</strong> This will remove your saved farm details from this device.
                    </p>
                    <div className="confirm-btn-row">
                      <button
                        type="button"
                        className="primary-button danger-button"
                        onClick={handleResetWorkspace}
                      >
                        Yes, Clear Workspace
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setResetConfirming(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="security-card-action">
                {!resetConfirming && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setResetConfirming(true);
                      setResetSuccess("");
                    }}
                  >
                    <span className="material-symbols-outlined">restart_alt</span>
                    Reset Data
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
