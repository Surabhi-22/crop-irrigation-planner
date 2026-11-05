/**
 * Quantum Agri — WaterSpeechControl
 *
 * Provides spoken Water Optimization results:
 * - "Listen to Results" button reading only real, valid data.
 * - Controls: Play, Pause, Resume, Stop.
 * - Localized spoken summaries in English, Hindi, and Kannada.
 * - Distinguishes estimates from measured values.
 * - Never fabricates fallback numbers or combines alternative crops.
 * - Automatically stops playback on unmount or navigation.
 */

import { useState, useEffect } from 'react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { useLanguage } from '../context/LanguageContext';
import {
  generateWaterSummarySpeech,
  SUPPORTED_LANGUAGES,
} from '../services/voiceService';

export default function WaterSpeechControl({
  planResult,
  farmData,
  activeCrop,
  activeMethod = 'Drip',
}) {
  const { language: globalLang, setLanguage: setGlobalLang } = useLanguage();
  const selectedLang = globalLang || 'en-IN';
  const [spokenTextPreview, setSpokenTextPreview] = useState('');

  const {
    isSynthesisSupported,
    isSpeaking,
    isPaused,
    speak,
    pauseSpeaking,
    resumeSpeaking,
    stopSpeaking,
    hasVoiceForLanguage,
    error,
  } = useVoiceAssistant({ defaultLanguage: selectedLang });

  // Clean up speech when navigating away or unmounting
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  function handleListen() {
    const summary = generateWaterSummarySpeech({
      planResult,
      farmData,
      activeCrop,
      activeMethod,
      language: selectedLang,
    });

    setSpokenTextPreview(summary);

    speak(summary, {
      lang: selectedLang,
      rate: 0.95,
      pitch: 1.0,
    });
  }

  function handleStop() {
    stopSpeaking();
    setSpokenTextPreview('');
  }

  return (
    <div className="water-speech-control-card" role="region" aria-label="Spoken Water Results Controls">
      <div className="speech-control-main-bar">
        {/* Left: Button Group */}
        <div className="speech-buttons-group">
          {!isSpeaking ? (
            <button
              id="water-listen-results-btn"
              type="button"
              className="water-listen-cta-btn"
              onClick={handleListen}
              disabled={!isSynthesisSupported}
              aria-label="Listen to water optimization results aloud"
              title={
                isSynthesisSupported
                  ? 'Listen to spoken summary of current water balances'
                  : 'Speech synthesis is not supported in this browser'
              }
            >
              <span className="material-symbols-outlined cta-icon">volume_up</span>
              <span>Listen to Results</span>
            </button>
          ) : (
            <div className="speech-active-controls">
              {isPaused ? (
                <button
                  type="button"
                  className="speech-mini-btn resume"
                  onClick={resumeSpeaking}
                  aria-label="Resume reading water results"
                  title="Resume speech playback"
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="speech-mini-btn pause"
                  onClick={pauseSpeaking}
                  aria-label="Pause reading water results"
                  title="Pause speech playback"
                >
                  <span className="material-symbols-outlined">pause</span>
                  <span>Pause</span>
                </button>
              )}

              <button
                type="button"
                className="speech-mini-btn stop"
                onClick={handleStop}
                aria-label="Stop reading water results"
                title="Stop speech playback"
              >
                <span className="material-symbols-outlined">stop</span>
                <span>Stop</span>
              </button>
            </div>
          )}

          {/* Active Speaking Wave Indicator */}
          {isSpeaking && (
            <div className="speaking-wave-box" aria-live="polite">
              <span className="wave-bar bar-1" />
              <span className="wave-bar bar-2" />
              <span className="wave-bar bar-3" />
              <span className="wave-bar bar-4" />
              <span className="speaking-status-text">
                {isPaused ? 'Paused' : 'Reading aloud…'}
              </span>
            </div>
          )}
        </div>

        {/* Right: Language Selector & Diagnostics */}
        <div className="speech-settings-group">
          <label htmlFor="water-speech-lang-select" className="speech-lang-label">
            <span className="material-symbols-outlined">translate</span>
            Voice:
          </label>
          <select
            id="water-speech-lang-select"
            value={selectedLang}
            onChange={(e) => {
              const next = e.target.value;
              setGlobalLang(next);
              if (isSpeaking) {
                stopSpeaking();
              }
            }}
            className="speech-lang-dropdown"
            disabled={isSpeaking}
            aria-label="Speech synthesis language"
          >
            {SUPPORTED_LANGUAGES.map((lang) => {
              const supported = hasVoiceForLanguage(lang.synthesisLang);
              return (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeLabel} {supported ? '' : '(Generic voice)'}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Browser compatibility notice if unsupported */}
      {!isSynthesisSupported && (
        <div className="speech-compat-notice warning" role="alert">
          <span className="material-symbols-outlined">info</span>
          <span>
            Speech synthesis is not available in your browser. Results are presented visually on
            this page.
          </span>
        </div>
      )}

      {error && (
        <div className="speech-compat-notice error" role="alert">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Live spoken transcript caption */}
      {isSpeaking && spokenTextPreview && (
        <div className="spoken-preview-banner" aria-live="polite">
          <span className="material-symbols-outlined caption-icon">record_voice_over</span>
          <p className="caption-text">{spokenTextPreview}</p>
        </div>
      )}
    </div>
  );
}
