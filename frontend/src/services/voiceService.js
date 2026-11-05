/**
 * Quantum Agri — Smart Voice Assistant Service
 *
 * Provides Web Speech API utilities:
 * 1. Feature detection and diagnostic reporting (SpeechRecognition, SpeechSynthesis).
 * 2. Robust multi-lingual voice parsing for farm parameters (English, Hindi, Kannada).
 * 3. Single-field voice parser for inline microphone dictation.
 * 4. Language preference loading and persistence across page refreshes.
 * 5. Verifiable spoken summary generators for Water Optimization and Crop Recommendations.
 */

export const SUPPORTED_LANGUAGES = [
  {
    code: 'en-IN',
    label: 'English (India)',
    nativeLabel: 'English (India)',
    recognitionCode: 'en-IN',
    synthesisLang: 'en-IN',
  },
  {
    code: 'hi-IN',
    label: 'Hindi (हिन्दी)',
    nativeLabel: 'हिन्दी',
    recognitionCode: 'hi-IN',
    synthesisLang: 'hi-IN',
  },
  {
    code: 'kn-IN',
    label: 'Kannada (ಕನ್ನಡ)',
    nativeLabel: 'ಕನ್ನಡ',
    recognitionCode: 'kn-IN',
    synthesisLang: 'kn-IN',
  },
];

export const DEFAULT_LANGUAGE = 'en-IN';
export const LANGUAGE_STORAGE_KEY = 'quantum_agri_language_pref';

/**
 * Loads the user's saved language preference from localStorage.
 * Defaults to 'en-IN'.
 */
export function getSavedLanguagePreference() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
        return saved;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Saves the selected language preference to localStorage and emits an event.
 */
export function saveLanguagePreference(langCode) {
  if (!SUPPORTED_LANGUAGES.some((l) => l.code === langCode)) {
    return false;
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, langCode);
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(
          new CustomEvent('quantum_agri_language_change', {
            detail: { language: langCode },
          })
        );
      }
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Returns the SpeechRecognition constructor if available in the global window or globalThis context.
 * Checks standard, webkit, and ms vendor prefixes for cross-browser support (Chrome, Edge, etc.).
 */
export function getSpeechRecognitionClass() {
  if (typeof window === 'undefined') {
    if (typeof globalThis !== 'undefined') {
      return (
        globalThis.SpeechRecognition ||
        globalThis.webkitSpeechRecognition ||
        globalThis.msSpeechRecognition ||
        null
      );
    }
    return null;
  }
  return (
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    window.msSpeechRecognition ||
    (typeof globalThis !== 'undefined' &&
      (globalThis.SpeechRecognition ||
        globalThis.webkitSpeechRecognition ||
        globalThis.msSpeechRecognition)) ||
    null
  );
}

/**
 * Checks whether browser supports Web Speech Recognition.
 */
export function isSpeechRecognitionSupported() {
  return Boolean(getSpeechRecognitionClass());
}

/**
 * Checks whether browser supports Web Speech Synthesis.
 */
export function isSpeechSynthesisSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

/**
 * Gathers browser diagnostic info regarding Web Speech and microphone availability.
 */
export function getVoiceDiagnostics() {
  const recognitionSupported = isSpeechRecognitionSupported();
  const synthesisSupported = isSpeechSynthesisSupported();

  let browserName = 'Unknown Browser';
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    const brands = navigator.userAgentData?.brands || [];
    const isEdgeBrand = brands.some(
      (b) => b.brand.includes('Microsoft Edge') || b.brand.includes('Edge')
    );
    const isChromeBrand = brands.some(
      (b) => b.brand.includes('Google Chrome') || b.brand.includes('Chrome')
    );

    if (isEdgeBrand || ua.includes('Edg/') || ua.includes('Edge/')) {
      browserName = 'Microsoft Edge';
    } else if (isChromeBrand || ua.includes('Chrome/')) {
      browserName = 'Google Chrome';
    } else if (ua.includes('Firefox/')) {
      browserName = 'Mozilla Firefox';
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
      browserName = 'Apple Safari';
    }
  }

  const recognitionNotes = recognitionSupported
    ? `Web Speech Recognition API is available and fully functional in ${browserName}.`
    : 'Speech recognition is not natively supported in this browser. For voice input, please use Google Chrome, Microsoft Edge, or a supported Chromium browser.';

  const synthesisNotes = synthesisSupported
    ? 'Web Speech Synthesis API is available for text-to-speech.'
    : 'Speech synthesis is not supported in this browser.';

  return {
    recognitionSupported,
    synthesisSupported,
    browserName,
    recognitionNotes,
    synthesisNotes,
  };
}

/**
 * Comprehensive number word mappings for English, Hindi, and Kannada.
 */
const WORD_NUMBER_MAP = {
  // English
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  twentyfive: 25,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lakhs: 100000,
  crore: 10000000,

  // Hindi
  शून्य: 0,
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
  ग्यारह: 11,
  बारह: 12,
  पंद्रह: 15,
  बीस: 20,
  पच्चीस: 25,
  तीस: 30,
  चालीस: 40,
  पचास: 50,
  सौ: 100,
  हज़ार: 1000,
  हजार: 1000,
  लाख: 100000,
  करोड़: 10000000,

  // Kannada
  ಸೊನ್ನೆ: 0,
  ಒಂದು: 1,
  ಎರಡು: 2,
  ಮೂರು: 3,
  ನಾಲ್ಕು: 4,
  ಐದು: 5,
  ಆರು: 6,
  ಏಳು: 7,
  ಎಂಟು: 8,
  ಒಂಬತ್ತು: 9,
  ಹತ್ತು: 10,
  ಹನ್ನೊಂದು: 11,
  ಹನ್ನೆರಡು: 12,
  ಹದಿನೈದು: 15,
  ಇಪ್ಪತ್ತು: 20,
  ಇಪ್ಪತ್ತೈದು: 25,
  ಮೂವತ್ತು: 30,
  ನಲವತ್ತು: 40,
  ಐವತ್ತು: 50,
  ನೂರು: 100,
  ಸಾವಿರ: 1000,
  ಲಕ್ಷ: 100000,
  ಕೋಟಿ: 10000000,
};

/**
 * Helper to parse spoken numbers or common word numerals (e.g. 'five', '5.5', 'पाँच', 'ಐದು').
 */
