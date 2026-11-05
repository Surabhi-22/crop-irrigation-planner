/**
 * Quantum Agri — FarmVoiceAssistant
 *
 * Multi-field voice dictation assistant for farm planning supporting English, Hindi, and Kannada.
 *
 * Workflow:
 * 1. Farmer records speech or dictates farm details in their chosen language.
 * 2. Speech is converted into editable text.
 * 3. Parser identifies reliable fields (farmName, location, area, soil, rainfall, water, budget, season).
 * 4. Displays a review table of proposed values vs current form values.
 * 5. Farmer can correct or reject proposals.
 * 6. Explicit confirmation button applies values to form.
 * 7. NEVER automatically submits the farm plan.
 * 8. Never silently overwrites unmapped fields.
 * 9. Syncs language choice with global LanguageContext and persists it.
 */

import { useState } from 'react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { useLanguage } from '../context/LanguageContext';
import {
  parseSpokenFarmDetails,
  SUPPORTED_LANGUAGES,
  ASSISTANT_MESSAGES,
} from '../services/voiceService';

export default function FarmVoiceAssistant({
  currentFarm,
  onApplyProposal,
  disabled = false,
}) {
  const { language: globalLang, setLanguage: setGlobalLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(true);
  const selectedLang = globalLang || 'en-IN';
  const [dictatedText, setDictatedText] = useState('');
  const [parsedProposal, setParsedProposal] = useState(null);
  const [editableProposal, setEditableProposal] = useState({});
  const [applySuccessNotice, setApplySuccessNotice] = useState('');
  const [clarificationNotice, setClarificationNotice] = useState('');

  const {
    isRecognitionSupported,
    isListening,
    interimTranscript,
    error,
    permissionNotice,
    startListening,
    stopListening,
    clearError,
    clearPermissionNotice,
  } = useVoiceAssistant({ defaultLanguage: selectedLang });

  const uiMessages = ASSISTANT_MESSAGES[selectedLang] || ASSISTANT_MESSAGES['en-IN'];

  function handleLanguageChange(newLang) {
    setGlobalLang(newLang);
    if (isListening) stopListening();
  }

  function handleStartRecording() {
    clearError();
    clearPermissionNotice();
    setApplySuccessNotice('');
    setClarificationNotice('');

    startListening({
      lang: selectedLang,
      continuous: true,
      onResult: (finalText) => {
        setDictatedText((prev) => {
          const next = prev ? `${prev} ${finalText}` : finalText;
          // Auto-parse preview as speech comes in
          const { parsed, recognizedFields, unparsedNotes } = parseSpokenFarmDetails(next, selectedLang);
          setParsedProposal(parsed);
          setEditableProposal((current) => ({ ...current, ...parsed }));

          if (recognizedFields.length > 0 && unparsedNotes.length > 3) {
            setClarificationNotice(uiMessages.clarificationNeeded);
          } else {
            setClarificationNotice('');
          }

          return next;
        });
      },
      onError: () => {
        // Handled in hook
      },
    });
  }

  function handleStopRecording() {
    stopListening();
    if (dictatedText.trim()) {
      const { parsed, recognizedFields, unparsedNotes } = parseSpokenFarmDetails(dictatedText, selectedLang);
      setParsedProposal(parsed);
      setEditableProposal((current) => ({ ...current, ...parsed }));

      if (recognizedFields.length > 0 && unparsedNotes.length > 3) {
        setClarificationNotice(uiMessages.clarificationNeeded);
      } else {
        setClarificationNotice('');
      }
    }
  }

  function handleManualParse() {
    if (!dictatedText.trim()) return;
    const { parsed, recognizedFields, unparsedNotes } = parseSpokenFarmDetails(dictatedText, selectedLang);
    setParsedProposal(parsed);
    setEditableProposal(parsed);

    if (recognizedFields.length > 0 && unparsedNotes.length > 3) {
      setClarificationNotice(uiMessages.clarificationNeeded);
    } else {
      setClarificationNotice('');
    }
  }

  function handleFieldChange(fieldKey, value) {
    setEditableProposal((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  }

  function handleDiscardProposal() {
    setParsedProposal(null);
    setEditableProposal({});
    setDictatedText('');
    setApplySuccessNotice('');
    setClarificationNotice('');
  }

  function handleApplyToForm() {
    if (!parsedProposal || Object.keys(editableProposal).length === 0) return;

    // Filter only fields that have non-empty valid values
    const fieldsToApply = {};
    if (editableProposal.farmName && editableProposal.farmName.trim()) {
      fieldsToApply.farmName = editableProposal.farmName.trim();
    }
    if (editableProposal.location && editableProposal.location.trim()) {
      fieldsToApply.location = editableProposal.location.trim();
    }
    if (editableProposal.area && Number(editableProposal.area) > 0) {
      fieldsToApply.area = editableProposal.area;
    }
    if (editableProposal.soilType) {
      fieldsToApply.soilType = editableProposal.soilType;
    }
    if (editableProposal.rainfall && Number(editableProposal.rainfall) >= 0) {
      fieldsToApply.rainfall = editableProposal.rainfall;
    }
    if (editableProposal.availableWater && Number(editableProposal.availableWater) >= 0) {
      fieldsToApply.availableWater = editableProposal.availableWater;
    }
    if (editableProposal.budget && Number(editableProposal.budget) >= 0) {
      fieldsToApply.budget = editableProposal.budget;
    }
    if (editableProposal.season) {
      fieldsToApply.season = editableProposal.season;
    }

    if (typeof onApplyProposal === 'function') {
      onApplyProposal(fieldsToApply);
      const appliedCount = Object.keys(fieldsToApply).length;
      setApplySuccessNotice(
        uiMessages.detectedSuccess(appliedCount)
      );
      // Clean review proposal
      setTimeout(() => {
        setParsedProposal(null);
        setEditableProposal({});
        setDictatedText('');
      }, 1500);
    }
  }

  return (
    <div className="farm-voice-assistant-card">
      <div className="voice-assistant-header">
        <div className="assistant-title-group">
          <div className="assistant-badge">
            <span className="material-symbols-outlined">mic_external_on</span>
            {uiMessages.title}
          </div>
          <h4 className="assistant-heading">{uiMessages.heading}</h4>
          <p className="assistant-desc">{uiMessages.desc}</p>
        </div>

        <button
          type="button"
          className="toggle-assistant-btn"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Hide Voice Assistant' : 'Open Voice Assistant'}
        >
          <span className="material-symbols-outlined">
            {isOpen ? 'expand_less' : 'keyboard_voice'}
          </span>
          {isOpen ? 'Close Assistant' : 'Dictate Farm Details'}
        </button>
      </div>

      {isOpen && (
        <div className="voice-assistant-panel" role="region" aria-label="Farm Voice Assistant Controls">
          {/* Top Bar: Language & Browser Status */}
          <div className="assistant-controls-bar">
            <div className="lang-picker-group">
              <label htmlFor="voice-lang-select" className="lang-picker-label">
                <span className="material-symbols-outlined">translate</span>
                Language:
              </label>
              <select
                id="voice-lang-select"
                value={selectedLang}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="voice-lang-select"
                disabled={isListening}
                aria-label="Assistant recognition language"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeLabel} ({lang.code.split('-')[0].toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="browser-support-pill">
              <span className="material-symbols-outlined pill-icon">
                {isRecognitionSupported ? 'check_circle' : 'info'}
              </span>
              <span>
                {isRecognitionSupported
                  ? 'Speech Recognition Active'
                  : 'Speech Recognition Unavailable in this browser'}
              </span>
            </div>
          </div>

          {!isRecognitionSupported && (
            <div className="voice-alert-notice warning" role="alert">
              <span className="material-symbols-outlined">info</span>
              <div>
                <strong>Browser Notice:</strong> {uiMessages.browserUnsupported}
              </div>
            </div>
          )}

          {permissionNotice && (
            <div className="voice-alert-notice permission" role="alert">
              <span className="material-symbols-outlined">lock_open</span>
              <div>
                <strong>Microphone Permission Needed:</strong> {permissionNotice}
              </div>
            </div>
          )}

          {error && !permissionNotice && (
            <div className="voice-alert-notice error" role="alert">
              <span className="material-symbols-outlined">error</span>
              <div>{error}</div>
            </div>
          )}

          {clarificationNotice && (
            <div className="voice-alert-notice info" role="note">
              <span className="material-symbols-outlined">help</span>
              <div>{clarificationNotice}</div>
            </div>
          )}

          {applySuccessNotice && (
            <div className="voice-alert-notice success" role="status">
              <span className="material-symbols-outlined">verified</span>
              <div>{applySuccessNotice}</div>
            </div>
          )}

          {/* Action Row: Start / Stop Voice Recording */}
          <div className="assistant-action-row">
            {isListening ? (
              <button
                type="button"
                className="voice-action-btn listening"
                onClick={handleStopRecording}
                aria-label="Stop dictation"
              >
                <span className="material-symbols-outlined pulse-dot">stop_circle</span>
                <span>{uiMessages.stopListening}</span>
              </button>
            ) : (
              <button
                id="start-dictation-btn"
                type="button"
                className="voice-action-btn primary"
                onClick={handleStartRecording}
                disabled={disabled}
                aria-label="Start dictating farm parameters"
              >
                <span className="material-symbols-outlined">mic</span>
                <span>{uiMessages.startListening}</span>
              </button>
            )}

            {isListening && (
              <div className="listening-live-indicator" aria-live="polite">
                <div className="live-sound-bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <span>{uiMessages.listeningStatus}</span>
              </div>
            )}
          </div>

          {/* Editable Transcript Box */}
          <div className="transcript-box-container">
            <div className="transcript-box-header">
              <label htmlFor="voice-dictated-transcript">{uiMessages.dictatedLabel}</label>
              <span className="transcript-hint">{uiMessages.dictatedHint}</span>
            </div>
            <textarea
              id="voice-dictated-transcript"
              className="dictated-textarea"
              rows={3}
              value={dictatedText}
              onChange={(e) => setDictatedText(e.target.value)}
              placeholder={uiMessages.placeholder}
            />
            {interimTranscript && (
              <p className="interim-text" aria-live="polite">
                <em>{interimTranscript}</em>
              </p>
            )}

            <div className="transcript-actions">
              <button
                type="button"
                className="secondary-btn-sm"
                onClick={handleManualParse}
                disabled={!dictatedText.trim()}
              >
                <span className="material-symbols-outlined">auto_fix_high</span>
                {uiMessages.parseBtn}
              </button>
              {dictatedText && (
                <button
                  type="button"
                  className="secondary-btn-sm text-subtle"
                  onClick={() => setDictatedText('')}
                >
                  {uiMessages.clearBtn}
                </button>
              )}
            </div>
          </div>

          {/* Review Proposed Values Section */}
          {parsedProposal && (
            <div className="proposal-review-section" role="region" aria-label="Review Proposed Farm Details">
              <div className="proposal-review-header">
                <span className="material-symbols-outlined">fact_check</span>
                <div>
                  <h5>{uiMessages.reviewHeading}</h5>
                  <p>{uiMessages.reviewDesc}</p>
                </div>
              </div>

              <div className="proposal-table-wrapper">
                <table className="proposal-review-table">
                  <thead>
                    <tr>
                      <th>Farm Parameter</th>
                      <th>Current Value in Form</th>
                      <th>Proposed from Speech</th>
                      <th>Action / Detection Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Farm Name */}
                    <tr>
                      <td>
                        <strong>Farm Name</strong>
                      </td>
                      <td>{currentFarm?.name || currentFarm?.farmName || '—'}</td>
                      <td>
                        {editableProposal.farmName !== undefined ? (
                          <input
                            type="text"
                            value={editableProposal.farmName}
                            onChange={(e) => handleFieldChange('farmName', e.target.value)}
                            className="proposal-input"
                            aria-label="Proposed Farm Name"
                          />
                        ) : (
                          <span className="unmapped-cell">Not mentioned in speech</span>
                        )}
                      </td>
                      <td>
                        {editableProposal.farmName ? (
                          <span className="status-chip success">Detected</span>
                        ) : (
                          <span className="status-chip subtle">Unchanged</span>
                        )}
                      </td>
                    </tr>

                    {/* Location */}
                    <tr>
                      <td>
                        <strong>Location / District</strong>
                      </td>
                      <td>{currentFarm?.location || '—'}</td>
                      <td>
                        {editableProposal.location !== undefined ? (
                          <input
                            type="text"
                            value={editableProposal.location}
                            onChange={(e) => handleFieldChange('location', e.target.value)}
                            className="proposal-input"
                            aria-label="Proposed Location"
                          />
                        ) : (
                          <span className="unmapped-cell">Not mentioned in speech</span>
                        )}
                      </td>
                      <td>
                        {editableProposal.location ? (
                          <span className="status-chip success">Detected</span>
                        ) : (
                          <span className="status-chip subtle">Unchanged</span>
                        )}
                      </td>
                    </tr>

                    {/* Area */}
                    <tr>
                      <td>
                        <strong>Cultivation Area (Acres)</strong>
                      </td>
                      <td>{currentFarm?.area ? `${currentFarm.area} ac` : '—'}</td>
                      <td>
                        {editableProposal.area !== undefined ? (
                          <div className="input-with-unit">
                            <input
                              type="number"
                              step="any"
                              value={editableProposal.area}
                              onChange={(e) => handleFieldChange('area', e.target.value)}
                              className="proposal-input"
                              aria-label="Proposed Cultivation Area"
                            />
                            <span className="unit-label">Acres</span>
                          </div>
                        ) : (
                          <span className="unmapped-cell">Not mentioned in speech</span>
                        )}
                      </td>
                      <td>
                        {editableProposal.area ? (
                          <span className="status-chip success">Detected</span>
                        ) : (
                          <span className="status-chip subtle">Unchanged</span>
                        )}
                      </td>
                    </tr>

                    {/* Soil Type */}
                    <tr>
                      <td>
                        <strong>Soil Type</strong>
                      </td>
                      <td>{currentFarm?.soilType || '—'}</td>
                      <td>
                        {editableProposal.soilType !== undefined ? (
                          <select
                            value={editableProposal.soilType}
                            onChange={(e) => handleFieldChange('soilType', e.target.value)}
                            className="proposal-select"
                            aria-label="Proposed Soil Type"
                          >
                            <option value="Loamy">Loamy</option>
                            <option value="Clay">Clay</option>
                            <option value="Sandy">Sandy</option>
                            <option value="Silty">Silty</option>
                          </select>
                        ) : (
                          <span className="unmapped-cell">Not mentioned in speech</span>
                        )}
                      </td>
                      <td>
                        {editableProposal.soilType ? (
                          <span className="status-chip success">Detected</span>
                        ) : (
                          <span className="status-chip subtle">Unchanged</span>
                        )}
                      </td>
                    </tr>

                    {/* Expected Rainfall */}
                    <tr>
                      <td>
                        <strong>Expected Rainfall (mm)</strong>
                      </td>
                      <td>{currentFarm?.rainfall ? `${currentFarm.rainfall} mm` : '—'}</td>
                      <td>
                        {editableProposal.rainfall !== undefined ? (
                          <div className="input-with-unit">
                            <input
                              type="number"
                              step="any"
                              value={editableProposal.rainfall}
                              onChange={(e) => handleFieldChange('rainfall', e.target.value)}
                              className="proposal-input"
                              aria-label="Proposed Rainfall"
                            />
                            <span className="unit-label">mm</span>
                          </div>
                        ) : (
                          <span className="unmapped-cell">Not mentioned in speech</span>
                        )}
                      </td>
                      <td>
                        {editableProposal.rainfall ? (
                          <span className="status-chip success">Detected</span>
                        ) : (
                          <span className="status-chip subtle">Unchanged</span>
                        )}
                      </td>
                    </tr>

                    {/* Available Irrigation Water */}
                    <tr>
                      <td>
                        <strong>Available Water (m³)</strong>
                      </td>
                      <td>
                        {currentFarm?.availableWater ? `${currentFarm.availableWater} m³` : '—'}
                      </td>
                      <td>
                        {editableProposal.availableWater !== undefined ? (
                          <div className="input-with-unit">
                            <input
                              type="number"
                              step="any"
                              value={editableProposal.availableWater}
                              onChange={(e) =>
                                handleFieldChange('availableWater', e.target.value)
                              }
                              className="proposal-input"
                              aria-label="Proposed Available Water"
                            />
                            <span className="unit-label">m³</span>
                          </div>
                        ) : (
                          <span className="unmapped-cell">Not mentioned in speech</span>
                        )}
                      </td>
                      <td>
                        {editableProposal.availableWater ? (
                          <span className="status-chip success">Detected</span>
                        ) : (
                          <span className="status-chip subtle">Unchanged</span>
                        )}
                      </td>
                    </tr>

                    {/* Season */}
                    <tr>
                      <td>
                        <strong>Planting Season</strong>
                      </td>
                      <td>{currentFarm?.season || '—'}</td>
                      <td>
                        {editableProposal.season !== undefined ? (
                          <select
                            value={editableProposal.season}
                            onChange={(e) => handleFieldChange('season', e.target.value)}
                            className="proposal-select"
                            aria-label="Proposed Planting Season"
                          >
                            <option value="Kharif">Kharif</option>
                            <option value="Rabi">Rabi</option>
                            <option value="Summer">Summer</option>
                          </select>
                        ) : (
                          <span className="unmapped-cell">Not mentioned in speech</span>
                        )}
                      </td>
                      <td>
                        {editableProposal.season ? (
                          <span className="status-chip success">Detected</span>
                        ) : (
                          <span className="status-chip subtle">Unchanged</span>
                        )}
                      </td>
                    </tr>

                    {/* Budget */}
                    <tr>
                      <td>
                        <strong>Total Budget (₹)</strong>
                      </td>
                      <td>{currentFarm?.budget ? `₹ ${Number(currentFarm.budget).toLocaleString('en-IN')}` : '—'}</td>
                      <td>
                        {editableProposal.budget !== undefined ? (
                          <div className="input-with-unit">
                            <input
                              type="number"
                              step="any"
                              value={editableProposal.budget}
                              onChange={(e) => handleFieldChange('budget', e.target.value)}
                              className="proposal-input"
                              aria-label="Proposed Farming Budget"
                            />
                            <span className="unit-label">INR</span>
                          </div>
                        ) : (
                          <span className="unmapped-cell">Not mentioned in speech</span>
                        )}
                      </td>
                      <td>
                        {editableProposal.budget ? (
                          <span className="status-chip success">Detected</span>
                        ) : (
                          <span className="status-chip subtle">Unchanged</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Explicit Confirmation Action Row */}
              <div className="proposal-footer-actions">
                <div className="safety-note">
                  <span className="material-symbols-outlined">security</span>
                  <span>
                    No form inputs are overwritten automatically. Click &ldquo;{uiMessages.applyBtn}&rdquo; to update your inputs.
                  </span>
                </div>

                <div className="action-button-group">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleDiscardProposal}
                  >
                    {uiMessages.discardBtn}
                  </button>
                  <button
                    type="button"
                    className="primary-btn-accent"
                    onClick={handleApplyToForm}
                    disabled={Object.keys(editableProposal).length === 0}
                  >
                    <span className="material-symbols-outlined">check</span>
                    {uiMessages.applyBtn}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
