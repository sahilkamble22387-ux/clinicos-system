import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, Copy, Check, ExternalLink } from 'lucide-react'
import { FEATURE_LABELS, type FeatureKey } from '../hooks/useSubscription'

// ── YOUR DETAILS ──────────────────────────────────────────────────────────────
const UPI_ID = 'sahilkamble22387-1@oksbi'
const WHATSAPP_NUMBER = '917620422387' // 91 + 10-digit number, no spaces/+
const SUPPORT_NAME = 'Sahil'
// ─────────────────────────────────────────────────────────────────────────────

const PLANS = [
    {
        id: 'basic',
        name: 'Basic',
        price: 999,
        color: 'from-blue-500 to-blue-600',
        ring: 'ring-blue-500/30',
        features: ['Front Desk', 'Doctor Portal', 'Medical Records', '1 Doctor'],
        locked: ['Analytics', 'QR Check-In', 'Reports', 'Data Export'],
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 1999,
        popular: true,
        color: 'from-violet-500 to-purple-600',
        ring: 'ring-violet-500/40',
        features: ['Everything in Basic', 'Analytics Hub', 'QR Check-In', 'Download Reports', '3 Doctors'],
        locked: ['Data Export'],
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 4999,
        color: 'from-slate-600 to-slate-800',
        ring: 'ring-slate-500/30',
        features: ['Everything in Pro', 'Unlimited Doctors', 'Data Export', 'Priority Support', 'Custom Branding'],
        locked: [],
    },
]

interface UpgradeModalProps {
    isOpen: boolean
    onClose: () => void
    lockedFeature?: FeatureKey
    /** Clinic ID — forwarded to WhatsApp message (no AuthContext in this codebase) */
    clinicId?: string | null
    clinicName?: string | null
}