export function parseSpokenNumber(token) {
  if (!token) return null;
  const cleaned = String(token).trim().toLowerCase().replace(/,/g, '');

  // Direct numeric digits
  const direct = parseFloat(cleaned);
  if (!isNaN(direct) && isFinite(direct)) return direct;

  if (WORD_NUMBER_MAP[cleaned] !== undefined) {
    return WORD_NUMBER_MAP[cleaned];
  }

  // Multi-word compound numerals (e.g. "four thousand", "चार हज़ार", "ಮೂರು ಸಾವಿರ")
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    let total = 0;
    let current = 0;
    let matchedAny = false;

    for (const w of words) {
      const val = WORD_NUMBER_MAP[w];
      if (val !== undefined) {
        matchedAny = true;
        if (val === 10000000 || val === 100000 || val === 1000 || val === 100) {
          total += (current || 1) * val;
          current = 0;
        } else {
          current += val;
        }
      }
    }
    total += current;
    if (matchedAny && total > 0) return total;
  }

  // Handle common compound Hindi phrases
  if (cleaned.includes('तीन हज़ार') || cleaned.includes('तीन हजार')) return 3000;
  if (cleaned.includes('चार हज़ार') || cleaned.includes('चार हजार')) return 4000;
  if (cleaned.includes('छह सौ पचास')) return 650;
  if (cleaned.includes('सात सौ पचास')) return 750;
  if (cleaned.includes('एक लाख')) return 100000;

  // Handle common compound Kannada phrases
  if (cleaned.includes('ಮೂರು ಸಾವಿರ')) return 3000;
  if (cleaned.includes('ನಾಲ್ಕು ಸಾವಿರ')) return 4000;
  if (cleaned.includes('ಆರು ನೂರ ಐವತ್ತು')) return 650;
  if (cleaned.includes('ಏಳು ನೂರ ಐವತ್ತು')) return 750;
  if (cleaned.includes('ಒಂದು ಲಕ್ಷ')) return 100000;

  return null;
}

/**
 * Parses dictation for a SINGLE specific form field.
 * Used by inline microphone buttons on individual inputs.
 *
 * @param {string} text - Spoken input
 * @param {string} fieldName - 'farmName' | 'location' | 'area' | 'soilType' | 'rainfall' | 'availableWater' | 'budget' | 'season'
 * @param {string} lang - 'en-IN' | 'hi-IN' | 'kn-IN'
 * @returns {{ success: boolean, value: string, displayLabel: string, rawText: string }}
 */
export function parseSingleFieldSpeech(arg1, arg2, _lang = DEFAULT_LANGUAGE) {
  void _lang;
  const KNOWN_FIELDS = [
    'farmName',
    'name',
    'location',
    'area',
    'soilType',
    'rainfall',
    'availableWater',
    'budget',
    'season',
  ];
  let fieldName;
  let text;

  if (KNOWN_FIELDS.includes(arg1) && !KNOWN_FIELDS.includes(arg2)) {
    fieldName = arg1 === 'name' ? 'farmName' : arg1;
    text = arg2;
  } else {
    text = arg1;
    fieldName = arg2 === 'name' ? 'farmName' : arg2;
  }

  if (!text || typeof text !== 'string') {
    return { success: false, value: '', displayLabel: '', rawText: '' };
  }

  const raw = text.trim();
  const lower = raw.toLowerCase();

  switch (fieldName) {
    case 'farmName': {
      // Clean prefixes like "farm name is", "my farm is called", "खेत का नाम", "ತೋಟದ ಹೆಸರು"
      let clean = raw.replace(
        /^(?:my\s*farm\s*name\s*is|farm\s*name\s*(?:is|=|:)?|my\s*farm\s*is\s*called|name\s*is|farm\s*is|खेत\s*का\s*नाम|ತೋಟದ\s*ಹೆಸರು|ಜಮೀನಿನ\s*ಹೆಸರು)\s*/i,
        ''
      );
      clean = clean.replace(/^[.,\s]+|[.,\s]+$/g, '').trim();
      // Capitalize first letters for English/Roman script
      if (/^[a-zA-Z\s]+$/.test(clean)) {
        clean = clean
          .split(' ')
          .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
          .join(' ');
      }
      return {
        success: Boolean(clean),
        value: clean || raw,
        displayLabel: clean || raw,
        rawText: raw,
      };
    }

    case 'location': {
      // Clean prefixes like "location is", "district", "farm in", "ಸ್ಥಳ", "ಜಿಲ್ಲೆ", "जिला"
      let clean = raw.replace(
        /^(?:location\s*(?:is|=|:)?|district|city|town|place|farm\s*in|in|जिला|स्थान|ಸ್ಥಳ|ಜಿಲ್ಲೆ)\s*/i,
        ''
      );
      clean = clean.replace(/\b(?:district|city|town|village|state|ಜಿಲ್ಲೆ|जिला)\b/gi, '').trim();
      clean = clean.replace(/^[.,\s]+|[.,\s]+$/g, '').trim();

      if (/^[a-zA-Z\s]+$/.test(clean)) {
        clean = clean
          .split(' ')
          .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
          .join(' ');
      }
      return {
        success: Boolean(clean),
        value: clean || raw,
        displayLabel: clean || raw,
        rawText: raw,
      };
    }

    case 'area': {
      // Extract numeric or word numerals e.g. "5", "5.5", "five acres", "पाँच एकड़", "ಐದು ಎಕರೆ", "My farm is five acres."
      const numMatch = lower.match(
        /(-?[0-9]+(?:\.[0-9]+)?|[\p{L}\p{M}]+)\s*(?:acres?|acre|ac|एकड़|एकर|ಎಕರೆ)?/iu
      );
      const token = numMatch ? numMatch[1] : lower;
      const num = parseSpokenNumber(token);

      if (num !== null && num > 0) {
        return {
          success: true,
          value: String(num),
          displayLabel: `${num} Acres`,
          rawText: raw,
        };
      }
      return { success: false, value: '', displayLabel: '', rawText: raw };
    }

    case 'soilType': {
      // Loamy
      if (/loam|loamy|medium\s*soil|दोमट|ದೋಮಟ್|ಮರಳು\s*ಮಿಶ್ರಿತ/i.test(lower)) {
        return { success: true, value: 'Loamy', displayLabel: 'Loamy (Medium)', rawText: raw };
      }
      // Clay
      if (/clay|clayey|heavy\s*soil|black\s*soil|काली\s*मिट्टी|काली|चिकनी|ಕಾಳಿ|ಜೇಡಿ/i.test(lower)) {
        return { success: true, value: 'Clay', displayLabel: 'Clay (Heavy)', rawText: raw };
      }
      // Sandy
      if (/sand|sandy|light\s*soil|रेतीली|बलुई|ಮರಳು/i.test(lower)) {
        return { success: true, value: 'Sandy', displayLabel: 'Sandy (Light)', rawText: raw };
      }
      // Silty
      if (/silt|silty|fertile\s*soil|गाद|हौళು|ಹೂಳು/i.test(lower)) {
        return { success: true, value: 'Silty', displayLabel: 'Silty (Fertile)', rawText: raw };
      }
      return { success: false, value: '', displayLabel: '', rawText: raw };
    }

    case 'rainfall': {
      // Extract numeric e.g. "650", "650 mm", "six hundred fifty", "छह सौ पचास", "ಆರು ನೂರ ಐವತ್ತು"
      const rainMatch = lower.match(/(-?[0-9]+(?:\.[0-9]+)?)/);
      if (rainMatch) {
        const val = parseFloat(rainMatch[1]);
        if (!isNaN(val) && val >= 0) {
          return { success: true, value: String(val), displayLabel: `${val} mm`, rawText: raw };
        }
      }
      const tokenVal = parseSpokenNumber(lower.replace(/(?:mm|millimeters|ಮಿಮೀ|मिमी|बारिश|मಳೆ)/gi, '').trim());
      if (tokenVal !== null && tokenVal >= 0) {
        return { success: true, value: String(tokenVal), displayLabel: `${tokenVal} mm`, rawText: raw };
      }
      return { success: false, value: '', displayLabel: '', rawText: raw };
    }

    case 'availableWater': {
      // Strip units first so "m3" digit 3 doesn't falsely match before word numerals
      const stripped = lower
        .replace(/(?:m3|m\^3|cubic\s*meters?|liters?|ltr|घन\s*मीटर|ಘನ\s*ಮೀಟರ್|पानी|ನೀರು)/gi, '')
        .trim();
      const waterMatch = stripped.match(/(-?[0-9]+(?:\.[0-9]+)?)/);
      if (waterMatch) {
        const val = parseFloat(waterMatch[1]);
        if (!isNaN(val) && val >= 0) {
          return { success: true, value: String(val), displayLabel: `${val} m³`, rawText: raw };
        }
      }
      const tokenVal = parseSpokenNumber(stripped);
      if (tokenVal !== null && tokenVal >= 0) {
        return { success: true, value: String(tokenVal), displayLabel: `${tokenVal} m³`, rawText: raw };
      }
      return { success: false, value: '', displayLabel: '', rawText: raw };
    }

    case 'budget': {
      // Check lakh
      const lakhMatch = lower.match(/(-?[0-9]+(?:\.[0-9]+)?)\s*(?:lakhs?|lac|लाख|ಲಕ್ಷ)/i);
      if (lakhMatch) {
        const lakhs = parseFloat(lakhMatch[1]);
        if (!isNaN(lakhs) && lakhs >= 0) {
          const val = String(Math.round(lakhs * 100000));
          return { success: true, value: val, displayLabel: `₹${Number(val).toLocaleString('en-IN')}`, rawText: raw };
        }
      }
      const numMatch = lower.match(/(-?[0-9]+(?:\.[0-9]+)?)/);
      if (numMatch) {
        const val = parseFloat(numMatch[1]);
        if (!isNaN(val) && val >= 0) {
          return { success: true, value: String(val), displayLabel: `₹${val.toLocaleString('en-IN')}`, rawText: raw };
        }
      }
      const tokenVal = parseSpokenNumber(lower.replace(/(?:rupees?|inr|₹|बजट|ಬಜೆಟ್)/gi, '').trim());
      if (tokenVal !== null && tokenVal >= 0) {
        return { success: true, value: String(tokenVal), displayLabel: `₹${tokenVal.toLocaleString('en-IN')}`, rawText: raw };
      }
      return { success: false, value: '', displayLabel: '', rawText: raw };
    }

    case 'season': {
      if (/kharif|monsoon|खरीफ|ಖಾರೀಫ್/i.test(lower)) {
        return { success: true, value: 'Kharif', displayLabel: 'Kharif (Monsoon)', rawText: raw };
      }
      if (/rabi|winter|रबी|ರಬಿ/i.test(lower)) {
        return { success: true, value: 'Rabi', displayLabel: 'Rabi (Winter)', rawText: raw };
      }
      if (/summer|zaid|गर्मी|ज़ैद|ಬೇಸಿಗೆ/i.test(lower)) {
        return { success: true, value: 'Summer', displayLabel: 'Summer (Zaid)', rawText: raw };
      }
      return { success: false, value: '', displayLabel: '', rawText: raw };
    }

    default:
      return { success: true, value: raw, displayLabel: raw, rawText: raw };
  }
}

