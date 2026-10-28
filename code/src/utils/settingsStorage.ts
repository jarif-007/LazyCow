/**
 * Synchronous settings persistence.
 * Writes to both localStorage and a disk mirror (settings.json) to survive
 * hard kills (like Ctrl+C in dev mode).
 */
export function persistSetting(key: string, value: string | boolean | number): void {
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    try {
        localStorage.setItem(key, strVal);
    } catch (err) {
        console.warn(`[settings-storage] localStorage write failed for ${key}:`, err);
    }
    // Synchronously mirror to disk
    window.electronAPI?.saveSettingSync(key, strVal);
}