import test from "node:test";
import assert from "node:assert/strict";

import {
  KARNATAKA_DISTRICTS,
  AGRO_CLIMATIC_ZONES,
  resolveDistrict,
  findNearestDistrict,
  isWithinKarnataka,
} from "../src/data/karnatakaDistricts.js";

import {
  formatCoordinates,
  parseGeolocationError,
  getCurrentDeviceLocation,
  searchPlace,
} from "../src/services/geocodingApi.js";

import {
  generateIrrigationInsights,
  ADVISORY_STATUS,
} from "../src/services/irrigationInsights.js";

test("KARNATAKA_DISTRICTS covers all 30 canonical agricultural districts", () => {
  assert.equal(KARNATAKA_DISTRICTS.length, 30);
  for (const d of KARNATAKA_DISTRICTS) {
    assert.ok(d.id, "District must have an id");
    assert.ok(d.name, "District must have a name");
    assert.ok(d.centroid.lat >= 11.5 && d.centroid.lat <= 18.5, `Lat ${d.centroid.lat} within Karnataka`);
    assert.ok(d.centroid.lon >= 74.0 && d.centroid.lon <= 78.6, `Lon ${d.centroid.lon} within Karnataka`);
    assert.ok(d.zone >= 1 && d.zone <= 10, "Agro-climatic zone must be 1-10");
    assert.ok(Array.isArray(d.dominantSoilGroups), "Soil groups must be an array");
  }
});

test("AGRO_CLIMATIC_ZONES maps 10 official KSDA/UAS zones", () => {
  assert.equal(Object.keys(AGRO_CLIMATIC_ZONES).length, 10);
  assert.equal(AGRO_CLIMATIC_ZONES[1], "North-East Transition Zone");
  assert.equal(AGRO_CLIMATIC_ZONES[10], "Coastal Zone");
});

test("resolveDistrict canonicalizes exact and alternative district names", () => {
  const d1 = resolveDistrict("Belagavi");
  assert.ok(d1);
  assert.equal(d1.name, "Belagavi");
  assert.equal(d1.mlDistrictKey, "BELAGAVI");

  const d2 = resolveDistrict("MYSORE");
  assert.ok(d2);
  assert.equal(d2.name, "Mysuru");
  assert.equal(d2.mlDistrictKey, "MYSURU");

  const d3 = resolveDistrict("Bangalore Rural");
  assert.ok(d3);
  assert.equal(d3.mlDistrictKey, "BANGALORE RURAL");

  const invalid = resolveDistrict("Jaipur");
  assert.equal(invalid, null);
});

test("isWithinKarnataka validates bounding box", () => {
  // Bengaluru
  assert.equal(isWithinKarnataka(12.9716, 77.5946), true);
  // Belagavi
  assert.equal(isWithinKarnataka(15.8497, 74.4977), true);
  // Delhi (Outside)
  assert.equal(isWithinKarnataka(28.6139, 77.209), false);
  // Mumbai (Outside)
  assert.equal(isWithinKarnataka(19.076, 72.8777), false);
});

test("findNearestDistrict identifies closest district centroid", () => {
  // Near Mysuru Palace coords
  const district = findNearestDistrict(12.3051, 76.6551);
  assert.ok(district);
  assert.equal(district.name, "Mysuru");
});

test("formatCoordinates formats to standard 4 decimal places with cardinals", () => {
  const formatted = formatCoordinates(12.9716, 77.5946);
  assert.equal(formatted, "12.9716° N, 77.5946° E");
});

test("parseGeolocationError formats browser permission errors", () => {
  const permDenied = parseGeolocationError({ code: 1 });
  assert.equal(permDenied.code, 1);
  assert.ok(permDenied.message.includes("declined") || permDenied.message.includes("Permission"));

  const timeoutErr = parseGeolocationError({ code: 3 });
  assert.equal(timeoutErr.code, 3);
  assert.ok(timeoutErr.message.includes("timed out") || timeoutErr.message.includes("Timed Out"));
});

test("getCurrentDeviceLocation rejects safely in headless Node environment", async () => {
  await assert.rejects(
    async () => {
      await getCurrentDeviceLocation();
    },
    /Geolocation is not supported/
  );
});

test("searchPlace matches Karnataka district centroids instantly", async () => {
  const results = await searchPlace("Mandya");
  assert.ok(Array.isArray(results));
  assert.ok(results.length > 0);
  assert.equal(results[0].districtName, "Mandya");
  assert.equal(results[0].isDistrictCentroid, true);
});

test("generateIrrigationInsights generates actionable advisory from weather data", () => {
  const mockWeather = {
    current: {
      temperatureC: 26,
      precipitationMm: 0,
      weatherCode: 0,
    },
    summary: {
      next24hPrecipMm: 25.0,
      next24hMaxProbPct: 85,
      next48hPrecipMm: 35.0,
      next7DaysTotalPrecipMm: 45.0,
    },
  };

  const farmData = {
    soilType: "Clay",
  };

  const insights = generateIrrigationInsights(mockWeather, farmData);
  assert.ok(insights);
  assert.equal(insights.status, ADVISORY_STATUS.HOLD);
  assert.ok(insights.headline);
  assert.ok(insights.actionItem);
  assert.ok(insights.metrics);
});

test("generateIrrigationInsights handles dry outlook with deficit soil", () => {
  const mockWeather = {
    current: {
      temperatureC: 32,
      precipitationMm: 0,
      weatherCode: 0,
    },
    summary: {
      next24hPrecipMm: 0.0,
      next24hMaxProbPct: 5,
      next48hPrecipMm: 0.0,
      next7DaysTotalPrecipMm: 0.0,
    },
  };

  const farmData = {
    soilType: "Sandy",
  };

  const insights = generateIrrigationInsights(mockWeather, farmData);
  assert.ok(insights);
  assert.equal(insights.status, ADVISORY_STATUS.PROCEED);
  assert.ok(insights.headline);
  assert.ok(insights.metrics);
});

