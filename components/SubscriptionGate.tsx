import React, { useState } from 'react';
import { useSubscription } from '../hooks/useSubscription';
import { Loader2, Lock, CheckCircle, Clock, AlertTriangle, WifiOff } from 'lucide-react';

// ── UPDATE THESE WITH YOUR ACTUAL DETAILS ────────────────────────────────────
const YOUR_UPI_ID = 'sahilkamble@okicici';
const YOUR_UPI_NAME = 'ClinicOS';
const YOUR_PHONE = '+91 98765 43210';
const YOUR_WHATSAPP_URL = 'https://wa.me/919876543210';
// ─────────────────────────────────────────────────────────────────────────────

const PLANS = [
    {
        id: 'basic',
        name: 'Basic',
        price: 999,
        period: 'month',
        features: ['1 Doctor', 'Unlimited Patients', 'Front Desk', 'Analytics'],
        color: 'from-blue-500 to-blue-600',
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 1999,
        period: 'month',
        popular: true,
        features: ['3 Doctors', 'QR Check-In', 'Advanced Analytics', 'Medical Records'],
        color: 'from-violet-500 to-purple-600',
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 4999,
        period: 'month',
        features: ['Unlimited Doctors', 'Custom Branding', 'Data Export', 'Priority Support'],
        color: 'from-slate-700 to-slate-900',
    },
];

interface Props {
    children: React.ReactNode;
    // clinicId and authResolved come from App.tsx after auth + clinic loading completes
    clinicId?: string | null;
    clinicName?: string | null;
    authResolved: boolean; // must be TRUE only after clinic has loaded
    onSignOut: () => void;
}

