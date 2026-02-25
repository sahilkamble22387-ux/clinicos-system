import React, { useState } from 'react';
import { Pill, CheckCircle2, XCircle, ArrowRight, HelpCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { pricingTiers, faqs } from '../data/pricing';

const PricingPage = () => {
    const navigate = useNavigate();
    const [hoveredTier, setHoveredTier] = useState<string | null>(null);

    const handleStartTrial = (tierId: string) => {
        // In a real app, track analytics here before routing
        console.log(`Trial started for tier: ${tierId}`);
        navigate('/');
    };

    const trackHover = (tierId: string) => {
        setHoveredTier(tierId);
        // You could also log this to an analytics service
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* Navigation Bar */}
            <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-50">
                <Link to="/" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-700 transition-colors">
                        <Pill className="text-white w-4 h-4" />
                    </div>
                    <span className="font-bold text-lg text-slate-900 tracking-tight">ClinicOS</span>
                </Link>
                <div className="flex gap-4">
                    <Link to="/" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors py-2 px-4">
                        Log In
                    </Link>
                    <button
                        onClick={() => handleStartTrial('professional')}
                        className="text-sm font-bold bg-indigo-600 text-white px-5 py-2 rounded-full hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        Start Free Trial
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 lg:mt-24">
                {/* Header Section */}
                <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-2">
                        Pricing Plans
                    </div>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
                        Simple, Transparent Pricing
                    </h1>
                    <p className="text-lg md:text-xl text-slate-500 font-medium">
                        No hidden fees, no surprises. Choose the plan that best fits the needs of your growing practice.
                    </p>
                </div>

                {/* Pricing Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch mb-24 max-w-6xl mx-auto">
                    {pricingTiers.map((tier) => (
                        <div
                            key={tier.id}
                            onMouseEnter={() => trackHover(tier.id)}
                            onMouseLeave={() => setHoveredTier(null)}
                            className={`
                relative flex flex-col rounded-3xl transition-all duration-300 transform
                ${tier.theme === 'light' ? 'bg-white border border-slate-200 shadow-sm hover:shadow-xl' : ''}
                ${tier.theme === 'primary' ? 'bg-white border-2 border-indigo-500 shadow-xl md:-mt-4 md:mb-4 z-10' : ''}
                ${tier.theme === 'dark' ? 'bg-slate-900 text-white border border-slate-800 shadow-xl' : ''}
                ${hoveredTier === tier.id ? '-translate-y-2' : ''}
              `}
                        >
                            {/* Badges */}
                            {tier.badge && (
                                <div className={`
                  absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-md whitespace-nowrap
                  ${tier.theme === 'primary' ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white' : ''}
                  ${tier.theme === 'dark' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900' : ''}
                `}>
                                    {tier.badge}
                                </div>
                            )}

                            <div className="p-8 pb-0">
                                <h3 className={`text-xl font-bold mb-2 ${tier.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{tier.name}</h3>
                                <p className={`text-sm h-10 mb-6 ${tier.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{tier.description}</p>
                                <div className="flex items-baseline gap-1 mb-8">
                                    <span className={`text-2xl font-bold ${tier.theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>{tier.currency}</span>
                                    <span className={`text-5xl font-black tracking-tight ${tier.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{tier.price}</span>
                                    <span className={`text-sm font-medium ${tier.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>/{tier.interval}</span>
                                </div>

                                <button
                                    onClick={() => handleStartTrial(tier.id)}
                                    className={`
                    w-full py-4 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 group
                    ${tier.theme === 'light' ? 'bg-slate-100 text-slate-900 hover:bg-slate-200' : ''}
                    ${tier.theme === 'primary' ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200' : ''}
                    ${tier.theme === 'dark' ? 'bg-white text-slate-900 hover:bg-slate-100' : ''}
                  `}
                                >
                                    Get Started
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>

                            <div className={`mt-8 p-8 pt-6 border-t flex-1 flex flex-col ${tier.theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                                <p className={`text-xs font-bold uppercase tracking-wider mb-4 ${tier.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    What's included
                                </p>
                                <ul className="space-y-4 flex-1">
                                    {tier.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                            {feature.included ? (
                                                <CheckCircle2 className={`w-5 h-5 shrink-0 ${tier.theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                                            ) : (
                                                <XCircle className={`w-5 h-5 shrink-0 ${tier.theme === 'dark' ? 'text-slate-700' : 'text-slate-300'}`} />
                                            )}
                                            <span className={`text-sm leading-snug ${!feature.included
                                                    ? (tier.theme === 'dark' ? 'text-slate-600' : 'text-slate-400')
                                                    : (tier.theme === 'dark' ? 'text-slate-300' : 'text-slate-700')
                                                }`}>
                                                {feature.name}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Global CTA Section */}
                <div className="mb-24 py-16 px-8 bg-indigo-50 border border-indigo-100 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
                    <div className="max-w-2xl text-center md:text-left">
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Ready to transform your clinic?</h2>
                        <p className="text-lg text-slate-600">Join thousands of modern healthcare providers using ClinicOS.</p>
                    </div>
                    <button
                        onClick={() => handleStartTrial('professional')}
                        className="shrink-0 px-8 py-4 bg-indigo-600 text-white font-bold text-lg rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300"
                    >
                        Start Your Free Trial
                    </button>
                </div>

                {/* FAQ Section */}
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
                        <p className="text-slate-500 text-lg">Everything you need to know about the product and billing.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                        {faqs.map((faq, idx) => (
                            <div key={idx} className="flex gap-4">
                                <div className="mt-1">
                                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                        <HelpCircle size={18} />
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-slate-900 mb-2">{faq.question}</h4>
                                    <p className="text-slate-600 text-base leading-relaxed">{faq.answer}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </main>

            {/* Footer minimal */}
            <footer className="mt-24 border-t border-slate-200 py-12 text-center text-slate-500">
                <p>© 2026 ClinicOS. All rights reserved.</p>
                <div className="mt-4 flex gap-4 justify-center text-sm font-medium">
                    <Link to="/privacy" className="hover:text-indigo-600 transition-colors">Privacy Policy</Link>
                    <Link to="/terms" className="hover:text-indigo-600 transition-colors">Terms of Service</Link>
                    <a href="mailto:support@clinicos.com" className="hover:text-indigo-600 transition-colors">Contact Support</a>
                </div>
            </footer>
        </div>
    );
};

export default PricingPage;
