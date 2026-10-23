import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

// ==========================================
// REUSABLE INFO ICON COMPONENT
// ==========================================
const InfoIcon = ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => (
    <button
        onClick={onClick}
        className="p-1 rounded-full hover:bg-muted text-muted-foreground transition-colors relative group/info"
        aria-label="Card Information"
    >
        <span className="material-symbols-outlined text-[16px]">info</span>
        {/* Hover Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-foreground text-background text-[11px] font-body-sm font-medium px-2.5 py-1.5 rounded-lg opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 pointer-events-none shadow-xl">
            Click to learn more
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-foreground" />
        </div>
    </button>
);

// ==========================================
// MAIN ACCOUNT COMPONENT
// ==========================================
export const Account: React.FC = () => {
    const [focusedCard, setFocusedCard] = useState<string | null>(null);
    const [infoCard, setInfoCard] = useState<string | null>(null);
    const [syncFilter, setSyncFilter] = useState<'all' | 'error' | 'ready'>('all');

    const [isSyncEnabled, setIsSyncEnabled] = useState(true);
    // Per-target sync spinner state. Keyed by '__global__' for the header
    // button, or String(item.id) for a per-shortcut row. Using a Set (not
    // a single boolean) keeps spinners independent — clicking a row must
    // not spin every other row or the header button.
    const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        document.body.style.overflow = (focusedCard || infoCard) ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [focusedCard, infoCard]);

    // --- Mock Data Types ---
    type SyncError = { id: string; name: string; missing: string };
    type PendingShortcut = { id: number; name: string; icon: string; time: string };

    const user = { name: 'Tamjid', email: 'tamjid@lazycow.dev', initials: 'TJ' };

    const syncErrors: SyncError[] = [
        { id: 'e1', name: 'OBS Streamer Layout', missing: 'obs64.exe' },
    ];

    const pendingShortcuts: PendingShortcut[] = [
        { id: 1, name: 'Morning Dev Flow', icon: 'code', time: '2m ago' },
        { id: 2, name: 'Deep Focus Session', icon: 'headphones', time: '1h ago' },
        { id: 3, name: 'Workspace Teardown', icon: 'power_settings_new', time: '3h ago' },
    ];

    const history = [
        { id: 1, action: 'Synced', target: 'Notepad & Spotify Setup', time: 'Yesterday at 9:00 AM', icon: 'sync' },
        { id: 2, action: 'Downloaded', target: 'University Class Links', time: '2 days ago', icon: 'download' },
        { id: 3, action: 'Uploaded', target: 'OBS Streamer Layout', time: '3 days ago', icon: 'upload' },
    ];

    const devices = [
        { name: 'This PC (Windows 11)', status: 'Active', icon: 'desktop_windows' },
        { name: 'Surface Pro 9', status: 'Synced 2m ago', icon: 'laptop_mac' },
    ];

    const hasErrors = syncErrors.length > 0;
    const hasPending = pendingShortcuts.length > 0;
    const totalIssues = syncErrors.length + pendingShortcuts.length;
    const isEverythingClear = !hasErrors && !hasPending;

    const openModal = (e: React.MouseEvent, filter: 'all' | 'error' | 'ready') => {
        e.stopPropagation();
        setSyncFilter(filter);
        setFocusedCard('sync');
    };

    const openInfo = (e: React.MouseEvent, card: string) => {
        e.stopPropagation();
        setInfoCard(card);
    };

    const handleSyncClick = (e: React.MouseEvent, targetId: string) => {
        e.stopPropagation();
        if (syncingIds.has(targetId)) return;
        setSyncingIds(prev => {
            const next = new Set(prev);
            next.add(targetId);
            return next;
        });
        setTimeout(() => {
            setSyncingIds(prev => {
                const next = new Set(prev);
                next.delete(targetId);
                return next;
            });
        }, 1500);
    };

    // --- Info Content Dictionary ---
    type CardInfoSection = { title: string; text: string };
    type CardInfoContent = { title: string; desc: string; sections: CardInfoSection[] };
    type CardInfoMap = Record<string, CardInfoContent>;
    
    // The fix is adding ": CardInfoMap" here 👇
    const cardInfo: CardInfoMap = {
        sync: {
            title: 'Sync Center',
            desc: 'This card shows the status of your local shortcuts compared to your cloud account.',
            sections: [
                { title: 'Action Required (Errors)', text: 'These shortcuts have broken file paths or missing apps on this device. They cannot be synced until you fix the paths.' },
                { title: 'Ready to Sync', text: 'These shortcuts are valid and waiting to be uploaded to the cloud.' },
                { title: 'Everything is Synced', text: 'All your local shortcuts perfectly match your cloud profile. No action needed.' }
            ]
        },
        activity: {
            title: 'Activity & Community',
            desc: 'Track your recent interactions with the LazyCow Cloud and Community.',
            sections: [
                { title: 'Recent History', text: 'A timeline of when you synced, downloaded, or uploaded shortcuts.' },
                { title: 'Community Stats', text: 'Shows how many times your published shortcuts have been downloaded by others, and your average star rating.' }
            ]
        },
        profile: {
            title: 'Your Profile',
            desc: 'Your account identity and subscription details.',
            sections: [
                { title: 'Account Details', text: 'Your current display name, email, and avatar.' },
                { title: 'Subscription', text: 'Manage your LazyCow Pro membership and billing settings here.' }
            ]
        },
        devices: {
            title: 'Connected Devices',
            desc: 'A list of Windows devices currently logged into your LazyCow account.',
            sections: [
                { title: 'Active Devices', text: 'Shows where your account is currently signed in. All devices on this list will sync shortcuts automatically.' }
            ]
        },
        actions: {
            title: 'Quick Actions',
            desc: 'Shortcuts to common account tasks.',
            sections: [
                { title: 'Import / Export', text: 'Download your shortcuts as a file, or upload them from another device.' },
                { title: 'Invite', text: 'Share your profile with friends to collaborate on shortcuts.' }
            ]
        }
    };

    return (
        <main className={`flex-1 p-6 w-full max-w-[1400px] mx-auto flex flex-col h-full min-h-0 ${(focusedCard || infoCard) ? 'overflow-hidden' : 'overflow-y-auto'}`}>

            {/* --- TOP HEADER --- */}
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 shrink-0 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Account Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">Welcome back, {user.name}. Manage your cloud environment.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div
                        onClick={() => setIsSyncEnabled(!isSyncEnabled)}
                        className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                        <span className={`material-symbols-outlined text-[18px] text-muted-foreground ${isSyncEnabled ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '3s' }}>sync</span>
                        <span className="text-xs font-semibold text-foreground">Auto Sync</span>
                        <div className={`w-8 h-4 rounded-full relative ml-1 transition-colors ${isSyncEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                            <motion.span
                                layout
                                className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm ${isSyncEnabled ? 'right-0.5' : 'left-0.5'}`}
                            />
                        </div>
                    </div>
                    <button
                        onClick={(e) => handleSyncClick(e, '__global__')}
                        disabled={syncingIds.has('__global__')}
                        className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm flex items-center gap-2 disabled:opacity-70"
                    >
                        <span className={`material-symbols-outlined text-[18px] ${syncingIds.has('__global__') ? 'animate-spin' : ''}`}>
                            {syncingIds.has('__global__') ? 'progress_activity' : 'cloud_upload'}
                        </span>
                        {syncingIds.has('__global__') ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>
            </header>

            {/* --- BENTO GRID --- */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 flex-1 min-h-[400px]">

                {/* HERO CARD: SYNC CENTER */}
                <div
                    onClick={(e) => openModal(e, 'all')}
                    className={`md:col-span-6 flex flex-col bg-card border rounded-2xl p-6 shadow-sm cursor-pointer hover:shadow-md transition-all relative overflow-hidden ${hasErrors ? 'border-red-500/30' : 'border-border'
                        }`}
                >
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">cloud_sync</span>
                            Sync Center
                        </h2>
                        <div className="flex items-center gap-2">
                            {hasErrors && (
                                <span className="inline-flex items-center justify-center h-6 px-2.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[11px] font-semibold whitespace-nowrap">
                                    {syncErrors.length} Error{syncErrors.length !== 1 ? 's' : ''}
                                </span>
                            )}
                            {hasPending && (
                                <span className="inline-flex items-center justify-center h-6 px-2.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-semibold whitespace-nowrap">
                                    {pendingShortcuts.length} Ready
                                </span>
                            )}
                            <InfoIcon onClick={(e) => openInfo(e, 'sync')} />
                            <button className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors" onClick={(e) => openModal(e, 'all')}>
                                <span className="material-symbols-outlined text-[18px]">open_in_full</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center gap-4">
                        {isEverythingClear ? (
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-[32px]">check_circle</span>
                                </div>
                                <h3 className="text-lg font-bold text-foreground">Everything is Synced</h3>
                                <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">Your local shortcuts perfectly match your cloud profile.</p>
                            </div>
                        ) : (
                            <>
                                {hasErrors ? (
                                    <div
                                        onClick={(e) => openModal(e, 'error')}
                                        className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 hover:bg-red-500/15 transition-colors group cursor-pointer"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-red-500 text-[24px]">warning</span>
                                            <div>
                                                <h3 className="text-sm font-bold text-red-500">
                                                    {syncErrors.length} Shortcut{syncErrors.length !== 1 ? 's' : ''} Need Attention
                                                </h3>
                                                <p className="text-xs text-red-500/80 mt-1 flex items-center gap-1 group-hover:underline">
                                                    Click to view and resolve <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-emerald-500 text-[24px]">check_circle</span>
                                            <div>
                                                <h3 className="text-sm font-bold text-emerald-500">All Systems Clear</h3>
                                                <p className="text-xs text-emerald-500/80 mt-1">No errors found in your local shortcuts.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {hasPending ? (
                                    <div onClick={(e) => openModal(e, 'ready')} className="group cursor-pointer">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1 group-hover:text-primary transition-colors">
                                            Ready to Sync <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                        </h4>
                                        <div className="space-y-2">
                                            {pendingShortcuts.slice(0, 2).map(sc => (
                                                <div key={sc.id} className="flex items-center justify-between bg-background border border-border p-2.5 rounded-lg group-hover:border-primary/30 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-primary text-[18px]">{sc.icon}</span>
                                                        <span className="text-sm font-semibold text-foreground">{sc.name}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {pendingShortcuts.length > 2 && (
                                                <p className="text-xs text-muted-foreground text-center pt-1 italic">+ {pendingShortcuts.length - 2} more...</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-2 border border-dashed border-border rounded-xl">
                                        <p className="text-xs text-muted-foreground">No shortcuts ready to sync.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ACTIVITY CARD */}
                <div
                    onClick={() => setFocusedCard('activity')}
                    className="md:col-span-6 flex flex-col bg-card border border-border rounded-2xl p-6 shadow-sm cursor-pointer hover:shadow-md transition-all"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">history</span>
                            Activity & Community
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center h-6 px-2.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold whitespace-nowrap">{history.length} Events</span>
                            <InfoIcon onClick={(e) => openInfo(e, 'activity')} />
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-4">
                        <div className="flex items-center justify-between bg-background border border-border p-3 rounded-xl">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-purple-500">groups</span>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Community Downloads</p>
                                    <p className="text-[11px] text-muted-foreground">1,240 total downloads</p>
                                </div>
                            </div>
                            <div className="text-amber-500 font-bold text-sm flex items-center gap-1">
                                <span className="material-symbols-outlined fill-1 text-[16px]">star</span> 4.8
                            </div>
                        </div>

                        <div className="flex-1">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Recent History</h4>
                            <div className="relative border-l-2 border-border ml-2.5 space-y-4 pb-2">
                                {history.slice(0, 3).map((item) => (
                                    <div key={item.id} className="relative pl-6">
                                        <div className="absolute -left-[13px] top-0 w-6 h-6 rounded-full bg-card border-2 border-primary flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[12px] text-primary">{item.icon}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold text-foreground">{item.target}</p>
                                            <span className="text-[10px] text-muted-foreground">{item.time}</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">{item.action}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* PROFILE CARD */}
                <div className="md:col-span-4 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
                                {user.initials}
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-foreground">{user.name}</h3>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                        </div>
                        <InfoIcon onClick={(e) => openInfo(e, 'profile')} />
                    </div>
                    <div className="flex-1 flex flex-col justify-center space-y-2">
                        <button className="w-full text-left px-3 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors flex items-center justify-between">
                            <span>Account Settings</span>
                            <span className="material-symbols-outlined text-muted-foreground text-[16px]">chevron_right</span>
                        </button>
                        <button className="w-full text-left px-3 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors flex items-center justify-between">
                            <span>Manage Subscription</span>
                            <span className="material-symbols-outlined text-muted-foreground text-[16px]">chevron_right</span>
                        </button>
                    </div>
                </div>

                {/* DEVICES CARD */}
                <div className="md:col-span-4 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-foreground">Connected Devices</h3>
                        <InfoIcon onClick={(e) => openInfo(e, 'devices')} />
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                        {devices.map((device, i) => (
                            <div key={i} className="flex items-center justify-between bg-background border border-border p-3 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-muted-foreground">{device.icon}</span>
                                    <span className="text-sm font-semibold text-foreground">{device.name}</span>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${device.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                                    {device.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* QUICK ACTIONS CARD */}
                <div className="md:col-span-4 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-foreground">Quick Actions</h3>
                        <InfoIcon onClick={(e) => openInfo(e, 'actions')} />
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                        <button className="flex flex-col items-center justify-center p-3 border border-border rounded-xl hover:bg-muted transition-colors">
                            <span className="material-symbols-outlined text-primary mb-2">download</span>
                            <span className="text-xs font-semibold">Import</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-3 border border-border rounded-xl hover:bg-muted transition-colors">
                            <span className="material-symbols-outlined text-primary mb-2">upload</span>
                            <span className="text-xs font-semibold">Export</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-3 border border-border rounded-xl hover:bg-muted transition-colors">
                            <span className="material-symbols-outlined text-primary mb-2">group_add</span>
                            <span className="text-xs font-semibold">Invite</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-3 border border-border rounded-xl hover:bg-muted transition-colors text-red-500">
                            <span className="material-symbols-outlined mb-2">logout</span>
                            <span className="text-xs font-semibold">Sign Out</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* --- SYNC & ACTIVITY MODAL --- */}
            {createPortal(
                <AnimatePresence>
                    {focusedCard && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-background/90"
                                onClick={() => setFocusedCard(null)}
                            />

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                                className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[800px] max-h-[85vh] flex flex-col overflow-hidden"
                            >
                                <div className="flex items-center justify-between p-6 border-b border-border shrink-0 bg-card z-10">
                                    <h2 className="text-xl font-bold text-foreground">
                                        {focusedCard === 'sync' ? 'Sync Details' : 'Activity Log'}
                                    </h2>
                                    <button
                                        onClick={() => setFocusedCard(null)}
                                        className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                                    >
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>

                                {focusedCard === 'sync' && (
                                    <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-muted/10 shrink-0 overflow-x-auto">
                                        <button
                                            onClick={() => setSyncFilter('all')}
                                            className={`inline-flex items-center justify-center h-8 px-3.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${syncFilter === 'all' ? 'bg-primary/10 text-primary border-primary/30' : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted'
                                                }`}
                                        >
                                            All ({totalIssues})
                                        </button>
                                        <button
                                            onClick={() => setSyncFilter('error')}
                                            className={`inline-flex items-center justify-center h-8 px-3.5 rounded-lg text-xs font-semibold border transition-colors gap-1.5 whitespace-nowrap ${syncFilter === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted'
                                                }`}
                                        >
                                            Errors ({syncErrors.length})
                                        </button>
                                        <button
                                            onClick={() => setSyncFilter('ready')}
                                            className={`inline-flex items-center justify-center h-8 px-3.5 rounded-lg text-xs font-semibold border transition-colors gap-1.5 whitespace-nowrap ${syncFilter === 'ready' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted'
                                                }`}
                                        >
                                            Ready ({pendingShortcuts.length})
                                        </button>
                                    </div>
                                )}

                                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-background/50">
                                    {focusedCard === 'sync' ? (
                                        <div className="space-y-6">
                                            {isEverythingClear && (
                                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                                                        <span className="material-symbols-outlined text-[32px]">check_circle</span>
                                                    </div>
                                                    <h3 className="text-lg font-bold text-foreground">Everything is synced!</h3>
                                                    <p className="text-sm text-muted-foreground mt-1">Your local workspace perfectly matches the cloud.</p>
                                                </div>
                                            )}

                                            {(syncFilter === 'all' || syncFilter === 'error') && hasErrors && (
                                                <div className="space-y-3">
                                                    {syncErrors.map((err) => (
                                                        <div key={err.id} className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 shadow-sm">
                                                            <h3 className="text-base font-bold text-red-500 flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-[20px]">warning</span>
                                                                Action Required
                                                            </h3>
                                                            <p className="text-sm text-red-500/80 mt-2">
                                                                The shortcut "{err.name}" cannot be synced because the required executable <code className="bg-red-500/20 px-1 py-0.5 rounded text-[11px] font-bold">{err.missing}</code> was not found on this device.
                                                            </p>
                                                            <button className="mt-3 px-4 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition-colors">
                                                                Locate File
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {(syncFilter === 'all' || syncFilter === 'ready') && hasPending && (
                                                <div>
                                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        Ready to Sync ({pendingShortcuts.length})
                                                    </h3>
                                                    <div className="space-y-2">
                                                        {pendingShortcuts.map(sc => (
                                                            <div key={sc.id} className="flex items-center justify-between bg-card border border-border p-3 rounded-xl shadow-sm">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-primary">
                                                                        <span className="material-symbols-outlined text-[16px]">{sc.icon}</span>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-foreground">{sc.name}</p>
                                                                        <p className="text-[10px] text-muted-foreground">Last updated {sc.time}</p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => handleSyncClick(e, String(sc.id))}
                                                                    disabled={syncingIds.has(String(sc.id))}
                                                                    className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                                                                >
                                                                    {syncingIds.has(String(sc.id)) ? <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> : null}
                                                                    Sync Now
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="relative border-l-2 border-border ml-4 space-y-6 pb-4">
                                                {history.map((item, i) => (
                                                    <div key={i} className="relative pl-8">
                                                        <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-card border-2 border-primary flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-[16px] text-primary">
                                                                {item.icon}
                                                            </span>
                                                        </div>
                                                        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <p className="text-sm font-bold text-foreground">{item.action}</p>
                                                                <span className="text-xs text-muted-foreground">{item.time}</span>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground">{item.target}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* --- INFO MODAL --- */}
            {createPortal(
                <AnimatePresence>
                    {infoCard && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-background/90"
                                onClick={() => setInfoCard(null)}
                            />
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                                className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[500px] flex flex-col overflow-hidden"
                            >
                                {(() => {
                                    const activeInfo = cardInfo[infoCard];
                                    if (!activeInfo) return null;
                                    return (
                                        <>
                                            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/10">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-primary text-[20px]">info</span>
                                                    <h2 className="text-lg font-bold text-foreground">{activeInfo.title}</h2>
                                                </div>
                                                <button
                                                    onClick={() => setInfoCard(null)}
                                                    className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                                </button>
                                            </div>
                                            <div className="p-6 overflow-y-auto flex flex-col gap-4 text-body-sm leading-relaxed">
                                                <p className="text-muted-foreground font-medium text-sm">
                                                    {activeInfo.desc}
                                                </p>

                                                <div className="flex flex-col gap-3">
                                                    {activeInfo.sections.map((sec: CardInfoSection, idx: number) => (
                                                        <div key={idx} className="bg-background border border-border rounded-xl p-3">
                                                            <h4 className="font-bold text-foreground text-xs uppercase tracking-wider mb-1">{sec.title}</h4>
                                                            <p className="text-muted-foreground text-[12px]">{sec.text}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </main>
    );
};