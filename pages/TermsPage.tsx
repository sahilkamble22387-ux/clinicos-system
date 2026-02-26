import React from 'react';
import { ArrowLeft, Shield, Scale, FlaskConical, FileDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TermsPageProps {
    onBack?: () => void;
}

const TermsPage: React.FC<TermsPageProps> = ({ onBack }) => {
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
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-600 text-xs font-bold tracking-wide">
                        <Scale size={13} /> LEGAL
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
                        Terms of Service
                    </h1>
                    <p className="text-slate-500 text-base font-medium">
                        Effective date: <span className="text-slate-700 font-semibold">February 2026</span> · Last updated February 21, 2026
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                        By accessing or using ClinicOS you agree to the following terms. Please read them carefully before continuing.
                    </p>
                </div>

                <hr className="border-slate-200" />

                {/* Section 1 */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                            <Scale size={18} className="text-amber-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Medical Disclaimer</h3>
                    </div>
                    <div className="pl-12 space-y-3 text-slate-600 leading-relaxed">
                        <p>
                            ClinicOS is a <strong className="text-slate-800">practice management and operational tool</strong> — not a medical device, diagnostic system, or clinical decision support platform in the regulated sense. It does not generate medical advice, diagnoses, or treatment recommendations.
                        </p>
                        <p>
                            All clinical decisions remain the sole responsibility of the licensed healthcare professional using the platform. Patient data stored in ClinicOS is used solely for record-keeping and workflow organisation purposes.
                        </p>
                        <p>
                            ClinicOS expressly disclaims any liability for clinical outcomes resulting from how data recorded in the platform is interpreted or acted upon by healthcare providers.
                        </p>
                    </div>
                </section>

                {/* Section 2 */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
                            <FlaskConical size={18} className="text-violet-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Pilot & Beta Status</h3>
                    </div>
                    <div className="pl-12 space-y-3 text-slate-600 leading-relaxed">
                        <p>
                            ClinicOS is currently in <strong className="text-slate-800">active beta (Pilot Phase)</strong>. Features, interfaces, and data schemas may change between updates without prior notice.
                        </p>
                        <p>
                            During the pilot period, the platform may experience downtime, data migrations, or breaking changes. We will communicate significant updates via the email address associated with your account.
                        </p>
                        <p>
                            By using ClinicOS during the pilot phase, you acknowledge that you are a beta participant and agree to provide feedback to help improve the platform. We are grateful for your collaboration.
                        </p>
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
                            <p className="text-amber-700 text-sm font-semibold">
                                ⚠️ We strongly recommend maintaining your own backup of critical patient records during the pilot phase, independent of ClinicOS.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Section 3 */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                            <FileDown size={18} className="text-indigo-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Data Export & Portability</h3>
                    </div>
                    <div className="pl-12 space-y-3 text-slate-600 leading-relaxed">
                        <p>
                            You have the right to export all patient data associated with your clinic at any time. ClinicOS provides a built-in <strong className="text-slate-800">CSV export</strong> directly from the Analytics dashboard.
                        </p>
                        <p>
                            For full data export requests (including historical records, appointments, and medical notes), submit a request via email to <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">support@clinicos.app</span>. Exports will be delivered within <strong className="text-slate-800">48 hours</strong> in machine-readable CSV format (UTF-8 encoded).
                        </p>
                        <p>
                            Upon account closure, your data will be retained for 30 days to allow final exports, then permanently deleted from all Supabase-managed storage.
                        </p>
                    </div>
                </section>

                <hr className="border-slate-200" />

                {/* Footer note */}
                <p className="text-slate-400 text-sm text-center">
                    Questions about these terms?{' '}
                    <span className="text-indigo-500 font-semibold cursor-pointer hover:text-indigo-700 transition-colors">Contact us at support@clinicos.app</span>
                </p>
            </div>
        </div>
    );
};

export default TermsPage;
