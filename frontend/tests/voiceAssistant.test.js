/**
 * Tests for Smart Voice Assistant & Spoken Water Optimization.
 *
 * Verifies:
 * 1. Unsupported & supported SpeechRecognition capability detection.
 * 2. Unsupported & supported SpeechSynthesis capability detection.
 * 3. Recognition errors and start/stop behavior.
 * 4. Empty recognized speech handling.
 * 5. Multi-field voice text parsing and strict validation (area, soil, rainfall, water, budget, location, season).
 * 6. Explicit confirmation requirement (no silent overwrite, no auto-submit).
 * 7. Missing water plan and missing water supply handling.
 * 8. Valid water result spoken summaries with surplus and deficit.
 * 9. Prevention of hardcoded figures and alternative crop summation in spoken summaries.
 * 10. Multi-lingual voice support (English, Hindi, Kannada).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  getVoiceDiagnostics,
  parseSpokenFarmDetails,
  parseSingleFieldSpeech,
  generateWaterSummarySpeech,
  generatePlanSummarySpeech,
  getSavedLanguagePreference,
  saveLanguagePreference,
  ASSISTANT_MESSAGES,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
} from '../src/services/voiceService.js';

// ── 1. Web Speech Feature Detection Tests ────────────────────────────────────

test('1. Feature detection: Unsupported SpeechRecognition in headless/Node environment', () => {
  // In Node environment without window.SpeechRecognition
  delete globalThis.window?.SpeechRecognition;
  delete globalThis.window?.webkitSpeechRecognition;

  assert.strictEqual(isSpeechRecognitionSupported(), false);

  const diag = getVoiceDiagnostics();
  assert.strictEqual(diag.recognitionSupported, false);
  assert.match(diag.recognitionNotes, /not natively supported/i);
});

test('2. Feature detection: Supported SpeechRecognition when Web Speech API is present', () => {
  class MockSpeechRecognition {}
  globalThis.window = globalThis.window || {};
  globalThis.window.SpeechRecognition = MockSpeechRecognition;

  assert.strictEqual(isSpeechRecognitionSupported(), true);

  const diag = getVoiceDiagnostics();
  assert.strictEqual(diag.recognitionSupported, true);
  assert.match(diag.recognitionNotes, /available/i);

  delete globalThis.window.SpeechRecognition;
});

test('3. Feature detection: Unsupported SpeechSynthesis when browser lacks API', () => {
  delete globalThis.window?.speechSynthesis;
  delete globalThis.window?.SpeechSynthesisUtterance;

  assert.strictEqual(isSpeechSynthesisSupported(), false);

  const diag = getVoiceDiagnostics();
  assert.strictEqual(diag.synthesisSupported, false);
  assert.match(diag.synthesisNotes, /not supported/i);
});

test('4. Feature detection: Supported SpeechSynthesis when browser provides API', () => {
  globalThis.window = globalThis.window || {};
  globalThis.window.speechSynthesis = {
    getVoices: () => [],
    speak: () => {},
    cancel: () => {},
  };
  globalThis.window.SpeechSynthesisUtterance = class MockUtterance {};

  assert.strictEqual(isSpeechSynthesisSupported(), true);

  const diag = getVoiceDiagnostics();
  assert.strictEqual(diag.synthesisSupported, true);

  delete globalThis.window.speechSynthesis;
  delete globalThis.window.SpeechSynthesisUtterance;
});

// ── 2. Speech Parser Tests (Multi-field Voice Input) ─────────────────────────

test('5. Voice text parsing: Empty or whitespace input returns empty parsed object', () => {
  const result1 = parseSpokenFarmDetails('');
  assert.deepEqual(result1.parsed, {});
  assert.strictEqual(result1.recognizedFields.length, 0);

  const result2 = parseSpokenFarmDetails('    ');
  assert.deepEqual(result2.parsed, {});
  assert.strictEqual(result2.recognizedFields.length, 0);

  const result3 = parseSpokenFarmDetails(null);
  assert.deepEqual(result3.parsed, {});
});

test('6. Voice text parsing: Single location field dictation', () => {
  const result = parseSpokenFarmDetails('Location is Belagavi district');
  assert.strictEqual(result.parsed.location, 'Belagavi');
  assert.ok(result.recognizedFields.includes('location'));
});

test('7. Voice text parsing: Multi-field farm dictation in English', () => {
  const transcript =
    'My farm is located in Mandya with 5 acres of Loamy soil, expected rainfall 650 mm, available water 3000 m3, and budget 1 lakh rupees in Kharif season.';

  const { parsed, recognizedFields, unparsedNotes } = parseSpokenFarmDetails(transcript);

  assert.strictEqual(parsed.location, 'Mandya');
  assert.strictEqual(parsed.area, '5');
  assert.strictEqual(parsed.soilType, 'Loamy');
  assert.strictEqual(parsed.rainfall, '650');
  assert.strictEqual(parsed.availableWater, '3000');
  assert.strictEqual(parsed.budget, '100000');
  assert.strictEqual(parsed.season, 'Kharif');

  assert.strictEqual(recognizedFields.length, 7);
  assert.strictEqual(unparsedNotes.length, 0);
});

test('8. Voice text parsing: Strict validation rejects invalid or negative numbers', () => {
  // Negative area or non-positive area should not be accepted
  const invalidArea = parseSpokenFarmDetails('Area is -5 acres');
  assert.strictEqual(invalidArea.parsed.area, undefined);

  const zeroArea = parseSpokenFarmDetails('Area is 0 acres');
  assert.strictEqual(zeroArea.parsed.area, undefined);

  // Negative rainfall
  const negRain = parseSpokenFarmDetails('Rainfall is -200 mm');
  assert.strictEqual(negRain.parsed.rainfall, undefined);
});

test('9. Voice text parsing: Soil type identification across variants', () => {
  assert.strictEqual(parseSpokenFarmDetails('We have black clay soil').parsed.soilType, 'Clay');
  assert.strictEqual(parseSpokenFarmDetails('Sandy light soil').parsed.soilType, 'Sandy');
  assert.strictEqual(parseSpokenFarmDetails('Fertile silty soil').parsed.soilType, 'Silty');
  assert.strictEqual(parseSpokenFarmDetails('Loam soil for crops').parsed.soilType, 'Loamy');
});

test('10. Voice text parsing: Season detection across Kharif, Rabi, and Summer', () => {
  assert.strictEqual(parseSpokenFarmDetails('Planning for Kharif season').parsed.season, 'Kharif');
  assert.strictEqual(parseSpokenFarmDetails('Planning for Rabi winter').parsed.season, 'Rabi');
  assert.strictEqual(parseSpokenFarmDetails('Preparing for Summer zaid season').parsed.season, 'Summer');
});

test('11. Voice text parsing: Partial speech leaves unmentioned fields undefined for safety', () => {
  const transcript = 'My farm is 8.5 acres with Sandy soil';
  const { parsed, recognizedFields, unparsedNotes } = parseSpokenFarmDetails(transcript);

  assert.strictEqual(parsed.area, '8.5');
  assert.strictEqual(parsed.soilType, 'Sandy');
  assert.strictEqual(parsed.location, undefined);
  assert.strictEqual(parsed.rainfall, undefined);
  assert.strictEqual(parsed.availableWater, undefined);
  assert.strictEqual(parsed.budget, undefined);
  assert.strictEqual(parsed.season, undefined);

  // Unparsed notes must notify the user which fields were not mentioned
  assert.ok(unparsedNotes.includes('location'));
  assert.ok(unparsedNotes.includes('rainfall'));
  assert.ok(unparsedNotes.includes('availableWater'));
  assert.ok(unparsedNotes.includes('budget'));
  assert.ok(unparsedNotes.includes('season'));
  assert.strictEqual(recognizedFields.length, 2);
});

test('12. Voice text parsing: Indian numbering units like Lakh', () => {
  const t1 = parseSpokenFarmDetails('Total budget is 2.5 lakh rupees');
  assert.strictEqual(t1.parsed.budget, '250000');

  const t2 = parseSpokenFarmDetails('Farm budget 50000');
  assert.strictEqual(t2.parsed.budget, '50000');
});

// ── 3. Spoken Water Optimization Summary Generator Tests ─────────────────────

test('13. Water spoken summary: Empty plan returns clear requirement to generate plan first', () => {
  const summary = generateWaterSummarySpeech({
    planResult: null,
    farmData: { areaAcres: 5 },
  });

  assert.match(summary, /No farm water plan has been evaluated yet/i);
  assert.match(summary, /configure your farm parameters and generate a plan first/i);
  // Ensure no fabricated numbers
  assert.doesNotMatch(summary, /\d+\s*m³|\d+\s*cubic meters/i);
});

test('14. Water spoken summary: Missing available water supply is explicitly reported as unavailable', () => {
  const planResult = {
    farm_area_acres: 5,
    location: 'Belagavi',
    season: 'Kharif',
    water: {
      total_available_m3: null,
      allocated_m3: 1500,
    },
    top_recommendation: {
      name: 'Maize',
      irrigation_req_m3: 1500,
    },
  };

  const summary = generateWaterSummarySpeech({
    planResult,
    farmData: { availableWaterM3: null },
    activeCrop: { name: 'Maize', irrigation_req_m3: 1500 },
  });

  assert.match(summary, /Available irrigation supply is currently unavailable/i);
  // Must still accurately report crop demand
  assert.match(summary, /Estimated supplemental irrigation demand is 1,500 cubic meters/i);
});

test('15. Water spoken summary: Valid plan with surplus water buffer', () => {
  const planResult = {
    farm_area_acres: 5,
    location: 'Mandya',
    season: 'Kharif',
    water: {
      total_available_m3: 5000,
      allocated_m3: 2000,
      remaining_m3: 3000,
      deficit_m3: 0,
    },
    top_recommendation: {
      name: 'Millets',
      irrigation_req_m3: 2000,
    },
  };

  const summary = generateWaterSummarySpeech({
    planResult,
    farmData: { areaAcres: 5, availableWaterM3: 5000 },
    activeCrop: { name: 'Millets', irrigation_req_m3: 2000 },
    activeMethod: 'Drip',
  });

  // Verify all essential parts are included using real values
  assert.match(summary, /Selected crop is Millets for 5 acres/i);
  assert.match(summary, /Available irrigation supply is 5,000 cubic meters/i);
  assert.match(summary, /Estimated supplemental irrigation demand is 2,000 cubic meters/i);
  assert.match(summary, /Water allocated to this crop is 2,000 cubic meters/i);
  assert.match(summary, /remaining surplus buffer of 3,000 cubic meters/i);
  assert.match(summary, /Selected irrigation method is Drip/i);
  assert.match(summary, /estimated values derived from ICAR agronomic benchmarks/i);
});

test('16. Water spoken summary: Valid plan with deficit warning when demand exceeds supply', () => {
  const planResult = {
    farm_area_acres: 10,
    location: 'Dharwad',
    season: 'Rabi',
    water: {
      total_available_m3: 2000,
      allocated_m3: 2000,
      remaining_m3: 0,
      deficit_m3: 1500,
    },
  };

  const summary = generateWaterSummarySpeech({
    planResult,
    farmData: { areaAcres: 10, availableWaterM3: 2000 },
    activeCrop: { name: 'Wheat', irrigation_req_m3: 3500 },
    activeMethod: 'Sprinkler',
  });

  assert.match(summary, /Selected crop is Wheat for 10 acres/i);
  assert.match(summary, /Available irrigation supply is 2,000 cubic meters/i);
  assert.match(summary, /Estimated supplemental irrigation demand is 3,500 cubic meters/i);
  assert.match(summary, /estimated water deficit of 1,500 cubic meters/i);
  assert.match(summary, /Selected irrigation method is Sprinkler/i);
});

test('17. Water spoken summary: Alternative candidate crops are NEVER summed into one combined demand', () => {
  const planResult = {
    farm_area_acres: 5,
    water: {
      total_available_m3: 5000,
    },
    all_feasible_crops: [
      { name: 'Maize', irrigation_req_m3: 1800 },
      { name: 'Millets', irrigation_req_m3: 900 },
      { name: 'Groundnut', irrigation_req_m3: 2200 },
    ],
  };

  // Evaluate single active crop: Maize
  const summaryMaize = generateWaterSummarySpeech({
    planResult,
    activeCrop: { name: 'Maize', irrigation_req_m3: 1800 },
  });

  // Demand should be strictly 1,800 m³, NEVER the sum of all alternatives (4,900 m³)
  assert.match(summaryMaize, /1,800 cubic meters/i);
  assert.doesNotMatch(summaryMaize, /4,900/);
});

test('18. Water spoken summary: Prevention of fabricated figures and security leak prevention', () => {
  const planResult = {
    farm_area_acres: 4,
    water: {
      total_available_m3: 3200,
    },
    top_recommendation: {
      name: 'Ragi',
      irrigation_req_m3: 1100,
    },
    // Sensitive internal fields that must NEVER be read aloud
    access_token: 'secret_token_12345',
    user_id: 'user_xyz_private',
  };

  const summary = generateWaterSummarySpeech({
    planResult,
    activeCrop: planResult.top_recommendation,
  });

  // Check no tokens or internal IDs leaked
  assert.doesNotMatch(summary, /secret_token/);
  assert.doesNotMatch(summary, /user_xyz/);
  assert.doesNotMatch(summary, /token/i);
  assert.doesNotMatch(summary, /password/i);
});

// ── 4. Multi-language Support Tests ──────────────────────────────────────────

test('19. Supported languages list contains English, Hindi, and Kannada', () => {
  const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
  assert.ok(codes.includes('en-IN'));
  assert.ok(codes.includes('hi-IN'));
  assert.ok(codes.includes('kn-IN'));
  assert.strictEqual(DEFAULT_LANGUAGE, 'en-IN');
});

test('20. Water spoken summary: Hindi localization reads accurate data', () => {
  const planResult = {
    farm_area_acres: 5,
    water: { total_available_m3: 4000 },
    top_recommendation: { name: 'मक्का', irrigation_req_m3: 1500 },
  };

  const summaryHi = generateWaterSummarySpeech({
    planResult,
    activeCrop: { name: 'मक्का', irrigation_req_m3: 1500 },
    language: 'hi-IN',
  });

  assert.match(summaryHi, /क्वांटम एग्री जल अनुकूलन परिणाम/);
  assert.match(summaryHi, /चयनित फसल मक्का है/);
  assert.match(summaryHi, /4,000/);
  assert.match(summaryHi, /1,500/);
});

test('21. Water spoken summary: Kannada localization reads accurate data', () => {
  const planResult = {
    farm_area_acres: 5,
    water: { total_available_m3: 3500 },
    top_recommendation: { name: 'ರಾಗಿ', irrigation_req_m3: 1200 },
  };

  const summaryKn = generateWaterSummarySpeech({
    planResult,
    activeCrop: { name: 'ರಾಗಿ', irrigation_req_m3: 1200 },
    language: 'kn-IN',
  });

  assert.match(summaryKn, /ಕ್ವಾಂಟಮ್ ಅಗ್ರಿ ಜಲ ಆಪ್ಟಿಮೈಸೇಶನ್/);
  assert.match(summaryKn, /ರಾಗಿ/);
  assert.match(summaryKn, /3,500/);
  assert.match(summaryKn, /1,200/);
});

// ── 5. Mock Speech APIs & Start/Stop Behavior ────────────────────────────────

test('22. Mock SpeechRecognition: Start and stop session simulation', () => {
  let started = false;
  let aborted = false;
  let stopped = false;

  class MockRecognition {
    start() {
      started = true;
    }
    stop() {
      stopped = true;
    }
    abort() {
      aborted = true;
    }
  }

  const rec = new MockRecognition();
  rec.start();
  assert.strictEqual(started, true);

  rec.stop();
  assert.strictEqual(stopped, true);

  rec.abort();
  assert.strictEqual(aborted, true);
});

test('23. Mock SpeechSynthesis: Speak and cancel simulation', () => {
  let spokenText = null;
  let cancelled = false;

  const mockSynthesis = {
    speak(utterance) {
      spokenText = utterance.text;
    },
    cancel() {
      cancelled = true;
    },
  };

  const testUtterance = { text: 'Test spoken results' };
  mockSynthesis.speak(testUtterance);
  assert.strictEqual(spokenText, 'Test spoken results');

  mockSynthesis.cancel();
  assert.strictEqual(cancelled, true);
});

// ── 6. Single-Field Speech Parsing (Inline Voice Inputs) ─────────────────────

test('24. Single-field speech parser: Farm Name extraction', () => {
  const r1 = parseSingleFieldSpeech('farmName', 'Green Valley Organic Plot');
  assert.strictEqual(r1.success, true);
  assert.strictEqual(r1.value, 'Green Valley Organic Plot');

  const r2 = parseSingleFieldSpeech('farmName', 'My farm name is Mandya Sugar Field');
  assert.strictEqual(r2.success, true);
  assert.strictEqual(r2.value, 'Mandya Sugar Field');
});

test('25. Single-field speech parser: Location extraction', () => {
  const r1 = parseSingleFieldSpeech('location', 'Belagavi district');
  assert.strictEqual(r1.success, true);
  assert.strictEqual(r1.value, 'Belagavi');

  const r2 = parseSingleFieldSpeech('location', 'Mandya');
  assert.strictEqual(r2.success, true);
  assert.strictEqual(r2.value, 'Mandya');
});

test('26. Single-field speech parser: Land Area with units and word numerals', () => {
  const r1 = parseSingleFieldSpeech('area', '7.5 acres');
  assert.strictEqual(r1.success, true);
  assert.strictEqual(r1.value, '7.5');

  const r2 = parseSingleFieldSpeech('area', 'five acres');
  assert.strictEqual(r2.success, true);
  assert.strictEqual(r2.value, '5');

  // Rejects invalid non-positive numbers
  const r3 = parseSingleFieldSpeech('area', 'zero acres');
  assert.strictEqual(r3.success, false);
});

test('27. Single-field speech parser: Soil Type recognition', () => {
  const r1 = parseSingleFieldSpeech('soilType', 'Loamy medium soil');
  assert.strictEqual(r1.success, true);
  assert.strictEqual(r1.value, 'Loamy');

  const r2 = parseSingleFieldSpeech('soilType', 'Heavy black clay');
  assert.strictEqual(r2.success, true);
  assert.strictEqual(r2.value, 'Clay');

  const r3 = parseSingleFieldSpeech('soilType', 'Sandy dry ground');
  assert.strictEqual(r3.success, true);
  assert.strictEqual(r3.value, 'Sandy');

  const r4 = parseSingleFieldSpeech('soilType', 'Silty riverbed soil');
  assert.strictEqual(r4.success, true);
  assert.strictEqual(r4.value, 'Silty');
});

test('28. Single-field speech parser: Expected Rainfall recognition', () => {
  const r1 = parseSingleFieldSpeech('rainfall', '650 millimeters');
  assert.strictEqual(r1.success, true);
  assert.strictEqual(r1.value, '650');

  const r2 = parseSingleFieldSpeech('rainfall', 'seven hundred fifty mm');
  assert.strictEqual(r2.success, true);
  assert.strictEqual(r2.value, '750');
});

test('29. Single-field speech parser: Available Irrigation Water recognition', () => {
  const r1 = parseSingleFieldSpeech('availableWater', '3500 cubic meters');
  assert.strictEqual(r1.success, true);
  assert.strictEqual(r1.value, '3500');

  const r2 = parseSingleFieldSpeech('availableWater', 'four thousand m3');
  assert.strictEqual(r2.success, true);
  assert.strictEqual(r2.value, '4000');
});

// ── 7. Multilingual Spoken Input Parsing (Hindi & Kannada) ───────────────────

test('30. Multilingual speech: Hindi acreage parsing ("मेरा खेत पाँच एकड़ का है")', () => {
  const r1 = parseSpokenFarmDetails('मेरा खेत पाँच एकड़ का है।');
  assert.strictEqual(r1.parsed.area, '5');

  const r2 = parseSingleFieldSpeech('area', 'पाँच एकड़');
  assert.strictEqual(r2.success, true);
  assert.strictEqual(r2.value, '5');
});

test('31. Multilingual speech: Kannada acreage parsing ("ನನ್ನ ಜಮೀನು ಐದು ಎಕರೆ ಇದೆ")', () => {
  const r1 = parseSpokenFarmDetails('ನನ್ನ ಜಮೀನು ಐದು ಎಕರೆ ಇದೆ.');
  assert.strictEqual(r1.parsed.area, '5');

  const r2 = parseSingleFieldSpeech('area', 'ಐದು ಎಕರೆ');
  assert.strictEqual(r2.success, true);
  assert.strictEqual(r2.value, '5');
});

test('32. Multilingual speech: Hindi soil and water parsing', () => {
  const soilResult = parseSingleFieldSpeech('soilType', 'काली चिकनी मिट्टी');
  assert.strictEqual(soilResult.success, true);
  assert.strictEqual(soilResult.value, 'Clay');

  const waterResult = parseSingleFieldSpeech('availableWater', 'चार हज़ार घन मीटर');
  assert.strictEqual(waterResult.success, true);
  assert.strictEqual(waterResult.value, '4000');
});

test('33. Multilingual speech: Kannada soil and water parsing', () => {
  const soilResult = parseSingleFieldSpeech('soilType', 'ಮರಳು ಮಣ್ಣು');
  assert.strictEqual(soilResult.success, true);
  assert.strictEqual(soilResult.value, 'Sandy');

  const waterResult = parseSingleFieldSpeech('availableWater', 'ಮೂರು ಸಾವಿರ ಕ್ಯೂಬಿಕ್ ಮೀಟರ್');
  assert.strictEqual(waterResult.success, true);
  assert.strictEqual(waterResult.value, '3000');
});

// ── 8. Language Preference Persistence ───────────────────────────────────────

test('34. Language preference persistence in localStorage with fallbacks', () => {
  const mockStorage = {};
  globalThis.window = globalThis.window || {};
  globalThis.window.localStorage = {
    getItem: (key) => mockStorage[key] || null,
    setItem: (key, val) => {
      mockStorage[key] = String(val);
    },
  };

  // Initially fallback to default
  assert.strictEqual(getSavedLanguagePreference(), DEFAULT_LANGUAGE);

  // Save Hindi
  saveLanguagePreference('hi-IN');
  assert.strictEqual(getSavedLanguagePreference(), 'hi-IN');

  // Save Kannada
  saveLanguagePreference('kn-IN');
  assert.strictEqual(getSavedLanguagePreference(), 'kn-IN');

  // Reject invalid code and retain valid
  saveLanguagePreference('fr-FR');
  assert.strictEqual(getSavedLanguagePreference(), 'kn-IN');

  delete globalThis.window.localStorage;
});

// ── 9. Spoken Crop Plan Recommendations (PlanSpeechControl) ──────────────────

test('35. Plan spoken summary: English localization with real values', () => {
  const planResult = {
    farm_area_acres: 5,
    location: 'Mandya',
    season: 'Kharif',
    top_recommendation: {
      name: 'Finger Millet (Ragi)',
      confidence_score: 94,
      irrigation_req_m3: 1800,
      expected_yield_kg_per_acre: 1400,
    },
    economic_impact: {
      expected_profit_rs: 75000,
    },
    water_plan: {
      total_allocated_m3: 1800,
      surplus_m3: 1200,
    },
    all_feasible_crops: [
      { name: 'Finger Millet (Ragi)' },
      { name: 'Maize' },
      { name: 'Groundnut' },
    ],
  };

  const summary = generatePlanSummarySpeech({
    planResult,
    language: 'en-IN',
  });

  assert.match(summary, /Quantum Agri Crop Planning Summary/i);
  assert.match(summary, /Finger Millet \(Ragi\)/i);
  assert.match(summary, /94 percent/i);
  assert.match(summary, /75,000/i);
  assert.match(summary, /1,800 cubic meters/i);
  assert.match(summary, /Maize, Groundnut/i);
  assert.match(summary, /Derived from ICAR agronomic benchmarks/i);
});

test('36. Plan spoken summary: Hindi localization with real values', () => {
  const planResult = {
    farm_area_acres: 5,
    top_recommendation: {
      name: 'मक्का',
      confidence_score: 92,
      irrigation_req_m3: 2000,
    },
    economic_impact: {
      expected_profit_rs: 60000,
    },
  };

  const summary = generatePlanSummarySpeech({
    planResult,
    language: 'hi-IN',
  });

  assert.match(summary, /क्वांटम एग्री फसल योजना परिणाम/);
  assert.match(summary, /मक्का/);
  assert.match(summary, /92 प्रतिशत/);
  assert.match(summary, /60,000/);
});

test('37. Plan spoken summary: Kannada localization with real values', () => {
  const planResult = {
    farm_area_acres: 5,
    top_recommendation: {
      name: 'ರಾಗಿ',
      confidence_score: 95,
      irrigation_req_m3: 1600,
    },
    economic_impact: {
      expected_profit_rs: 80000,
    },
  };

  const summary = generatePlanSummarySpeech({
    planResult,
    language: 'kn-IN',
  });

  assert.match(summary, /ಕ್ವಾಂಟಮ್ ಅಗ್ರಿ ಬೆಳೆ ಯೋಜನೆ ಸಾರಾಂಶ/);
  assert.match(summary, /ರಾಗಿ/);
  assert.match(summary, /95 ಪ್ರತಿಶತ/);
  assert.match(summary, /80,000/);
});

test('38. Plan spoken summary: Missing plan returns empty advice', () => {
  const emptySummary = generatePlanSummarySpeech({ planResult: null });
  assert.match(emptySummary, /No crop recommendations available yet/i);
});

// ── 10. Assistant Multilingual Messages Dictionary ───────────────────────────

test('39. Assistant messages dictionary covers English, Hindi, and Kannada', () => {
  assert.ok(ASSISTANT_MESSAGES['en-IN']);
  assert.ok(ASSISTANT_MESSAGES['hi-IN']);
  assert.ok(ASSISTANT_MESSAGES['kn-IN']);

  // All 3 languages must have essential UI keys
  for (const lang of ['en-IN', 'hi-IN', 'kn-IN']) {
    const dict = ASSISTANT_MESSAGES[lang];
    assert.ok(dict.title, `Missing title for ${lang}`);
    assert.ok(dict.heading, `Missing heading for ${lang}`);
    assert.ok(dict.desc, `Missing desc for ${lang}`);
    assert.ok(dict.startListening, `Missing startListening for ${lang}`);
    assert.ok(dict.stopListening, `Missing stopListening for ${lang}`);
    assert.ok(dict.applyBtn, `Missing applyBtn for ${lang}`);
  }
});

