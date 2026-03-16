import { useState, useEffect, useCallback, useRef } from 'react';

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function useWebSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recognitionRef = useRef<any>(null);
  // Use a ref to track listening state so the onend/onerror callbacks
  // always see the latest value without re-creating the recognition instance
  const isListeningRef = useRef(false);

  // Keep the ref in sync
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Create recognition instance ONCE on mount
  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Web Speech API is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let currentInterim = '';
      let currentFinal = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentFinal += event.results[i][0].transcript;
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }

      setTranscript((prev) => prev + currentFinal);
      setInterimTranscript(currentInterim);
    };

    recognition.onerror = (event: any) => {
      // Never stop listening due to errors — just log them.
      // Show a brief warning to the doctor for no-speech events
      if (event.error === 'no-speech') {
        setWarning('No speech detected - make sure your mic is on');
        // Auto-clear after 3 seconds
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        warningTimerRef.current = setTimeout(() => setWarning(null), 3000);
      } else {
        console.warn('Speech recognition error (non-fatal):', event.error);
      }
    };

    recognition.onend = () => {
      // The browser auto-stops recognition after silence or timeouts.
      // If doc hasn't manually clicked stop, always restart immediately.
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Small delay then retry — handles "already started" race condition
          setTimeout(() => {
            if (isListeningRef.current) {
              try { recognition.start(); } catch (_) { /* give up */ }
            }
          }, 200);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
    };
  }, []); // Empty deps — only create once

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListeningRef.current) {
      setError(null);
      setInterimTranscript('');
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (e: any) {
        console.error("Failed to start speech recognition:", e);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      setIsListening(false);
      try { recognitionRef.current.stop(); } catch (_) {}
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    warning,
    startListening,
    stopListening,
    resetTranscript,
    error,
    isSupported: !error || error !== "Web Speech API is not supported in this browser."
  };
}
