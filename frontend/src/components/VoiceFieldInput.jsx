/**
 * Quantum Agri — VoiceFieldInput
 *
 * Micro-component providing accessible, inline microphone controls for individual farm form inputs:
 * 1. Farm name
 * 2. Farm location
 * 3. Land area
 * 4. Soil information
 * 5. Expected rainfall
 * 6. Available irrigation water
 *
 * Automatically populates the corresponding input field upon speech recognition,
 * displays listening animation and microphone status, enables direct editing,
 * and never automatically submits the farm form.
 */

import { useState } from 'react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { useLanguage } from '../context/LanguageContext';
import { parseSingleFieldSpeech } from '../services/voiceService';

export default function VoiceFieldInput({
  onChange,
  fieldName = 'location',
  disabled = false,
  language: propLang,
  ariaLabel,
}) {
  const { language: contextLang } = useLanguage();
  const activeLang = propLang || contextLang || 'en-IN';

  const [activeTooltip, setActiveTooltip] = useState('');
  const [successBadge, setSuccessBadge] = useState('');

  const {
    isRecognitionSupported,
    isListening,
    startListening,
    stopListening,
    error,
    permissionNotice,
    clearError,
    clearPermissionNotice,
  } = useVoiceAssistant({ defaultLanguage: activeLang });

  function handleToggleListen(e) {
    // Explicitly prevent any parent form submission
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;
    clearError();
    clearPermissionNotice();
    setSuccessBadge('');

    if (isListening) {
      stopListening();
      return;
    }

    if (!isRecognitionSupported) {
      setActiveTooltip(
        activeLang === 'hi-IN'
          ? 'इस ब्राउज़र में स्पीच रिकग्निशन समर्थित नहीं है। कृपया क्रोम या एज का उपयोग करें।'
          : activeLang === 'kn-IN'
          ? 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ಕ್ರೋಮ್ ಅಥವಾ ಎಡ್ಜ್ ಬಳಸಿ.'
          : 'Speech recognition is not supported in this browser. Please use Chrome/Edge or type manually.'
      );
      setTimeout(() => setActiveTooltip(''), 4500);
      return;
    }

    startListening({
      lang: activeLang,
      onResult: (spokenText) => {
        if (!spokenText || !spokenText.trim()) return;

        const result = parseSingleFieldSpeech(spokenText, fieldName, activeLang);

        if (result.success && result.value) {
          if (typeof onChange === 'function') {
            onChange({
              target: {
                name: fieldName,
                value: result.value,
              },
            });
          }

          setSuccessBadge(`✓ ${result.displayLabel || result.value}`);
          setTimeout(() => setSuccessBadge(''), 4000);
        } else {
          const clarifyMsg =
            activeLang === 'hi-IN'
              ? `स्पष्ट नहीं हुआ ("${spokenText}"). कृपया पुनः बोलें या टाइप करें।`
              : activeLang === 'kn-IN'
              ? `ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ ("${spokenText}"). ದಯವಿಟ್ಟು ಮತ್ತೆ ಮಾತನಾಡಿ.`
              : `Could not parse ("${spokenText}"). Please speak clearly or type.`;
          setActiveTooltip(clarifyMsg);
          setTimeout(() => setActiveTooltip(''), 4500);
        }
      },
      onError: (err) => {
        setActiveTooltip(err.message || 'Microphone error.');
        setTimeout(() => setActiveTooltip(''), 4500);
      },
    });
  }

  const defaultAria = `Voice input for ${fieldName}`;

  return (
    <div className="voice-field-input-wrapper voice-field-input-container">
      <button
        id={`voice-mic-${fieldName}`}
        type="button"
        className={`voice-mic-btn ${isListening ? 'listening pulse' : ''} ${
          !isRecognitionSupported ? 'unsupported' : ''
        }`}
        onClick={handleToggleListen}
        disabled={disabled}
        aria-label={
          isListening
            ? `Stop listening for ${fieldName}`
            : isRecognitionSupported
            ? ariaLabel || defaultAria
            : 'Voice input not supported in this browser'
        }
        aria-pressed={isListening}
        title={
          isListening
            ? 'Listening... Click to stop'
            : isRecognitionSupported
            ? `Click to dictate into ${fieldName}`
            : 'Speech recognition requires Chrome or Edge'
        }
      >
        <span className="material-symbols-outlined voice-mic-icon">
          {isListening ? 'mic' : !isRecognitionSupported ? 'mic_off' : 'mic'}
        </span>
        {isListening && <span className="mic-wave-indicator" aria-hidden="true" />}
      </button>

      {/* Listening status pulse banner */}
      {isListening && (
        <span className="voice-listening-pill" aria-live="polite">
          <span className="pulse-dot" />
          {activeLang === 'hi-IN' ? 'सुन रहे हैं…' : activeLang === 'kn-IN' ? 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದ್ದೇವೆ…' : 'Listening…'}
        </span>
      )}

      {/* Success badge showing recognized value */}
      {successBadge && !isListening && (
        <span className="voice-success-badge" role="status">
          {successBadge}
        </span>
      )}

      {/* Popover for errors, permissions, or clarifications */}
      {(activeTooltip || error || permissionNotice) && !isListening && (
        <div className="voice-field-popover" role="alert">
          <span className="material-symbols-outlined popover-icon">
            {permissionNotice ? 'security' : 'info'}
          </span>
          <span className="popover-text">
            {permissionNotice || activeTooltip || error}
          </span>
          <button
            type="button"
            className="popover-dismiss"
            onClick={() => {
              setActiveTooltip('');
              clearError();
              clearPermissionNotice();
            }}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