export function SubscriptionGate({ children, clinicId, clinicName, authResolved, onSignOut }: Props) {
    const { subscription, status, daysLeft, fetchError, isLocked, isLoading, isTrialEnding } =
        useSubscription(clinicId, authResolved);

    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [utrInput, setUtrInput] = useState('');
    const [submitted, setSubmitted] = useState(false);

    // ─────────────────────────────────────────────────────────────────────────
    // STATE 1: LOADING (auth hasn't resolved OR subscription is being fetched)
    // ⚠️ CRITICAL FIX: render NOTHING here — NOT children.
    // The previous bug rendered {children} during loading, letting users in.
    // ─────────────────────────────────────────────────────────────────────────
    if (!authResolved || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-indigo-400 w-9 h-9" />
                    <p className="text-sm text-slate-400 font-semibold tracking-wide">Verifying subscription...</p>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATE 2: FETCH ERROR — show hard error screen, not the app
    // ⚠️ CRITICAL FIX: never fail open on network error or missing row.
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
                <div className="max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <WifiOff className="text-red-400 w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-black text-white mb-2">Access Check Failed</h1>
                    <p className="text-slate-400 text-sm mb-2 leading-relaxed">
                        {fetchError ?? 'We could not verify your subscription. Please try again.'}
                    </p>
                    <p className="text-slate-500 text-xs mb-8">
                        If this keeps happening, contact WhatsApp support.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition-colors"
                        >
                            🔄 Retry
                        </button>
                        <a
                            href={YOUR_WHATSAPP_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-3 bg-white/10 text-white font-semibold rounded-xl text-sm hover:bg-white/20 transition-colors text-center"
                        >
                            💬 Contact Support
                        </a>
                        <button
                            onClick={onSignOut}
                            className="text-slate-500 text-xs hover:text-slate-300 transition-colors mt-1"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATE 3: LOCKED — payment wall
    // Triggered when: status === 'expired' | 'locked'
    // ⚠️ CRITICAL FIX: isLocked is explicitly computed in the hook — checking
    //    is_locked, status='expired', status='blocked', and fetch errors.
    // ─────────────────────────────────────────────────────────────────────────
    if (isLocked) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col font-sans">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                            <Lock className="text-red-400 w-4 h-4" />
                        </div>
                        <span className="text-white font-bold text-lg tracking-tight">ClinicOS</span>
                        <span className="text-xs bg-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded-full ml-1 tracking-wider">
                            LOCKED
                        </span>
                    </div>
                    <button onClick={onSignOut} className="text-slate-400 text-sm hover:text-white transition-colors font-medium">
                        Sign out
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-10 px-4">
                    <div className="max-w-3xl mx-auto">

                        {/* Lock banner */}
                        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center mb-8 shadow-lg">
                            <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Lock className="text-red-400 w-7 h-7" />
                            </div>
                            <h1 className="text-2xl font-black text-white mb-2">
                                {status === 'locked' ? 'Account Suspended' : 'Subscription Expired'}
                            </h1>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                {status === 'locked'
                                    ? 'Your account has been manually suspended. Please contact support via WhatsApp.'
                                    : 'Your free trial or subscription has ended. Choose a plan below to restore access.'}
                            </p>
                            {subscription?.admin_notes && (
                                <div className="mt-4 p-3 bg-white/5 rounded-xl text-slate-300 text-sm border border-white/10 text-left">
                                    📋 {subscription.admin_notes}
                                </div>
                            )}
                        </div>

                        {/* Plan selection — hidden if hard-locked or already submitted */}
                        {status !== 'locked' && !submitted && (
                            <>
                                <h2 className="text-white font-bold text-lg mb-4 text-center">Choose a Plan to Continue</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                    {PLANS.map(plan => (
                                        <button
                                            key={plan.id}
                                            onClick={() => setSelectedPlan(plan.id)}
                                            className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 ${selectedPlan === plan.id
                                                    ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]'
                                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                                }`}
                                        >
                                            {plan.popular && (
                                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-md">
                                                    MOST POPULAR
                                                </span>
                                            )}
                                            <div className={`inline-block text-xs font-bold px-2 py-1 rounded-lg bg-gradient-to-r ${plan.color} text-white mb-3 shadow-sm`}>
                                                {plan.name}
                                            </div>
                                            <div className="mb-3">
                                                <span className="text-3xl font-black text-white">₹{plan.price.toLocaleString('en-IN')}</span>
                                                <span className="text-slate-400 text-sm">/{plan.period}</span>
                                            </div>
                                            <ul className="space-y-1.5">
                                                {plan.features.map(f => (
                                                    <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                                                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                                        <span className="leading-snug">{f}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            {selectedPlan === plan.id && (
                                                <div className="mt-4 w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl text-center">✓ Selected</div>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* UPI payment — shown after plan is selected */}
                                {selectedPlan && (
                                    <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 shadow-xl">
                                        <h3 className="text-white font-bold text-lg mb-1 text-center">Pay via UPI</h3>
                                        <p className="text-slate-400 text-xs text-center mb-5">
                                            Scan, pay, and submit your UTR. Access restored within 30 minutes.
                                        </p>

                                        <div className="text-center mb-5">
                                            <p className="text-slate-400 text-sm mb-1">Amount to pay</p>
                                            <p className="text-4xl font-black text-emerald-400">
                                                ₹{(PLANS.find(p => p.id === selectedPlan)?.price ?? 0).toLocaleString('en-IN')}
                                            </p>
                                            <p className="text-slate-500 text-xs mt-1">{PLANS.find(p => p.id === selectedPlan)?.name} Plan — 1 Month</p>
                                        </div>

                                        {/* QR Code */}
                                        <div className="flex justify-center mb-4">
                                            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                                                <img
                                                    src="/upi-qr.png"
                                                    alt="UPI QR Code"
                                                    className="w-44 h-44 object-contain"
                                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                                />
                                                <p className="text-center text-[11px] text-slate-500 font-mono mt-1 font-semibold">{YOUR_UPI_ID}</p>
                                            </div>
                                        </div>

                                        {/* Copy UPI ID */}
                                        <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-4 py-3 mb-5 border border-slate-700">
                                            <span className="text-slate-400 text-sm flex-1">UPI ID: <span className="text-white font-mono font-bold">{YOUR_UPI_ID}</span></span>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(YOUR_UPI_ID); alert('UPI ID copied!'); }}
                                                className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0"
                                            >
                                                Copy
                                            </button>
                                        </div>

                                        {/* UTR input */}
                                        <div className="mb-5">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                                UTR / Transaction ID <span className="text-rose-400">*</span>
                                            </label>
                                            <input
                                                value={utrInput}
                                                onChange={e => setUtrInput(e.target.value.trim())}
                                                placeholder="12-digit reference number"
                                                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-sm placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono transition-all"
                                            />
                                            <p className="text-slate-500 text-xs mt-2">Find in your UPI app → Transaction History</p>
                                        </div>

                                        <button
                                            onClick={() => {
                                                if (!utrInput) { alert('Please enter your UTR / Transaction ID.'); return; }
                                                const plan = PLANS.find(p => p.id === selectedPlan);
                                                const message = encodeURIComponent(
                                                    `Hi! I've paid for ClinicOS ${plan?.name} Plan.\n\n` +
                                                    `Clinic: ${clinicName ?? 'N/A'}\n` +
                                                    `Plan: ${plan?.name}\n` +
                                                    `Amount: ₹${plan?.price}\n` +
                                                    `UTR Number: ${utrInput}\n\n` +
                                                    `Please verify and activate my subscription. Thank you!`
                                                );
                                                window.open(`${YOUR_WHATSAPP_URL}?text=${message}`, '_blank');
                                                setSubmitted(true);
                                            }}
                                            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl text-sm hover:from-emerald-600 hover:to-green-700 transition shadow-lg shadow-emerald-500/25 block text-center"
                                        >
                                            ✅ I've Paid — Notify via WhatsApp
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Submitted confirmation */}
                        {submitted && status !== 'locked' && (
                            <div className="max-w-md mx-auto text-center mt-4">
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 shadow-xl">
                                    <Clock className="text-emerald-400 w-10 h-10 mx-auto mb-4" />
                                    <h2 className="text-xl font-black text-white mb-2 tracking-tight">Payment Submitted!</h2>
                                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                                        UTR <span className="text-white font-mono font-bold bg-white/10 px-1 py-0.5 rounded">{utrInput}</span> received.
                                        We'll verify and activate your account within <strong className="text-white">30 minutes</strong>.
                                    </p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="w-full px-6 py-4 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition-colors shadow-lg"
                                    >
                                        🔄 Refresh to Check Access
                                    </button>
                                </div>
                            </div>
                        )}

                        <p className="text-center text-slate-500 text-sm mt-10">
                            Need help?{' '}
                            <a href={YOUR_WHATSAPP_URL} target="_blank" rel="noreferrer" className="text-green-400 hover:text-green-300 font-semibold transition-colors">
                                WhatsApp Support
                            </a>
                            {' '}· {YOUR_PHONE}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATE 4: OPEN — render children
    // Only reached when status is 'trial' or 'active' (hasAccess === true)
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            {/* Trial ending banner — only when ≤ 2 days remain */}
            {isTrialEnding && (
                <div className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold px-4 py-2.5 flex items-center justify-between shadow-md flex-shrink-0 z-50 relative">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span className="leading-snug">
                            ⏰ Your free trial ends in <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>. Upgrade now to keep access.
                        </span>
                    </div>
                    <a href="/pricing" className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ml-4 whitespace-nowrap">
                        View Plans →
                    </a>
                </div>
            )}
            {children}
        </>
    );
}
