/**
 * AgriMap — Production-Quality Blinkit-Style Location Picker
 *
 * Implements two equally convenient location options:
 * 1. Automatic: "Use My Current Location" via browser Geolocation API (high accuracy, timeout, accuracy ring).
 * 2. Manual: Karnataka address/village search with autocomplete + interactive map click & draggable marker.
 *
 * Confirmation:
 *   Dedicated "Confirm Farm Location" dock so device-detected positions are never
 *   confused with confirmed farm coordinates. Users review, fine-tune, and confirm.
 *
 * Tile Provider:
 *   Uses OpenStreetMap Standard tiles. Fully documented, open, reliable, no API key required.
 *   Fixes the Carto "API KEY REQUIRED" watermark issue.
 *   Attribution: © OpenStreetMap contributors
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import {
  KARNATAKA_CENTER,
  KARNATAKA_ZOOM,
  resolveDistrict,
  isWithinKarnataka,
  findNearestDistrict,
} from "../data/karnatakaDistricts";
import {
  reverseGeocode,
  searchPlace,
  getCurrentDeviceLocation,
  parseGeolocationError,
  formatCoordinates,
  formatAccuracy,
  debounce,
} from "../services/geocodingApi";

// ── Fix Leaflet marker icons under Vite ──────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/** Custom farm pin icon styled in agricultural emerald */
const FARM_MARKER_ICON = L.divIcon({
  className: "agrimap-farm-marker",
  html: `<div class="agrimap-pin-pulse"></div>
         <span class="material-symbols-outlined agrimap-pin-icon">location_on</span>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -34],
});

// ── Map interaction handler (click on map) ──────────────────────────────────
function MapInteractionHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng, "map");
    },
  });
  return null;
}

// ── Smooth fly-to animation on coordinate change ────────────────────────────
function FlyToLocation({ lat, lon, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lon != null) {
      const targetZoom = zoom || Math.max(map.getZoom(), 13);
      map.flyTo([lat, lon], targetZoom, {
        animate: true,
        duration: 1.2,
      });
    }
  }, [lat, lon, zoom, map]);
  return null;
}

// ── Search autocomplete sub-component ───────────────────────────────────────
function SearchBox({ onSelectLocation, disabled }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const boxRef = useRef(null);

  const runSearchRef = useRef(null);
  if (runSearchRef.current == null) {
    runSearchRef.current = debounce(async (text) => {
      if (!text || text.trim().length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      setSearching(true);
      const found = await searchPlace(text);
      setResults(found);
      setIsOpen(found.length > 0);
      setSearching(false);
    }, 350);
  }

  function handleInputChange(e) {
    const val = e.target.value;
    setQuery(val);
    runSearchRef.current(val);
  }

  function handleResultClick(r) {
    const shortName = r.displayName.split(",")[0].trim();
    setQuery(shortName);
    setResults([]);
    setIsOpen(false);
    onSelectLocation(r.lat, r.lon, "search", r.displayName);
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="agrimap-searchbox" ref={boxRef}>
      <div className="agrimap-searchbox-inner">
        <span className="material-symbols-outlined agrimap-search-icon" aria-hidden="true">
          {searching ? "progress_activity" : "search"}
        </span>
        <input
          type="text"
          className="agrimap-search-input"
          placeholder="Search village, town, or district in Karnataka…"
          value={query}
          onChange={handleInputChange}
          disabled={disabled}
          aria-label="Search village or district"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="agrimap-search-clear"
            onClick={handleClear}
            aria-label="Clear search query"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="agrimap-search-results" role="listbox" aria-label="Search suggestions">
          {results.map((r) => (
            <li
              key={r.osmId || `${r.lat}-${r.lon}`}
              className="agrimap-search-result-item"
              role="option"
              onMouseDown={() => handleResultClick(r)}
            >
              <span className="material-symbols-outlined agrimap-result-icon">
                {r.isDistrictCentroid ? "hub" : "pin_drop"}
              </span>
              <div className="agrimap-result-text">
                <div className="agrimap-result-title">
                  {r.displayName.split(",")[0].trim()}
                </div>
                <div className="agrimap-result-sub">
                  {r.displayName.split(",").slice(1, 3).join(",").trim()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main AgriMap Component ──────────────────────────────────────────────────
export default function AgriMap({
  onLocationSelect,
  onLocationConfirm,
  initialLat,
  initialLon,
  initialConfirmed = false,
}) {
  // Staged marker position (unconfirmed until user clicks "Confirm Farm Location")
  const [markerPos, setMarkerPos] = useState(
    initialLat != null && initialLon != null
      ? { lat: initialLat, lon: initialLon }
      : null
  );

  // Confirmed state
  const [isConfirmed, setIsConfirmed] = useState(
    initialConfirmed && initialLat != null && initialLon != null
  );

  // Metadata
  const [source, setSource] = useState(
    initialLat != null ? "saved" : null
  ); // 'gps' | 'search' | 'map' | 'drag' | 'saved'
  const [deviceAccuracy, setDeviceAccuracy] = useState(null); // meters
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  // Geocoding status
  const [geocoding, setGeocoding] = useState(false);
  const [resolvedDistrict, setResolvedDistrict] = useState(null);
  const [addressDetails, setAddressDetails] = useState(null);
  const [outOfBounds, setOutOfBounds] = useState(false);

  // Latest position ref for safe async completion
  const latestPosRef = useRef(markerPos);
  useEffect(() => {
    latestPosRef.current = markerPos;
  }, [markerPos]);

  // ── Unified coordinate staging function ─────────────────────────────────────
  const stageCoordinates = useCallback(
    async (lat, lon, selectionSource = "map", explicitName = null, accuracy = null) => {
      const withinKA = isWithinKarnataka(lat, lon);
      setOutOfBounds(!withinKA);
      setMarkerPos({ lat, lon });
      setSource(selectionSource);
      setDeviceAccuracy(accuracy);
      setIsConfirmed(false); // Staged, awaiting explicit confirmation
      setGpsError(null);

      // Notify parent that coordinates were picked/staged (unconfirmed)
      onLocationSelect?.({
        lat,
        lon,
        source: selectionSource,
        accuracy,
        isConfirmed: false,
      });

      if (!withinKA) {
        setResolvedDistrict(null);
        setAddressDetails(null);
        return;
      }

      setGeocoding(true);
      let addr = null;
      let district = null;

      try {
        addr = await reverseGeocode(lat, lon);
        if (addr?.district) {
          district = resolveDistrict(addr.district);
        }
        if (!district && explicitName) {
          district = resolveDistrict(explicitName);
        }
        // Fallback to geographic nearest centroid if Nominatim had no county/district
        if (!district) {
          district = findNearestDistrict(lat, lon);
        }
      } catch (err) {
        console.warn("[AgriMap] Reverse geocode failed, using nearest district centroid:", err);
        district = (explicitName ? resolveDistrict(explicitName) : null) || findNearestDistrict(lat, lon);
      } finally {
        if (
          latestPosRef.current?.lat === lat &&
          latestPosRef.current?.lon === lon
        ) {
          setAddressDetails(addr);
          setResolvedDistrict(district);
          setGeocoding(false);

          onLocationSelect?.({
            lat,
            lon,
            district: district?.name || addr?.district || null,
            mlDistrictKey: district?.mlDistrictKey || null,
            address: addr,
            source: selectionSource,
            accuracy,
            isConfirmed: false,
          });
        }
      }
    },
    [onLocationSelect]
  );

  // ── Automatic Location: Geolocation API ─────────────────────────────────────
  async function handleDetectLocation() {
    setGpsError(null);
    setDetectingGps(true);

    try {
      const pos = await getCurrentDeviceLocation({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      });

      await stageCoordinates(pos.lat, pos.lon, "gps", null, pos.accuracy);
    } catch (err) {
      const parsed = parseGeolocationError(err);
      setGpsError(parsed);
    } finally {
      setDetectingGps(false);
    }
  }

  // ── Explicit Confirmation: "Confirm Farm Location" ──────────────────────────
  function handleConfirmLocation() {
    if (!markerPos) return;

    setIsConfirmed(true);

    const payload = {
      lat: markerPos.lat,
      lon: markerPos.lon,
      district: resolvedDistrict?.name || addressDetails?.district || null,
      mlDistrictKey: resolvedDistrict?.mlDistrictKey || null,
      address: addressDetails,
      accuracy: deviceAccuracy,
      source,
      isConfirmed: true,
    };

    // Notify listeners
    onLocationConfirm?.(payload);
    onLocationSelect?.(payload);
  }

  // ── Reset / Clear Location ──────────────────────────────────────────────────
  function handleClearLocation() {
    setMarkerPos(null);
    setIsConfirmed(false);
    setSource(null);
    setDeviceAccuracy(null);
    setResolvedDistrict(null);
    setAddressDetails(null);
    setOutOfBounds(false);
    setGpsError(null);

    onLocationSelect?.({
      lat: null,
      lon: null,
      district: null,
      mlDistrictKey: null,
      address: null,
      isConfirmed: false,
    });
  }

  // Fly target
  const flyTarget = markerPos ? { lat: markerPos.lat, lon: markerPos.lon } : null;

  // Formatted location display title
  const locationTitle =
    addressDetails?.village ||
    addressDetails?.taluk ||
    resolvedDistrict?.name ||
    (markerPos ? formatCoordinates(markerPos.lat, markerPos.lon) : "No location selected");

  return (
    <div className="agrimap-container">
      {/* ── Blinkit-style Option Bar (Automatic + Manual Search) ────────────── */}
      <div className="agrimap-action-bar">
        {/* Option 1: Automatic "Use My Current Location" */}
        <button
          type="button"
          className={`agrimap-btn-locate ${detectingGps ? "loading" : ""}`}
          onClick={handleDetectLocation}
          disabled={detectingGps}
          title="Detect device GPS coordinates via browser location"
        >
          <span className={`material-symbols-outlined agrimap-locate-icon ${detectingGps ? "spin-icon" : ""}`}>
            {detectingGps ? "sync" : "my_location"}
          </span>
          <span className="agrimap-locate-text">
            {detectingGps ? "Detecting GPS Location…" : "Use My Current Location"}
          </span>
        </button>

        {/* Option 2: Manual Search */}
        <div className="agrimap-search-area">
          <SearchBox
            onSelectLocation={stageCoordinates}
            disabled={detectingGps || geocoding}
          />
        </div>
      </div>

      {/* ── Geolocation Error Notice (Graceful Recovery) ───────────────────── */}
      {gpsError && (
        <div className="agrimap-alert warning" role="alert">
          <span className="material-symbols-outlined agrimap-alert-icon">location_disabled</span>
          <div className="agrimap-alert-body">
            <strong>{gpsError.title}</strong>
            <p>{gpsError.message}</p>
          </div>
          <button
            type="button"
            className="agrimap-alert-dismiss"
            onClick={() => setGpsError(null)}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Interactive Map Canvas ────────────────────────────────────────── */}
      <div className="agrimap-map-wrapper">
        <MapContainer
          center={KARNATAKA_CENTER}
          zoom={KARNATAKA_ZOOM}
          scrollWheelZoom
          className="agrimap-leaflet-map"
          aria-label="Karnataka Agricultural Map"
        >
          {/* OpenStreetMap Standard Tiles (No CARTO API Key Required) */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
            maxZoom={19}
          />

          <MapInteractionHandler onMapClick={stageCoordinates} />

          {flyTarget && (
            <FlyToLocation lat={flyTarget.lat} lon={flyTarget.lon} />
          )}

          {/* GPS Accuracy Radius (Circle) when detected from device */}
          {markerPos && deviceAccuracy != null && deviceAccuracy > 0 && (
            <Circle
              center={[markerPos.lat, markerPos.lon]}
              radius={deviceAccuracy}
              pathOptions={{
                color: "#2e6b43",
                fillColor: "#4a7c59",
                fillOpacity: 0.15,
                weight: 1.5,
              }}
            />
          )}

          {/* Draggable Farm Marker */}
          {markerPos && (
            <Marker
              position={[markerPos.lat, markerPos.lon]}
              icon={FARM_MARKER_ICON}
              draggable
              eventHandlers={{
                dragend(e) {
                  const { lat, lng } = e.target.getLatLng();
                  stageCoordinates(lat, lng, "drag");
                },
              }}
            >
              <Popup>
                <div className="agrimap-popup-content">
                  <div className="agrimap-popup-title">
                    <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#2e6b43" }}>
                      agriculture
                    </span>
                    <strong>Farm Location</strong>
                  </div>
                  <div className="agrimap-popup-coords font-tabular">
                    {formatCoordinates(markerPos.lat, markerPos.lon)}
                  </div>
                  {resolvedDistrict && (
                    <div className="agrimap-popup-district">
                      {resolvedDistrict.name} District (Zone {resolvedDistrict.zone})
                    </div>
                  )}
                  <div className="agrimap-popup-hint">
                    💡 Drag pin to adjust exact field position
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* ── Out-of-bounds Warning ─────────────────────────────────────────── */}
      {outOfBounds && (
        <div className="agrimap-alert warning" role="alert">
          <span className="material-symbols-outlined">warning</span>
          <div className="agrimap-alert-body">
            <strong>Coordinates Outside Karnataka</strong>
            <p>
              The selected point falls outside Karnataka's state boundary.
              Crop models, weather lookups, and agro-climatic norms are calibrated specifically for Karnataka.
            </p>
          </div>
        </div>
      )}

      {/* ── Blank Slate Guide ─────────────────────────────────────────────── */}
      {!markerPos && (
        <div className="agrimap-guide-banner">
          <span className="material-symbols-outlined">touch_app</span>
          <span>
            Choose an option above: click <strong>"Use My Current Location"</strong>, search your village or district, or click anywhere on the map to place your farm pin.
          </span>
        </div>
      )}

      {/* ── Blinkit-Style Confirmation Card ───────────────────────────────── */}
      {markerPos && !outOfBounds && (
        <div className={`agrimap-confirmation-card ${isConfirmed ? "is-confirmed" : "is-pending"}`}>
          <div className="agrimap-card-top">
            <div className="agrimap-card-header">
              <span className="material-symbols-outlined agrimap-card-icon">
                {isConfirmed ? "verified" : "location_on"}
              </span>
              <div className="agrimap-card-title-group">
                <div className="agrimap-card-title">
                  {geocoding ? "Resolving location address…" : locationTitle}
                </div>
                <div className="agrimap-card-subtitle">
                  {addressDetails?.district
                    ? `${addressDetails.district} District, Karnataka`
                    : resolvedDistrict
                    ? `${resolvedDistrict.name} District, Karnataka`
                    : "Karnataka, India"}
                </div>
              </div>
            </div>

            {/* Source & Status Badges */}
            <div className="agrimap-card-badges">
              {source === "gps" && (
                <span className="agrimap-badge badge-gps">
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>gps_fixed</span>
                  GPS Detected {deviceAccuracy ? `(${formatAccuracy(deviceAccuracy)})` : ""}
                </span>
              )}
              {source === "search" && (
                <span className="agrimap-badge badge-search">
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>search</span>
                  Search Result
                </span>
              )}
              {source === "drag" && (
                <span className="agrimap-badge badge-manual">
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>pan_tool</span>
                  Pin Adjusted
                </span>
              )}

              {isConfirmed ? (
                <span className="agrimap-status-pill pill-confirmed">
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>check_circle</span>
                  Farm Location Confirmed
                </span>
              ) : (
                <span className="agrimap-status-pill pill-pending">
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>pending</span>
                  Review & Confirm
                </span>
              )}
            </div>
          </div>

          {/* Coordinates & Agricultural District Specs */}
          <div className="agrimap-card-details">
            <div className="agrimap-detail-item">
              <span className="detail-label">GPS Coordinates</span>
              <span className="detail-val font-tabular">
                {formatCoordinates(markerPos.lat, markerPos.lon, 5)}
              </span>
            </div>

            {resolvedDistrict && (
              <div className="agrimap-detail-item">
                <span className="detail-label">Agro-Climatic Zone</span>
                <span className="detail-val">
                  Zone {resolvedDistrict.zone} — {resolvedDistrict.zoneName}
                </span>
              </div>
            )}

            {addressDetails?.taluk && (
              <div className="agrimap-detail-item">
                <span className="detail-label">Taluk / Sub-District</span>
                <span className="detail-val">{addressDetails.taluk}</span>
              </div>
            )}
          </div>

          {/* CTA Actions */}
          <div className="agrimap-card-actions">
            <button
              type="button"
              className={`agrimap-btn-confirm ${isConfirmed ? "confirmed" : ""}`}
              onClick={handleConfirmLocation}
            >
              <span className="material-symbols-outlined">
                {isConfirmed ? "check_circle" : "task_alt"}
              </span>
              <span>
                {isConfirmed ? "Farm Location Confirmed" : "Confirm Farm Location"}
              </span>
            </button>

            <button
              type="button"
              className="agrimap-btn-clear"
              onClick={handleClearLocation}
              title="Clear selected coordinates"
            >
              <span className="material-symbols-outlined">restart_alt</span>
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
