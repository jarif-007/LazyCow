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

  // On unmount, make sure the main process stops suppressing hotkeys —
  // otherwise a mid-recording unmount would leave hotkeys muted forever.
  useEffect(() => () => {
    window.electronAPI?.setHotkeyRecording(false);
    if (cleanupRef.current) cleanupRef.current();
  }, []);

  const stopRecording = useCallback(() => {
    if (cleanupRef.current) cleanupRef.current();
    cleanupRef.current = null;
    setRecording(false);
    // Tell the main process hotkeys can fire again.
    window.electronAPI?.setHotkeyRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    if (recording) return;
    stopRecording();
    setRecording(true);
    setRecordedCombo('Listening...');
    keysRef.current = new Set();

    // Tell the main process to suppress hotkey fires while we record.
    window.electronAPI?.setHotkeyRecording(true);

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
        // Prefer e.code (physical key) over e.key (produced character).
        // e.key gives the shifted character — Shift+5 becomes '%' on US
        // layouts, or a locale character on non-US ones. Electron's
        // globalShortcut.register() can't handle those, so the combo
        // silently fails to register. e.code is always the physical key
        // ('Digit5', 'KeyB', 'F1'), which is what we actually want.
        let key = e.key;
        if (/^Key[A-Z]$/.test(e.code)) {
          key = e.code.slice(3); // 'KeyB' → 'B'
        } else if (/^Digit\d$/.test(e.code)) {
          key = e.code.slice(5); // 'Digit5' → '5'
        }
        keysRef.current.add(key.length === 1 ? key.toUpperCase() : key);
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