import React from 'react';
import { ArrowLeft, CreditCard, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const RefundPolicyPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-100">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold text-sm transition-colors"
                    >
                        <ArrowLeft size={17} />
                        Back to Website
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto py-14 px-6 space-y-8">
                <div className="space-y-3">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
                        Refund Policy
                    </h1>
                    <p className="text-slate-600 leading-relaxed">
                        Refund requests are reviewed case by case for accidental duplicate charges and verified billing errors.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <CreditCard size={18} className="text-indigo-600" />
                        <h2 className="font-bold text-slate-900">Billing Issues</h2>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        If you believe you were charged incorrectly, email support@nirogos.in with your clinic name, payment date, amount, and transaction reference.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <ShieldCheck size={18} className="text-emerald-600" />
                        <h2 className="font-bold text-slate-900">Review Window</h2>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Once the issue is verified, approved refunds are processed back to the original payment method. Timelines depend on the payment provider.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RefundPolicyPage;
