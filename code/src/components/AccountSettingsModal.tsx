import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../utils/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { SPRING_ENTER, FADE_ENTER, MODAL_OFFSET_Y } from '../utils/motion';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

const PASSWORD_REQUIREMENTS = [
    { id: 'length', label: 'At least 8 characters', regex: /.{8,}/ },
    { id: 'uppercase', label: 'One uppercase letter', regex: /[A-Z]/ },
    { id: 'lowercase', label: 'One lowercase letter', regex: /[a-z]/ },
    { id: 'number', label: 'One number', regex: /[0-9]/ },
    { id: 'special', label: 'One special character', regex: /[^A-Za-z0-9]/ },
];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string;
    authProvider?: string;
    onSignOut: () => void;
}

export const AccountSettingsModal: React.FC<Props> = ({ isOpen, onClose, userEmail, authProvider = 'email', onSignOut }) => {
    const isGoogleUser = authProvider === 'google';
    const reducedMotion = usePrefersReducedMotion();
    const [name, setName] = useState('');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [showOldPass, setShowOldPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);

    const [savingName, setSavingName] = useState(false);
    const [savingPass, setSavingPass] = useState(false);
    const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const metRequirements = useMemo(() => {
        return PASSWORD_REQUIREMENTS.map(req => ({
            ...req,
            met: req.regex.test(newPassword)
        }));
    }, [newPassword]);

    const passwordStrength = metRequirements.filter(r => r.met).length;
    const passwordsMatch = newPassword === confirmPassword;
    const showPasswordMismatch = confirmPassword.length > 0 && !passwordsMatch;
    const isPasswordValid = passwordStrength === 5 && passwordsMatch && oldPassword.length > 0;

    const handleSaveName = async () => {
        if (!name.trim()) return;
        setSavingName(true);
        setMsg(null);
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { error } = await supabase.from('profiles').upsert({
                id: session.user.id,
                display_name: name.trim(),
                updated_at: new Date().toISOString()
            });
            if (error) setMsg({ text: error.message, type: 'error' });
            else setMsg({ text: 'Display name updated!', type: 'success' });
        }
        setSavingName(false);
    };

    const handleUpdatePassword = async () => {
        if (!isPasswordValid) {
            setMsg({ text: 'Please fill all fields and meet password requirements.', type: 'error' });
            return;
        }
        setSavingPass(true);
        setMsg(null);

        // 1. Verify the old password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: oldPassword,
        });

        if (signInError) {
            setMsg({ text: 'Incorrect old password.', type: 'error' });
            setSavingPass(false);
            return;
        }

        // 2. Update to the new password
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            setMsg({ text: error.message, type: 'error' });
        } else {
            setMsg({ text: 'Password updated successfully!', type: 'success' });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }
        setSavingPass(false);
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/90" onClick={onClose} />
                    <motion.div initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: MODAL_OFFSET_Y }} animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: MODAL_OFFSET_Y }} transition={reducedMotion ? FADE_ENTER : SPRING_ENTER} className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

                        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/10">
                            <h2 className="text-lg font-bold text-foreground">Account Settings</h2>
                            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"><span className="material-symbols-outlined text-[20px]">close</span></button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                            {msg && (
                                <div className={`p-3 text-sm rounded-lg ${msg.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                    {msg.text}
                                </div>
                            )}

                            {/* Profile */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Profile</h3>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Email Address</label>
                                    <input type="text" value={userEmail} disabled className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground cursor-not-allowed" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Display Name</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none" />
                                        <button onClick={handleSaveName} disabled={savingName} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">{savingName ? '...' : 'Save'}</button>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-border" />

                            {/* Security */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Security</h3>
                                
                                {isGoogleUser ? (
                                    <div className="bg-muted/30 border border-border rounded-xl p-4 flex items-start gap-3">
                                        <span className="material-symbols-outlined text-muted-foreground shrink-0">info</span>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Signed in with Google</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Your password is managed securely by your Google account. You cannot change it here.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                {/* Old Password */}
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Current Password</label>
                                    <div className="flex items-center w-full bg-background border border-border px-3 py-2 rounded-lg focus-within:ring-1 focus-within:ring-primary focus-within:border-transparent transition-colors">
                                        <span className="material-symbols-outlined text-[16px] text-muted-foreground mr-2 select-none">lock</span>
                                        <input type={showOldPass ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="••••••••" className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/50 tracking-wider" />
                                        <button type="button" onClick={() => setShowOldPass(!showOldPass)} className="text-muted-foreground hover:text-foreground flex items-center justify-center p-0.5 rounded transition-colors">
                                            <span className="material-symbols-outlined text-[16px]">{showOldPass ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* New Password */}
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">New Password</label>
                                    <div className="flex items-center w-full bg-background border border-border px-3 py-2 rounded-lg focus-within:ring-1 focus-within:ring-primary focus-within:border-transparent transition-colors">
                                        <span className="material-symbols-outlined text-[16px] text-muted-foreground mr-2 select-none">lock_reset</span>
                                        <input type={showNewPass ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/50 tracking-wider" />
                                        <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="text-muted-foreground hover:text-foreground flex items-center justify-center p-0.5 rounded transition-colors">
                                            <span className="material-symbols-outlined text-[16px]">{showNewPass ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                    </div>
                                    
                                    {/* Checklist */}
                                    {newPassword.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                                    <div className={`h-full transition-all duration-300 ${passwordStrength <= 2 ? 'bg-red-500' : passwordStrength <= 4 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${(passwordStrength / 5) * 100}%` }} />
                                                </div>
                                                <span className={`text-[10px] font-bold w-12 text-right ${passwordStrength <= 2 ? 'text-red-500' : passwordStrength <= 4 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                    {passwordStrength <= 2 ? 'Weak' : passwordStrength <= 4 ? 'Fair' : 'Strong'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {metRequirements.map(req => (
                                                    <div key={req.id} className="flex items-center gap-1.5">
                                                        <span className={`material-symbols-outlined text-[12px] ${req.met ? 'text-emerald-500' : 'text-muted-foreground/40'}`}>{req.met ? 'check_circle' : 'circle'}</span>
                                                        <span className={`text-[11px] leading-snug ${req.met ? 'text-foreground' : 'text-muted-foreground/60'}`}>{req.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs text-muted-foreground block">Confirm New Password</label>
                                        {showPasswordMismatch && <span className="text-[10px] text-red-500 font-medium">Passwords do not match.</span>}
                                    </div>
                                    <div className={`flex items-center w-full bg-background border px-3 py-2 rounded-lg focus-within:ring-1 focus-within:ring-primary focus-within:border-transparent transition-colors ${showPasswordMismatch ? 'border-red-500/50' : 'border-border'}`}>
                                        <span className="material-symbols-outlined text-[16px] text-muted-foreground mr-2 select-none">lock_reset</span>
                                        <input type={showConfirmPass ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/50 tracking-wider" />
                                        <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="text-muted-foreground hover:text-foreground flex items-center justify-center p-0.5 rounded transition-colors">
                                            <span className="material-symbols-outlined text-[16px]">{showConfirmPass ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                    </div>
                                </div>

                                <button onClick={handleUpdatePassword} disabled={savingPass || !isPasswordValid} className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all ${savingPass || !isPasswordValid ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:opacity-90'}`}>
                                    {savingPass ? 'Updating...' : 'Update Password'}
                                </button>
                                </>
                                )}
                            </div>

                            <hr className="border-border" />

                            {/* Danger Zone */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider">Danger Zone</h3>
                                <button onClick={onSignOut} className="w-full px-4 py-2 border border-red-500/50 text-red-500 rounded-lg text-sm font-semibold hover:bg-red-500/10 transition-colors">
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};