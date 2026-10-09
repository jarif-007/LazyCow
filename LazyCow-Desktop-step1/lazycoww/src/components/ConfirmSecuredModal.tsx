import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SavedShortcut, ActionItem } from '../types/actions';
import { getActionLabel } from '../utils/danger';

interface ConfirmSecuredModalProps {
    shortcut: SavedShortcut;
    onConfirm: (updatedShortcut: SavedShortcut) => void;
    onCancel: () => void;
}

type Filter = 'all' | 'dangerous' | 'safe';

/**
 * Interactive confirmation modal for secured shortcuts. Lets the user:
 *  - Filter the list by Dangerous / Safe / All
 *  - Change the safety label of any action inline
 *  - If all actions end up Safe, offers to turn off Secured for the shortcut
 *
 * Any label changes are staged locally and persisted on "Run Anyway".
 * Cancel discards all staged changes.
 */
export const ConfirmSecuredModal: React.FC<ConfirmSecuredModalProps> = ({ shortcut, onConfirm, onCancel }) => {
    const [filter, setFilter] = useState<Filter>('all');
    const [overrides, setOverrides] = useState<Record<string, 'dangerous' | 'safe'>>(() => {
        const initial: Record<string, 'dangerous' | 'safe'> = {};
        for (const a of shortcut.actions) {
            if (a.safetyOverride) initial[a.id] = a.safetyOverride;
        }
        return initial;
    });
    const [showAllSafePrompt, setShowAllSafePrompt] = useState(false);

    // Merge staged overrides into actions for display.
    const displayActions: ActionItem[] = useMemo(() =>
        shortcut.actions.map((a) => overrides[a.id] ? { ...a, safetyOverride: overrides[a.id] } : a),
        [shortcut.actions, overrides]
    );

    const filteredActions = useMemo(() => {
        if (filter === 'all') return displayActions;
        if (filter === 'dangerous') return displayActions.filter((a) => getActionLabel(a) === 'dangerous');
        return displayActions.filter((a) => getActionLabel(a) === 'safe');
    }, [displayActions, filter]);

    const dangerousCount = displayActions.filter((a) => getActionLabel(a) === 'dangerous').length;
    const safeCount = displayActions.length - dangerousCount;
    const allSafe = dangerousCount === 0 && displayActions.length > 0;

    const applyOverride = (actionId: string, override: 'dangerous' | 'safe') => {
        setOverrides((p) => ({ ...p, [actionId]: override }));
    };

    const buildUpdatedShortcut = (securedOverride?: boolean): SavedShortcut => {
        const updatedActions = shortcut.actions.map((a) =>
            overrides[a.id] ? { ...a, safetyOverride: overrides[a.id] } : a
        );
        return {
            ...shortcut,
            actions: updatedActions,
            secured: securedOverride !== undefined ? securedOverride : shortcut.secured,
        };
    };

    const handleRunAnyway = () => {
        if (allSafe) {
            // Give the user a chance to turn Secured off — but only once.
            setShowAllSafePrompt(true);
            return;
        }
        onConfirm(buildUpdatedShortcut());
    };

    const handleAllSafeConfirm = (turnOffSecured: boolean) => {
        setShowAllSafePrompt(false);
        onConfirm(buildUpdatedShortcut(turnOffSecured ? false : undefined));
    };

    return createPortal(
        <div className="fixed inset-0 z-[250] flex items-center justify-center">
            <div className="absolute inset-0 bg-background/90" onClick={onCancel} />
            <div className="relative bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-lg w-full mx-4">
                <div className="flex items-start gap-3 mb-4">
                    <span className="material-symbols-outlined text-primary text-[22px] shrink-0 mt-0.5">lock</span>
                    <div>
                        <h2 className="font-title-sm text-foreground">Secured Shortcut</h2>
                        <p className="text-body-sm text-muted-foreground mt-1">
                            "{shortcut.name}" is secured — {shortcut.actions.length} action{shortcut.actions.length !== 1 ? 's' : ''} will run.
                        </p>
                    </div>
                </div>

                {/* Filter row */}
                <div className="flex items-center gap-2 mb-3">
                    {(['all', 'dangerous', 'safe'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${filter === f
                                ? f === 'dangerous'
                                    ? 'bg-red-500/15 text-red-500 border-red-500/40'
                                    : f === 'safe'
                                        ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/40'
                                        : 'bg-primary/10 text-primary border-primary/40'
                                : 'bg-transparent text-muted-foreground border-border hover:bg-muted/40'
                                }`}
                        >
                            {f === 'all' ? `All (${displayActions.length})` :
                                f === 'dangerous' ? `Dangerous (${dangerousCount})` :
                                    `Safe (${safeCount})`}
                        </button>
                    ))}
                </div>

                {/* Action list */}
                <div className="bg-background/50 border border-border rounded-lg max-h-72 overflow-y-auto divide-y divide-border/50">
                    {filteredActions.length === 0 ? (
                        <div className="p-4 text-center text-body-sm text-muted-foreground italic">
                            No actions in this view.
                        </div>
                    ) : (
                        filteredActions.map((a) => {
                            const label = getActionLabel(a);
                            const isDanger = label === 'dangerous';
                            return (
                                <div key={a.id} className="flex items-center gap-3 p-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-body-sm font-medium text-foreground truncate">{a.title}</span>
                                        </div>
                                        <span className="text-[11px] text-muted-foreground font-code-sm block truncate">{a.value || '(empty)'}</span>
                                    </div>
                                    <select
                                        value={label}
                                        onChange={(e) => applyOverride(a.id, e.target.value as 'dangerous' | 'safe')}
                                        className={`text-[11px] font-semibold px-2 py-1 rounded border transition-colors focus:outline-none ${isDanger
                                            ? 'bg-red-500/10 text-red-500 border-red-500/30'
                                            : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30'
                                            }`}
                                    >
                                        <option value="dangerous">Dangerous</option>
                                        <option value="safe">Safe</option>
                                    </select>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer buttons */}
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 border border-border rounded-full font-body-sm hover:bg-muted transition-colors text-foreground"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleRunAnyway}
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-full font-body-sm hover:opacity-90 transition-opacity"
                    >
                        Run Anyway
                    </button>
                </div>

                {/* All-safe prompt */}
                {showAllSafePrompt && (
                    <div className="absolute inset-0 z-[260] flex items-center justify-center bg-background/80 rounded-2xl">
                        <div className="bg-card border border-border rounded-xl p-5 max-w-sm mx-4 shadow-xl">
                            <p className="text-body-sm text-foreground mb-4">
                                All actions are marked safe. Turn off Secured for this shortcut?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleAllSafeConfirm(false)}
                                    className="flex-1 px-3 py-2 border border-border rounded-full font-body-sm hover:bg-muted text-foreground"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleAllSafeConfirm(true)}
                                    className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-full font-body-sm hover:opacity-90"
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};