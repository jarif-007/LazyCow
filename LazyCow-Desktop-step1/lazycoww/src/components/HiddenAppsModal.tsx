import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface HiddenAppsModalProps {
    /** Pre-filtered by the drawer — every entry here is currently hidden. */
    hiddenApps: InstalledAppForIPC[];
    /** Lowercased paths of user-added apps. */
    customPaths: Set<string>;
    onUnhide: (app: InstalledAppForIPC) => void;
    onRemoveCustom: (app: InstalledAppForIPC) => void;
    onClose: () => void;
}

export const HiddenAppsModal: React.FC<HiddenAppsModalProps> = ({
    hiddenApps,
    customPaths,
    onUnhide,
    onRemoveCustom,
    onClose,
}) => {
    const [contextMenu, setContextMenu] = useState<{ app: InstalledAppForIPC; x: number; y: number } | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    return createPortal(
        <div className="fixed inset-0 z-[400] flex items-center justify-center">
            <div className="absolute inset-0 bg-background/80" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[700px] mx-4 h-[520px] max-h-[82vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
                    <div>
                        <h2 className="font-title-sm text-foreground">Hidden apps</h2>
                        <p className="text-body-sm text-muted-foreground mt-0.5">
                            Hidden apps stay installed but don't appear in the drawer.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                        title="Close"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="px-4 py-1.5 border-b border-border/40 bg-muted/10">
                    <p className="text-[11px] text-muted-foreground/70">
                        <span className="material-symbols-outlined text-[13px] align-middle mr-1">tips_and_updates</span>
                        Click the eye icon to unhide. Right-click an app for the full menu.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    {hiddenApps.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground px-6 text-center">
                            <span className="material-symbols-outlined text-4xl opacity-40">visibility</span>
                            <p className="text-body-sm">No hidden apps.</p>
                            <p className="text-[11px] opacity-70">
                                Hover any app in the drawer and click the eye-off icon to hide it,
                                or right-click for the same option.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {hiddenApps.map((app) => {
                                const isCustom = customPaths.has(app.path.toLowerCase());
                                return (
                                    <div
                                        key={`${app.path}::${app.name}`}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setContextMenu({ app, x: e.clientX, y: e.clientY });
                                        }}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors"
                                    >
                                        <div className="w-9 h-9 flex items-center justify-center shrink-0">
                                            {app.iconDataUrl ? (
                                                <img src={app.iconDataUrl} alt="" className="w-8 h-8 object-contain" draggable={false} />
                                            ) : (
                                                <span className="material-symbols-outlined text-[22px] text-muted-foreground/40">apps</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-body-sm text-foreground truncate">{app.name}</p>
                                                {app.system && (
                                                    <span className="text-[9px] uppercase tracking-wider text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                                                        System
                                                    </span>
                                                )}
                                                {isCustom && (
                                                    <span className="text-[9px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                                                        Custom
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground/60 truncate font-code-sm">{app.path}</p>
                                        </div>
                                        {isCustom && (
                                            <button
                                                onClick={() => onRemoveCustom(app)}
                                                className="p-2 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                                                title="Remove permanently from drawer"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onUnhide(app)}
                                            className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                                            title="Unhide"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-3 border-t border-border flex items-center justify-end gap-3 shrink-0">
                    <span className="text-[11px] text-muted-foreground/60">
                        {hiddenApps.length} hidden
                    </span>
                </div>
            </div>

            {contextMenu && (
                <>
                    <div
                        className="fixed inset-0 z-[440]"
                        onClick={() => setContextMenu(null)}
                        onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                    />
                    <div
                        className="fixed z-[450] w-56 bg-card border border-border rounded-xl shadow-2xl overflow-hidden py-1"
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
                                onUnhide(contextMenu.app);
                                setContextMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors flex items-center gap-2.5"
                        >
                            <span className="material-symbols-outlined text-[18px] text-muted-foreground">visibility</span>
                            <span className="text-body-sm text-foreground">Unhide app</span>
                        </button>
                        {customPaths.has(contextMenu.app.path.toLowerCase()) && (
                            <button
                                onClick={() => {
                                    onRemoveCustom(contextMenu.app);
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