/**
 * Multi-field voice parser for farm details.
 * Converts speech into editable proposed fields without overwriting anything automatically.
 *
 * @param {string} transcript - The transcribed voice string
 * @param {string} lang - Recognition language tag
 * @returns {object} { parsed: { farmName, area, soilType, rainfall, availableWater, location, season, budget }, recognizedFields: string[], unparsedNotes: string[] }
 */
export function parseSpokenFarmDetails(transcript, lang = 'en-IN') {
  if (!transcript || typeof transcript !== 'string') {
    return {
      parsed: {},
      recognizedFields: [],
      unparsedNotes: ['No speech transcript provided.'],
    };
  }

  const activeLang = lang || DEFAULT_LANGUAGE;
  void activeLang;

  const text = transcript.trim();
  const lower = text.toLowerCase();
  const parsed = {};
  const recognizedFields = [];
  const unparsedNotes = [];

  // 1. Cultivation Area (Acres)
  // Check: "5 acres", "five acres", "5.5 acre", "पाँच एकड़", "ಐದು ಎಕರೆ",
  // "My farm is five acres.", "मेरा खेत पाँच एकड़ का है।", "ನನ್ನ ಜಮೀನು ಐದು ಎಕರೆ ಇದೆ."
  const areaWordOrNumRegex =
    /(?:(-?[0-9]+(?:\.[0-9]+)?|[\p{L}\p{M}]+))\s*(?:acres?|acre|ac|एकड़|एकर|ಎಕರೆ)/iu;
  const areaNamedRegex =
    /(?:area|land|cultivation|size|farm|खेत|जमीन|ಜಮೀನು|ತೋಟ)\s*(?:is|=|:|\s*होता\s*है|\s*ಇದೆ)?\s*(-?[0-9]+(?:\.[0-9]+)?|[\p{L}\p{M}]+)\s*(?:acres?|ac|एकड़|ಎಕರೆ)?/iu;

  const directAreaMatch = lower.match(areaWordOrNumRegex);
  if (directAreaMatch && directAreaMatch[1]) {
    const val = parseSpokenNumber(directAreaMatch[1]);
    if (val !== null && val > 0) {
      parsed.area = String(val);
      recognizedFields.push('area');
    }
  }

  if (!parsed.area) {
    const namedAreaMatch = lower.match(areaNamedRegex);
    if (namedAreaMatch && namedAreaMatch[1]) {
      const parsedVal = parseSpokenNumber(namedAreaMatch[1]);
      if (parsedVal !== null && parsedVal > 0) {
        parsed.area = String(parsedVal);
        recognizedFields.push('area');
      }
    }
  }

  // 2. Farm Name
  // Match "farm name is Green Valley", "farm called Sunrise", "खेत का नाम ...", "ತೋಟದ ಹೆಸರು ..."
  const farmNameRegex =
    /(?:farm\s*name\s*(?:is|=|:)?|farm\s*called|खेत\s*का\s*नाम|ತೋಟದ\s*ಹೆಸರು|ಜಮೀನಿನ\s*ಹೆಸರು)\s*([^\d,;:!?]{2,35}?)(?=$|\s+(?:and|with|season|soil|area|water|budget|rainfall|acres?))/i;
  const nameMatch = text.match(farmNameRegex);
  if (nameMatch && nameMatch[1]) {
    let nameClean = nameMatch[1].trim().replace(/^[.,\s]+|[.,\s]+$/g, '');
    if (nameClean && nameClean.length >= 2) {
      if (/^[a-zA-Z\s]+$/.test(nameClean)) {
        nameClean = nameClean
          .split(' ')
          .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
          .join(' ');
      }
      parsed.farmName = nameClean;
      recognizedFields.push('farmName');
    }
  }

  // 3. Soil Type (Loamy, Clay, Sandy, Silty)
  if (/loam|loamy|medium soil|दोमट|ದೋಮಟ್|ಮರಳು ಮಿಶ್ರಿತ/i.test(lower)) {
    parsed.soilType = 'Loamy';
    recognizedFields.push('soilType');
  } else if (/clay|clayey|heavy soil|black soil|काली मिट्टी|काली|चिकनी|ಕಾಳಿ|ಜೇಡಿ|ಕಪ್ಪು ಮಣ್ಣು/i.test(lower)) {
    parsed.soilType = 'Clay';
    recognizedFields.push('soilType');
  } else if (/sand|sandy|light soil|रेतीली|बलुई|ಮರಳು/i.test(lower)) {
    parsed.soilType = 'Sandy';
    recognizedFields.push('soilType');
  } else if (/silt|silty|fertile soil|गाद|हौళು|ಹೂಳು/i.test(lower)) {
    parsed.soilType = 'Silty';
    recognizedFields.push('soilType');
  }

  // 4. Expected Rainfall (mm)
  // Match "rainfall 650 mm", "rain 700", "बारिश 650", "ಮಳೆ 650"
  const rainRegex =
    /(?:rainfall|rain|precipitation|बारिश|वर्षा|ಮಳೆ)\s*(?:is|=|:)?\s*(-?[0-9]+(?:\.[0-9]+)?|[\p{L}\p{M}]+)\s*(?:mm|millimeters|ಮಿಮೀ|मिमी)?/iu;
  const rainAltRegex =
    /(-?[0-9]+(?:\.[0-9]+)?)\s*(?:mm|millimeters|ಮಿಮೀ|मिमी)\s*(?:rainfall|rain)?/i;

  const rainMatch = lower.match(rainRegex) || lower.match(rainAltRegex);
  if (rainMatch && rainMatch[1]) {
    const rainVal = parseSpokenNumber(rainMatch[1]);
    if (rainVal !== null && rainVal >= 0) {
      parsed.rainfall = String(rainVal);
      recognizedFields.push('rainfall');
    }
  }

  // 5. Available Irrigation Water (m³)
  // Match "water 3000", "available water 4000 m3", "पानी 3000", "ನೀರು 3000"
  const waterRegex =
    /(?:available\s*water|water\s*reserve|water\s*supply|water|पानी|जल|ನೀರು)\s*(?:is|=|:)?\s*(-?[0-9]+(?:\.[0-9]+)?|[\p{L}\p{M}]+)\s*(?:m3|cubic\s*meters?|liters?|ltr|घन\s*मीटर|ಘನ\s*ಮೀಟರ್)?/iu;
  const waterAltRegex =
    /(-?[0-9]+(?:\.[0-9]+)?)\s*(?:m3|cubic\s*meters?|घन\s*मीटर|ಘನ\s*ಮೀಟರ್)\s*(?:water|supply|पानी|ನೀರು)?/i;

  const waterMatch = lower.match(waterRegex) || lower.match(waterAltRegex);
  if (waterMatch && waterMatch[1]) {
    const waterVal = parseSpokenNumber(waterMatch[1]);
    if (waterVal !== null && waterVal >= 0) {
      parsed.availableWater = String(waterVal);
      recognizedFields.push('availableWater');
    }
  }

  // 6. Total Budget (INR)
  const lakhRegex =
    /(?:budget|funds?|cost|बजट|ಬಜೆಟ್)\s*(?:is|=|:)?\s*(?:₹|rs\.?|inr)?\s*(-?[0-9]+(?:\.[0-9]+)?|[\p{L}\p{M}]+)\s*(?:lakhs?|lac|लाख|ಲಕ್ಷ)/iu;
  const lakhMatch = lower.match(lakhRegex);

  if (lakhMatch && lakhMatch[1]) {
    const lakhs = parseSpokenNumber(lakhMatch[1]);
    if (lakhs !== null && lakhs >= 0) {
      parsed.budget = String(Math.round(lakhs * 100000));
      recognizedFields.push('budget');
    }
  } else {
    const budgetRegex =
      /(?:budget|funds?|cost|बजट|ಬಜೆಟ್)\s*(?:is|=|:)?\s*(?:₹|rs\.?|inr)?\s*(-?[0-9]+(?:\.[0-9]+)?)\s*(?:rupees?|inr|₹)?/i;
    const budgetMatch = lower.match(budgetRegex);
    if (budgetMatch && budgetMatch[1]) {
      const budgetVal = parseFloat(budgetMatch[1]);
      if (!isNaN(budgetVal) && budgetVal >= 0) {
        parsed.budget = String(budgetVal);
        recognizedFields.push('budget');
      }
    }
  }

  // 7. Growing Season (Kharif, Rabi, Summer)
  if (/kharif|monsoon season|खरीफ|ಖಾರೀಫ್/i.test(lower)) {
    parsed.season = 'Kharif';
    recognizedFields.push('season');
  } else if (/rabi|winter season|रबी|ರಬಿ/i.test(lower)) {
    parsed.season = 'Rabi';
    recognizedFields.push('season');
  } else if (/summer|zaid|summer season|गर्मी|ज़ैद|ಬೇಸಿಗೆ/i.test(lower)) {
    parsed.season = 'Summer';
    recognizedFields.push('season');
  }

  // 8. Location or District
  const locationRegex =
    /(?:location|district|place|farm in|city|in|जिला|स्थान|ಸ್ಥಳ|ಜಿಲ್ಲೆ)\s*(?:is|=|:)?\s*([^\d.,;:!?]{2,30}?)(?=$|\s+(?:and|with|season|soil|area|water|budget|rainfall|acres?))/i;
  const locMatch = text.match(locationRegex);

  if (locMatch && locMatch[1]) {
    let locClean = locMatch[1].trim();
    locClean = locClean.replace(/^[.,\s]+|[.,\s]+$/g, '');
    locClean = locClean.replace(/\b(?:district|city|town|village|state|ಜಿಲ್ಲೆ|जिला)\b/gi, '').trim();
    locClean = locClean.replace(/^[.,\s]+|[.,\s]+$/g, '');

    const reserved = ['kharif', 'rabi', 'summer', 'loamy', 'clay', 'sandy', 'silty', 'acres', 'water', 'budget'];
    if (locClean && !reserved.includes(locClean.toLowerCase()) && locClean.length >= 2) {
      if (/^[a-zA-Z\s]+$/.test(locClean)) {
        parsed.location = locClean
          .split(' ')
          .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
          .join(' ');
      } else {
        parsed.location = locClean;
      }
      recognizedFields.push('location');
    }
  }

  // Identify any missing core fields for farmer feedback (farmName is optional)
  const coreFields = ['location', 'area', 'season', 'soilType', 'rainfall', 'availableWater', 'budget'];
  coreFields.forEach((field) => {
    if (!recognizedFields.includes(field)) {
      unparsedNotes.push(field);
    }
  });

  return {
    parsed,
    recognizedFields,
    unparsedNotes,
    rawTranscript: text,
  };
}

