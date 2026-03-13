/**
 * PharmacyLogin.tsx  (add to your pages/ folder)
 * ─────────────────────────────────────────────────────────────────
 * Route: /pharmacy-login
 * Completely separate login page for pharmacy staff.
 * After login, checks role and redirects to /pharmacy-portal.
 * If a doctor somehow tries to log in here, they're redirected back.
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import { supabase } from '../services/db';
import { Pill, Eye, EyeOff, Store, AlertTriangle, Loader } from 'lucide-react';

const PharmacyLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            setError('Please enter your email and password.');
            return;
        }
        setLoading(true);
        setError('');

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (authError) throw authError;
            if (!data.user) throw new Error('No user returned');

            // Verify role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (profile?.role !== 'pharmacy_staff') {
                await supabase.auth.signOut();
                setError('This login is only for pharmacy staff. Doctors should use the main login.');
                setLoading(false);
                return;
            }

            window.location.href = '/pharmacy-portal';
        } catch (err: any) {
            setError(err.message || 'Login failed. Check your credentials.');
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleLogin();
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f8fafc 100%)' }}>
            <div className="w-full max-w-sm">

                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-300">
                        <Pill size={20} className="text-white" />
                    </div>
                    <span className="font-black text-2xl text-slate-900 tracking-tight">NirogOS</span>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                            <Store size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h1 className="font-black text-slate-900 text-lg leading-tight">Pharmacy Login</h1>
                            <p className="text-xs text-slate-400">For pharmacy staff only</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 block">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="pharmacist@email.com"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 block">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Your password"
                                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-rose-50 rounded-xl border border-rose-100">
                                <AlertTriangle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-rose-700">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={handleLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 mt-2"
                        >
                            {loading ? <Loader size={16} className="animate-spin" /> : <Store size={16} />}
                            {loading ? 'Signing in…' : 'Sign In to Pharmacy'}
                        </button>

                        <p className="text-center text-xs text-slate-400 mt-2">
                            Are you a doctor?{' '}
                            <a href="/" className="text-indigo-600 hover:underline font-semibold">
                                Doctor login →
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PharmacyLogin;


/* ═══════════════════════════════════════════════════════════════════════════
   APP.TSX CHANGES — Add these 4 things to your existing App.tsx
   ═══════════════════════════════════════════════════════════════════════════

   1. Add imports at the top:
   ─────────────────────────────────────────────────────────────────────────
   import PharmacyPortal from './pages/PharmacyPortal';
   import PharmacyLogin from './pages/PharmacyLogin';
   import PharmacySignup from './pages/PharmacySignup';


   2. Add pharmacy route bypass (BEFORE the useState hooks, next to checkinClinicId):
   ─────────────────────────────────────────────────────────────────────────
   // Pharmacy routes — bypass all doctor auth/clinic loading
   const pathname = window.location.pathname;
   if (pathname === '/pharmacy-portal') return <PharmacyPortal />;
   if (pathname === '/pharmacy-login')  return <PharmacyLogin />;
   if (pathname === '/pharmacy-signup') return <PharmacySignup />;


   3. Your Routes block already has <Route path="/*"> — the bypasses above
      mean pharmacy routes never reach it. No changes to existing routes needed.


   4. In EditProfile.tsx or your settings page, drop in the invite panel:
   ─────────────────────────────────────────────────────────────────────────
   import PharmacyInvitePanel from '../components/Doctor/PharmacyInvitePanel';
   import { useAuth } from '../context/AuthContext';

   // Inside your settings component:
   const { clinicId, user } = useAuth();

   // In the JSX, wherever you want the pharmacy section:
   <PharmacyInvitePanel
     clinicId={clinicId!}
     doctorProfileId={user.id}
   />


   5. When doctor clicks "Complete Visit" — add this to your visit completion handler:
   ─────────────────────────────────────────────────────────────────────────
   // After creating/updating the prescription row, add pharmacy_id + status:
   
   // First, get the linked pharmacy for this clinic:
   const { data: pharmacy } = await supabase
     .from('pharmacies')
     .select('id')
     .eq('clinic_id', clinicId)
     .maybeSingle();

   if (pharmacy) {
     await supabase
       .from('prescriptions')
       .update({
         pharmacy_id: pharmacy.id,
         pharmacy_status: 'sent_to_pharmacy',
       })
       .eq('id', prescriptionId);  // your prescription's id
   }
   // Pharmacy dashboard receives this instantly via Realtime.

   ═══════════════════════════════════════════════════════════════════════════ */