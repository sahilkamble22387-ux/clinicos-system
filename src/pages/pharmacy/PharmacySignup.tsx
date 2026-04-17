import React, { useState } from 'react';
import { Mail, Phone, User, MapPin, Lock, ShieldCheck, Building2, Store } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../../services/db';
import { syncAndFetchPharmacyProfile } from '../../../services/pharmacyService';
import { Logo } from '../../../src/components/Logo';

type Step = 1 | 2;

const PharmacySignup: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const inviteToken = searchParams.get('token')?.trim() ?? '';

  const [form, setForm] = useState({
    pharmacyName: '',
    ownerName: '',
    licenseNumber: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    pincode: '',
    password: '',
    confirmPassword: '',
  });

  const update = (key: keyof typeof form, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const validatePhone = (raw: string): string | null => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 10) return 'Enter a 10-digit mobile number.';
    if (!/^[6-9]/.test(digits)) return 'Must start with 6–9 (India).';
    return null;
  };

  const validateStep1 = (): boolean => {
    if (!form.pharmacyName.trim()) { toast.error('Pharmacy name is required.'); return false; }
    if (!form.ownerName.trim()) { toast.error('Owner / pharmacist name is required.'); return false; }
    if (!form.licenseNumber.trim()) { toast.error('License number is required.'); return false; }
    if (!form.email.trim()) { toast.error('Email is required.'); return false; }
    if (!form.address.trim() || !form.city.trim() || !form.pincode.trim()) {
      toast.error('Address, city, and pincode are required.');
      return false;
    }
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) { toast.error(phoneErr); return false; }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/\d/.test(form.password)) {
      toast.error('Password must be 8+ chars with 1 number & 1 uppercase letter.');
      return false;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return false;
    }
    if (!agreed) {
      toast.error('Please agree to the Terms of Service.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;

    setLoading(true);
    try {
      const cleanPhone = form.phone.replace(/\D/g, '');
      let inviteClinicId: string | null = null;

      if (inviteToken) {
        const { data: invite, error: inviteError } = await (supabase as any)
          .from('pharmacy_invites')
          .select('id, clinic_id, status, expires_at')
          .eq('token', inviteToken)
          .maybeSingle();

        if (inviteError) throw inviteError;
        if (!invite || invite.status !== 'pending' || new Date(invite.expires_at) <= new Date()) {
          throw new Error('This pharmacy invite link is invalid or expired.');
        }

        inviteClinicId = invite.clinic_id;
      }

      const pharmacyPayload = {
        pharmacy_name: form.pharmacyName.trim(),
        owner_name: form.ownerName.trim(),
        license_number: form.licenseNumber.trim(),
        phone: cleanPhone,
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim(),
        clinic_id: inviteClinicId,
        invite_token: inviteToken || null,
      };

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: form.ownerName.trim(),
            role: 'pharmacy_staff',
            pharmacy_signup: pharmacyPayload,
          },
        },
      });

      if (error || !data.user) {
        throw error ?? new Error('Signup failed.');
      }

      const userId = data.user.id;
      if (!data.session) {
        toast.success('Check your email to confirm your account. After confirming, log in — your pharmacy profile will finish syncing.');
        window.location.href = '/login?portal=pharmacy';
        return;
      }

      const profile = await syncAndFetchPharmacyProfile(userId);
      if (!profile?.pharmacy_id) {
        throw new Error('Your pharmacy profile could not be created yet. Please try signing in once more.');
      }

      toast.success('Account created! Opening pharmacy portal…');
      window.location.href = '/pharmacy-portal';
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create pharmacy account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
             <Logo variant="full" usage="navbar" theme="dark" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Store size={11} className="text-indigo-400" />
                  Pharmacy Name
                  <span className="text-rose-400 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={form.pharmacyName}
                  onChange={e => update('pharmacyName', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium text-slate-900 outline-none"
                  placeholder="e.g. Healthy Life Pharmacy"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <User size={11} className="text-indigo-400" />
                  Owner / Pharmacist Name
                  <span className="text-rose-400 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={form.ownerName}
                  onChange={e => update('ownerName', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium text-slate-900 outline-none"
                  placeholder="e.g. Dr. Itachi"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldCheck size={11} className="text-indigo-400" />
                    License Number
                    <span className="text-rose-400 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.licenseNumber}
                    onChange={e => update('licenseNumber', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium text-slate-900 outline-none"
                    placeholder="e.g. MH-1234-ABC"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Phone size={11} className="text-indigo-400" />
                    Phone
                    <span className="text-rose-400 ml-0.5">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium text-slate-900 outline-none"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Mail size={11} className="text-indigo-400" />
                  Email
                  <span className="text-rose-400 ml-0.5">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium text-slate-900 outline-none"
                  placeholder="pharmacy@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin size={11} className="text-indigo-400" />
                  Address
                  <span className="text-rose-400 ml-0.5">*</span>
                </label>
                <textarea
                  value={form.address}
                  onChange={e => update('address', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium text-slate-900 outline-none resize-none"
                  rows={2}
                  placeholder="Street, area, landmark"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => update('city', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium text-slate-900 outline-none"
                    placeholder="e.g. Pune"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Pincode</label>
                  <input
                    type="text"
                    value={form.pincode}
                    onChange={e => update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium text-slate-900 outline-none"
                    placeholder="e.g. 411001"
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Lock size={11} className="text-indigo-400" />
                  Password
                  <span className="text-rose-400 ml-0.5">*</span>
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium text-slate-900 outline-none"
                  placeholder="Create a strong password"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Minimum 8 characters, including at least 1 number and 1 uppercase letter.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => update('confirmPassword', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium text-slate-900 outline-none"
                  placeholder="Re-enter password"
                />
              </div>

              <label className="flex items-start gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-[12px] text-slate-600">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" className="font-semibold text-indigo-600 hover:underline">
                    Terms of Service
                  </a>{' '}
                  and confirm that the above details are accurate.
                </span>
              </label>
            </>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
            {step === 2 ? (
              <>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-sm"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? 'Creating account…' : 'Create Pharmacy Account'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { window.location.href = '/login?portal=pharmacy'; }}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { if (validateStep1()) setStep(2); }}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm"
                >
                  Continue →
                </button>
              </>
            )}
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-400 flex items-center justify-between">
          <span>Already have an account?</span>
          <button
            type="button"
            onClick={() => { window.location.href = '/login?portal=pharmacy'; }}
            className="text-indigo-600 font-bold hover:text-indigo-700"
          >
            Go to Pharmacy Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default PharmacySignup;
