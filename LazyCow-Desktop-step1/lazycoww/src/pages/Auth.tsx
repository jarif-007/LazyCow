import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useMotionTemplate } from 'motion/react';
import { supabase } from '../utils/supabase';

interface AuthProps {
    onLogin: () => void;
    initialMessage?: string | null;
}

const PASSWORD_REQUIREMENTS = [
    { id: 'length', label: 'At least 8 characters', regex: /.{8,}/ },
    { id: 'uppercase', label: 'One uppercase letter', regex: /[A-Z]/ },
    { id: 'lowercase', label: 'One lowercase letter', regex: /[a-z]/ },
    { id: 'number', label: 'One number', regex: /[0-9]/ },
    { id: 'special', label: 'One special character', regex: /[^A-Za-z0-9]/ },
];

export const Auth: React.FC<AuthProps> = ({ onLogin, initialMessage }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(initialMessage || null);

    // If we arrive here after a password reset, automatically focus the email
    // input so the user can immediately start typing their new password.
    useEffect(() => {
        if (initialMessage) {
            setTimeout(() => {
                document.getElementById('auth-email-input')?.focus();
            }, 100);
        }
    }, [initialMessage]);

    // Focus State for Dynamic Layout
    const [isFormFocused, setIsFormFocused] = useState(false);

    // --- Cursor-Following Light Logic ---
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
    const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });
    const backgroundLight = useMotionTemplate`radial-gradient(
    circle 600px at ${springX}px ${springY}px, 
    hsl(var(--primary) / 0.08), 
    transparent 80%
  )`;

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left);
        mouseY.set(e.clientY - rect.top);
    };

    // --- Validation Logic ---
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const metRequirements = useMemo(() => {
        return PASSWORD_REQUIREMENTS.map(req => ({
            ...req,
            met: req.regex.test(password)
        }));
    }, [password]);

    const passwordStrength = metRequirements.filter(r => r.met).length;

    const passwordsMatch = password === confirmPassword;
    const showPasswordMismatch = confirmPassword.length > 0 && !passwordsMatch;

    // Centralized validation to prevent silent submit failures
    const isFormValid = 
        isEmailValid && 
        password.length > 0 && 
        (isLogin || (passwordStrength === 5 && passwordsMatch));

    const handleTabSwitch = (toLogin: boolean, preserveEmail = false) => {
        setIsLogin(toLogin);
        // Clear fields, but optionally keep the email if requested
        if (!preserveEmail) setEmail('');
        setPassword('');
        setConfirmPassword('');
        setAuthError(null);
        setSuccessMsg(null);
    };

    const handleGoogleLogin = async () => {
        setAuthError(null);
        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: 'http://localhost:54321/auth/callback',
                    skipBrowserRedirect: true,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });

            if (error) throw error;
            if (data?.url) {
                // Open the Google login page in the user's default browser
                await window.electronAPI?.openExternalUrl(data.url);
            }
        } catch (err) {
            setAuthError(err instanceof Error ? err.message : 'Google sign-in failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!isEmailValid) {
            setAuthError("Enter a valid email address first.");
            return;
        }
        setIsSubmitting(true);
        setAuthError(null);
        setSuccessMsg(null);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: 'http://localhost:54321/auth/callback',
            });
            if (error) throw error;
            setSuccessMsg("If an account exists for that email, a reset link has been sent. Please check your inbox.");
        } catch (err) {
            setAuthError(err instanceof Error ? err.message : "Failed to send reset email.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendEmail = async () => {
        if (!email.trim()) return;
        setIsSubmitting(true);
        setAuthError(null);
        setSuccessMsg(null);

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email.trim(),
            options: {
                emailRedirectTo: 'http://localhost:54321/auth/callback'
            }
        });

        if (error) {
            setAuthError(error.message);
        } else {
            setSuccessMsg("Confirmation email resent! Please check your inbox.");
        }
        setIsSubmitting(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid) return;
        setAuthError(null);
        setSuccessMsg(null);

        // Sanitize email to prevent trailing space errors
        const cleanEmail = email.trim();

        if (isLogin) {
            setIsSubmitting(true);

            const { error } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password,
            });

            if (error) {
                if (error.message === 'Invalid login credentials') {
                    setAuthError("INVALID_CREDENTIALS");
                } else if (error.message === 'Email not confirmed') {
                    // Catch the unconfirmed user edge case
                    setAuthError("EMAIL_NOT_CONFIRMED");
                } else if (error.message.includes('rate limit')) {
                    setAuthError("Too many attempts. Please wait a few minutes before trying again.");
                } else {
                    setAuthError(error.message);
                }
                setIsSubmitting(false);
            } else {
                setIsSubmitting(false);
                onLogin();
            }
        } else {
            if (passwordStrength < 5 || !passwordsMatch) return;
            setIsSubmitting(true);

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: 'http://localhost:54321/auth/callback'
                }
            });

            if (error) {
                if (error.message.includes('rate limit')) {
                    setAuthError("Email rate limit exceeded. Please wait a few minutes or use a different email.");
                } else {
                    setAuthError(error.message);
                }
                setIsSubmitting(false);
            } else if (data?.user?.identities?.length === 0) {
                // Supabase obfuscates existing emails for security. 
                // We catch the empty identities array to show a real error.
                setAuthError("EMAIL_EXISTS");
                // Do NOT set isLogin(true) here. Keep them on the Create Account page.
                setPassword('');
                setConfirmPassword('');
                setIsSubmitting(false);
            } else {
                setIsSubmitting(false);
                setIsLogin(true);
                if (!data.session) {
                    setSuccessMsg("Account created! Please check your email to confirm before signing in.");
                } else {
                    await supabase.auth.signOut();
                    setSuccessMsg("Account created successfully! Please sign in.");
                }
            }
        }
    };

    const getStrengthColor = () => {
        if (password.length === 0) return 'bg-muted';
        if (passwordStrength <= 2) return 'bg-red-500';
        if (passwordStrength <= 4) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    const getStrengthWidth = () => {
        if (password.length === 0) return '0%';
        return `${(passwordStrength / 5) * 100}%`;
    };

    return (
        <div className="flex-1 w-full h-full flex flex-col lg:flex-row bg-background overflow-hidden relative">

            {/* LEFT COLUMN (Value Proposition) */}
            <motion.div
                onMouseMove={handleMouseMove}
                animate={{
                    width: isFormFocused ? '0%' : '45%',
                    opacity: isFormFocused ? 0 : 1,
                    borderRightWidth: isFormFocused ? 0 : 1
                }}
                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                className="hidden lg:flex flex-col justify-center bg-muted/5 relative overflow-hidden select-none border-border"
            >
                <motion.div className="absolute inset-0 pointer-events-none" style={{ background: backgroundLight }} />

                {/* Inner container with fixed width to prevent content squishing during animation */}
                <div className="relative z-10 w-[45vw] max-w-[500px] p-12 mx-auto">
                    <div id="auth-logo" className="flex items-center gap-3 mb-8">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 9.75 240.10000610351562 46.20000076293945" className="h-[38px] w-auto shrink-0 fill-current text-primary transition-colors duration-300">
                            <path d="M10.35 42.20Q11.75 42.20 13.03 41.95Q14.30 41.70 16.05 41.25Q18 40.70 19.53 40.42Q21.05 40.15 22.85 40.15L22.85 45.25L5.85 45.25Q4.55 45.25 2.85 45.08Q1.15 44.90 0 44.50L0 43.70Q1.50 43.70 2.13 40.75Q2.75 37.80 2.75 32.60L2.75 22.25L2.75 16.60Q2.75 14 2.60 12.98Q2.45 11.95 2.03 11.63Q1.60 11.30 0.50 11.30L0.50 10.50Q2.70 9.75 5.85 9.75Q9 9.75 11.20 10.50L11.20 11.30Q10.10 11.30 9.68 11.63Q9.25 11.95 9.10 12.98Q8.95 14 8.95 16.60L8.95 22.25L8.95 32.60Q8.95 39.75 10.05 42.20L10.35 42.20ZM52 39.15Q52 41.60 52.60 42.65Q53.20 43.70 54.75 43.70L54.75 44.50Q53.60 44.90 51.98 45.08Q50.35 45.25 49.40 45.25Q45.65 45.25 44.70 42.40Q41.70 45.25 37.15 45.25Q34.70 45.25 32.38 44.27Q30.05 43.30 28.45 40.88Q26.85 38.45 26.85 34.40Q26.85 30.20 28.90 26.85Q30.95 23.50 34.35 21.63Q37.75 19.75 41.65 19.75Q46.50 19.75 49.25 22.20Q52 24.65 52 29.70L52 39.15M38.40 41.45Q40.70 41.45 42.65 39.58Q44.60 37.70 45.60 33.75Q46.30 30.50 46.30 28.50Q46.30 25.75 45.18 24.47Q44.05 23.20 41.85 23.20Q39.10 23.20 37.10 24.85Q35.10 26.50 34.05 29.05Q33 31.60 33 34.25Q33 37.30 34.40 39.38Q35.80 41.45 38.40 41.45ZM85.30 39.10Q83.25 42.80 79.85 44.15Q76.45 45.50 72.85 45.50Q71.80 45.50 70.47 45.35Q69.15 45.20 68.65 45.15Q65.55 44.75 64.10 44.75Q62 44.75 60.60 45.25L58.75 43.55Q60.80 42.80 64.05 38.55L75.35 22.75Q74.35 22.75 72.25 22.65Q70.15 22.60 69.15 22.67Q68.15 22.75 67.53 23.17Q66.90 23.60 66.90 24.55Q66.90 25.80 65.97 26.52Q65.05 27.25 63.80 27.25Q62.50 27.25 61.50 26.47Q60.50 25.70 60.50 24.30Q60.50 22 62.63 20.88Q64.75 19.75 68.30 19.75Q70.10 19.75 72.50 20Q73 20.05 74.38 20.15Q75.75 20.25 76.95 20.25Q78.60 20.25 79.95 20.05L81.55 19.75L83.35 20.45L69.35 40.55Q68.50 41.75 67.45 42.55Q68.80 42.55 69.45 42.60L71.45 42.65Q74.30 42.65 76.40 41.05Q78.50 39.45 79.85 35.40L85.30 39.10ZM108.25 22.35Q108.25 20.85 108.90 20.30Q109.55 19.75 110.85 19.75Q111.40 19.75 113.20 19.95Q115.85 20.20 116.70 20.20L116.70 21.10Q115.45 21.10 114.95 22.38Q114.45 23.65 114.45 25.50L114.45 36.75Q114.40 46.30 111.22 51.13Q108.05 55.95 100.60 55.95Q99.10 55.95 98.15 55.17Q97.20 54.40 95.95 52.65Q95.55 52.05 95.05 51.45L95.05 50.70Q101.15 50.70 104.10 48.65Q107.05 46.60 107.85 41.95Q105.55 45.25 100.90 45.25Q97.15 45.25 94.63 43.23Q92.10 41.20 92.05 35.55L92.05 27Q92.05 22.60 89.30 22.60L89.30 21.70Q93.35 19.75 95.40 19.75Q96.80 19.75 97.53 20.72Q98.25 21.70 98.25 23.80L98.25 35.45Q98.25 41.45 102 41.45Q104.55 41.45 106.25 39.35Q107.95 37.25 108.25 33.10L108.25 22.35ZM152.80 40.30Q150.20 42.60 146.60 43.92Q143 45.25 139.15 45.25Q133.10 45.25 128.95 42.88Q124.80 40.50 122.75 36.45Q120.70 32.40 120.70 27.35Q120.70 22.85 122.67 18.82Q124.65 14.80 128.78 12.27Q132.90 9.75 139.10 9.75Q142.75 9.75 145.78 10.88Q148.80 12 150.53 13.95Q152.25 15.90 152.25 18.25Q152.25 19.70 151.25 20.52Q150.25 21.35 148.90 21.35Q147.65 21.35 146.75 20.57Q145.85 19.80 145.85 18.40Q145.85 17 145.05 15.72Q144.25 14.45 142.72 13.67Q141.20 12.90 139.10 12.90Q133.60 12.90 130.55 16.95Q127.50 21 127.50 27.70Q127.50 31.85 129.15 35.02Q130.80 38.20 133.47 39.90Q136.15 41.60 139.15 41.60Q141.30 41.60 142.97 40.88Q144.65 40.15 146.03 38.95Q147.40 37.75 149.65 35.40L152.80 40.30ZM170.30 19.75Q174.80 19.75 178.23 21.35Q181.65 22.95 183.53 25.82Q185.40 28.70 185.40 32.45Q185.40 36.20 183.53 39.02Q181.65 41.85 178.60 43.40Q175.55 44.95 172.10 45.20Q171.65 45.25 170.70 45.25Q167.15 45.20 163.95 43.70Q160.75 42.20 158.78 39.27Q156.80 36.35 156.80 32.35Q156.80 28.60 158.63 25.75Q160.45 22.90 163.55 21.32Q166.65 19.75 170.30 19.75M171.75 41.50Q175.15 41.50 177.23 39.25Q179.30 37 179.30 33.60Q179.30 31.80 178.70 29.95Q177.55 26.30 175.25 24.72Q172.95 23.15 170.50 23.15Q167.10 23.15 165.10 25.45Q163.10 27.75 163.10 31.20Q163.10 33.10 163.65 34.75Q164.70 38.25 167 39.88Q169.30 41.50 171.75 41.50ZM220.90 20.20Q221.80 20.20 224.40 19.95Q226.20 19.75 226.75 19.75Q228.05 19.75 228.70 20.30Q229.35 20.85 229.35 22.35L229.35 25.55Q229.35 36.05 225.88 40.65Q222.40 45.25 217.15 45.25Q212 45.25 209.60 41.60Q208.05 43.50 206 44.38Q203.95 45.25 201.65 45.25Q197.45 45.25 194.80 42.55Q192.15 39.85 192.15 33.35L192.15 27Q192.15 22.60 189.40 22.60L189.40 21.70Q193.45 19.75 195.50 19.75Q196.90 19.75 197.63 20.72Q198.35 21.70 198.35 23.80L198.35 33.35Q198.35 37.35 199.22 39.40Q200.10 41.45 202.10 41.45Q207.45 41.45 207.65 26.60Q207.55 22.60 204.90 22.60L204.90 21.70Q208.95 19.75 211 19.75Q212.40 19.75 213.13 20.72Q213.85 21.70 213.85 23.80L213.85 33.35Q213.85 37.35 214.73 39.40Q215.60 41.45 217.60 41.45Q223.15 41.45 223.15 25.55Q223.15 23.65 222.65 22.38Q222.15 21.10 220.90 21.10L220.90 20.20ZM236.75 45Q235.35 45 234.35 44Q233.35 43 233.35 41.60Q233.35 40.20 234.35 39.23Q235.35 38.25 236.75 38.25Q238.15 38.25 239.13 39.23Q240.10 40.20 240.10 41.60Q240.10 43 239.13 44Q238.15 45 236.75 45Z" />
                        </svg>
                        <span className="text-3xl font-bold text-foreground tracking-tight mt-0.5 shrink-0">Cloud</span>
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4 leading-tight">
                        Your workspace, <br /> everywhere you go.
                    </h1>
                    <p className="text-sm text-muted-foreground mb-10 leading-relaxed max-w-xs">
                        Sync your shortcuts across all your Windows devices and share your best workflows with the community.
                    </p>

                    <div className="space-y-6 max-w-xs">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 shadow-sm">
                                <span className="material-symbols-outlined text-primary text-[20px]">sync</span>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Automatic Cloud Sync</h3>
                                <p className="text-xs text-muted-foreground mt-1">Background backup for hotkeys, scripts, and layouts.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 shadow-sm">
                                <span className="material-symbols-outlined text-primary text-[20px]">groups</span>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Community Marketplace</h3>
                                <p className="text-xs text-muted-foreground mt-1">Publish workflows and install community plugins.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 shadow-sm">
                                <span className="material-symbols-outlined text-primary text-[20px]">devices</span>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Multi-Device Support</h3>
                                <p className="text-xs text-muted-foreground mt-1">Access your library from Desktop, Surface, or Laptop.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* RIGHT COLUMN (Auth Form) */}
            <div
                className="flex-1 flex flex-col h-full overflow-y-auto bg-background [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                onFocusCapture={() => setIsFormFocused(true)}
                onBlurCapture={(e) => {
                    // Only blur if focus is moving outside the form container
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                        setIsFormFocused(false);
                    }
                }}
            >
                <div className="w-full max-w-[400px] mx-auto my-auto p-6 transition-all duration-300">

                    <div id="auth-logo-mobile" className="lg:hidden flex items-center justify-center gap-2 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 9.75 240.10000610351562 46.20000076293945" className="h-[30px] w-auto shrink-0 fill-current text-primary">
                            <path d="M10.35 42.20Q11.75 42.20 13.03 41.95Q14.30 41.70 16.05 41.25Q18 40.70 19.53 40.42Q21.05 40.15 22.85 40.15L22.85 45.25L5.85 45.25Q4.55 45.25 2.85 45.08Q1.15 44.90 0 44.50L0 43.70Q1.50 43.70 2.13 40.75Q2.75 37.80 2.75 32.60L2.75 22.25L2.75 16.60Q2.75 14 2.60 12.98Q2.45 11.95 2.03 11.63Q1.60 11.30 0.50 11.30L0.50 10.50Q2.70 9.75 5.85 9.75Q9 9.75 11.20 10.50L11.20 11.30Q10.10 11.30 9.68 11.63Q9.25 11.95 9.10 12.98Q8.95 14 8.95 16.60L8.95 22.25L8.95 32.60Q8.95 39.75 10.05 42.20L10.35 42.20ZM52 39.15Q52 41.60 52.60 42.65Q53.20 43.70 54.75 43.70L54.75 44.50Q53.60 44.90 51.98 45.08Q50.35 45.25 49.40 45.25Q45.65 45.25 44.70 42.40Q41.70 45.25 37.15 45.25Q34.70 45.25 32.38 44.27Q30.05 43.30 28.45 40.88Q26.85 38.45 26.85 34.40Q26.85 30.20 28.90 26.85Q30.95 23.50 34.35 21.63Q37.75 19.75 41.65 19.75Q46.50 19.75 49.25 22.20Q52 24.65 52 29.70L52 39.15M38.40 41.45Q40.70 41.45 42.65 39.58Q44.60 37.70 45.60 33.75Q46.30 30.50 46.30 28.50Q46.30 25.75 45.18 24.47Q44.05 23.20 41.85 23.20Q39.10 23.20 37.10 24.85Q35.10 26.50 34.05 29.05Q33 31.60 33 34.25Q33 37.30 34.40 39.38Q35.80 41.45 38.40 41.45ZM85.30 39.10Q83.25 42.80 79.85 44.15Q76.45 45.50 72.85 45.50Q71.80 45.50 70.47 45.35Q69.15 45.20 68.65 45.15Q65.55 44.75 64.10 44.75Q62 44.75 60.60 45.25L58.75 43.55Q60.80 42.80 64.05 38.55L75.35 22.75Q74.35 22.75 72.25 22.65Q70.15 22.60 69.15 22.67Q68.15 22.75 67.53 23.17Q66.90 23.60 66.90 24.55Q66.90 25.80 65.97 26.52Q65.05 27.25 63.80 27.25Q62.50 27.25 61.50 26.47Q60.50 25.70 60.50 24.30Q60.50 22 62.63 20.88Q64.75 19.75 68.30 19.75Q70.10 19.75 72.50 20Q73 20.05 74.38 20.15Q75.75 20.25 76.95 20.25Q78.60 20.25 79.95 20.05L81.55 19.75L83.35 20.45L69.35 40.55Q68.50 41.75 67.45 42.55Q68.80 42.55 69.45 42.60L71.45 42.65Q74.30 42.65 76.40 41.05Q78.50 39.45 79.85 35.40L85.30 39.10ZM108.25 22.35Q108.25 20.85 108.90 20.30Q109.55 19.75 110.85 19.75Q111.40 19.75 113.20 19.95Q115.85 20.20 116.70 20.20L116.70 21.10Q115.45 21.10 114.95 22.38Q114.45 23.65 114.45 25.50L114.45 36.75Q114.40 46.30 111.22 51.13Q108.05 55.95 100.60 55.95Q99.10 55.95 98.15 55.17Q97.20 54.40 95.95 52.65Q95.55 52.05 95.05 51.45L95.05 50.70Q101.15 50.70 104.10 48.65Q107.05 46.60 107.85 41.95Q105.55 45.25 100.90 45.25Q97.15 45.25 94.63 43.23Q92.10 41.20 92.05 35.55L92.05 27Q92.05 22.60 89.30 22.60L89.30 21.70Q93.35 19.75 95.40 19.75Q96.80 19.75 97.53 20.72Q98.25 21.70 98.25 23.80L98.25 35.45Q98.25 41.45 102 41.45Q104.55 41.45 106.25 39.35Q107.95 37.25 108.25 33.10L108.25 22.35ZM152.80 40.30Q150.20 42.60 146.60 43.92Q143 45.25 139.15 45.25Q133.10 45.25 128.95 42.88Q124.80 40.50 122.75 36.45Q120.70 32.40 120.70 27.35Q120.70 22.85 122.67 18.82Q124.65 14.80 128.78 12.27Q132.90 9.75 139.10 9.75Q142.75 9.75 145.78 10.88Q148.80 12 150.53 13.95Q152.25 15.90 152.25 18.25Q152.25 19.70 151.25 20.52Q150.25 21.35 148.90 21.35Q147.65 21.35 146.75 20.57Q145.85 19.80 145.85 18.40Q145.85 17 145.05 15.72Q144.25 14.45 142.72 13.67Q141.20 12.90 139.10 12.90Q133.60 12.90 130.55 16.95Q127.50 21 127.50 27.70Q127.50 31.85 129.15 35.02Q130.80 38.20 133.47 39.90Q136.15 41.60 139.15 41.60Q141.30 41.60 142.97 40.88Q144.65 40.15 146.03 38.95Q147.40 37.75 149.65 35.40L152.80 40.30ZM170.30 19.75Q174.80 19.75 178.23 21.35Q181.65 22.95 183.53 25.82Q185.40 28.70 185.40 32.45Q185.40 36.20 183.53 39.02Q181.65 41.85 178.60 43.40Q175.55 44.95 172.10 45.20Q171.65 45.25 170.70 45.25Q167.15 45.20 163.95 43.70Q160.75 42.20 158.78 39.27Q156.80 36.35 156.80 32.35Q156.80 28.60 158.63 25.75Q160.45 22.90 163.55 21.32Q166.65 19.75 170.30 19.75M171.75 41.50Q175.15 41.50 177.23 39.25Q179.30 37 179.30 33.60Q179.30 31.80 178.70 29.95Q177.55 26.30 175.25 24.72Q172.95 23.15 170.50 23.15Q167.10 23.15 165.10 25.45Q163.10 27.75 163.10 31.20Q163.10 33.10 163.65 34.75Q164.70 38.25 167 39.88Q169.30 41.50 171.75 41.50ZM220.90 20.20Q221.80 20.20 224.40 19.95Q226.20 19.75 226.75 19.75Q228.05 19.75 228.70 20.30Q229.35 20.85 229.35 22.35L229.35 25.55Q229.35 36.05 225.88 40.65Q222.40 45.25 217.15 45.25Q212 45.25 209.60 41.60Q208.05 43.50 206 44.38Q203.95 45.25 201.65 45.25Q197.45 45.25 194.80 42.55Q192.15 39.85 192.15 33.35L192.15 27Q192.15 22.60 189.40 22.60L189.40 21.70Q193.45 19.75 195.50 19.75Q196.90 19.75 197.63 20.72Q198.35 21.70 198.35 23.80L198.35 33.35Q198.35 37.35 199.22 39.40Q200.10 41.45 202.10 41.45Q207.45 41.45 207.65 26.60Q207.55 22.60 204.90 22.60L204.90 21.70Q208.95 19.75 211 19.75Q212.40 19.75 213.13 20.72Q213.85 21.70 213.85 23.80L213.85 33.35Q213.85 37.35 214.73 39.40Q215.60 41.45 217.60 41.45Q223.15 41.45 223.15 25.55Q223.15 23.65 222.65 22.38Q222.15 21.10 220.90 21.10L220.90 20.20ZM236.75 45Q235.35 45 234.35 44Q233.35 43 233.35 41.60Q233.35 40.20 234.35 39.23Q235.35 38.25 236.75 38.25Q238.15 38.25 239.13 39.23Q240.10 40.20 240.10 41.60Q240.10 43 239.13 44Q238.15 45 236.75 45Z" />
                        </svg>
                        <span className="text-2xl font-bold text-foreground tracking-tight translate-y-[-1px] shrink-0">Cloud</span>
                    </div>

                    <div className="p-1 rounded-xl bg-muted/50 flex items-center mb-4 border border-border/50">
                        <button
                            onClick={() => handleTabSwitch(true)}
                            className={`flex-1 py-1.5 text-center rounded-lg font-semibold text-sm transition-colors ${isLogin ? 'bg-card shadow-sm text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => handleTabSwitch(false)}
                            className={`flex-1 py-1.5 text-center rounded-lg font-semibold text-sm transition-colors ${!isLogin ? 'bg-card shadow-sm text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Create Account
                        </button>
                    </div>

                    <motion.div id="auth-form-container" layout className="w-full relative">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.form
                                key={isLogin ? 'login' : 'register'}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                className="flex flex-col gap-3 w-full"
                                onSubmit={handleSubmit}
                            >
                                {/* Email Field */}
                                <div className="flex flex-col gap-1 text-left">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-foreground">Email address</label>
                                        {email.includes('@') && !isEmailValid && (
                                            <span className="text-[11px] font-body-sm font-medium text-red-500">Invalid email address format.</span>
                                        )}
                                    </div>
                                    <div className={`flex items-center w-full bg-background border px-3 py-2 rounded-xl focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-colors ${email.length > 0 && !isEmailValid ? 'border-red-500/50' : 'border-border'}`}>
                                        <span className="material-symbols-outlined text-[16px] text-muted-foreground mr-2 select-none">mail</span>
                                        <input
                                            type="email"
                                            id="auth-email-input"
                                            placeholder="name@example.com"
                                            required
                                            disabled={isSubmitting}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onBlur={() => setEmail(email.trim())}
                                            className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                {/* Password Field */}
                                <div className="flex flex-col gap-1.5 text-left">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-foreground">Password</label>
                                        {isLogin && (
                                            <button
                                                type="button"
                                                onClick={handleForgotPassword}
                                                disabled={isSubmitting}
                                                className="text-[10px] text-primary font-medium hover:underline transition-colors disabled:opacity-50"
                                            >
                                                Forgot?
                                            </button>
                                        )}
                                    </div>
                                    <div className={`flex items-center w-full bg-background border px-3 py-2 rounded-xl focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-colors ${!isLogin && password.length > 0 && passwordStrength < 5 ? 'border-amber-500/50' : 'border-border'}`}>
                                        <span className="material-symbols-outlined text-[16px] text-muted-foreground mr-2 select-none">lock</span>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/50 tracking-wider"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="text-muted-foreground hover:text-foreground flex items-center justify-center p-0.5 rounded transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">
                                                {showPassword ? 'visibility_off' : 'visibility'}
                                            </span>
                                        </button>
                                    </div>

                                    {/* Password Strength & Checklist */}
                                    {!isLogin && password.length > 0 && (
                                        <div className="mt-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                                    <motion.div
                                                        className={`h-full ${getStrengthColor()}`}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: getStrengthWidth() }}
                                                        transition={{ duration: 0.3 }}
                                                    />
                                                </div>
                                                <span className={`text-[10px] font-bold w-12 text-right ${passwordStrength <= 2 ? 'text-red-500' : passwordStrength <= 4 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                    {passwordStrength <= 2 ? 'Weak' : passwordStrength <= 4 ? 'Fair' : 'Strong'}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5">
                                                {metRequirements.map(req => (
                                                    <div key={req.id} className="flex items-center gap-1.5">
                                                        <span className={`material-symbols-outlined text-[12px] ${req.met ? 'text-emerald-500' : 'text-muted-foreground/40'}`}>
                                                            {req.met ? 'check_circle' : 'circle'}
                                                        </span>
                                                        <span className={`text-[11px] font-body-sm leading-snug ${req.met ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                                                            {req.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                {!isLogin && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="flex flex-col gap-1.5 text-left"
                                    >
                                        <div className="flex items-center justify-between mt-0.5">
                                            <label className="text-xs font-semibold text-foreground">Confirm Password</label>
                                            {showPasswordMismatch && (
                                                <span className="text-[11px] font-body-sm font-medium text-red-500">Passwords do not match.</span>
                                            )}
                                        </div>
                                        <div className={`flex items-center w-full bg-background border px-3 py-2 rounded-xl focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-colors ${showPasswordMismatch ? 'border-red-500/50' : 'border-border'}`}>
                                            <span className="material-symbols-outlined text-[16px] text-muted-foreground mr-2 select-none">lock_reset</span>
                                            <input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                required={!isLogin}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/50 tracking-wider"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="text-muted-foreground hover:text-foreground flex items-center justify-center p-0.5 rounded transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">
                                                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                                                </span>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Success Message */}
                                {successMsg && (
                                    <div className="text-emerald-500 text-xs text-center font-medium bg-emerald-500/10 p-2 rounded-lg mt-2">
                                        {successMsg}
                                    </div>
                                )}

                                {/* Error Message */}
                                {authError === "INVALID_CREDENTIALS" ? (
                                    <div className="text-red-500 text-xs text-center font-medium bg-red-500/10 p-2 rounded-lg mt-2 flex flex-col gap-2 items-center">
                                        <span>Invalid email or password.</span>
                                        <div className="flex flex-col gap-1">
                                            <button 
                                                type="button"
                                                onClick={handleForgotPassword}
                                                className="underline font-bold hover:text-red-400 transition-colors"
                                            >
                                                Forgot your password?
                                            </button>
                                            <span className="text-[11px] text-red-400/80">
                                                (If you signed up with Google, click here to set a password for email login.)
                                            </span>
                                        </div>
                                        <div className="w-full h-px bg-red-500/20 my-1" />
                                        <button 
                                            type="button"
                                            onClick={() => handleTabSwitch(false)}
                                            className="underline font-bold hover:text-red-400 transition-colors"
                                        >
                                            Don't have an account? Create one.
                                        </button>
                                    </div>
                                ) : authError === "EMAIL_EXISTS" ? (
                                    <div className="text-red-500 text-xs text-center font-medium bg-red-500/10 p-2 rounded-lg mt-2 flex flex-col gap-1 items-center">
                                        <span>This email is already registered.</span>
                                        <button 
                                            type="button"
                                            onClick={() => handleTabSwitch(true, true)}
                                            className="underline font-bold hover:text-red-400 transition-colors"
                                        >
                                            Please sign in instead.
                                        </button>
                                    </div>
                                ) : authError === "EMAIL_NOT_CONFIRMED" ? (
                                    <div className="text-amber-500 text-xs text-center font-medium bg-amber-500/10 p-2 rounded-lg mt-2 flex flex-col gap-2 items-center">
                                        <span>Please confirm your email address before signing in.</span>
                                        <button 
                                            type="button"
                                            onClick={handleResendEmail}
                                            className="bg-amber-500 text-white px-3 py-1 rounded-md hover:bg-amber-600 transition-colors font-bold"
                                        >
                                            Resend Confirmation Email
                                        </button>
                                    </div>
                                ) : authError ? (
                                    <div className="text-red-500 text-xs text-center font-medium bg-red-500/10 p-2 rounded-lg mt-2">
                                        {authError}
                                    </div>
                                ) : null}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !isFormValid}
                                    className={`w-full mt-2 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                                        isSubmitting || !isFormValid
                                            ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70'
                                            : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.99]'
                                    }`}
                                >
                                    {isSubmitting ? (
                                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                    ) : (
                                        <span className="material-symbols-outlined text-[18px]">{isLogin ? 'login' : 'person_add'}</span>
                                    )}
                                    <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                                </button>

                                {/* Divider */}
                                <div className="flex items-center gap-3 mt-2">
                                    <div className="h-px bg-border flex-1" />
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Or continue with</span>
                                    <div className="h-px bg-border flex-1" />
                                </div>

                                {/* Google Button */}
                                <button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    disabled={isSubmitting}
                                    className="w-full py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            fill="#4285F4"
                                        />
                                        <path
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            fill="#34A853"
                                        />
                                        <path
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            fill="#FBBC05"
                                        />
                                        <path
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            fill="#EA4335"
                                        />
                                    </svg>
                                    Google
                                </button>
                            </motion.form>
                        </AnimatePresence>
                    </motion.div>



                    <div className="mt-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md">
                            <span className="material-symbols-outlined text-[12px]">lock</span>
                            <span>End-to-end encrypted</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};