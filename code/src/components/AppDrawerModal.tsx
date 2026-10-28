import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import {
    SPRING_ENTER,
    FADE_ENTER,
    BACKDROP_ENTER,
    MODAL_OFFSET_Y,
} from '../utils/motion';
import { recordAppUsage, getFrequentlyUsedApps } from '../utils/appUsage';
import {
    readHiddenSet,
    readVisibleSet,
    readCustomApps,
    writeHiddenSet,
    writeVisibleSet,
    writeCustomApps,
} from '../utils/appVisibility';
import { HiddenAppsModal } from './HiddenAppsModal';

interface AppDrawerModalProps {
    /** The action's current value — the app drawer highlights it if it matches an installed app. */
    currentPath: string;
    /** Called when the user picks an app. Passes the resolved .exe path. */
    onSelect: (path: string) => void;
    /** Called when the user closes without picking. */
    onCancel: () => void;
}

const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

/**
 * Read the user's backdrop preference directly from localStorage. Same
 * pattern as Builder's readShowDangerWarnings — avoids threading a prop
 * through ActionValueInput → ActionSequence → Builder just for one visual
 * setting.
 */
function readBackdrop(): 'blur' | 'solid' {
    try {
        const raw = localStorage.getItem('lazycow_settings');
        if (!raw) return 'solid';
        const parsed = JSON.parse(raw);
        return parsed?.appDrawerBackdrop === 'blur' ? 'blur' : 'solid';
    } catch {
        return 'solid';
    }
}

