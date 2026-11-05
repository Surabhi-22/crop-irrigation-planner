/**
 * Quantum Agri — Language Context
 *
 * Provides a unified multilingual state for:
 * 1. Interface localization
 * 2. Speech recognition language (en-IN, hi-IN, kn-IN)
 * 3. Speech synthesis language
 * 4. LocalStorage persistence across page refreshes
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getSavedLanguagePreference,
  saveLanguagePreference,
} from '../services/voiceService';

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  supportedLanguages: SUPPORTED_LANGUAGES,
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => getSavedLanguagePreference());

  const setLanguage = useCallback((newLang) => {
    if (!newLang) return;
    setLanguageState(newLang);
    saveLanguagePreference(newLang);
  }, []);

  useEffect(() => {
    function handleStorage(e) {
      if (e.key === 'quantum_agri_language_pref' && e.newValue) {
        setLanguageState(e.newValue);
      }
    }

    function handleCustomEvent(e) {
      if (e.detail?.language) {
        setLanguageState(e.detail.language);
      }
    }

    window.addEventListener('storage', handleStorage);
    window.addEventListener('quantum_agri_language_change', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('quantum_agri_language_change', handleCustomEvent);
    };
  }, []);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      supportedLanguages: SUPPORTED_LANGUAGES,
    };
  }
  return context;
}
