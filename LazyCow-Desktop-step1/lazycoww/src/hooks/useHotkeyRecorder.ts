import { useState, useRef, useCallback, useEffect } from 'react';

interface UseHotkeyRecorderReturn {
  recording: boolean;
  recordedCombo: string;
  notice: string | null;
  startRecording: (initialMods?: string[]) => void;
  stopRecording: () => void;
  clearCombo: () => void;
  setRecordedCombo: (combo: string) => void;
}

/**
 * Modifiers — these accumulate freely. All four can be pressed together.
 */
const MODIFIER_KEYS = ['Ctrl', 'Alt', 'Shift', 'Win'];

/**
 * Map a keyboard event to a canonical, layout-stable key name.
 *
 * Always prefer `e.code` (physical key) over `e.key` (produced character).
 * `e.key` is affected by layout AND modifier state — Shift + `;` produces
 * `:`, which is not a key name Windows RegisterHotKey understands. We
 * normalise shifted symbols back to their physical key so the recorder
 * and the ComboBuilder agree on what was captured.
 *
 * Returns null when the key isn't one we track.
 */
function canonicalKeyFromEvent(e: KeyboardEvent): string | null {
  // Letters: KeyA..KeyZ
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3);
  // Digit row: Digit0..Digit9
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  // Numpad digits: Numpad0..Numpad9
  if (/^Numpad\d$/.test(e.code)) return e.code;
  // Function keys: F1..F24
  if (/^F\d{1,2}$/.test(e.code)) return e.code;

  // Symbols — map the physical code to the UNSHIFTED character.
  // The user always presses Shift if they want the shifted variant —
  // the base key is what gets stored.
  const symMap: Record<string, string> = {
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: '\'',
    Comma: ',',
    Period: '.',
    Slash: '/',
  };
  if (symMap[e.code]) return symMap[e.code];

  // Special keys — e.key is more reliable here (no shifted variants).
  switch (e.key) {
    case ' ': return 'Space';
    case 'Escape': return 'Esc';
    case 'Enter': return 'Return';
    case 'Backspace': return 'Backspace';
    case 'Delete': return 'Delete';
    case 'Tab': return 'Tab';
    case 'ArrowUp': return 'Up';
    case 'ArrowDown': return 'Down';
    case 'ArrowLeft': return 'Left';
    case 'ArrowRight': return 'Right';
    case 'Home': return 'Home';
    case 'End': return 'End';
    case 'PageUp': return 'PageUp';
    case 'PageDown': return 'PageDown';
    case 'Insert': return 'Insert';
    case 'PrintScreen': return 'PrintScreen';
  }
  return null;
}

