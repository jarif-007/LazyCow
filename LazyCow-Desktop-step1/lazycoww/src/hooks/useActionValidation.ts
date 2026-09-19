import { useEffect, useState } from 'react';
import { ActionItem, actionCatalog } from '../types/actions';

const CATALOG_TYPES = new Set(actionCatalog.map((a) => a.type as string));

export interface ValidationState {
  errors: Record<string, string>;
  unsupportedIds: Set<string>;
  isValid: boolean;
}

/**
 * Validates the current action sequence.
 * - Sync checks (empty, format, range) run immediately.
 * - Async checks (path existence) run debounced 400ms.
 * - Actions whose type isn't in the catalog are flagged as unsupported.
 */
export function useActionValidation(sequence: ActionItem[]): ValidationState {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [unsupportedIds, setUnsupportedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const nextErrors: Record<string, string> = {};
      const nextUnsupported = new Set<string>();

      for (const card of sequence) {
        if (!CATALOG_TYPES.has(card.type as string)) {
          nextUnsupported.add(card.id);
          nextErrors[card.id] = 'Unsupported action — remove to continue';
          continue;
        }

        const v = (card.value ?? '').trim();

        switch (card.type) {
          case 'open_url':
            if (!v) nextErrors[card.id] = 'URL is required';
            else if (!/^https?:\/\/.+/i.test(v))
              nextErrors[card.id] = 'URL must start with http:// or https://';
            break;

          case 'launch_app':
            if (!v) nextErrors[card.id] = 'Application path is required';
            else if (!v.toLowerCase().endsWith('.exe'))
              nextErrors[card.id] = 'Only .exe files are supported';
            else if (window.electronAPI?.checkPathExists) {
              const exists = await window.electronAPI.checkPathExists(v);
              if (!exists) nextErrors[card.id] = 'File does not exist';
            }
            break;

          case 'open_folder':
          case 'open_file':
            if (!v) nextErrors[card.id] = 'Path is required';
            else if (window.electronAPI?.checkPathExists) {
              const exists = await window.electronAPI.checkPathExists(v);
              if (!exists) nextErrors[card.id] = 'Path does not exist';
            }
            break;

          case 'set_volume':
          case 'set_brightness': {
            const n = Number(v);
            if (isNaN(n) || !Number.isInteger(n) || n < 0 || n > 100)
              nextErrors[card.id] = `${card.type === 'set_volume' ? 'Volume' : 'Brightness'} must be 0–100`;
            break;
          }

          case 'delay': {
            const n = Number(v);
            if (isNaN(n) || !Number.isInteger(n) || n < 50 || n > 60000)
              nextErrors[card.id] = 'Delay must be 50–60000 ms';
            break;
          }

          case 'run_script':
            if (!v) nextErrors[card.id] = 'Script command cannot be empty';
            break;

          // toggle_dnd, toggle_nightlight, arrange_windows have safe fixed values
        }
      }

      if (!cancelled) {
        setErrors(nextErrors);
        setUnsupportedIds(nextUnsupported);
      }
    };

    const timeout = setTimeout(run, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [sequence]);

  return {
    errors,
    unsupportedIds,
    isValid: Object.keys(errors).length === 0,
  };
}