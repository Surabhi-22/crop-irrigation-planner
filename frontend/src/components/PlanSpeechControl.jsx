/**
 * Quantum Agri — PlanSpeechControl
 *
 * Spoken audio summary of Crop Recommendations & Farm Planning results:
 * - Reads actual plan results (Top recommended crop, duration, profit, irrigation requirement).
 * - Multi-lingual speech synthesis (English, Hindi, Kannada).
 * - Controls: Play, Pause, Resume, Stop.
 * - Live animated speaking indicator.
 * - Stops playback on navigation / component unmount.
 */

import { useState, useEffect } from 'react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { useLanguage } from '../context/LanguageContext';
import {
  generatePlanSummarySpeech,
  SUPPORTED_LANGUAGES,
  ASSISTANT_MESSAGES,
} from '../services/voiceService';

export default function PlanSpeechControl({ planResult, farmData }) {
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

  const uiMessages = ASSISTANT_MESSAGES[selectedLang] || ASSISTANT_MESSAGES['en-IN'];

  // Clean up speech when navigating away or unmounting
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  function handleListen() {
    const summary = generatePlanSummarySpeech({
      planResult,
      farmData,
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
    <div className="plan-speech-control-card" role="region" aria-label="Spoken Crop Recommendations Controls">
      <div className="speech-control-main-bar">
        {/* Play / Pause / Stop controls */}
        <div className="speech-buttons-group">
          {!isSpeaking ? (
            <button
              id="plan-listen-results-btn"
              type="button"
              className="plan-listen-cta-btn"
              onClick={handleListen}
              disabled={!isSynthesisSupported || !planResult}
              aria-label="Listen to crop recommendations aloud"
              title={
                isSynthesisSupported
                  ? 'Listen to spoken summary of crop planning results'
                  : 'Speech synthesis is not supported in this browser'
              }
            >
              <span className="material-symbols-outlined cta-icon">volume_up</span>
              <span>{uiMessages.listenPlanBtn}</span>
            </button>
          ) : (
            <div className="speech-active-controls">
              {isPaused ? (
                <button
                  type="button"
                  className="speech-mini-btn resume"
                  onClick={resumeSpeaking}
                  aria-label="Resume reading crop results"
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
                  aria-label="Pause reading crop results"
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
                aria-label="Stop reading crop results"
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

        {/* Language selector */}
        <div className="speech-settings-group">
          <label htmlFor="plan-speech-lang-select" className="speech-lang-label">
            <span className="material-symbols-outlined">translate</span>
            Voice:
          </label>
          <select
            id="plan-speech-lang-select"
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
            aria-label="Crop recommendations speech language"
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

      {error && (
        <div className="speech-error-alert" role="alert">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {spokenTextPreview && (
        <div className="speech-preview-drawer">
          <span className="preview-label">Spoken Text:</span>
          <p className="preview-text">&ldquo;{spokenTextPreview}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
