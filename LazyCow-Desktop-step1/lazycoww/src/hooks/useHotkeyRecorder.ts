import { useState, useRef, useCallback, useEffect } from 'react';

interface UseHotkeyRecorderReturn {
  recording: boolean;
  recordedCombo: string;
  startRecording: () => void;
  stopRecording: () => void;
  clearCombo: () => void;
  setRecordedCombo: (combo: string) => void;
}

export function useHotkeyRecorder(initialCombo: string = ''): UseHotkeyRecorderReturn {
  const [recording, setRecording] = useState(false);
  const [recordedCombo, setRecordedCombo] = useState(initialCombo);
  const keysRef = useRef<Set<string>>(new Set());
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { if (cleanupRef.current) cleanupRef.current(); }, []);

  const stopRecording = useCallback(() => {
    if (cleanupRef.current) cleanupRef.current();
    cleanupRef.current = null;
    setRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    if (recording) return;
    stopRecording();
    setRecording(true);
    setRecordedCombo('Listening...');
    keysRef.current = new Set();

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey) keysRef.current.add('Ctrl');
      if (e.altKey) keysRef.current.add('Alt');
      if (e.shiftKey) keysRef.current.add('Shift');
      if (e.metaKey) keysRef.current.add('Win');

      if (e.key === 'Escape') {
        keysRef.current = new Set();
        setRecordedCombo('Listening...');
        return;
      }

      if (!['Control', 'Alt', 'Shift', 'Meta', 'OS'].includes(e.key)) {
        keysRef.current.add(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      }

      const combo = Array.from(keysRef.current).join(' + ');
      if (combo) setRecordedCombo(combo);
    };

    const handleKeyUp = () => {
      setTimeout(() => {
        if (keysRef.current.size > 0) {
          setRecordedCombo(Array.from(keysRef.current).join(' + '));
        }
      }, 200);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    cleanupRef.current = () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [recording, stopRecording]);

  const clearCombo = useCallback(() => {
    stopRecording();
    setRecordedCombo('');
  }, [stopRecording]);

  return { recording, recordedCombo, startRecording, stopRecording, clearCombo, setRecordedCombo };
}