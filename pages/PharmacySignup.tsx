/**
 * PharmacySignup.tsx  (add to your pages/ folder)
 * ─────────────────────────────────────────────────────────────────
 * Route: /pharmacy-signup?token=<invite_token>
 *
 * Add to App.tsx Routes:
 *   import PharmacySignup from './pages/PharmacySignup';
 *   <Route path="/pharmacy-signup" element={<PharmacySignup />} />
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/db';
import { Pill, Store, ShieldCheck, Eye, EyeOff, AlertTriangle, CheckCircle, Loader } from 'lucide-react';

type Step = 'validating' | 'invalid' | 'form' | 'creating' | 'success';

interface InviteData {
    clinic_id: string;
    clinic_name?: string;
    expires_at: string;
}

const PharmacySignup: React.FC = () => {
    const token = new URLSearchParams(window.location.search).get('token');

    const [step, setStep] = useState<Step>('validating');
    const [inviteData, setInviteData] = useState<InviteData | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [form, setForm] = useState({
        pharmacyName: '',
        phone: '',
        address: '',
        email: '',
        password: '',
    });

    // ── Step 1: Validate token on mount ──
    useEffect(() => {
        if (!token) {
            setStep('invalid');
            setErrorMsg('No invite token found in URL. Ask your doctor to resend the link.');
            return;
        }
        validateToken();
    }, []);

    const validateToken = async () => {
        try {
            const { data, error } = await supabase
                .from('pharmacy_invites')
                .select('clinic_id, status, expires_at')
                .eq('token', token)
                .single();

            if (error || !data) {
                setStep('invalid');
                setErrorMsg('This invite link is invalid or has already been used.');
                return;
            }

            if (data.status !== 'pending') {
                setStep('invalid');
                setErrorMsg(
                    data.status === 'used'
                        ? 'This invite has already been used. Ask your doctor for a new link.'
                        : 'This invite has expired. Ask your doctor for a new link.'
                );
                return;
            }

            if (new Date(data.expires_at) < new Date()) {
                setStep('invalid');
                setErrorMsg('This invite link has expired (48 hour limit). Ask your doctor to generate a new one.');
                return;
            }

            // Fetch clinic name for display
            const { data: clinic } = await supabase
                .from('clinics')
                .select('name')
                .eq('id', data.clinic_id)
                .single();

            setInviteData({
                clinic_id: data.clinic_id,
                clinic_name: clinic?.name,
                expires_at: data.expires_at,
            });
            setStep('form');
        } catch (err) {
            setStep('invalid');
            setErrorMsg('Something went wrong. Please try the link again.');
        }
    };

    // ── Step 2: Create account ──
    const handleSubmit = async () => {
        if (!form.pharmacyName.trim() || !form.email.trim() || !form.password.trim()) {
            setErrorMsg('Please fill in all required fields.');
            return;
        }
        if (form.password.length < 8) {
            setErrorMsg('Password must be at least 8 characters.');
            return;
        }

        setStep('creating');
        setErrorMsg('');

        try {
            // 1. Create Supabase auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: {
                    data: { full_name: form.pharmacyName, role: 'pharmacy_staff' },
                },
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('No user returned from signup');

            // 2. Create profile row FIRST (redeem_pharmacy_invite will update it)
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    full_name: form.pharmacyName,
                    role: 'pharmacy_staff',
                    clinic_id: inviteData!.clinic_id,
                });

            if (profileError && profileError.code !== '23505') {
                // 23505 = unique violation = profile already exists, fine to ignore
                throw profileError;
            }

            // 3. Redeem the invite — this creates pharmacy row + binds profile
            const { data: redeemResult, error: redeemError } = await supabase
                .rpc('redeem_pharmacy_invite', {
                    p_token: token,
                    p_user_id: authData.user.id,
                    p_pharmacy_name: form.pharmacyName,
                    p_phone: form.phone || null,
                    p_address: form.address || null,
                });

            if (redeemError) throw redeemError;
            if (redeemResult?.error) throw new Error(redeemResult.error);

            setStep('success');
        } catch (err: any) {
            setErrorMsg(err.message || 'Account creation failed. Please try again.');
            setStep('form');
        }
    };

    const updateForm = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(prev => ({ ...prev, [field]: e.target.value }));

    // ── Render states ──

    if (step === 'validating') {
        return (
            <Screen>
                <div className="flex flex-col items-center gap-4 py-12">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center animate-pulse">
                        <ShieldCheck size={24} className="text-white" />
                    </div>
                    <p className="text-sm font-medium text-slate-600">Validating your invite link…</p>
                </div>
            </Screen>
        );
    }

    if (step === 'invalid') {
        return (
            <Screen>
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center">
                        <AlertTriangle size={28} className="text-rose-500" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 text-lg mb-1">Invalid Invite Link</h2>
                        <p className="text-sm text-slate-500 max-w-sm">{errorMsg}</p>
                    </div>
                </div>
            </Screen>
        );
    }

    if (step === 'success') {
        return (
            <Screen>
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                        <CheckCircle size={28} className="text-white" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 text-xl mb-1">You're all set! 🎉</h2>
                        <p className="text-sm text-slate-500 max-w-sm">
                            Your pharmacy is now linked to <strong>{inviteData?.clinic_name}</strong>.
                            Prescriptions will appear on your dashboard instantly.
                        </p>
                    </div>
                    <a
                        href="/pharmacy-portal"
                        className="mt-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-sm transition-colors shadow-md shadow-indigo-200"
                    >
                        Open Pharmacy Dashboard →
                    </a>
                </div>
            </Screen>
        );
    }

    return (
        <Screen>
            {/* Clinic badge */}
            {inviteData?.clinic_name && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 rounded-xl border border-indigo-100 mb-6">
                    <ShieldCheck size={14} className="text-indigo-500 flex-shrink-0" />
                    <p className="text-xs text-slate-600">
                        You're joining as the pharmacy for <strong className="text-indigo-700">{inviteData.clinic_name}</strong>
                    </p>
                </div>
            )}

            <div className="space-y-4">
                <Field label="Pharmacy / Store Name *" placeholder="e.g. Sharma Medical Store">
                    <input
                        value={form.pharmacyName}
                        onChange={updateForm('pharmacyName')}
                        placeholder="e.g. Sharma Medical Store"
                        className={inputCls}
                    />
                </Field>

                <Field label="Phone Number" placeholder="For patient contact">
                    <input
                        value={form.phone}
                        onChange={updateForm('phone')}
                        placeholder="+91 98765 43210"
                        type="tel"
                        className={inputCls}
                    />
                </Field>

                <Field label="Address" placeholder="Shop address">
                    <input
                        value={form.address}
                        onChange={updateForm('address')}
                        placeholder="Ground floor, City Medical Centre"
                        className={inputCls}
                    />
                </Field>

                <hr className="border-slate-100" />

                <Field label="Login Email *">
                    <input
                        value={form.email}
                        onChange={updateForm('email')}
                        placeholder="pharmacist@email.com"
                        type="email"
                        className={inputCls}
                    />
                </Field>

                <Field label="Password *">
                    <div className="relative">
                        <input
                            value={form.password}
                            onChange={updateForm('password')}
                            placeholder="Min. 8 characters"
                            type={showPassword ? 'text' : 'password'}
                            className={inputCls + ' pr-10'}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                </Field>

                {errorMsg && (
                    <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-xl border border-rose-100">
                        <AlertTriangle size={14} className="text-rose-500 flex-shrink-0" />
                        <p className="text-xs text-rose-700">{errorMsg}</p>
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={step === 'creating'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 mt-2"
                >
                    {step === 'creating' ? (
                        <><Loader size={16} className="animate-spin" /> Creating your account…</>
                    ) : (
                        <><Store size={16} /> Create Pharmacy Account</>
                    )}
                </button>
            </div>
        </Screen>
    );
};

// ── Helpers ──

const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all";

const Field: React.FC<{ label: string; placeholder?: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-600 block">{label}</label>
        {children}
    </div>
);

const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-300">
                    <Pill size={20} className="text-white" />
                </div>
                <span className="font-black text-2xl text-slate-900 tracking-tight">NirogOS</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
                <div className="mb-6">
                    <h1 className="font-black text-slate-900 text-xl mb-1">Pharmacy Setup</h1>
                    <p className="text-sm text-slate-400">You've been invited to join NirogOS as a pharmacy partner.</p>
                </div>
                {children}
            </div>
        </div>
    </div>
);

export default PharmacySignup;