export function useHotkeyRecorder(initialCombo: string = ''): UseHotkeyRecorderReturn {
  const [recording, setRecording] = useState(false);
  const [recordedCombo, setRecordedCombo] = useState(initialCombo);
  const [notice, setNotice] = useState<string | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const cleanupRef = useRef<(() => void) | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // While recording, keep keysRef mirrored with recordedCombo. Chips in
  // ComboBuilder can write directly to recordedCombo via the parent's
  // setRecordedCombo — but keysRef (the recorder's internal set) doesn't
  // see that change. On the next keydown, keysRef is used to rebuild the
  // combo string, so the chip edit gets silently discarded. Mirroring
  // recordedCombo back into keysRef keeps both inputs in sync.
  //
  // When the recorder itself updates recordedCombo (the common case), this
  // effect re-parses the same string into the same set — a no-op — so there
  // is no infinite loop and no race.
  useEffect(() => {
    if (!recording) return;
    if (!recordedCombo || recordedCombo === 'Listening...') return;
    const parts = recordedCombo.split(' + ').map((p) => p.trim()).filter(Boolean);
    keysRef.current = new Set(parts);
  }, [recordedCombo, recording]);

  // Clean up on unmount: stop suppressing hotkeys, clear any pending notice.
  useEffect(() => () => {
    window.electronAPI?.setHotkeyRecording(false);
    if (cleanupRef.current) cleanupRef.current();
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
  }, []);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setNotice(null);
      noticeTimeoutRef.current = null;
    }, 3000);
  }, []);

  const stopRecording = useCallback(() => {
    if (cleanupRef.current) cleanupRef.current();
    cleanupRef.current = null;
    setRecording(false);
    window.electronAPI?.setHotkeyRecording(false);
  }, []);

  const startRecording = useCallback((initialMods?: string[]) => {
    if (recording) return;
    stopRecording();
    setRecording(true);
    // Seed the keys set with any modifiers the user already picked via the
    // ComboBuilder chips. This lets them tick "Win", click the recorder,
    // and press just the main key — we merge the two into "Win + G".
    const seed = (initialMods ?? []).filter((m) => MODIFIER_KEYS.includes(m));
    keysRef.current = new Set(seed);
    setRecordedCombo(seed.length > 0 ? seed.join(' + ') : 'Listening...');
    setNotice(null);

    window.electronAPI?.setHotkeyRecording(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Modifiers accumulate. All four allowed together.
      if (e.ctrlKey) keysRef.current.add('Ctrl');
      if (e.altKey) keysRef.current.add('Alt');
      if (e.shiftKey) keysRef.current.add('Shift');
      if (e.metaKey) keysRef.current.add('Win');

      // Escape resets — the user can start over without leaving the recorder.
      if (e.key === 'Escape') {
        keysRef.current = new Set();
        setRecordedCombo('Listening...');
        setNotice(null);
        return;
      }

      // Ignore bare modifier presses — we wait for a non-modifier key.
      if (['Control', 'Alt', 'Shift', 'Meta', 'OS'].includes(e.key)) return;

      // Convert the event to a canonical key name.
      const key = canonicalKeyFromEvent(e);
      if (!key) return;

      // Windows RegisterHotKey allows modifiers + exactly ONE main key.
      // If the user already has a main key (e.g. G) and presses another
      // (F), we REPLACE the old one instead of accumulating — otherwise
      // the recorder would show "Ctrl + G + F", which Windows silently
      // collapses to "Ctrl + F" at register time. That mismatch is what
      // confused users. Show a notice so the replacement is visible.
      const replaced: string[] = [];
      keysRef.current.forEach((k) => {
        if (!MODIFIER_KEYS.includes(k) && k !== key) replaced.push(k);
      });
      if (replaced.length > 0) {
        showNotice(`Only one main key allowed — "${replaced[0]}" was replaced by "${key}".`);
      }
      replaced.forEach((k) => keysRef.current.delete(k));

      keysRef.current.add(key);

      // Canonicalize modifier order so the recorder's display matches
      // ComboBuilder's preview (which always emits Ctrl → Alt → Shift → Win).
      // Without this, pressing Ctrl+Shift+Alt shows "Ctrl + Shift + Alt" in
      // the recorder and "Ctrl + Alt + Shift" in the preview — same combo,
      // different strings, confusing the user.
      const CANONICAL_ORDER = ['Ctrl', 'Alt', 'Shift', 'Win'];
      const set = keysRef.current;
      const orderedMods = CANONICAL_ORDER.filter((m) => set.has(m));
      const mainKeys: string[] = [];
      set.forEach((k) => { if (!CANONICAL_ORDER.includes(k)) mainKeys.push(k); });
      const combo = [...orderedMods, ...mainKeys].join(' + ');
      if (combo) setRecordedCombo(combo);
    };

    const handleKeyUp = () => {
      setTimeout(() => {
        if (keysRef.current.size === 0) return;
        const CANONICAL_ORDER = ['Ctrl', 'Alt', 'Shift', 'Win'];
        const set = keysRef.current;
        const orderedMods = CANONICAL_ORDER.filter((m) => set.has(m));
        const mainKeys: string[] = [];
        set.forEach((k) => { if (!CANONICAL_ORDER.includes(k)) mainKeys.push(k); });
        setRecordedCombo([...orderedMods, ...mainKeys].join(' + '));
      }, 200);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    cleanupRef.current = () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [recording, stopRecording, showNotice]);

  const clearCombo = useCallback(() => {
    stopRecording();
    setRecordedCombo('');
    setNotice(null);
  }, [stopRecording]);

  return { recording, recordedCombo, notice, startRecording, stopRecording, clearCombo, setRecordedCombo };
}