/**
 * Generates an accurate, spoken water optimization results summary.
 * Strictly avoids fabricated numbers or hardcoded fallback figures.
 *
 * @param {object} params
 * @param {object} params.planResult - Real backend plan result
 * @param {object} params.farmData - Active farm data
 * @param {object} params.activeCrop - Selected crop object
 * @param {string} params.activeMethod - Selected irrigation method (e.g. Drip, Sprinkler)
 * @param {string} params.language - 'en-IN' | 'hi-IN' | 'kn-IN'
 * @returns {string} Clean, spoken text summary
 */
export function generateWaterSummarySpeech({
  planResult,
  farmData,
  activeCrop,
  activeMethod = 'Drip',
  language = 'en-IN',
}) {
  // Empty state handling
  if (!planResult) {
    if (language === 'hi-IN') {
      return 'वर्तमान में कोई जल योजना उपलब्ध नहीं है। फसल जल आवश्यकताओं और सिंचाई आवंटन को देखने के लिए कृपया पहले फार्म विवरण दर्ज करें और योजना बनाएं।';
    }
    if (language === 'kn-IN') {
      return 'ಪ್ರಸ್ತುತ ಯಾವುದೇ ನೀರಿನ ಯೋಜನೆ ಲಭ್ಯವಿಲ್ಲ. ಬೆಳೆ ನೀರಿನ ಅಗತ್ಯತೆಗಳನ್ನು ಲೆಕ್ಕಾಚಾರ ಮಾಡಲು ದಯವಿಟ್ಟು ಮೊದಲು ಫಾರ್ಮ್ ವಿವರಗಳನ್ನು ಕಾನ್ಫಿಗರ್ ಮಾಡಿ ಮತ್ತು ಯೋಜನೆಯನ್ನು ರಚಿಸಿ.';
    }
    return 'No farm water plan has been evaluated yet. Please configure your farm parameters and generate a plan first to calculate crop water requirements and irrigation allocations.';
  }

  // Identify Crop
  const crop =
    activeCrop ||
    planResult.top_recommendation ||
    (planResult.all_feasible_crops && planResult.all_feasible_crops[0]) ||
    null;
  const cropName = crop?.name || null;

  // Farm Area
  const farmArea = planResult.farm_area_acres ?? farmData?.areaAcres;

  // Available Supply
  const rawSupply =
    planResult.water?.total_available_m3 !== undefined && planResult.water?.total_available_m3 !== null
      ? planResult.water.total_available_m3
      : farmData?.availableWaterM3 !== undefined && farmData?.availableWaterM3 !== null
      ? farmData.availableWaterM3
      : null;

  // Demand
  const netDemandM3 =
    crop && crop.irrigation_req_m3 !== undefined && crop.irrigation_req_m3 !== null
      ? Number(crop.irrigation_req_m3)
      : planResult.water?.net_demand_m3 !== undefined && planResult.water?.net_demand_m3 !== null
      ? Number(planResult.water.net_demand_m3)
      : null;

  // Allocation & Balances
  let allocatedM3 = null;
  let deficitM3 = 0;
  let remainingM3 = 0;

  if (rawSupply !== null && netDemandM3 !== null) {
    allocatedM3 = Math.min(rawSupply, netDemandM3);
    deficitM3 = Math.max(0, netDemandM3 - rawSupply);
    remainingM3 = Math.max(0, rawSupply - netDemandM3);
  } else if (planResult.water?.allocated_m3 !== undefined && planResult.water?.allocated_m3 !== null) {
    allocatedM3 = planResult.water.allocated_m3;
    deficitM3 = planResult.water.deficit_m3 || 0;
    remainingM3 = planResult.water.remaining_m3 || 0;
  }

  // Generate localized spoken text
  const parts = [];

  if (language === 'hi-IN') {
    parts.push('क्वांटम एग्री जल अनुकूलन परिणाम:');
    if (cropName) {
      parts.push(`चयनित फसल ${cropName} है।`);
    } else {
      parts.push('कोई विशिष्ट फसल चयनित नहीं है।');
    }

    if (rawSupply !== null) {
      parts.push(`उपलब्ध सिंचाई जल आपूर्ति ${Math.round(rawSupply).toLocaleString('en-IN')} घन मीटर है।`);
    } else {
      parts.push('उपलब्ध जल आपूर्ति अज्ञात है।');
    }

    if (netDemandM3 !== null) {
      parts.push(`अनुमानित शुद्ध सिंचाई मांग ${Math.round(netDemandM3).toLocaleString('en-IN')} घन मीटर है।`);
    }

    if (allocatedM3 !== null) {
      parts.push(`आवंटित जल ${Math.round(allocatedM3).toLocaleString('en-IN')} घन मीटर है।`);
    }

    if (deficitM3 > 0) {
      parts.push(`चेतावनी: ${Math.round(deficitM3).toLocaleString('en-IN')} घन मीटर का जल घाटा है।`);
    } else if (remainingM3 > 0) {
      parts.push(`सिंचाई के बाद ${Math.round(remainingM3).toLocaleString('en-IN')} घन मीटर शेष जल सुरक्षित रहेगा।`);
    }

    if (activeMethod) {
      parts.push(`चयनित सिंचाई विधि ${activeMethod} है।`);
    }

    parts.push('कृपया ध्यान दें: जल मांग भारतीय कृषि अनुसंधान परिषद के बेंचमार्क पर आधारित अनुमानित मान है।');
    return parts.join(' ');
  }

  if (language === 'kn-IN') {
    parts.push('ಕ್ವಾಂಟಮ್ ಅಗ್ರಿ ಜಲ ಆಪ್ಟಿಮೈಸೇಶನ್ ಫಲಿತಾಂಶಗಳು:');
    if (cropName) {
      parts.push(`ಆಯ್ಕೆಮಾಡಿದ ಬೆಳೆ ${cropName}.`);
    } else {
      parts.push('ಯಾವುದೇ ನಿರ್ದಿಷ್ಟ ಬೆಳೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಲಾಗಿಲ್ಲ.');
    }

    if (rawSupply !== null) {
      parts.push(`ಲಭ್ಯವಿರುವ ನೀರಾವರಿ ನೀರು ${Math.round(rawSupply).toLocaleString('en-IN')} ಘನ ಮೀಟರ್ ಆಗಿದೆ.`);
    } else {
      parts.push('ಲಭ್ಯವಿರುವ ನೀರು ಅಜ್ಞಾತವಾಗಿದೆ.');
    }

    if (netDemandM3 !== null) {
      parts.push(`ಅಂದಾಜು ನಿವ್ವಳ ನೀರಾವರಿ ಬೇಡಿಕೆ ${Math.round(netDemandM3).toLocaleString('en-IN')} ಘನ ಮೀಟರ್ ಆಗಿದೆ.`);
    }

    if (allocatedM3 !== null) {
      parts.push(`ಹಂಚಿಕೆಯಾದ ನೀರು ${Math.round(allocatedM3).toLocaleString('en-IN')} ಘನ ಮೀಟರ್.`);
    }

    if (deficitM3 > 0) {
      parts.push(`ಎಚ್ಚರಿಕೆ: ${Math.round(deficitM3).toLocaleString('en-IN')} ಘನ ಮೀಟರ್ ನೀರಿನ ಕೊರತೆಯಿದೆ.`);
    } else if (remainingM3 > 0) {
      parts.push(`ಬೆಳೆಯ ನಂತರ ${Math.round(remainingM3).toLocaleString('en-IN')} ಘನ ಮೀಟರ್ ಉಳಿದ ಬಫರ್ ಇರುತ್ತದೆ.`);
    }

    if (activeMethod) {
      parts.push(`ಆಯ್ಕೆಮಾಡಿದ ನೀರಾವರಿ ವಿಧಾನ ${activeMethod}.`);
    }

    parts.push('ಗಮನಿಸಿ: ನೀರಿನ ಬೇಡಿಕೆಯು ಐಸಿಎಆರ್ ಮಾನದಂಡಗಳ ಆಧಾರದ ಮೇಲೆ ಅಂದಾಜು ಮೌಲ್ಯವಾಗಿದೆ.');
    return parts.join(' ');
  }

  // Default English summary
  parts.push('Quantum Agri Water Optimization summary.');

  if (cropName) {
    const areaSuffix = farmArea ? ` for ${farmArea} acres` : '';
    parts.push(`Selected crop is ${cropName}${areaSuffix}.`);
  } else {
    parts.push('No individual candidate crop is currently selected.');
  }

  if (rawSupply !== null) {
    parts.push(`Available irrigation supply is ${Math.round(rawSupply).toLocaleString()} cubic meters.`);
  } else {
    parts.push('Available irrigation supply is currently unavailable.');
  }

  if (netDemandM3 !== null) {
    parts.push(`Estimated supplemental irrigation demand is ${Math.round(netDemandM3).toLocaleString()} cubic meters.`);
  }

  if (allocatedM3 !== null) {
    parts.push(`Water allocated to this crop is ${Math.round(allocatedM3).toLocaleString()} cubic meters.`);
  }

  if (deficitM3 > 0) {
    parts.push(
      `There is an estimated water deficit of ${Math.round(deficitM3).toLocaleString()} cubic meters, meaning demand exceeds current reserves.`
    );
  } else if (remainingM3 > 0) {
    parts.push(
      `A remaining surplus buffer of ${Math.round(remainingM3).toLocaleString()} cubic meters will be retained in your reserve.`
    );
  } else if (rawSupply !== null && netDemandM3 !== null) {
    parts.push('Irrigation demand matches available supply with zero remaining buffer.');
  }

  if (activeMethod) {
    parts.push(`Selected irrigation method is ${activeMethod}.`);
  }

  parts.push('Please note: all crop irrigation demands are estimated values derived from ICAR agronomic benchmarks.');

  return parts.join(' ');
}

