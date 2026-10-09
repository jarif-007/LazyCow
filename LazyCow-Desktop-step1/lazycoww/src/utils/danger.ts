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
 */
export function isDangerousAction(action: Pick<ActionItem, 'type' | 'value'>): boolean {
    if (action.type === 'run_script' || action.type === 'launch_app') return true;
    if (action.type === 'open_file') return hasDangerousExtension(action.value);
    return false;
}