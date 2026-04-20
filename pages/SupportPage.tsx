import React from 'react';
import { ArrowLeft, Mail, MessageCircle, Clock3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SupportPage: React.FC = () => {
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
                        Support
                    </h1>
                    <p className="text-slate-600 leading-relaxed">
                        Reach the NirogOS team for account help, billing questions, exports, or product issues.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <a
                        href="mailto:support@nirogos.in"
                        className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-200 hover:shadow-sm transition"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                <Mail size={18} className="text-indigo-600" />
                            </div>
                            <div className="font-bold text-slate-900">Email Support</div>
                        </div>
                        <p className="text-sm text-slate-600">support@nirogos.in</p>
                    </a>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                <MessageCircle size={18} className="text-emerald-600" />
                            </div>
                            <div className="font-bold text-slate-900">Response Window</div>
                        </div>
                        <p className="text-sm text-slate-600">Most support requests are answered within 1 business day.</p>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Clock3 size={18} className="text-slate-500" />
                        <h2 className="font-bold text-slate-900">What to include</h2>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Include your clinic name, account email, and a short description of the problem so support can resolve it faster.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SupportPage;
