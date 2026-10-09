import { ActionItem } from '../types/actions';

/**
 * File extensions treated as "dangerous" when used with `open_file` — an
 * `.exe`/`.bat`/etc. opens an executable, which deserves a pre-run warning.
 * Single source of truth — used by the Builder badge, the Library pre-run
 * gate, and the confirmation modal's item list.
 */
export const DANGEROUS_EXTENSIONS = ['.exe', '.cmd', '.bat', '.ps1', '.vbs', '.js', '.wsf', '.msi'];

export function hasDangerousExtension(value: string): boolean {
    const val = (value || '').toLowerCase();
    const dotIdx = val.lastIndexOf('.');
    if (dotIdx === -1) return false;
    return DANGEROUS_EXTENSIONS.includes(val.slice(dotIdx));
}

/**
 * True if the action should be flagged as dangerous in the UI and gated
 * behind the pre-run confirmation modal.
 * - `run_script` and `launch_app` are always dangerous.
 * - `open_file` is dangerous only if it points at a dangerous extension.
 * - Everything else is safe.
 *
 * This is the *computed* classification — it ignores any user override.
 * For the effective label (override-aware), use `getActionLabel`.
 */
export function isDangerousAction(action: Pick<ActionItem, 'type' | 'value'>): boolean {
    if (action.type === 'run_script' || action.type === 'launch_app') return true;
    if (action.type === 'open_file') return hasDangerousExtension(action.value);
    return false;
}

/**
 * The effective Dangerous/Safe label for an action — respects the user's
 * `safetyOverride` when present, falls back to the computed classification
 * otherwise. This is the single source of truth used by:
 *  - the Builder action card's colored chip
 *  - the confirmation modal's per-row label column
 *  - the shortcut-level "has any dangerous actions?" check
 */
export function getActionLabel(action: Pick<ActionItem, 'type' | 'value' | 'safetyOverride'>): 'dangerous' | 'safe' {
    if (action.safetyOverride) return action.safetyOverride;
    return isDangerousAction(action) ? 'dangerous' : 'safe';
}

/**
 * True if any action in the array evaluates to Dangerous (override-aware).
 * Used to decide whether a shortcut's `secured` default should be true.
 */
export function hasDangerousActions(actions: Array<Pick<ActionItem, 'type' | 'value' | 'safetyOverride'>>): boolean {
    return actions.some((a) => getActionLabel(a) === 'dangerous');
}