/**
 * Quantum Agri — useVoiceAssistant Hook
 *
 * Provides a robust, leak-free React hook for Web Speech APIs:
 * - SpeechRecognition (voice-to-text) with duplicate session prevention and proper cleanup.
 * - SpeechSynthesis (text-to-speech) with play, pause, resume, stop, and language selection.
 * - Clear permission, compatibility, and error handling.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getSpeechRecognitionClass,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
} from '../services/voiceService';

export function useVoiceAssistant(options = {}) {
  const initialLang = options.defaultLanguage || DEFAULT_LANGUAGE;

  const [recognitionLang, setRecognitionLang] = useState(initialLang);
  const [synthesisLang, setSynthesisLang] = useState(initialLang);

  const [isRecognitionSupported] = useState(() => isSpeechRecognitionSupported());
  const [isSynthesisSupported] = useState(() => isSpeechSynthesisSupported());

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [permissionNotice, setPermissionNotice] = useState(null);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);

  // Active recognition instance ref
  const recognitionRef = useRef(null);
  // Flag to know if recognition was intentionally aborted/stopped
  const manuallyStoppedRef = useRef(false);
  // Active SpeechSynthesisUtterance ref
  const utteranceRef = useRef(null);

  // Load available speech synthesis voices if supported
  useEffect(() => {
    if (!isSynthesisSupported) return;

    function populateVoices() {
      try {
        const voices = window.speechSynthesis.getVoices() || [];
        setAvailableVoices(voices);
      } catch {
        // ignore
      }
    }

    populateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }

    return () => {
      if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged === populateVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isSynthesisSupported]);

  // Clean up any ongoing recognition or speech synthesis when component unmounts
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          manuallyStoppedRef.current = true;
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }

      if (isSynthesisSupported && typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [isSynthesisSupported]);

  /**
   * Stop active listening session
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      manuallyStoppedRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    }
    setIsListening(false);
    setIsProcessing(false);
  }, []);

  /**
   * Start listening via SpeechRecognition
   * Prevents duplicate recognition sessions by halting any ongoing session first.
   */
  const startListening = useCallback(
    ({ lang, onResult, onEnd, onError, continuous = false } = {}) => {
      setError(null);
      setPermissionNotice(null);
      setTranscript('');
      setInterimTranscript('');

      if (!isRecognitionSupported) {
        const msg =
          'Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or another Chromium-based browser, or use manual typing.';
        setError(msg);
        if (onError) onError(new Error(msg));
        return;
      }

      // Prevent duplicate recognition sessions
      if (recognitionRef.current) {
        try {
          manuallyStoppedRef.current = true;
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }

      const candidates = [
        typeof window !== 'undefined' ? window.SpeechRecognition : null,
        typeof window !== 'undefined' ? window.webkitSpeechRecognition : null,
        typeof window !== 'undefined' ? window.msSpeechRecognition : null,
        typeof globalThis !== 'undefined' ? globalThis.SpeechRecognition : null,
        typeof globalThis !== 'undefined' ? globalThis.webkitSpeechRecognition : null,
        getSpeechRecognitionClass(),
      ].filter(Boolean);

      const uniqueConstructors = Array.from(new Set(candidates));
      if (uniqueConstructors.length === 0) {
        const msg =
          'Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or another Chromium-based browser, or use manual typing.';
        setError(msg);
        if (onError) onError(new Error(msg));
        return;
      }

      let recognition = null;
      let initError = null;

      for (const Constructor of uniqueConstructors) {
        try {
          recognition = new Constructor();
          if (recognition) break;
        } catch (e) {
          initError = e;
        }
      }

      if (!recognition) {
        const msg = initError?.message || 'SpeechRecognition API class unavailable or failed to initialize.';
        setError(msg);
        if (onError) onError(new Error(msg));
        return;
      }

      try {
        recognitionRef.current = recognition;
        manuallyStoppedRef.current = false;

        const targetLang = lang || recognitionLang;
        recognition.lang = targetLang;
        recognition.continuous = continuous;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          setIsProcessing(false);
          setError(null);
        };

        recognition.onresult = (event) => {
          let currentFinal = '';
          let currentInterim = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const item = event.results[i];
            const text = item[0]?.transcript || '';
            if (item.isFinal) {
              currentFinal += text;
            } else {
              currentInterim += text;
            }
          }

          if (currentInterim) {
            setInterimTranscript(currentInterim);
          }

          if (currentFinal) {
            setTranscript((prev) => (prev ? `${prev} ${currentFinal.trim()}` : currentFinal.trim()));
            setInterimTranscript('');
            if (onResult) {
              onResult(currentFinal.trim());
            }
          }
        };

        recognition.onerror = (event) => {
          setIsProcessing(false);
          if (manuallyStoppedRef.current) return;

          const errType = event.error;
          if (errType === 'aborted') {
            return;
          }

          let friendlyError;
          if (errType === 'not-allowed' || errType === 'permission-denied') {
            friendlyError =
              'Microphone access was denied. Please allow microphone permissions in your browser address bar or site settings.';
            setPermissionNotice(
              'To use voice input, click the lock or site settings icon in your browser address bar and set Microphone to "Allow".'
            );
          } else if (errType === 'service-not-allowed') {
            friendlyError =
              'Speech recognition service is blocked in your browser settings. In Microsoft Edge, ensure "Online speech recognition" is enabled under Settings > Privacy, search, and services.';
            setPermissionNotice(
              'In Microsoft Edge, enable "Online speech recognition" under edge://settings/privacy or check site permissions in your address bar.'
            );
          } else if (errType === 'no-speech') {
            friendlyError = 'No speech was detected. Please check your microphone and speak again.';
          } else if (errType === 'audio-capture') {
            friendlyError = 'No working microphone found. Please connect an audio input device.';
          } else if (errType === 'network') {
            friendlyError =
              'Network error communicating with the speech service. Check your internet connection.';
          } else {
            friendlyError = `Voice recognition error: ${errType}`;
          }

          setError(friendlyError);
          if (onError) onError(new Error(friendlyError));
        };

        recognition.onend = () => {
          setIsListening(false);
          setIsProcessing(false);
          recognitionRef.current = null;
          if (onEnd) onEnd();
        };

        recognition.start();
      } catch (err) {
        setIsListening(false);
        setIsProcessing(false);
        const errMsg = err?.message || 'Failed to start speech recognition.';
        setError(errMsg);
        if (onError) onError(err);
      }
    },
    [isRecognitionSupported, recognitionLang]
  );

  /**
   * Speak given text using SpeechSynthesis
   */
  const speak = useCallback(
    (text, { lang, onStart, onEnd, onError, rate = 1.0, pitch = 1.0 } = {}) => {
      setError(null);

      if (!isSynthesisSupported) {
        const msg = 'Speech synthesis is not supported in this browser.';
        setError(msg);
        if (onError) onError(new Error(msg));
        return;
      }

      if (!text || !text.trim()) {
        return;
      }

      try {
        // Cancel any active speech before starting new utterance
        window.speechSynthesis.cancel();

        const utterance = new window.SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        const targetLang = lang || synthesisLang;
        utterance.lang = targetLang;
        utterance.rate = rate;
        utterance.pitch = pitch;

        // Try to pick a voice matching the language tag
        const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices() || [];
        const matchingVoice = voices.find(
          (v) => v.lang === targetLang || v.lang.replace('_', '-').toLowerCase().startsWith(targetLang.toLowerCase().slice(0, 2))
        );
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
          setIsPaused(false);
          if (onStart) onStart();
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          setIsPaused(false);
          utteranceRef.current = null;
          if (onEnd) onEnd();
        };

        utterance.onerror = (e) => {
          setIsSpeaking(false);
          setIsPaused(false);
          utteranceRef.current = null;
          // Browser error event on cancel is normal
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            setError(`Speech synthesis error: ${e.error}`);
            if (onError) onError(e);
          }
        };

        utterance.onpause = () => setIsPaused(true);
        utterance.onresume = () => setIsPaused(false);

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        setIsSpeaking(false);
        setIsPaused(false);
        const msg = err?.message || 'Speech synthesis failed to play.';
        setError(msg);
        if (onError) onError(err);
      }
    },
    [isSynthesisSupported, synthesisLang, availableVoices]
  );

  /**
   * Pause speech synthesis
   */
  const pauseSpeaking = useCallback(() => {
    if (isSynthesisSupported && window.speechSynthesis && isSpeaking && !isPaused) {
      try {
        window.speechSynthesis.pause();
        setIsPaused(true);
      } catch {
        // ignore
      }
    }
  }, [isSynthesisSupported, isSpeaking, isPaused]);

  /**
   * Resume paused speech synthesis
   */
  const resumeSpeaking = useCallback(() => {
    if (isSynthesisSupported && window.speechSynthesis && isSpeaking && isPaused) {
      try {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } catch {
        // ignore
      }
    }
  }, [isSynthesisSupported, isSpeaking, isPaused]);

  /**
   * Stop speech synthesis playback
   */
  const stopSpeaking = useCallback(() => {
    if (isSynthesisSupported && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setIsSpeaking(false);
    setIsPaused(false);
    utteranceRef.current = null;
  }, [isSynthesisSupported]);

  /**
   * Helper to check if a specific language has a synthesis voice installed
   */
  const hasVoiceForLanguage = useCallback(
    (langCode) => {
      if (!isSynthesisSupported || availableVoices.length === 0) return true; // optimistic until loaded
      const prefix = langCode.slice(0, 2).toLowerCase();
      return availableVoices.some(
        (v) => v.lang.toLowerCase() === langCode.toLowerCase() || v.lang.toLowerCase().startsWith(prefix)
      );
    },
    [isSynthesisSupported, availableVoices]
  );

  return {
    // Capabilities
    isRecognitionSupported,
    isSynthesisSupported,
    supportedLanguages: SUPPORTED_LANGUAGES,
    hasVoiceForLanguage,

    // Recognition state & controls
    recognitionLang,
    setRecognitionLang,
    isListening,
    isProcessing,
    transcript,
    setTranscript,
    interimTranscript,
    error,
    clearError: () => setError(null),
    permissionNotice,
    clearPermissionNotice: () => setPermissionNotice(null),
    startListening,
    stopListening,

    // Synthesis state & controls
    synthesisLang,
    setSynthesisLang,
    isSpeaking,
    isPaused,
    availableVoices,
    speak,
    pauseSpeaking,
    resumeSpeaking,
    stopSpeaking,
  };
}
