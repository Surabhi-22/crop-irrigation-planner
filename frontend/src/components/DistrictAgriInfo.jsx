/**
 * DistrictAgriInfo — District-Level Agricultural Information Panel
 *
 * Displays verified agricultural reference data for the selected Karnataka
 * district. All data is sourced from documented government publications;
 * unavailable fields show an explicit "Data not available" state.
 *
 * Data sources:
 *   - Agro-climatic zones: UAS Bengaluru / Karnataka State DOA
 *   - Annual rainfall normals: IMD District-wise Rainfall Normal (2021)
 *   - Dominant soil groups: NBSS&LUP Karnataka Soil Surveys
 *
 * Props:
 *   district — DistrictRecord from karnatakaDistricts.js, or null
 *   loading   — boolean: true while geocoding is in progress
 */



/** Zone colour coding to match the design system's green palette. */
const ZONE_COLORS = {
  1: { bg: "#e8f5e9", text: "#1b5e20", border: "#a5d6a7" },
  2: { bg: "#fff3e0", text: "#e65100", border: "#ffcc80" },
  3: { bg: "#fce4ec", text: "#880e4f", border: "#f48fb1" },
  4: { bg: "#e3f2fd", text: "#0d47a1", border: "#90caf9" },
  5: { bg: "#f3e5f5", text: "#4a148c", border: "#ce93d8" },
  6: { bg: "#e0f7fa", text: "#006064", border: "#80deea" },
  7: { bg: "#f9fbe7", text: "#33691e", border: "#c5e1a5" },
  8: { bg: "#efebe9", text: "#3e2723", border: "#bcaaa4" },
  9: { bg: "#f9fbe7", text: "#33691e", border: "#c5e1a5" },
  10: { bg: "#e8f5e9", text: "#1b5e20", border: "#a5d6a7" },
};

function DataRow({ label, value, subtext, unavailable, source }) {
  return (
    <div className="agriinfo-data-row">
      <span className="agriinfo-label">{label}</span>
      <div className="agriinfo-value-group">
        {unavailable ? (
          <span className="agriinfo-unavailable">Data not available</span>
        ) : (
          <>
            <span className="agriinfo-value">{value}</span>
            {subtext && <span className="agriinfo-subtext">{subtext}</span>}
          </>
        )}
        {source && (
          <span className="agriinfo-source">Source: {source}</span>
        )}
      </div>
    </div>
  );
}

export default function DistrictAgriInfo({ district, loading }) {
  // ── Empty / loading states ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="agriinfo-panel agriinfo-loading" aria-busy="true">
        <span className="material-symbols-outlined spin-icon" style={{ fontSize: "20px" }}>
          progress_activity
        </span>
        <span>Resolving district information…</span>
      </div>
    );
  }

  if (!district) {
    return (
      <div className="agriinfo-panel agriinfo-empty">
        <div className="agriinfo-empty-icon">
          <span className="material-symbols-outlined">map</span>
        </div>
        <div>
          <p className="agriinfo-empty-title">Select a Location on the Map</p>
          <p className="agriinfo-empty-sub">
            Click anywhere in Karnataka to see district-level agro-climatic
            data and crop-relevant information.
          </p>
        </div>
      </div>
    );
  }

  const zoneColors = ZONE_COLORS[district.zone] || ZONE_COLORS[1];

  return (
    <div className="agriinfo-panel">
      {/* District Header */}
      <div className="agriinfo-header">
        <div>
          <h4 className="agriinfo-district-name">
            <span className="material-symbols-outlined" style={{ fontSize: "18px", verticalAlign: "middle" }}>
              location_city
            </span>{" "}
            {district.name} District
          </h4>
          <p className="agriinfo-ml-key">
            ML Model Key:{" "}
            <code className="font-tabular">{district.mlDistrictKey}</code>
          </p>
        </div>

        {/* Agro-climatic zone badge */}
        <span
          className="agriinfo-zone-badge"
          style={{
            background: zoneColors.bg,
            color: zoneColors.text,
            border: `1px solid ${zoneColors.border}`,
          }}
          title={`Karnataka Agro-climatic Zone ${district.zone}: ${district.zoneName}`}
        >
          Zone {district.zone}
        </span>
      </div>

      {/* Zone name row */}
      <div
        className="agriinfo-zone-row"
        style={{
          background: zoneColors.bg,
          borderColor: zoneColors.border,
          color: zoneColors.text,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
          terrain
        </span>
        <div>
          <strong>Agro-climatic Zone {district.zone}:</strong>{" "}
          {district.zoneName}
          <br />
          <span style={{ fontSize: "11px", opacity: 0.8 }}>
            Source: University of Agricultural Sciences Bengaluru / Karnataka
            State Department of Agriculture
          </span>
        </div>
      </div>

      {/* Data rows */}
      <div className="agriinfo-data-section">
        <DataRow
          label="Annual Rainfall Normal"
          value={
            district.annualRainfallNormalMm != null
              ? `${district.annualRainfallNormalMm.toLocaleString()} mm`
              : null
          }
          subtext="30-year long-period average (LPA)"
          unavailable={district.annualRainfallNormalMm == null}
          source="IMD District-wise Rainfall Normal (IMD/HP/2021)"
        />

        <DataRow
          label="Dominant Soil Groups"
          value={
            district.dominantSoilGroups?.length
              ? district.dominantSoilGroups.join(", ")
              : null
          }
          unavailable={!district.dominantSoilGroups?.length}
          source="NBSS&LUP Karnataka Soil Survey"
        />
      </div>

      {/* Disclaimer */}
      <div className="agriinfo-disclaimer">
        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
          info
        </span>
        <p>
          Rainfall normals are district-level 30-year averages (climate
          reference). They represent typical seasonal totals, not your farm's
          specific measured rainfall. Enter your actual expected rainfall in the
          farm form below.
        </p>
      </div>
    </div>
  );
}
