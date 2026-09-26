import { useEffect, useState } from 'react';
import { ActionItem, actionCatalog } from '../types/actions';

const CATALOG_TYPES = new Set(actionCatalog.map((a) => a.type as string));

/** IPv4 — exactly 4 numeric segments, each 0–255. */
function isIPv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

/** IPv6 — 8 groups of 1–4 hex digits, or compressed with `::`. */
function isIPv6(host: string): boolean {
  // Strip brackets if present
  const h = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (!h.includes(':')) return false;
  if (h.includes(':::')) return false;
  const parts = h.split('::');
  if (parts.length > 2) return false;
  const hexGroup = /^[0-9a-fA-F]{1,4}$/;

  if (parts.length === 2) {
    // Compressed form: left + right groups, total < 8
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    if (left.length + right.length >= 8) return false;
    return [...left, ...right].every((g) => hexGroup.test(g));
  }
  // Full form: exactly 8 groups
  const groups = h.split(':');
  if (groups.length !== 8) return false;
  return groups.every((g) => hexGroup.test(g));
}

/**
 * Format-only URL check — scheme must be http/https, host must contain
 * at least one dot (or be localhost / an IP literal).
 * No TLD whitelist. No DNS. Users verify the URL themselves via the
 * Test button.
 */
export function isValidUrlFormat(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname;
    if (!host) return false;

    // IPv6 literal (bracketed)
    if (host.startsWith('[') && host.endsWith(']')) {
      return isIPv6(host);
    }
    // Local development
    if (host === 'localhost') return true;
    // IPv4 — must be 4 segments, each 0–255
    if (/^\d+(\.\d+){3}$/.test(host)) {
      return isIPv4(host);
    }
    // Hostname — must contain at least one dot
    return host.includes('.');
  } catch {
    return false;
  }
}

export interface ValidationState {
  errors: Record<string, string>;
  warnings: Record<string, string>;
  unsupportedIds: Set<string>;
  isValid: boolean;
}

/**
 * Validates the current action sequence.
 * - Sync checks (empty, format, range) run immediately.
 * - Async checks (path existence, DNS resolution) run debounced.
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
          case 'open_url': {
            if (!v) {
              nextErrors[card.id] = 'URL is required';
              break;
            }

            // ── Rule 1: All digits + dots → IP attempt, always strict ──
            if (/^[\d.]+$/.test(v) && v.includes('.')) {
              if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) {
                // Exactly 4 numeric groups — must be in range
                if (!isIPv4(v)) {
                  nextErrors[card.id] = 'Invalid IP address — each part must be 0–255';
                }
                // else: valid IPv4, no error
              } else {
                // Wrong number of groups (3, 5, 6, trailing dot, etc.)
                nextErrors[card.id] = 'Enter a full IP address like 192.168.1.1';
              }
              break;
            }

            // ── Rule 2: Localhost / local dev — pending while typing ──
            if (/^localhost(\.|:|\/|$)/i.test(v)) {
              break;
            }

            // ── Rule 3: Schemeless hostname with a dot + chars after ──
            // (user is mid-typing; blur will auto-prefix)
            if (
              !/^[a-z][a-z0-9+.-]*:\/\//i.test(v) &&
              /\..+/.test(v)
            ) {
              break;
            }

            // ── Rule 4: Fallback to full URL parse ──
            if (!isValidUrlFormat(v)) {
              nextErrors[card.id] = 'Enter a URL like google.com or www.google.com';
            }
            break;
          }

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

    const timeout = setTimeout(run, 600);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [sequence]);

  return {
    errors,
    warnings: {} as Record<string, string>,
    unsupportedIds,
    isValid: Object.keys(errors).length === 0,
  };
}