export const AppDrawerModal: React.FC<AppDrawerModalProps> = ({
    currentPath,
    onSelect,
    onCancel,
}) => {
    // `rawApps` is what the OS scanner returned. The rendered list is a
    // merge of rawApps + custom apps from state, recomputed whenever
    // either changes.
    const [rawApps, setRawApps] = useState<InstalledAppForIPC[] | null>(null);
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [showHidden, setShowHidden] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ app: InstalledAppForIPC; x: number; y: number } | null>(null);

    // ── Visibility + custom apps as React state ──
    // localStorage is only persistence. Every mutation updates both state
    // and storage, and the render reads state — so hiding an app triggers
    // an immediate re-render with no memo-dep gymnastics.
    const [hiddenSet, setHiddenSet] = useState<Set<string>>(() => readHiddenSet());
    const [visibleSet, setVisibleSet] = useState<Set<string>>(() => readVisibleSet());
    const [customApps, setCustomApps] = useState<InstalledAppForIPC[]>(() => readCustomApps());

    const scrollRef = useRef<HTMLDivElement>(null);
    const backdrop = readBackdrop();
    const reducedMotion = usePrefersReducedMotion();

    // Effective hidden check: an explicit hidden entry wins; an explicit
    // visible entry wins; otherwise the app's `system` flag decides.
    // `visibleSet` is not stored separately in state because the only
    // way it matters is "did the user explicitly unhide a system app" —
    // which we can infer by absence from hiddenSet if the app was
    // previously hidden. See `isHidden` below.
    const isHidden = useCallback((app: InstalledAppForIPC): boolean => {
        const key = app.path.toLowerCase();
        if (hiddenSet.has(key)) return true;
        // System apps (redistributables, runtimes, SDKs) are auto-hidden
        // unless the user has explicitly shown them via visibleSet.
        if (app.system && !visibleSet.has(key)) return true;
        return false;
    }, [hiddenSet, visibleSet]);

    const apps = useMemo(() => {
        if (!rawApps) return null;
        const customPaths = new Set(customApps.map((a) => a.path.toLowerCase()));
        return [
            ...customApps,
            ...rawApps.filter((a) => !customPaths.has(a.path.toLowerCase())),
        ];
    }, [rawApps, customApps]);

    const visibleApps = useMemo(() => {
        if (!apps) return [];
        return apps.filter((a) => !isHidden(a));
    }, [apps, isHidden]);

    const recentApps = useMemo(
        () => getFrequentlyUsedApps(visibleApps, 8),
        [visibleApps]
    );

    // ── Load the installed apps list on mount ──
    useEffect(() => {
        let cancelled = false;
        window.electronAPI?.listInstalledApps().then((list) => {
            if (cancelled) return;
            setRawApps(list);
        }).catch(() => {
            if (!cancelled) setRawApps([]);
        });
        return () => { cancelled = true; };
    }, []);

    // ── Escape closes the modal ──
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onCancel]);

    // ── Live filter ──
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return visibleApps;
        return visibleApps.filter((a) => a.name.toLowerCase().includes(q));
    }, [visibleApps, search]);

    const hiddenCount = useMemo(
        () => (apps ? apps.filter(isHidden).length : 0),
        [apps, isHidden]
    );

    // ── Group by first letter (# first, then A–Z) ──
    const groups = useMemo(() => {
        const map = new Map<string, InstalledAppForIPC[]>();
        for (const app of filtered) {
            const first = (app.name[0] || '').toUpperCase();
            const key = /[A-Z]/.test(first) ? first : '#';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(app);
        }
        return [...map.entries()].sort((a, b) => {
            if (a[0] === '#') return -1;
            if (b[0] === '#') return 1;
            return a[0].localeCompare(b[0]);
        });
    }, [filtered]);

    const availableLetters = useMemo(() => new Set(groups.map(([l]) => l)), [groups]);

    const jumpTo = (letter: string) => {
        const el = document.getElementById(`app-section-${letter}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            const list = await window.electronAPI?.refreshInstalledApps();
            if (list) setRawApps(list);
        } finally {
            setRefreshing(false);
        }
    };

    const handlePick = (path: string) => {
        recordAppUsage(path);
        onSelect(path);
    };

    // ── Visibility mutations ──
    // Every mutation: update state AND persist to localStorage. Hide and
    // unhide both manipulate hiddenSet AND visibleSet so a system app that
    // was auto-hidden can be shown, and an app the user showed can be
    // hidden again — the two sets always agree.
    const hideApp = (app: InstalledAppForIPC) => {
        const key = app.path.toLowerCase();
        const nextHidden = new Set(hiddenSet);
        nextHidden.add(key);
        setHiddenSet(nextHidden);
        writeHiddenSet(nextHidden);

        if (visibleSet.has(key)) {
            const nextVisible = new Set(visibleSet);
            nextVisible.delete(key);
            setVisibleSet(nextVisible);
            writeVisibleSet(nextVisible);
        }
    };

    const unhideApp = (app: InstalledAppForIPC) => {
        const key = app.path.toLowerCase();
        const nextHidden = new Set(hiddenSet);
        nextHidden.delete(key);
        setHiddenSet(nextHidden);
        writeHiddenSet(nextHidden);

        // Add to visibleSet unconditionally. Harmless for non-system apps
        // (their hidden flag is already cleared above), essential for
        // system apps whose `system: true` would otherwise keep them
        // hidden forever.
        const nextVisible = new Set(visibleSet);
        nextVisible.add(key);
        setVisibleSet(nextVisible);
        writeVisibleSet(nextVisible);
    };

    const addCustom = (app: InstalledAppForIPC) => {
        const key = app.path.toLowerCase();
        if (customApps.some((a) => a.path.toLowerCase() === key)) return;
        const next = [...customApps, app];
        setCustomApps(next);
        writeCustomApps(next);
    };

    const removeCustom = (app: InstalledAppForIPC) => {
        const key = app.path.toLowerCase();
        const next = customApps.filter((a) => a.path.toLowerCase() !== key);
        setCustomApps(next);
        writeCustomApps(next);

        // Drop any visibility state so a future re-add is clean.
        if (hiddenSet.has(key)) {
            const nextHidden = new Set(hiddenSet);
            nextHidden.delete(key);
            setHiddenSet(nextHidden);
            writeHiddenSet(nextHidden);
        }
        if (visibleSet.has(key)) {
            const nextVisible = new Set(visibleSet);
            nextVisible.delete(key);
            setVisibleSet(nextVisible);
            writeVisibleSet(nextVisible);
        }
    };

    const openContextMenu = (app: InstalledAppForIPC, x: number, y: number) => {
        setContextMenu({ app, x, y });
    };

    const handleOtherApps = async () => {
        const picked = await window.electronAPI?.selectPath('app');
        if (picked) {
            recordAppUsage(picked);
            onSelect(picked);
        }
    };

    const handleAddToDrawer = async () => {
        const picked = await window.electronAPI?.selectPath('app');
        if (!picked) return;
        const base = picked.split(/[\\/]/).pop() || picked;
        addCustom({
            name: base.replace(/\.exe$/i, ''),
            path: picked,
            kind: 'exe',
            iconDataUrl: null,
            system: false,
        });
        recordAppUsage(picked);
        setShowAddMenu(false);
        onSelect(picked);
    };

    const backdropClass = backdrop === 'blur'
        ? 'bg-background/50 backdrop-blur-md'
        : 'bg-background/90';

    return createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
                className={`absolute inset-0 ${backdropClass}`}
                onClick={onCancel}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={reducedMotion ? FADE_ENTER : BACKDROP_ENTER}
            />

            {/* Modal */}
            <motion.div
                className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[900px] mx-4 h-[600px] max-h-[85vh] flex flex-col overflow-hidden"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: MODAL_OFFSET_Y }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: MODAL_OFFSET_Y }}
                transition={reducedMotion ? FADE_ENTER : SPRING_ENTER}
            >
                {/* Header — search, refresh, close */}
                <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]">
                            search
                        </span>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search apps..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-background/50 border border-border rounded-lg pl-10 pr-4 py-2 font-body-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    <button
                        onClick={() => setShowHidden(true)}
                        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Manage hidden apps"
                    >
                        <span className="material-symbols-outlined text-[20px]">visibility_off</span>
                        {hiddenCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                                {hiddenCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                        title="Refresh app list"
                    >
                        <span className={`material-symbols-outlined text-[20px] ${refreshing ? 'animate-spin' : ''}`}>
                            refresh
                        </span>
                    </button>
                    <button
                        onClick={onCancel}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Close"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Guide strip */}
                <div className="px-4 py-1.5 border-b border-border/40 bg-muted/10">
                    <p className="text-[11px] text-muted-foreground/70">
                        <span className="material-symbols-outlined text-[13px] align-middle mr-1">tips_and_updates</span>
                        Right-click any app to hide or remove it. Hover and click the eye-off icon for a quick hide.
                    </p>
                </div>

                {/* Body — scrollable, with alphabet strip overlaid on the right */}
                <div className="relative flex-1 min-h-0">
                    <div ref={scrollRef} className="absolute inset-0 overflow-y-auto pr-7">
                        {apps === null ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                                <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
                                <span className="text-body-sm">Loading installed apps…</span>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground px-6 text-center">
                                <span className="material-symbols-outlined text-4xl">search_off</span>
                                <span className="text-body-sm">
                                    {search ? `No apps match "${search}".` : 'No installed apps found — use "Add app" below.'}
                                </span>
                            </div>
                        ) : (
                            <>
                                {/* Frequently used — hidden while searching */}
                                {!search && recentApps.length > 0 && (
                                    <div className="pt-4 pb-3">
                                        <h3 className="text-[10px] font-label-caps uppercase tracking-wider opacity-60 mb-3 px-4">
                                            Frequently used
                                        </h3>
                                        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-1 px-3">
                                            {recentApps.map((app) => (
                                                <AppCell
                                                    key={`${app.path}::${app.name}`}
                                                    app={app}
                                                    isCurrent={app.path === currentPath}
                                                    onPick={handlePick}
                                                    onHide={hideApp}
                                                    onContextMenu={openContextMenu}
                                                />
                                            ))}
                                        </div>
                                        <div className="border-t border-border/40 mt-4" />
                                    </div>
                                )}

                                {/* All apps, grouped by letter */}
                                <div className="pt-3 pb-6">
                                    <h3 className="text-[10px] font-label-caps uppercase tracking-wider opacity-60 mb-2 px-4">
                                        {search ? 'Search results' : 'All apps'}
                                    </h3>
                                    {groups.map(([letter, appsInGroup]) => (
                                        <div key={letter} id={`app-section-${letter}`} className="mb-2">
                                            <div className="sticky top-0 z-10 bg-card/95 px-4 py-1.5">
                                                <span className="text-[11px] font-semibold text-muted-foreground">{letter}</span>
                                            </div>
                                            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-1 px-3">
                                                {appsInGroup.map((app) => (
                                                    <AppCell
                                                        key={`${app.path}::${app.name}`}
                                                        app={app}
                                                        isCurrent={app.path === currentPath}
                                                        onPick={handlePick}
                                                        onHide={hideApp}
                                                        onContextMenu={openContextMenu}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Alphabet strip */}
                    {apps !== null && filtered.length > 0 && (
                        <div className="absolute right-0.5 top-8 bottom-2 flex flex-col items-center justify-start z-20 pointer-events-none">
                            <div className="flex flex-col items-center gap-0 pointer-events-auto py-1 max-h-full overflow-y-auto overflow-x-hidden scrollbar-thin-alpha">
                                {LETTERS.map((l) => {
                                    const available = availableLetters.has(l);
                                    return (
                                        <button
                                            key={l}
                                            onClick={() => available && jumpTo(l)}
                                            disabled={!available}
                                            className={`w-3.5 h-3.5 flex items-center justify-center text-[8px] font-semibold leading-none transition-colors rounded-full shrink-0 ${available
                                                ? 'text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer'
                                                : 'text-muted-foreground/20 cursor-default'
                                                }`}
                                        >
                                            {l}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer — "Add app" menu + count */}
                <div className="relative shrink-0">
                    <div className="p-3 border-t border-border flex items-center justify-between gap-3">
                        <button
                            onClick={() => setShowAddMenu((v) => !v)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-body-sm transition-colors ${showAddMenu
                                    ? 'text-foreground bg-muted'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            <span>Add app</span>
                            <span className="material-symbols-outlined text-[16px]">
                                {showAddMenu ? 'expand_more' : 'expand_less'}
                            </span>
                        </button>
                        <span className="text-[11px] text-muted-foreground/60">
                            {filtered.length} app{filtered.length !== 1 ? 's' : ''}
                            {hiddenCount > 0 && ` · ${hiddenCount} hidden`}
                        </span>
                    </div>
                    {showAddMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-[310]"
                                onClick={() => setShowAddMenu(false)}
                            />
                            <div className="absolute left-3 bottom-full mb-1 z-[320] w-64 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                                <button
                                    onClick={handleAddToDrawer}
                                    className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-start gap-2.5"
                                >
                                    <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">add_box</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-body-sm text-foreground">Add to drawer</p>
                                        <p className="text-[11px] text-muted-foreground/70">Keep it here for next time</p>
                                    </div>
                                </button>
                                <div className="border-t border-border/50" />
                                <button
                                    onClick={() => { setShowAddMenu(false); void handleOtherApps(); }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-start gap-2.5"
                                >
                                    <span className="material-symbols-outlined text-[18px] text-muted-foreground shrink-0 mt-0.5">bolt</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-body-sm text-foreground">Use once</p>
                                        <p className="text-[11px] text-muted-foreground/70">Just fill this field, don't save</p>
                                    </div>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>

            {showHidden && apps !== null && (
                <HiddenAppsModal
                    hiddenApps={apps.filter(isHidden)}
                    customPaths={new Set(customApps.map((c) => c.path.toLowerCase()))}
                    onUnhide={unhideApp}
                    onRemoveCustom={removeCustom}
                    onClose={() => setShowHidden(false)}
                />
            )}

            {contextMenu && (
                <>
                    <div
                        className="fixed inset-0 z-[340]"
                        onClick={() => setContextMenu(null)}
                        onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                    />
                    <div
                        className="fixed z-[350] w-56 bg-card border border-border rounded-xl shadow-2xl overflow-hidden py-1"
                        style={{
                            top: Math.min(contextMenu.y, window.innerHeight - 120),
                            left: Math.min(contextMenu.x, window.innerWidth - 230),
                        }}
                    >
                        <div className="px-3 py-1.5 border-b border-border/40">
                            <p className="text-[11px] text-muted-foreground truncate">{contextMenu.app.name}</p>
                        </div>
                        <button
                            onClick={() => {
                                hideApp(contextMenu.app);
                                setContextMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors flex items-center gap-2.5"
                        >
                            <span className="material-symbols-outlined text-[18px] text-muted-foreground">visibility_off</span>
                            <span className="text-body-sm text-foreground">Hide from drawer</span>
                        </button>
                        {customApps.some((c) => c.path.toLowerCase() === contextMenu.app.path.toLowerCase()) && (
                            <button
                                onClick={() => {
                                    removeCustom(contextMenu.app);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-red-500/10 transition-colors flex items-center gap-2.5 text-red-500"
                            >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                <span className="text-body-sm">Remove permanently</span>
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>,
        document.body
    );
};

// ──────────────────────────────────────────────
// App cell — icon + name. Kept local because it's only used here.
// ──────────────────────────────────────────────

const SHELL_ICONS: Record<string, string> = {
    'File Explorer': 'folder',
    'This PC': 'computer',
    'Recycle Bin': 'delete',
    'Control Panel': 'settings_applications',
    'Settings': 'settings',
    'Network': 'lan',
};

const AppCell: React.FC<{
    app: InstalledAppForIPC;
    isCurrent: boolean;
    onPick: (path: string) => void;
    onHide: (app: InstalledAppForIPC) => void;
    onContextMenu: (app: InstalledAppForIPC, x: number, y: number) => void;
}> = ({ app, isCurrent, onPick, onHide, onContextMenu }) => {
    const fallbackIcon = app.kind === 'shell'
        ? (SHELL_ICONS[app.name] || 'folder')
        : 'apps';
    const fallbackColor = app.kind === 'shell'
        ? 'text-foreground/60'
        : 'text-muted-foreground/40';

    return (
        <div
            className="relative group/app"
            onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu(app, e.clientX, e.clientY);
            }}
        >
            <button
                onClick={() => onPick(app.path)}
                title={
                    app.kind === 'uwp'
                        ? `${app.name} (Windows app)`
                        : app.kind === 'shell'
                            ? `${app.name} (Windows folder)`
                            : `${app.name}\n${app.path}`
                }
                className={`w-full flex flex-col items-center gap-1.5 p-2 rounded-lg transition-colors text-center ${isCurrent ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-muted'
                    }`}
            >
                <div className="w-14 h-14 flex items-center justify-center shrink-0">
                    {app.iconDataUrl ? (
                        <img src={app.iconDataUrl} alt="" className="w-12 h-12 object-contain" draggable={false} />
                    ) : (
                        <span className={`material-symbols-outlined text-3xl ${fallbackColor}`}>
                            {fallbackIcon}
                        </span>
                    )}
                </div>
                <span className="text-[11px] leading-tight text-foreground line-clamp-2 w-full">
                    {app.name}
                </span>
            </button>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onHide(app);
                }}
                className="absolute top-1 left-1 w-6 h-6 rounded-md bg-background/90 border border-border flex items-center justify-center text-muted-foreground opacity-0 group-hover/app:opacity-100 hover:text-red-500 hover:border-red-500/50 transition-all shadow-sm"
                title="Hide from drawer"
                aria-label={`Hide ${app.name}`}
            >
                <span className="material-symbols-outlined text-[14px]">visibility_off</span>
            </button>
        </div>
    );
};