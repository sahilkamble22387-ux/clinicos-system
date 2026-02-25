import React, { useState, useEffect } from 'react';
import { supabase as supabasePublic } from '../services/db';

interface CheckinPageProps {
    clinicId: string;
}

const CheckinPage: React.FC<CheckinPageProps> = ({ clinicId }) => {
    const [step, setStep] = useState<'loading' | 'invalid' | 'form' | 'success'>('loading');
    const [clinicName, setClinicName] = useState('');
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        full_name: '',
        phone: '',
        gender: '',
        dob: '',
        reason: '',
    });

    // Validate clinic exists
    useEffect(() => {
        const validate = async () => {
            try {
                const { data, error } = await supabasePublic
                    .from('clinics')
                    .select('id, name')
                    .eq('id', clinicId)
                    .single();

                if (error || !data) {
                    setStep('invalid');
                    return;
                }
                setClinicName(data.name || 'Clinic');
                setStep('form');
            } catch {
                setStep('invalid');
            }
        };
        validate();
    }, [clinicId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.full_name.trim() || !form.phone.trim()) return;
        setLoading(true);

        try {
            // 1. Check if patient already exists by phone + clinic
            const { data: existing } = await supabasePublic
                .from('patients')
                .select('id')
                .eq('phone', form.phone.trim())
                .eq('clinic_id', clinicId)
                .maybeSingle();

            let patientId: string;

            if (existing) {
                patientId = existing.id;
                // Update status to waiting
                await supabasePublic
                    .from('patients')
                    .update({
                        status: 'waiting',
                        is_active: true,
                        source: 'QR_Checkin',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', patientId);
            } else {
                // Create new patient
                const { data: newPatient, error: patientError } = await supabasePublic
                    .from('patients')
                    .insert({
                        full_name: form.full_name.trim(),
                        phone: form.phone.trim(),
                        gender: form.gender || null,
                        dob: form.dob || null,
                        clinic_id: clinicId,
                        status: 'waiting',
                        is_active: true,
                        source: 'QR_Checkin',
                        consultation_fee: 0,
                    })
                    .select('id')
                    .single();

                if (patientError) throw patientError;
                patientId = newPatient.id;
            }

            // 2. Create appointment
            const { error: apptError } = await supabasePublic
                .from('appointments')
                .insert({
                    patient_id: patientId,
                    clinic_id: clinicId,
                    status: 'waiting',
                });

            if (apptError) throw apptError;

            setStep('success');
        } catch (err) {
            console.error('Check-in failed:', err);
            alert('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Loading state
    if (step === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 flex items-center justify-center p-4">
                <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    // Invalid clinic
    if (step === 'invalid') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                    <div className="text-5xl mb-4">❌</div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid Clinic</h1>
                    <p className="text-slate-500 text-sm">
                        This check-in link is not valid. Please ask the reception for the correct QR code.
                    </p>
                </div>
            </div>
        );
    }

    // Success state
    if (step === 'success') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-emerald-100">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                        <span className="text-4xl">✅</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">You're in the queue!</h1>
                    <p className="text-slate-500 mb-6 text-sm leading-relaxed">
                        Please take a seat. The doctor will call you shortly.
                    </p>
                    <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
                        <p className="text-sm text-indigo-700 font-semibold">{form.full_name}</p>
                        <p className="text-xs text-indigo-500 mt-1">{clinicName}</p>
                    </div>
                    <p className="mt-6 text-xs text-slate-400">You can close this page now.</p>
                </div>
            </div>
        );
    }

    // Main form
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 pt-8 pb-6 text-center text-white">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/30">
                        <span className="text-3xl">🏥</span>
                    </div>
                    <h1 className="text-xl font-bold">Patient Check-In</h1>
                    <p className="text-indigo-200 text-sm mt-1">{clinicName}</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-xs text-slate-500 font-medium mb-2">Fill in your details to join the queue</p>

                    {/* Full Name */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            required
                            value={form.full_name}
                            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                            className="w-full mt-1.5 px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-800 placeholder:text-slate-400"
                            placeholder="Your full name"
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Phone Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                            required
                            type="tel"
                            value={form.phone}
                            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                            className="w-full mt-1.5 px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-800 placeholder:text-slate-400"
                            placeholder="10-digit mobile number"
                        />
                    </div>

                    {/* Gender + DOB */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Gender</label>
                            <select
                                value={form.gender}
                                onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                className="w-full mt-1.5 px-3 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm bg-white text-slate-800"
                            >
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Date of Birth</label>
                            <input
                                type="date"
                                value={form.dob}
                                onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                                className="w-full mt-1.5 px-3 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm text-slate-800"
                            />
                        </div>
                    </div>

                    {/* Chief Complaint */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Chief Complaint</label>
                        <textarea
                            value={form.reason}
                            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                            rows={2}
                            className="w-full mt-1.5 px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm resize-none text-slate-800 placeholder:text-slate-400"
                            placeholder="What's bothering you today? (optional)"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl text-sm hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 mt-2"
                    >
                        {loading ? '⏳ Adding to queue...' : '✅ Check In Now'}
                    </button>
                </form>

                {/* Footer */}
                <div className="px-6 pb-5 text-center">
                    <p className="text-[11px] text-slate-400">Powered by <span className="font-bold text-indigo-500">ClinicOS</span></p>
                </div>
            </div>
        </div>
    );
};

export default CheckinPage;