export function UpgradeModal({ isOpen, onClose, lockedFeature, clinicId, clinicName }: UpgradeModalProps) {
    const [copied, setCopied] = useState(false)
    const [selectedPlan, setSelectedPlan] = useState('pro')
    const [step, setStep] = useState<'plans' | 'payment' | 'done'>('plans')
    const overlayRef = useRef<HTMLDivElement>(null)

    // Close on Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        if (isOpen) window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, onClose])

    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [isOpen])

    // Reset when opened
    useEffect(() => {
        if (isOpen) { setStep('plans'); setCopied(false) }
    }, [isOpen])

    function copyUPI() {
        navigator.clipboard.writeText(UPI_ID)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
    }

    function openWhatsApp() {
        const plan = PLANS.find(p => p.id === selectedPlan)
        const msg = encodeURIComponent(
            `Hi ${SUPPORT_NAME}! I just paid for ClinicOS ${plan?.name} Plan.\n\n` +
            `Clinic: ${clinicName ?? 'N/A'}\n` +
            `Clinic ID: ${clinicId ?? 'N/A'}\n` +
            `Plan: ${plan?.name} — ₹${plan?.price}/month\n\n` +
            `Please verify my payment and activate my subscription. Thank you!`
        )
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank')
        setStep('done')
    }

    const featureMeta = lockedFeature ? FEATURE_LABELS[lockedFeature] : null

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={overlayRef}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={e => { if (e.target === overlayRef.current) onClose() }}
                    style={{
                        background: 'rgba(2,6,23,0.80)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                    }}
                >
                    {/* ── Modal Panel ── */}
                    <motion.div
                        className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl"
                        initial={{ opacity: 0, scale: 0.93, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 16 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                        style={{
                            background: 'linear-gradient(145deg, rgba(15,10,40,0.98) 0%, rgba(20,15,50,0.98) 100%)',
                            border: '1px solid rgba(139,92,246,0.25)',
                            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
                        }}
                    >
                        {/* Top glow line */}
                        <div
                            className="absolute top-0 inset-x-0 h-px pointer-events-none"
                            style={{ background: 'linear-gradient(to right, transparent, rgba(139,92,246,0.6), transparent)' }}
                        />

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>

                        <div className="p-6 sm:p-8">

                            {/* ── HEADER ── */}
                            <div className="mb-6">
                                {featureMeta && (
                                    <div
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
                                        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
                                    >
                                        <span className="text-base">{featureMeta.icon}</span>
                                        <span className="text-red-300 text-xs font-bold tracking-wide">
                                            {featureMeta.name} — Locked
                                        </span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                    </div>
                                )}

                                <h2 className="text-2xl font-black text-white leading-tight mb-2">
                                    {featureMeta ? `Unlock ${featureMeta.name}` : 'Upgrade Your Plan'}
                                </h2>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    {featureMeta
                                        ? `${featureMeta.description} is available on a higher plan. Upgrade to continue.`
                                        : 'Choose a plan to restore or expand your access.'}
                                </p>
                            </div>

                            {/* ── STEP: PLANS ── */}
                            {step === 'plans' && (
                                <>
                                    <div className="space-y-3 mb-6">
                                        {PLANS.map(plan => (
                                            <button
                                                key={plan.id}
                                                onClick={() => setSelectedPlan(plan.id)}
                                                className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 relative ${selectedPlan === plan.id
                                                    ? `border-violet-500/50 ring-2 ${plan.ring}`
                                                    : 'border-white/8 hover:border-white/16'
                                                    }`}
                                                style={{
                                                    background: selectedPlan === plan.id
                                                        ? 'rgba(139,92,246,0.08)'
                                                        : 'rgba(255,255,255,0.03)',
                                                }}
                                            >
                                                {plan.popular && (
                                                    <span
                                                        className="absolute -top-2.5 left-4 text-xs font-black px-2.5 py-0.5 rounded-full text-white"
                                                        style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}
                                                    >
                                                        RECOMMENDED
                                                    </span>
                                                )}

                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="mb-2">
                                                            <span className={`text-xs font-black px-2 py-0.5 rounded-md bg-gradient-to-r ${plan.color} text-white`}>
                                                                {plan.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {plan.features.map(f => (
                                                                <span key={f} className="inline-flex items-center gap-1 text-xs text-emerald-300 bg-emerald-400/10 px-2 py-0.5 rounded-md border border-emerald-400/15">
                                                                    <CheckCircle size={10} className="flex-shrink-0" />{f}
                                                                </span>
                                                            ))}
                                                            {plan.locked.map(f => (
                                                                <span key={f} className="inline-flex items-center gap-1 text-xs text-slate-500 bg-white/4 px-2 py-0.5 rounded-md border border-white/8">
                                                                    🔒 {f}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="text-2xl font-black text-white">₹{plan.price.toLocaleString('en-IN')}</p>
                                                        <p className="text-slate-500 text-xs">/month</p>
                                                    </div>
                                                </div>

                                                {selectedPlan === plan.id && (
                                                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                                                        <Check size={11} className="text-white" />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    <motion.button
                                        onClick={() => setStep('payment')}
                                        whileTap={{ scale: 0.98 }}
                                        whileHover={{ scale: 1.01 }}
                                        className="w-full py-4 font-black text-white rounded-2xl text-sm tracking-wide"
                                        style={{
                                            background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                                            boxShadow: '0 8px 24px rgba(109,40,217,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
                                        }}
                                    >
                                        Continue with {PLANS.find(p => p.id === selectedPlan)?.name} Plan →
                                    </motion.button>

                                    <p className="text-center text-slate-600 text-xs mt-3">
                                        No credit card · UPI payment · Activated within 30 minutes
                                    </p>
                                </>
                            )}

                            {/* ── STEP: PAYMENT ── */}
                            {step === 'payment' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.22 }}
                                >
                                    <button
                                        onClick={() => setStep('plans')}
                                        className="flex items-center gap-1 text-slate-400 hover:text-white text-xs mb-5 transition"
                                    >
                                        ← Back to plans
                                    </button>

                                    {(() => {
                                        const plan = PLANS.find(p => p.id === selectedPlan)!
                                        return (
                                            <div
                                                className="flex items-center justify-between p-3 rounded-xl mb-5"
                                                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
                                            >
                                                <span className="text-slate-200 text-sm font-semibold">{plan.name} Plan — 1 Month</span>
                                                <span className="text-white font-black text-lg">₹{plan.price.toLocaleString('en-IN')}</span>
                                            </div>
                                        )
                                    })()}

                                    {/* QR Code */}
                                    <div className="flex justify-center mb-4">
                                        <div className="p-3 bg-white rounded-2xl shadow-xl">
                                            <img
                                                src="/upi-qr.png"
                                                alt="UPI QR Code"
                                                className="w-44 h-44 object-contain rounded-lg"
                                                onError={e => {
                                                    const el = e.currentTarget
                                                    el.style.display = 'none'
                                                    const fallback = document.createElement('div')
                                                    fallback.className = 'w-44 h-44 flex flex-col items-center justify-center bg-slate-100 rounded-xl text-slate-500 text-xs text-center gap-2 p-4'
                                                    fallback.innerHTML = '<span style="font-size:2rem">📱</span><span>Add <strong>/public/upi-qr.png</strong> to show your QR code</span>'
                                                    el.parentNode?.appendChild(fallback)
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* UPI ID row */}
                                    <div
                                        className="flex items-center gap-2 p-3 rounded-xl mb-4"
                                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-500 text-xs mb-0.5">UPI ID</p>
                                            <p className="text-white font-mono font-bold text-sm truncate">{UPI_ID}</p>
                                        </div>
                                        <button
                                            onClick={copyUPI}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold flex-shrink-0 transition ${copied
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                }`}
                                        >
                                            {copied ? <><Check size={12} />Copied!</> : <><Copy size={12} />Copy</>}
                                        </button>
                                    </div>

                                    {/* Steps */}
                                    <div className="space-y-2.5 mb-5">
                                        {[
                                            { n: '1', text: 'Open GPay, PhonePe, or Paytm on your phone' },
                                            { n: '2', text: `Scan the QR above or enter UPI ID: ${UPI_ID}` },
                                            { n: '3', text: `Pay ₹${PLANS.find(p => p.id === selectedPlan)?.price?.toLocaleString('en-IN')}` },
                                            { n: '4', text: 'Click the button below to send your transaction details via WhatsApp' },
                                        ].map(s => (
                                            <div key={s.n} className="flex items-start gap-3">
                                                <span
                                                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0 mt-0.5"
                                                    style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}
                                                >
                                                    {s.n}
                                                </span>
                                                <p className="text-slate-300 text-sm leading-snug">{s.text}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* WhatsApp CTA */}
                                    <motion.button
                                        onClick={openWhatsApp}
                                        whileTap={{ scale: 0.98 }}
                                        whileHover={{ scale: 1.01 }}
                                        className="w-full py-4 font-black text-white rounded-2xl text-sm flex items-center justify-center gap-2"
                                        style={{
                                            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                            boxShadow: '0 8px 24px rgba(22,163,74,0.3)',
                                        }}
                                    >
                                        <span className="text-lg">💬</span>
                                        Notify Admin after Payment (WhatsApp)
                                        <ExternalLink size={14} className="opacity-70" />
                                    </motion.button>

                                    <p className="text-center text-slate-600 text-xs mt-3">
                                        This opens WhatsApp with your clinic ID pre-filled
                                    </p>
                                </motion.div>
                            )}

                            {/* ── STEP: DONE ── */}
                            {step === 'done' && (
                                <motion.div
                                    className="text-center py-4"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    <div
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                                        style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
                                    >
                                        <span className="text-3xl">✅</span>
                                    </div>
                                    <h3 className="text-xl font-black text-white mb-2">Message Sent!</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                                        We received your WhatsApp notification. Your subscription will be activated within{' '}
                                        <strong className="text-white">30 minutes</strong> during business hours.
                                    </p>

                                    <div
                                        className="p-4 rounded-2xl text-left mb-5 space-y-2"
                                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                                    >
                                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">What happens next</p>
                                        {[
                                            'We verify your UPI transaction',
                                            'We activate your subscription in our system',
                                            'You refresh the page — full access restored',
                                        ].map((t, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                                                <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                                                {t}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => window.location.reload()}
                                            className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition"
                                        >
                                            🔄 Refresh Page
                                        </button>
                                        <button
                                            onClick={onClose}
                                            className="flex-1 py-3 text-slate-400 font-semibold rounded-xl text-sm transition"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                                        >
                                            Close
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