/**
 * Generates an accurate, spoken summary for Crop Recommendations and Farm Planning results.
 * Reads actual values only, never generating simulated numbers.
 *
 * @param {object} params
 * @param {object} params.planResult - Real plan result
 * @param {object} params.farmData - Current farm data
 * @param {string} params.language - 'en-IN' | 'hi-IN' | 'kn-IN'
 * @returns {string} Localized spoken summary
 */
export function generatePlanSummarySpeech({ planResult, farmData, language = 'en-IN' }) {
  if (!planResult) {
    if (language === 'hi-IN') {
      return 'वर्तमान में कोई फसल सिफारिशें उपलब्ध नहीं हैं। कृपया पहले अपने खेत के विवरण दर्ज करें और योजना बनाएं।';
    }
    if (language === 'kn-IN') {
      return 'ಪ್ರಸ್ತುತ ಯಾವುದೇ ಬೆಳೆ ಶಿಫಾರಸುಗಳು ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಮೊದಲು ನಿಮ್ಮ ಕೃಷಿ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ ಮತ್ತು ಯೋಜನೆಯನ್ನು ರಚಿಸಿ.';
    }
    return 'No crop recommendations available yet. Please configure your farm parameters and generate a plan first.';
  }

  const topCrop = planResult.top_recommendation;
  const candidateCount = planResult.all_feasible_crops?.length || 0;
  const area = planResult.farm_area_acres ?? farmData?.areaAcres;
  const location = planResult.location ?? farmData?.location ?? '';
  const profit =
    topCrop?.expected_profit_inr ??
    topCrop?.expected_profit_rs ??
    planResult.economic_impact?.expected_profit_rs ??
    null;
  const confidence = topCrop?.confidence_score;

  if (language === 'hi-IN') {
    const parts = ['क्वांटम एग्री फसल योजना परिणाम:'];
    if (topCrop) {
      parts.push(`शीर्ष अनुशंसित फसल ${topCrop.name} है।`);
      if (confidence !== undefined && confidence !== null) {
        parts.push(`विश्वसनीयता स्कोर ${confidence} प्रतिशत है।`);
      }
      if (profit !== null) {
        parts.push(`अनुमानित शुद्ध लाभ ₹${Math.round(profit).toLocaleString('en-IN')} है।`);
      }
      if (topCrop.irrigation_req_m3 !== undefined && topCrop.irrigation_req_m3 !== null) {
        parts.push(`सिंचाई जल आवश्यकता ${Math.round(topCrop.irrigation_req_m3).toLocaleString('en-IN')} घन मीटर है।`);
      }
    }
    if (candidateCount > 0) {
      parts.push(`कुल ${candidateCount} व्यवहार्य फसलें पहचानी गईं।`);
    }
    parts.push('भारतीय कृषि अनुसंधान परिषद के बेंचमार्क पर आधारित।');
    return parts.join(' ');
  }

  if (language === 'kn-IN') {
    const parts = ['ಕ್ವಾಂಟಮ್ ಅಗ್ರಿ ಬೆಳೆ ಯೋಜನೆ ಸಾರಾಂಶ:'];
    if (topCrop) {
      parts.push(`ಅಗ್ರ ಶಿಫಾರಸು ಮಾಡಿದ ಬೆಳೆ ${topCrop.name}.`);
      if (confidence !== undefined && confidence !== null) {
        parts.push(`ವಿಶ್ವಾಸಾರ್ಹತೆ ಸ್ಕೋರ್ ${confidence} ಪ್ರತಿಶತ.`);
      }
      if (profit !== null) {
        parts.push(`ಅಂದಾಜು ನಿವ್ವಳ ಲಾಭ ₹${Math.round(profit).toLocaleString('en-IN')}.`);
      }
      if (topCrop.irrigation_req_m3 !== undefined && topCrop.irrigation_req_m3 !== null) {
        parts.push(`ನೀರಾವರಿ ಅಗತ್ಯತೆ ${Math.round(topCrop.irrigation_req_m3).toLocaleString('en-IN')} ಘನ ಮೀಟರ್.`);
      }
    }
    if (candidateCount > 0) {
      parts.push(`ಒಟ್ಟು ${candidateCount} ಸೂಕ್ತ ಬೆಳೆಗಳನ್ನು ಗುರುತಿಸಲಾಗಿದೆ.`);
    }
    parts.push('ಐಸಿಎಆರ್ ಕೃಷಿ ಮಾನದಂಡಗಳ ಆಧಾರದ ಮೇಲೆ.');
    return parts.join(' ');
  }

  // English
  const parts = ['Quantum Agri Crop Planning summary.'];
  if (topCrop) {
    const locPhrase = location ? ` in ${location}` : '';
    const areaPhrase = area ? ` for ${area} acres` : '';
    parts.push(`The top recommended crop${areaPhrase}${locPhrase} is ${topCrop.name}.`);
    if (confidence !== undefined && confidence !== null) {
      parts.push(`Confidence score is ${confidence} percent.`);
    }
    if (profit !== null) {
      parts.push(`Estimated net profit is ₹${Math.round(profit).toLocaleString('en-IN')}.`);
    }
    if (topCrop.irrigation_req_m3 !== undefined && topCrop.irrigation_req_m3 !== null) {
      parts.push(`Seasonal supplemental irrigation demand is ${Math.round(topCrop.irrigation_req_m3).toLocaleString('en-IN')} cubic meters.`);
    }
  }
  if (candidateCount > 0) {
    const otherFeasible = (planResult.all_feasible_crops || [])
      .filter((c) => c.name !== topCrop?.name)
      .map((c) => c.name);
    if (otherFeasible.length > 0) {
      parts.push(`Alternative viable crops include: ${otherFeasible.join(', ')}.`);
    } else {
      parts.push(`A total of ${candidateCount} feasible crops meet all your soil, water, and season criteria.`);
    }
  }
  parts.push('Derived from ICAR agronomic benchmarks.');

  return parts.join(' ');
}

