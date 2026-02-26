import React from 'react';
import { ArrowLeft, ShieldCheck, Lock, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PrivacyPageProps {
    onBack?: () => void;
}

const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBack }) => {
    const navigate = useNavigate();
    const handleBack = onBack ?? (() => navigate('/login'));
    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Top bar */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-100">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold text-sm transition-colors"
                    >
                        <ArrowLeft size={17} />
                        Back to Sign In
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto py-14 px-6 space-y-12">

                {/* Hero */}
                <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-600 text-xs font-bold tracking-wide">
                        <ShieldCheck size={13} /> PRIVACY
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
                        Privacy Policy
                    </h1>
                    <p className="text-slate-500 text-base font-medium">
                        Effective date: <span className="text-slate-700 font-semibold">February 2026</span> · Last updated February 21, 2026
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                        At ClinicOS we believe patient data belongs to the doctor, not to us. This policy explains how we handle data and why you can trust us with it.
                    </p>
                </div>

                <hr className="border-slate-200" />

                {/* Section 1 — Ownership */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                            <UserCheck size={18} className="text-indigo-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Data Ownership</h3>
                    </div>
                    <div className="pl-12 space-y-3 text-slate-600 leading-relaxed">
                        <p>
                            All patient records, appointments, medical notes, and clinical data entered into ClinicOS are <strong className="text-slate-800">owned exclusively by the registered doctor/clinic</strong> — not by ClinicOS, its developers, or any affiliated entity.
                        </p>
                        <p>
                            We act as a <strong className="text-slate-800">data processor</strong> on your behalf. You remain the data controller under applicable healthcare and data protection regulations. We will never claim ownership of, licence, sublicence, or commercially exploit any patient or clinical data you input.
                        </p>
                        <p>
                            You may request deletion of all your data at any time by contacting <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">support@clinicos.app</span>. Deletion will be completed within 30 days.
                        </p>
                    </div>
                </section>

                {/* Section 2 — Security */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                            <Lock size={18} className="text-slate-600" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Security & Encryption</h3>
                    </div>
                    <div className="pl-12 space-y-3 text-slate-600 leading-relaxed">
                        <p>
                            All data is stored on <strong className="text-slate-800">Supabase</strong> — a SOC 2 Type II compliant, PostgreSQL-based infrastructure provider. Data is encrypted <strong className="text-slate-800">at rest (AES-256)</strong> and <strong className="text-slate-800">in transit (TLS 1.3)</strong> by default.
                        </p>
                        <p>
                            Authentication is handled via Supabase Auth with JWT-based session management. Passwords are never stored in plain text. We enforce secure session expiry and token rotation.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                            {[
                                { label: 'At-rest encryption', detail: 'AES-256' },
                                { label: 'In-transit encryption', detail: 'TLS 1.3' },
                                { label: 'Auth standard', detail: 'JWT + RLS' },
                            ].map(item => (
                                <div key={item.label} className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</div>
                                    <div className="text-slate-800 font-black text-base">{item.detail}</div>
                                </div>
                            ))}
                        </div>
                        <p>
                            Row-Level Security (RLS) policies are enforced at the database level, ensuring one clinic can never access another clinic's data — even in the event of an application-layer bug.
                        </p>
                    </div>
                </section>

                {/* Section 3 — Non-sharing */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck size={18} className="text-rose-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">No Third-Party Data Sharing</h3>
                    </div>
                    <div className="pl-12 space-y-3 text-slate-600 leading-relaxed">
                        <p>
                            <strong className="text-slate-800">We do not sell, rent, trade, or share patient data with any third party for any commercial purpose.</strong> Patient data will never be used for advertising, machine learning model training outside your explicit consent, or analytics products sold to other parties.
                        </p>
                        <p>
                            We will only disclose data to third parties in the following strictly limited circumstances:
                        </p>
                        <ul className="list-disc list-outside pl-5 space-y-1 text-slate-600">
                            <li>When legally required by a court order or government authority in your jurisdiction</li>
                            <li>With your explicit written consent</li>
                            <li>To Supabase Inc., solely as our infrastructure sub-processor under their Data Processing Agreement</li>
                        </ul>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
                            <p className="text-emerald-700 text-sm font-semibold">
                                ✅ ClinicOS helps clinics manage operations securely — your patient data stays under your control.
                            </p>
                        </div>
                    </div>
                </section>

                <hr className="border-slate-200" />

                {/* Footer note */}
                <p className="text-slate-400 text-sm text-center">
                    Questions about privacy?{' '}
                    <span className="text-indigo-500 font-semibold cursor-pointer hover:text-indigo-700 transition-colors">Contact us at support@clinicos.app</span>
                </p>
            </div>
        </div>
    );
};

export default PrivacyPage;
