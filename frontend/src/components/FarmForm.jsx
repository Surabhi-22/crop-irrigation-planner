import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { validateFarm } from "../services/farmApi";
import { ApiError, NetworkError } from "../services/apiClient";
import VoiceFieldInput from "./VoiceFieldInput";
import FarmVoiceAssistant from "./FarmVoiceAssistant";
import { resolveDistrict, isWithinKarnataka, findNearestDistrict } from "../data/karnatakaDistricts";
import DistrictAgriInfo from "./DistrictAgriInfo";
import WeatherPanel from "./WeatherPanel";
import {
  getCurrentDeviceLocation,
  reverseGeocode,
  parseGeolocationError,
} from "../services/geocodingApi";

// Lazy-load Leaflet map only when needed
const AgriMap = lazy(() => import("./AgriMap"));
import "leaflet/dist/leaflet.css";

const DEFAULT_FARM = {
  name: "My Farm Plot",
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
    name: initialData?.name || initialData?.farmName || DEFAULT_FARM.name,
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
      initialData?.budget !== undefined && initialData?.budget !== null
        ? String(initialData.budget)
        : (initialData?.unconstrainedBudget ? "" : DEFAULT_FARM.budget),
    unconstrainedBudget: Boolean(
      initialData?.unconstrainedBudget ||
      initialData?.isBudgetUnconstrained ||
      initialData?.budget === null
    ),
  }));

  // ── Map / location state ─────────────────────────────────────────────
  const [farmCoords, setFarmCoords] = useState(
    initialData?.lat != null && initialData?.lon != null
      ? { lat: initialData.lat, lon: initialData.lon }
      : null
  );
  const [locationConfirmed, setLocationConfirmed] = useState(
    Boolean(initialData?.lat != null && initialData?.lon != null)
  );
  const [resolvedDistrict, setResolvedDistrict] = useState(
    initialData?.location ? resolveDistrict(initialData.location) : null
  );
  const [showMap, setShowMap] = useState(true);

  // ── GPS Auto-detection states ─────────────────────────────────────────
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationDetectionError, setLocationDetectionError] = useState(null);
  const [locationNotice, setLocationNotice] = useState(null);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingNotice, setSubmittingNotice] = useState("");
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

    if (name === "location") {
      setResolvedDistrict(resolveDistrict(value));
      setLocationDetectionError(null);
      setLocationNotice(null);
    }
  }

  function handleApplyVoiceProposal(proposedFields) {
    if (!proposedFields || typeof proposedFields !== 'object') return;
    setFarm((prev) => {
      const next = {
        ...prev,
        ...proposedFields,
        name: proposedFields.farmName || proposedFields.name || prev.name,
      };
      if (proposedFields.location) {
        setResolvedDistrict(resolveDistrict(proposedFields.location));
        setLocationDetectionError(null);
        setLocationNotice(null);
      }
      return next;
    });
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
    setFarmCoords(null);
    setLocationConfirmed(false);
    setResolvedDistrict(null);
    setLocationDetectionError(null);
    setLocationNotice(null);
    setIsModified(false);
    setError("");
    setServerSuccess("");

    if (typeof onReset === "function") {
      onReset();
    }
  }

  /**
   * Automatically detects the farmer's GPS position via the browser Geolocation API,
   * performs reverse geocoding via Nominatim with offline Karnataka centroid fallback,
   * validates against Karnataka boundaries, and populates the location field.
   */
  async function handleAutoDetectLocation() {
    setLocationDetectionError(null);
    setLocationNotice(null);
    setDetectingLocation(true);

    try {
      const pos = await getCurrentDeviceLocation({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      });

      const { lat, lon } = pos;
      const withinKA = isWithinKarnataka(lat, lon);
      let address = null;
      let detectedLocation = "";
      let matchedDistrict = null;

      try {
        address = await reverseGeocode(lat, lon);
      } catch (revErr) {
        console.warn("[FarmForm] Reverse geocode request failed, falling back to local dataset:", revErr);
      }

      if (withinKA) {
        // Within Karnataka: resolve district via reverse geocode or nearest centroid
        if (address?.district) {
          matchedDistrict = resolveDistrict(address.district);
        }
        if (!matchedDistrict) {
          matchedDistrict = findNearestDistrict(lat, lon);
        }

        const subArea = address?.village || address?.suburb || address?.taluk || address?.town;
        if (matchedDistrict) {
          detectedLocation = subArea ? `${subArea}, ${matchedDistrict.name}` : matchedDistrict.name;
        } else if (address?.district) {
          detectedLocation = address.district;
        } else {
          detectedLocation = `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
        }
        setLocationNotice(null);
      } else {
        // Outside Karnataka: Do NOT assign to nearest Karnataka district!
        matchedDistrict = null;
        const parts = [
          address?.village || address?.suburb || address?.taluk || address?.town,
          address?.district || address?.county,
          address?.state,
        ].filter(Boolean);

        detectedLocation = parts.length > 0 ? parts.join(", ") : `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;

        setLocationNotice({
          type: "warning",
          title: "Location Outside Karnataka",
          message: `Detected location (${detectedLocation}) is outside Karnataka. Note: District-specific ML yield models and agro-climatic normals are calibrated exclusively for Karnataka's 30 agricultural districts. General farm feasibility and water allocation will still be computed from your input parameters.`,
        });
      }

      setFarm((prev) => {
        const next = { ...prev, location: detectedLocation };
        // Populate rainfall normal if in Karnataka and current rainfall is empty or default
        if (
          matchedDistrict?.annualRainfallNormalMm &&
          (!prev.rainfall || prev.rainfall === DEFAULT_FARM.rainfall)
        ) {
          next.rainfall = String(matchedDistrict.annualRainfallNormalMm);
        }
        return next;
      });

      setFarmCoords({ lat, lon });
      setLocationConfirmed(true);
      setResolvedDistrict(matchedDistrict);
      setIsModified(true);
      setError("");
      setServerSuccess("");
    } catch (err) {
      const parsed = parseGeolocationError(err);
      setLocationDetectionError(parsed);
      // DO NOT silently overwrite with Bengaluru on error!
    } finally {
      setDetectingLocation(false);
    }
  }

  /**
   * Called by AgriMap when a user stages a location (GPS detect, search, or map click/drag).
   */
  function handleMapLocationSelect({ lat, lon, district, mlDistrictKey, address, isConfirmed }) {
    if (lat == null || lon == null) {
      setFarmCoords(null);
      setResolvedDistrict(null);
      setLocationConfirmed(false);
      return;
    }

    const districtRecord = mlDistrictKey
      ? resolveDistrict(district || mlDistrictKey)
      : (district ? resolveDistrict(district) : null);
    setResolvedDistrict(districtRecord);

    if (isConfirmed) {
      handleMapLocationConfirm({ lat, lon, district, mlDistrictKey, address });
    }
  }

  /**
   * Called when user explicitly clicks "Confirm Farm Location" on AgriMap.
   * Confirms coordinates, syncs location text, and stores GPS coordinates.
   */
  function handleMapLocationConfirm({ lat, lon, district, mlDistrictKey, address }) {
    setFarmCoords({ lat, lon });
    setLocationConfirmed(true);

    const districtRecord = mlDistrictKey
      ? resolveDistrict(district || mlDistrictKey)
      : (district ? resolveDistrict(district) : null);
    setResolvedDistrict(districtRecord);

    const locationName =
      districtRecord?.name ||
      district ||
      address?.village ||
      address?.taluk ||
      address?.district ||
      (lat != null ? `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E` : "");

    if (locationName) {
      setFarm((prev) => {
        const next = { ...prev, location: locationName };
        // Auto-populate rainfall normal if current rainfall is default or empty
        if (
          districtRecord?.annualRainfallNormalMm &&
          (!prev.rainfall || prev.rainfall === DEFAULT_FARM.rainfall)
        ) {
          next.rainfall = String(districtRecord.annualRainfallNormalMm);
        }
        return next;
      });
      setIsModified(true);
      setError("");
      setServerSuccess(`Farm location confirmed at ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E (${locationName})`);
    }
  }


  async function handleSubmit(event) {
    event.preventDefault();

    // Prevent duplicate submissions while request is in-flight
    if (isSubmitting) return;

    const area = Number(farm.area);
    const rainfall = Number(farm.rainfall);
    const availableWater = Number(farm.availableWater);
    const isUnconstrained = Boolean(farm.unconstrainedBudget);
    const budgetNum = isUnconstrained ? null : Number(farm.budget);
    const trimmedLocation = (farm.location || "").trim();

    // ── Client-side validation ─────────────────────────────────────────
    if (
      !Number.isFinite(area) ||
      area <= 0 ||
      !Number.isFinite(rainfall) ||
      rainfall < 0 ||
      !Number.isFinite(availableWater) ||
      availableWater < 0 ||
      (!isUnconstrained && (!Number.isFinite(budgetNum) || budgetNum < 0 || farm.budget === ""))
    ) {
      setError(
        "Please provide a positive cultivation area (> 0) and non-negative values for rainfall, available water, and operational budget (or select 'No fixed budget limit')."
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
      budget: budgetNum,
      unconstrainedBudget: isUnconstrained,
      ...(farmCoords ? { lat: farmCoords.lat, lon: farmCoords.lon } : {}),
      ...(resolvedDistrict ? { mlDistrictKey: resolvedDistrict.mlDistrictKey } : {}),
    };

    // ── Server-side validation via FastAPI endpoint ─────────────────────
    setError("");
    setServerSuccess("");
    setSubmittingNotice("");
    setIsSubmitting(true);

    const spinUpTimer = setTimeout(() => {
      setSubmittingNotice("Connecting to server (waking up cloud backend, please wait)…");
    }, 2500);

    try {
      const result = await validateFarm(farmData);
      clearTimeout(spinUpTimer);
      setSubmittingNotice("");
      const successMessage =
        result.message || "Farm parameters successfully validated by FastAPI server.";

      setServerSuccess(successMessage);
      setIsModified(false);
      setError("");

      timeoutRef.current = setTimeout(() => {
        setIsSubmitting(false);
        if (typeof onSubmit === "function") {
          onSubmit(
            {
              ...result.data,
              ...(farmCoords ? { lat: farmCoords.lat, lon: farmCoords.lon } : {}),
              ...(resolvedDistrict ? { mlDistrictKey: resolvedDistrict.mlDistrictKey } : {}),
            },
            successMessage
          );
        }
      }, 550);

    } catch (err) {
      clearTimeout(spinUpTimer);
      setSubmittingNotice("");
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
  const isBudgetValid = farm.unconstrainedBudget
    ? true
    : (!isNaN(budgetNum) && budgetNum >= 0 && farm.budget !== "");

  const perAcreBudget =
    farm.unconstrainedBudget
      ? null
      : (isAreaValid && isBudgetValid ? Math.round(budgetNum / areaNum) : null);

  const waterPerAcre =
    isAreaValid && isWaterValid ? Math.round(waterNum / areaNum) : null;

  const hasLocation = Boolean(farm.location && farm.location.trim());

  return (
    <div className="farm-details-workspace">
      {/* Top Configuration & Draft Control Bar */}
      <div className="farm-config-header">
        <div className="farm-config-header-info">
          <div className="farm-config-icon-badge">
            <span className="material-symbols-outlined">agriculture</span>
          </div>
          <div>
            <h2>My Farm Details</h2>
            <div className="farm-config-status">
              <span
                className={`status-dot ${isModified ? "draft" : "synced"}`}
              ></span>
              <span>
                {isModified
                  ? "Unsaved changes (click Save Farm Details below)"
                  : initialData
                  ? "Farm details saved and active"
                  : "Ready to enter your farm details"}
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
          {/* Smart Voice Assistant for multi-field dictation */}
          <FarmVoiceAssistant
            currentFarm={farm}
            onApplyProposal={handleApplyVoiceProposal}
            disabled={isSubmitting}
          />

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
                  <h3>Step 1: Land &amp; Location</h3>
                </div>
                <span className="section-badge">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px" }}
                  >
                    pin_drop
                  </span>
                  Location &amp; Season
                </span>
              </div>

              {/* ── Karnataka AgriMap & District Intelligence ─────── */}
              <div className="agrimap-section">
                <div className="agrimap-toggle-bar">
                  <div className="agrimap-toggle-label">
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>map</span>
                    <strong>Karnataka AgriMap</strong>
                    <span className="hint-pill">Click map or search to set farm location</span>
                  </div>
                  <button
                    type="button"
                    className="agrimap-toggle-btn"
                    onClick={() => setShowMap((v) => !v)}
                    aria-expanded={showMap}
                    aria-controls="agrimap-panel"
                  >
                    <span className="material-symbols-outlined">
                      {showMap ? "keyboard_arrow_up" : "keyboard_arrow_down"}
                    </span>
                    {showMap ? "Hide Map" : "Show Map"}
                  </button>
                </div>

                {showMap && (
                  <div id="agrimap-panel" className="agrimap-panel">
                    <Suspense
                      fallback={
                        <div className="agrimap-loading-placeholder">
                          <span className="material-symbols-outlined spin-icon">progress_activity</span>
                          <span>Loading Karnataka Map…</span>
                        </div>
                      }
                    >
                      <AgriMap
                        onLocationSelect={handleMapLocationSelect}
                        onLocationConfirm={handleMapLocationConfirm}
                        initialLat={farmCoords?.lat}
                        initialLon={farmCoords?.lon}
                        initialConfirmed={locationConfirmed}
                      />
                    </Suspense>

                    {/* District agri info panel — shown below map */}
                    <DistrictAgriInfo
                      district={resolvedDistrict}
                    />
                  </div>
                )}
              </div>

              {/* ── Automated Weather & Rainfall Intelligence ────────── */}
              <WeatherPanel
                farmCoords={farmCoords}
                locationConfirmed={locationConfirmed}
                locationName={farm.location}
                farmData={farm}
              />

              <div className="form-fields-grid">
                {/* Farm Name (Optional Identifier) */}
                <div className="form-group span-2">
                  <div className="label-row">
                    <label htmlFor="farm-name">
                      Farm Name
                    </label>
                    <span className="hint-pill">Farm Identifier</span>
                  </div>
                  <div className="input-with-icon voice-input-attached-group">
                    <span className="material-symbols-outlined input-prefix-icon">
                      agriculture
                    </span>
                    <input
                      id="farm-name"
                      type="text"
                      name="name"
                      value={farm.name}
                      onChange={handleChange}
                      placeholder="e.g. Green Valley Plot, Mandya Field 1"
                      disabled={isSubmitting}
                    />
                    <VoiceFieldInput
                      value={farm.name}
                      onChange={handleChange}
                      fieldName="farmName"
                      disabled={isSubmitting}
                      ariaLabel="Voice input for farm name"
                    />
                  </div>
                  <span className="field-helper">
                    Give your plot or farm an optional title or nickname.
                  </span>
                </div>

                {/* Location or District */}
                <div className="form-group span-2">
                  <div className="label-row">
                    <label htmlFor="farm-location">
                      Location or District{" "}
                      <span className="required-star">*</span>
                    </label>
                    {locationConfirmed && farmCoords ? (
                      <span className="hint-pill hint-pill--success" title="Confirmed on AgriMap">
                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>check_circle</span>
                        GPS Confirmed
                      </span>
                    ) : (
                      <span className="hint-pill">Agro District</span>
                    )}
                  </div>
                  <div className="location-input-row">
                    <div className="input-with-icon voice-input-attached-group" style={{ flex: 1 }}>
                      <span className="material-symbols-outlined input-prefix-icon">
                        pin_drop
                      </span>
                      <input
                        id="farm-location"
                        type="text"
                        name="location"
                        value={farm.location}
                        onChange={handleChange}
                        placeholder="e.g. Belagavi, Mandya, Bengaluru Rural"
                        disabled={isSubmitting || detectingLocation}
                        required
                      />
                      <VoiceFieldInput
                        value={farm.location}
                        onChange={handleChange}
                        fieldName="location"
                        disabled={isSubmitting || detectingLocation}
                        ariaLabel="Voice input for farm location"
                      />
                    </div>
                    <button
                      type="button"
                      id="detect-location-btn"
                      className={`detect-location-btn ${detectingLocation ? "loading" : ""}`}
                      onClick={handleAutoDetectLocation}
                      disabled={detectingLocation || isSubmitting}
                      title="Automatically detect current GPS location via browser"
                    >
                      <span className={`material-symbols-outlined ${detectingLocation ? "spin-icon" : ""}`}>
                        {detectingLocation ? "sync" : "my_location"}
                      </span>
                      <span>{detectingLocation ? "Detecting Location…" : "Detect My Location"}</span>
                    </button>
                  </div>

                  {locationDetectionError && (
                    <div className="location-detection-alert error" role="alert" id="location-detection-error">
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>error</span>
                      <div style={{ flex: 1 }}>
                        <strong>{locationDetectionError.title}: </strong>
                        <span>{locationDetectionError.message}</span>
                      </div>
                      <button
                        type="button"
                        className="alert-close-btn"
                        onClick={() => setLocationDetectionError(null)}
                        aria-label="Dismiss location error"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
                      </button>
                    </div>
                  )}

                  {locationNotice && (
                    <div className={`location-detection-alert ${locationNotice.type}`} role="status" id="location-detection-notice">
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>info</span>
                      <div style={{ flex: 1 }}>
                        <strong>{locationNotice.title}: </strong>
                        <span>{locationNotice.message}</span>
                      </div>
                      <button
                        type="button"
                        className="alert-close-btn"
                        onClick={() => setLocationNotice(null)}
                        aria-label="Dismiss location notice"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
                      </button>
                    </div>
                  )}

                  <span className="field-helper">
                    {farmCoords
                      ? `${locationConfirmed ? "✓ Confirmed farm coordinates" : "Staged coordinates"}: ${farmCoords.lat.toFixed(5)}°N, ${farmCoords.lon.toFixed(5)}°E.`
                      : "Enter your district or click \"Detect My Location\" to auto-pinpoint coordinates."}
                  </span>
                </div>


                {/* Cultivation Area */}
                <div className="form-group">
                  <div className="label-row">
                    <label htmlFor="cultivation-area">
                      Land Area <span className="required-star">*</span>
                    </label>
                  </div>
                  <div className="input-with-addon voice-input-attached-group">
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
                    <VoiceFieldInput
                      value={farm.area}
                      onChange={handleChange}
                      fieldName="area"
                      disabled={isSubmitting}
                      ariaLabel="Voice input for land area"
                    />
                  </div>
                  <span className="field-helper">
                    Total land area you plan to cultivate (must be greater than 0).
                  </span>
                </div>

                {/* Growing Season */}
                <div className="form-group">
                  <div className="label-row">
                    <label htmlFor="growing-season">
                      Planting Season <span className="required-star">*</span>
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
                      <option value="Kharif">Kharif (Monsoon Season / Jun–Nov)</option>
                      <option value="Rabi">Rabi (Winter Season / Nov–Apr)</option>
                      <option value="Summer">Summer (Zaid Season / Mar–Jun)</option>
                    </select>
                    <span className="material-symbols-outlined select-arrow">
                      unfold_more
                    </span>
                  </div>
                  <span className="field-helper">
                    Choose the planting cycle you are preparing for.
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
                  <h3>Step 2: Soil &amp; Water Supply</h3>
                </div>
                <span className="section-badge">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px" }}
                  >
                    water_drop
                  </span>
                  Soil &amp; Water
                </span>
              </div>

              <div className="form-fields-grid">
                {/* Soil Type */}
                <div className="form-group span-2">
                  <div className="label-row">
                    <label htmlFor="soil-type">
                      Soil Type{" "}
                      <span className="required-star">*</span>
                    </label>
                    <span className="hint-pill">Soil Quality</span>
                  </div>
                  <div className="select-with-arrow voice-input-attached-group">
                    <select
                      id="soil-type"
                      name="soilType"
                      value={farm.soilType}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    >
                      <option value="Loamy">
                        Loamy (Medium soil — balanced drainage &amp; good moisture retention)
                      </option>
                      <option value="Clay">
                        Clay (Heavy soil — holds water very well, slower drainage)
                      </option>
                      <option value="Sandy">
                        Sandy (Light soil — drains quickly, needs regular watering)
                      </option>
                      <option value="Silty">
                        Silty (Smooth fertile soil — fertile with good water holding)
                      </option>
                    </select>
                    <span className="material-symbols-outlined select-arrow">
                      unfold_more
                    </span>
                    <VoiceFieldInput
                      value={farm.soilType}
                      onChange={handleChange}
                      fieldName="soilType"
                      disabled={isSubmitting}
                      ariaLabel="Voice input for soil type"
                    />
                  </div>
                  <span className="field-helper">
                    Different crops thrive in different soils. Select the predominant soil in your field.
                  </span>
                </div>

                {/* Expected Seasonal Rainfall */}
                <div className="form-group">
                  <div className="label-row">
                    <label htmlFor="expected-rainfall">
                      Expected Rainfall{" "}
                      <span className="required-star">*</span>
                    </label>
                  </div>
                  <div className="input-with-addon voice-input-attached-group">
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
                    <VoiceFieldInput
                      value={farm.rainfall}
                      onChange={handleChange}
                      fieldName="rainfall"
                      disabled={isSubmitting}
                      ariaLabel="Voice input for expected rainfall"
                    />
                  </div>
                  <span className="field-helper">
                    Typical seasonal rainfall for your district (650 mm is standard in monsoon).
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
                  <div className="input-with-addon voice-input-attached-group">
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
                    <VoiceFieldInput
                      value={farm.availableWater}
                      onChange={handleChange}
                      fieldName="availableWater"
                      disabled={isSubmitting}
                      ariaLabel="Voice input for available irrigation water"
                    />
                  </div>
                  <span className="field-helper">
                    Total irrigation water available from borewells, canals, or farm ponds (1 m³ ≈ 1,000 liters).
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
                  <h3>Step 3: Farm Budget</h3>
                </div>
                <span className="section-badge">
                  Rupees (₹)
                </span>
              </div>

              <div className="form-fields-grid">
                {/* Total Operational Budget */}
                <div className="form-group span-2">
                  <div className="label-row">
                    <label htmlFor="farm-budget">
                      Total Farming Budget{" "}
                      {!farm.unconstrainedBudget && <span className="required-star">*</span>}
                    </label>
                    {farm.unconstrainedBudget ? (
                      <span className="hint-pill font-tabular" style={{ background: "#ecfdf5", color: "#065f46", borderColor: "#a7f3d0" }}>
                        No Fixed Limit (Unconstrained)
                      </span>
                    ) : (
                      perAcreBudget !== null && (
                        <span className="hint-pill font-tabular">
                          ₹ {perAcreBudget.toLocaleString("en-IN")} / Acre
                        </span>
                      )
                    )}
                  </div>

                  <div className="budget-unconstrained-row" style={{ marginBottom: "10px" }}>
                    <label className="checkbox-toggle-label" style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.88rem", fontWeight: "600", color: "#374151" }}>
                      <input
                        id="unconstrained-budget-toggle"
                        type="checkbox"
                        name="unconstrainedBudget"
                        checked={Boolean(farm.unconstrainedBudget)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFarm((prev) => ({
                            ...prev,
                            unconstrainedBudget: checked,
                            budget: checked ? "" : (prev.budget || DEFAULT_FARM.budget),
                          }));
                          setIsModified(true);
                        }}
                        disabled={isSubmitting}
                      />
                      <span>No fixed budget limit (plan assuming unconstrained working capital)</span>
                    </label>
                  </div>

                  <div className="input-with-addon">
                    <span className="input-prefix-addon">₹</span>
                    <input
                      id="farm-budget"
                      type="number"
                      name="budget"
                      min="0"
                      step="any"
                      value={farm.unconstrainedBudget ? "" : farm.budget}
                      onChange={handleChange}
                      placeholder={farm.unconstrainedBudget ? "Unconstrained (No Limit)" : "e.g. 100000"}
                      disabled={isSubmitting || farm.unconstrainedBudget}
                      required={!farm.unconstrainedBudget}
                      style={{ paddingLeft: "32px", opacity: farm.unconstrainedBudget ? 0.6 : 1 }}
                    />
                    <span className="input-suffix-addon">INR</span>
                  </div>
                  <span className="field-helper">
                    {farm.unconstrainedBudget
                      ? "Planning will evaluate full farm capacity without capital restriction."
                      : "Total funds available for seeds, fertilizers, tractor work, and farm labor (enter 0 for zero capital)."}
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
                  <strong>Please Check Your Inputs</strong>
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
                  <strong>Farm Details Verified</strong>
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
                    ? submittingNotice || "Validating farm parameters and preparing your crop plan…"
                    : serverSuccess
                    ? "Farm parameters validated and saved successfully."
                    : error
                    ? "Please check the highlighted fields above."
                    : "Ready to save and calculate crop recommendations."}
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
                      ? "Saving & Planning…"
                      : serverSuccess
                      ? "Saved & Ready"
                      : "Save & Plan Crops"}
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