/**
 * Localized interface messages and assistant instructions.
 */
export const ASSISTANT_MESSAGES = {
  'en-IN': {
    title: 'Smart Voice Assistant',
    heading: 'Dictate Farm Details',
    desc: 'Speak your farm acreage, location, soil type, water reserve, or budget naturally. Review the extracted values below before applying them to the form.',
    startListening: 'Start Dictation',
    stopListening: 'Stop Listening',
    listeningStatus: 'Listening now… Speak your farm details',
    dictatedLabel: 'Dictated Text (Editable):',
    dictatedHint: 'You can manually edit or correct any misheard words before applying.',
    placeholder: 'e.g. My farm is 5 acres with Loamy soil in Mandya, expected rainfall 650 mm, and 3000 m³ water reserve.',
    parseBtn: 'Parse Spoken Details',
    clearBtn: 'Clear Transcript',
    reviewHeading: 'Review Proposed Farm Parameters',
    reviewDesc: 'Verify the extracted values below. Correct any numbers if needed, then click "Apply to Farm Form". Unmapped fields will not be altered.',
    applyBtn: 'Apply to Farm Form',
    discardBtn: 'Discard Proposals',
    noSpeechNotice: 'No speech was detected. Please check your microphone and speak again.',
    detectedSuccess: (count) => `Recognized ${count} farm field(s). Please review and edit before applying.`,
    clarificationNeeded: 'Some details were not clearly heard. You can edit the values in the table below or speak again.',
    browserUnsupported: 'Speech Recognition is not natively supported in this browser. Please use Google Chrome, Microsoft Edge, or type manually.',
    micDenied: 'Microphone access was denied. Please allow microphone permissions in your browser URL bar.',
    listenPlanBtn: 'Listen to Crop Recommendations',
    listenWaterBtn: 'Listen to Results',
  },
  'hi-IN': {
    title: 'स्मार्ट वॉयस सहायक',
    heading: 'खेत का विवरण बोलकर दर्ज करें',
    desc: 'अपने खेत का क्षेत्रफल, स्थान, मिट्टी का प्रकार, पानी का भंडार या बजट स्वाभाविक रूप से बोलें। लागू करने से पहले समीक्षा करें।',
    startListening: 'बोलना शुरू करें',
    stopListening: 'सुनना बंद करें',
    listeningStatus: 'सुन रहे हैं… कृपया अपने खेत का विवरण बोलें',
    dictatedLabel: 'बोला गया पाठ (संपादन योग्य):',
    dictatedHint: 'लागू करने से पहले आप किसी भी गलत सुने गए शब्द को सुधार सकते हैं।',
    placeholder: 'उदा. मेरा खेत पाँच एकड़ का है, दोमट मिट्टी, मंड्या में, 650 मिमी वर्षा और 3000 घन मीटर पानी।',
    parseBtn: 'विवरण पहचानें',
    clearBtn: 'पाठ साफ़ करें',
    reviewHeading: 'पहचाने गए खेत मापदंडों की समीक्षा करें',
    reviewDesc: 'नीचे दिए गए मानों की पुष्टि करें। आवश्यकतानुसार सुधार करें, फिर "फार्म में लागू करें" पर क्लिक करें।',
    applyBtn: 'फार्म में लागू करें',
    discardBtn: 'प्रस्ताव अस्वीकार करें',
    noSpeechNotice: 'कोई आवाज़ नहीं सुनी गई। कृपया माइक्रोफ़ोन जांचें और फिर से बोलें।',
    detectedSuccess: (count) => `${count} फार्म विवरण पहचाने गए। लागू करने से पहले समीक्षा और संपादन करें।`,
    clarificationNeeded: 'कुछ विवरण स्पष्ट रूप से नहीं सुने गए। आप तालिका में मान संपादित कर सकते हैं या फिर से बोल सकते हैं।',
    browserUnsupported: 'इस ब्राउज़र में स्पीच रिकग्निशन समर्थित नहीं है। कृपया क्रोम या एज का उपयोग करें या मैन्युअल रूप से टाइप करें।',
    micDenied: 'माइक्रोफ़ोन अनुमति अस्वीकृत हो गई। कृपया ब्राउज़र सेटिंग्स में माइक्रोफ़ोन की अनुमति दें।',
    listenPlanBtn: 'सिफारिशें सुनें',
    listenWaterBtn: 'परिणाम सुनें',
  },
  'kn-IN': {
    title: 'ಸ್ಮಾರ್ಟ್ ಧ್ವನಿ ಸಹಾಯಕ',
    heading: 'ಕೃಷಿ ವಿವರಗಳನ್ನು ಮಾತನಾಡಿ ನಮೂದಿಸಿ',
    desc: 'ನಿಮ್ಮ ಜಮೀನಿನ ವಿಸ್ತೀರ್ಣ, ಸ್ಥಳ, ಮಣ್ಣಿನ ಪ್ರಕಾರ, ನೀರಿನ ಸಂಗ್ರಹ ಅಥವಾ ಬಜೆಟ್ ಅನ್ನು ಮಾತನಾಡಿ. ಅನ್ವಯಿಸುವ ಮುನ್ನ ಪರಿಶೀಲಿಸಿ.',
    startListening: 'ಮಾತನಾಡಲು ಪ್ರಾರಂಭಿಸಿ',
    stopListening: 'ನಿಲ್ಲಿಸಿ',
    listeningStatus: 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದ್ದೇವೆ… ದಯವಿಟ್ಟು ಕೃಷಿ ವಿವರಗಳನ್ನು ಮಾತನಾಡಿ',
    dictatedLabel: 'ಮಾತನಾಡಿದ ಪಠ್ಯ (ತಿದ್ದಿ ಬರೆಯಬಹುದು):',
    dictatedHint: 'ಫಾರ್ಮ್‌ಗೆ ಅನ್ವಯಿಸುವ ಮೊದಲು ನೀವು ತಪ್ಪಾಗಿ ಕೇಳಿದ ಯಾವುದೇ ಪದವನ್ನು ತಿದ್ದಬಹುದು.',
    placeholder: 'ಉದಾ: ನನ್ನ ಜಮೀನು ಐದು ಎಕರೆ ಇದೆ, ಮಂಡ್ಯದಲ್ಲಿ ದೋಮಟ್ ಮಣ್ಣು, 650 ಮಿಮೀ ಮಳೆ ಮತ್ತು 3000 ಘನ ಮೀಟರ್ ನೀರು.',
    parseBtn: 'ವಿವರಗಳನ್ನು ಗುರುತಿಸಿ',
    clearBtn: 'ಅಳಿಸಿ',
    reviewHeading: 'ಗುರುತಿಸಲಾದ ಕೃಷಿ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ',
    reviewDesc: 'ಕೆಳಗೆ ಗುರುತಿಸಲಾದ ಮೌಲ್ಯಗಳನ್ನು ಪರಿಶೀಲಿಸಿ. ಅಗತ್ಯವಿದ್ದರೆ ಸರಿಪಡಿಸಿ, ನಂತರ "ಫಾರ್ಮ್‌ಗೆ ಅನ್ವಯಿಸಿ" ಕ್ಲಿಕ್ ಮಾಡಿ.',
    applyBtn: 'ಫಾರ್ಮ್‌ಗೆ ಅನ್ವಯಿಸಿ',
    discardBtn: 'ತಿರಸ್ಕರಿಸಿ',
    noSpeechNotice: 'ಯಾವುದೇ ಧ್ವನಿ ಪತ್ತೆಯಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಮೈಕ್ರೊಫೋನ್ ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಮತ್ತೆ ಮಾತನಾಡಿ.',
    detectedSuccess: (count) => `${count} ಕೃಷಿ ವಿವರಗಳನ್ನು ಗುರುತಿಸಲಾಗಿದೆ. ಅನ್ವಯಿಸುವ ಮೊದಲು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಸಂಪಾದಿಸಿ.`,
    clarificationNeeded: 'ಕೆಲವು ವಿವರಗಳು ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ಕೆಳಗಿನ ಕೋಷ್ಟಕದಲ್ಲಿ ತಿದ್ದಿ ಅಥವಾ ಮತ್ತೊಮ್ಮೆ ಮಾತನಾಡಿ.',
    browserUnsupported: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ಕ್ರೋಮ್ ಅಥವಾ ಎಡ್ಜ್ ಬಳಸಿ.',
    micDenied: 'ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಅನುಮತಿ ನೀಡಿ.',
    listenPlanBtn: 'ಶಿಫಾರಸುಗಳನ್ನು ಆಲಿಸಿ',
    listenWaterBtn: 'ಫಲಿತಾಂಶಗಳನ್ನು ಆಲಿಸಿ',
  },
};
