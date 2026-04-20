import { useState, useContext, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Check, X, CheckCircle, Sparkles, MessageCircle,
    Star, Zap, Clock
} from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import { usePendingPlan } from '../hooks/usePendingPlan'
import { supabase } from '../services/db'
import toast from 'react-hot-toast'
import {
    PLAN_PRICE_BY_ID,
    formatPlanName,
    normalizePlanId,
} from '../src/constants/subscriptionPlans'

// ── Pricing tiers ──────────────────────────────────────────────────
const TIERS = [
    {
        id: 'basic',
        name: 'Basic',
        badge: null as string | null,
        icon: Zap,
        tagline: 'The Full Clinic Starter',
        description: 'Every core NirogOS workflow is unlocked from day one for pilot and growing clinics.',
        monthlyPrice: PLAN_PRICE_BY_ID.basic,
        yearlyPrice: 414,
        perDay: 17,
        color: 'slate' as const,
        highlighted: false,
        accentClass: 'border-slate-200',
        ctaClass: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
        features: [
            { text: 'Doctor Portal + Front Desk access', included: true },
            { text: 'Unlimited patients and patient history', included: true },
            { text: 'QR check-in and WhatsApp prescriptions', included: true },
            { text: 'Analytics dashboard and exports', included: true },
            { text: 'No patient-data usage limit', included: true },
            { text: 'Admin-controlled clinic management', included: true },
        ],
    },
    {
        id: 'professional',
        name: 'Professional',
        badge: '⭐ Most Popular',
        icon: Star,
        tagline: 'The Full Clinic Growth Plan',
        description: 'All product access plus faster support, founder onboarding, and rollout assistance.',
        monthlyPrice: PLAN_PRICE_BY_ID.professional,
        yearlyPrice: 829,
        perDay: 33,
        color: 'indigo' as const,
        highlighted: true,
        accentClass: 'border-indigo-500 shadow-2xl shadow-indigo-100',
        ctaClass: 'bg-indigo-600 text-white hover:bg-indigo-700',
        features: [
            { text: 'Everything in Basic', included: true },
            { text: 'Priority support and faster activation help', included: true },
            { text: 'Founder onboarding assistance', included: true },
            { text: 'Operational guidance for rollout clinics', included: true },
            { text: 'Unlimited patients and records', included: true },
            { text: 'No patient-data usage limit', included: true },
        ],
    },
]

const FAQS = [
    {
        q: 'How does the free trial work?',
        a: "You get 30 days of full access to test all features. No payment required upfront. After the trial, you choose a plan and pay via UPI.",
    },
    {
        q: 'How do I pay?',
        a: "We accept UPI (Google Pay, PhonePe, Paytm). After selecting a plan, click the green WhatsApp button and we'll send you the UPI QR code. Your plan activates within 30 minutes of payment confirmation.",
    },
    {
        q: 'Can I upgrade or downgrade?',
        a: "Yes, anytime. Contact us on WhatsApp and we'll adjust your plan for the next billing cycle.",
    },
    {
        q: 'What does "QR Check-in" mean?',
        a: "Patients scan a QR code at your clinic on their phone and register themselves — no front desk needed. Saves 30–60 minutes per day.",
    },
    {
        q: 'Is patient data secure?',
        a: "Yes. All data is encrypted at rest and in transit on secure cloud infrastructure with Row Level Security on every table.",
    },
]

// ── Feature 2: Upgrade Confirmation Modal ──────────────────────────
function UpgradeModal({
    tier,
    isYearly,
    clinicId,
    clinicName,
    doctorName,
    onClose,
    onSuccess,
}: {
    tier: typeof TIERS[0]
    isYearly: boolean
    clinicId: string
    clinicName: string
    doctorName: string
    onClose: () => void
    onSuccess: () => void
}) {
    const [sending, setSending] = useState(false)

    const monthlyPrice = isYearly ? tier.yearlyPrice : tier.monthlyPrice
    const totalDue = isYearly ? tier.yearlyPrice * 12 : tier.monthlyPrice
    const billingLabel = isYearly ? 'Yearly' : 'Monthly'

    const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '917620422387'

    // Feature 3: WhatsApp payload + Supabase update
    async function handleSendRequest() {
        setSending(true)

        try {
            // Step 1: Database Update — set plan_status = 'pending'
            const { error } = await (supabase as any)
                .from('clinics')
                .update({ plan_status: 'pending' })
                .eq('id', clinicId)

            if (error) {
                toast.error('Failed to update plan status: ' + error.message)
                setSending(false)
                return
            }

            // Step 2: WhatsApp Redirect — open wa.me with pre-filled text
            const waText = encodeURIComponent(
                `Hi Sahil, I want to upgrade to the ${tier.name} ${billingLabel} Plan. ` +
                `My Clinic ID is: ${clinicId}. ` +
                `Please send the UPI QR code.`
            )
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`, '_blank')

            toast.success('Upgrade request sent! Check WhatsApp.')

            // Step 3: Callback to parent (navigates to dashboard)
            onSuccess()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            toast.error('Something went wrong: ' + message)
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
                {/* Header */}
                <div className="bg-gradient-to-br from-slate-900 to-indigo-900 px-6 py-5">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                    >
                        <X size={14} className="text-white" />
                    </button>
                    <p className="text-indigo-300 text-xs font-semibold mb-1">Upgrade Plan</p>
                    <h3 className="text-white text-xl font-black">
                        Upgrade to {tier.name} ({billingLabel})
                    </h3>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Summary Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-600">Plan</span>
                            <span className="text-sm font-black text-slate-900">{tier.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-600">Billing</span>
                            <span className="text-sm font-black text-slate-900">{billingLabel}</span>
                        </div>
                        {isYearly && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-600">Per Month</span>
                                <span className="text-sm font-bold text-slate-700">₹{monthlyPrice.toLocaleString('en-IN')}</span>
                            </div>
                        )}
                        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-900">Total amount due today</span>
                            <span className="text-2xl font-black text-slate-900">₹{totalDue.toLocaleString('en-IN')}</span>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
                        <MessageCircle size={18} className="text-green-600 flex-shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-green-800">Payment Method</p>
                            <p className="text-sm font-semibold text-green-700">Manual UPI via WhatsApp</p>
                        </div>
                    </div>

                    {/* Steps */}
                    <ol className="space-y-2 text-sm text-slate-600">
                        {[
                            'Click the button below to send your request on WhatsApp',
                            'We\'ll send you a UPI QR code within minutes',
                            'Pay via any UPI app and share the screenshot',
                            'Plan activated within 30 minutes of confirmation',
                        ].map((step, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                                    {i + 1}
                                </span>
                                <span className="font-medium">{step}</span>
                            </li>
                        ))}
                    </ol>

                    {/* CTA: Send Request on WhatsApp */}
                    <button
                        onClick={handleSendRequest}
                        disabled={sending}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold rounded-2xl transition shadow-lg shadow-green-200 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <MessageCircle size={18} />
                        {sending ? 'Sending...' : 'Send Request on WhatsApp'}
                    </button>

                    <p className="text-center text-xs text-slate-400">
                        Your account will be upgraded within 30 minutes of payment confirmation
                    </p>
                </div>
            </motion.div>
        </div>
    )
}

// ── Helper: determine CTA label contextually ──────────────────────
function getCTALabel(
    tierId: string,
    tierName: string,
    currentPlanId: string,
    isLoggedIn: boolean,
    isPending: boolean,
): { label: string; disabled: boolean } {
    if (isPending) return { label: '⏳ Upgrade Pending...', disabled: true }
    if (isLoggedIn && currentPlanId === tierId) return { label: 'Current Plan ✓', disabled: true }
    if (isLoggedIn) return { label: `Upgrade to ${tierName}`, disabled: false }
    // Non-logged-in: go straight to WhatsApp, not login page
    return { label: `💬 Get Started on WhatsApp`, disabled: false }
}

// ── Main PricingPage ───────────────────────────────────────────────
export default function PricingPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const authCtx = useContext(AuthContext)
    const user = authCtx?.user ?? null
    const clinicId = authCtx?.clinicId ?? null
    const clinicProfile = authCtx?.clinicProfile ?? null
    const { subscription, status } = useSubscription(clinicId, true)
    const { getPendingPlan, setPendingPlan, clearPendingPlan } = usePendingPlan()

    const [isYearly, setIsYearly] = useState(false)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [selectedTier, setSelectedTier] = useState<typeof TIERS[0] | null>(null)
    const [openFaq, setOpenFaq] = useState<number | null>(null)
    const [planStatus, setPlanStatus] = useState<string>('none')
    const [whatsappConfirmTier, setWhatsappConfirmTier] = useState<typeof TIERS[0] | null>(null)

    // Fetch plan_status from clinics table
    useEffect(() => {
        if (!clinicId) return
        (supabase as any)
            .from('clinics')
            .select('plan_status')
            .eq('id', clinicId)
            .single()
            .then(({ data, error }) => {
                if (!error && data && typeof data.plan_status === 'string') {
                    setPlanStatus(data.plan_status)
                }
            })
    }, [clinicId])

    // Auto-open modal if redirected back from login with a pending plan
    useEffect(() => {
        const upgradeParam = searchParams.get('upgrade')
        if (upgradeParam === 'true' && user) {
            const pending = getPendingPlan()
            if (pending) {
                const tier = TIERS.find(t => t.id === pending.id)
                if (tier) {
                    setIsYearly(pending.isYearly)
                    setSelectedTier(tier)
                    setShowUpgradeModal(true)
                    clearPendingPlan()
                }
            }
        }
    }, [searchParams, user])

    // Current plan label
    const planName = subscription?.plan_name?.toLowerCase() ?? 'trial'
    const currentPlanId = normalizePlanId(planName)
    const isPending = planStatus === 'pending'

    // Feature 1: Context-aware CTA handler
    function handleCTAClick(tier: typeof TIERS[0]) {
        if (!user) {
            // ── NOT logged in → show confirmation popup first ──────────
            setWhatsappConfirmTier(tier)
            return
        }

        // ── Logged in → open upgrade modal (which also opens WhatsApp) ──
        setSelectedTier(tier)
        setShowUpgradeModal(true)
    }

    // Feature 3: After successful WhatsApp send
    function handleUpgradeSuccess() {
        setShowUpgradeModal(false)
        setSelectedTier(null)
        setPlanStatus('pending')
        navigate('/dashboard')
    }

    const yearlyDiscount = 17

    const doctorName =
        (clinicProfile as { doctor_name?: string })?.doctor_name ??
        user?.user_metadata?.full_name ??
        user?.user_metadata?.first_name ??
        ''

    const clinicName =
        (clinicProfile as { clinic_name_override?: string; name?: string })?.clinic_name_override ??
        (clinicProfile as { name?: string })?.name ??
        'Not set'

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 pb-24">

            {/* ── Pending Banner (shown inline on pricing page too) ── */}
            {user && isPending && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold text-amber-800">
                    <Clock size={16} className="text-amber-600 flex-shrink-0" />
                    ⏳ Upgrade Pending: Please complete your UPI payment on WhatsApp. Your account will be upgraded within 30 minutes of payment confirmation.
                </div>
            )}

            {/* ── Header ── */}
            <div className="max-w-5xl mx-auto px-4 pt-14 pb-2 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full text-xs font-bold text-indigo-700 mb-6">
                    <Sparkles size={12} />
                    Founder offer live for the first 43 clinics
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">
                    {user ? 'Upgrade your plan' : 'Simple, honest pricing'}
                </h1>
                <p className="text-slate-500 text-lg max-w-xl mx-auto font-medium mb-8">
                    {user
                        ? 'Choose the plan that fits your clinic. Pay via UPI on WhatsApp.'
                        : 'Start your 30-day free trial. No credit card required. No setup fees.'
                    }
                </p>

                {/* Current plan banner for logged-in users */}
                {user && status !== 'loading' && (
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6 ${isPending ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                        status === 'trial' ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                            status === 'active' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
                                'bg-slate-50 border border-slate-200 text-slate-700'
                        }`}>
                        {isPending ? '⏳' : status === 'trial' ? '⏳' : status === 'active' ? '✅' : '💡'}
                        {isPending && 'Upgrade pending — awaiting payment confirmation'}
                        {!isPending && status === 'trial' && 'Free Trial active — upgrade to keep access'}
                        {!isPending && status === 'active' && `Your Plan: ${formatPlanName(planName)} ✓`}
                        {!isPending && status !== 'trial' && status !== 'active' && 'Select a plan to get started'}
                    </div>
                )}

                {/* Billing toggle */}
                <div className="flex items-center justify-center gap-3 mt-2">
                    <span className={`text-sm font-bold ${!isYearly ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
                    <button
                        onClick={() => setIsYearly(v => !v)}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${isYearly ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isYearly ? 'translate-x-6' : ''}`} />
                    </button>
                    <span className={`text-sm font-bold ${isYearly ? 'text-slate-900' : 'text-slate-400'}`}>
                        Yearly
                        <span className="ml-2 inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-black rounded-full">
                            Save {yearlyDiscount}%
                        </span>
                    </span>
                </div>
            </div>

            {/* ── Pricing Cards ── */}
            <div className="max-w-5xl mx-auto px-4 mt-10 grid grid-cols-1 gap-6 items-start md:grid-cols-2">
                {TIERS.map(tier => {
                    const price = isYearly ? tier.yearlyPrice : tier.monthlyPrice
                    const originalMonthly = tier.monthlyPrice
                    const isCurrent = status === 'active' && currentPlanId === tier.id
                    const Icon = tier.icon
                    const lockedFeatures = tier.features.filter(f => !f.included)
                    const cta = getCTALabel(tier.id, tier.name, currentPlanId, !!user, isPending)

                    return (
                        <motion.div
                            key={tier.id}
                            whileHover={{ y: -4 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className={`relative bg-white rounded-3xl border overflow-hidden flex flex-col ${tier.highlighted
                                ? 'border-indigo-500 shadow-2xl shadow-indigo-100 scale-[1.04]'
                                : 'border-slate-200 shadow-sm hover:shadow-md'
                                } ${isCurrent ? 'ring-2 ring-emerald-400' : ''}`}
                        >
                            {/* Top accent bar */}
                            {tier.highlighted && (
                                <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />
                            )}

                            {/* Badge */}
                            {(tier.badge || isCurrent) && (
                                <div className="absolute top-4 right-4">
                                    {isCurrent ? (
                                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-black rounded-full">
                                            ✓ Current Plan
                                        </span>
                                    ) : tier.badge ? (
                                        <span className={`px-2.5 py-1 text-xs font-black rounded-full ${tier.highlighted ? 'bg-indigo-600 text-white' : 'bg-violet-100 text-violet-700'}`}>
                                            {tier.badge}
                                        </span>
                                    ) : null}
                                </div>
                            )}

                            <div className="p-7 flex flex-col flex-1">
                                {/* Header */}
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${tier.id === 'basic' ? 'bg-slate-100' : 'bg-indigo-50'}`}>
                                    <Icon size={24} className={
                                        tier.id === 'basic' ? 'text-slate-600' : 'text-indigo-600'
                                    } />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-0.5">{tier.name}</h3>
                                <p className="text-xs font-bold text-slate-500 mb-1">{tier.tagline}</p>
                                <p className="text-sm text-slate-500 font-medium mb-5">{tier.description}</p>

                                {/* Price */}
                                <div className="mb-1">
                                    {isYearly && (
                                        <span className="text-slate-400 line-through text-sm font-medium mr-1">₹{originalMonthly}</span>
                                    )}
                                    <span className="text-4xl font-black text-slate-900">₹{price.toLocaleString('en-IN')}</span>
                                    <span className="text-slate-400 font-medium ml-1 text-sm">/{isYearly ? 'mo (billed yearly)' : 'month'}</span>
                                </div>
                                <p className="text-xs text-slate-400 font-semibold mb-1">
                                    That's just ₹{tier.perDay}/day
                                    {isYearly && <span className="text-emerald-600 ml-1">(Save ₹{((originalMonthly - price) * 12).toLocaleString('en-IN')}/year)</span>}
                                </p>
                                {isYearly && (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 mb-1 mt-2">
                                        <p className="text-xs font-bold text-indigo-800">
                                            Total billed today: <span className="text-base font-black text-indigo-900">₹{(price * 12).toLocaleString('en-IN')}</span>
                                        </p>
                                        <p className="text-[10px] text-indigo-500 font-medium">One-time payment for 12 months</p>
                                    </div>
                                )}
                                {tier.id === 'professional' && (
                                    <p className="text-xs text-teal-600 font-semibold mb-4">⭐ Founder support eligible</p>
                                )}

                                {/* Features */}
                                <ul className="space-y-2.5 mb-8 flex-1 mt-2">
                                    {tier.features.map((f, i) => (
                                        <li key={i} className="flex items-center gap-2.5 text-sm">
                                            {f.included ? (
                                                <Check size={16} className="text-emerald-500 flex-shrink-0" />
                                            ) : (
                                                <X size={16} className="text-slate-300 flex-shrink-0" />
                                            )}
                                            <span className={f.included ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                                                {f.text}
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                {/* Loss framing for locked features */}
                                {lockedFeatures.length > 0 && !isCurrent && (
                                    <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-3 font-medium">
                                        You're missing: {lockedFeatures.map(f => f.text.split(' ')[0]).join(', ')}
                                    </p>
                                )}

                                {/* Feature 1: Context-Aware CTA */}
                                <button
                                    onClick={() => !cta.disabled && handleCTAClick(tier)}
                                    disabled={cta.disabled}
                                    className={`w-full py-3.5 rounded-2xl text-sm font-bold transition active:scale-[0.98] ${cta.disabled
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : tier.ctaClass
                                        }`}
                                >
                                    {cta.label} {!cta.disabled && '→'}
                                </button>
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            <div className="max-w-5xl mx-auto px-4 mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="text-sm text-slate-500 font-medium">🔄 Cancel anytime. No questions asked.</div>
                <div className="text-sm text-slate-500 font-medium">🔒 Your data is always yours. Export anytime.</div>
                <div className="text-sm text-slate-500 font-medium">📞 Founder support on WhatsApp directly.</div>
            </div>
            <p className="mt-4 text-center text-sm italic text-slate-400">
                Prices in INR. GST applicable. Annual plans billed once per year.
            </p>

            {/* ── Social Proof ── */}
            <div className="max-w-3xl mx-auto px-4 mt-10">
                <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
                        <span className="text-2xl">🏆</span>
                    </div>
                    <div>
                        <p className="font-black text-slate-900 mb-0.5">Founder's Plan is open</p>
                        <p className="text-sm text-slate-500 font-medium">
                            The first 43 clinics get 3 months free on Professional, then founder clinics stay locked at ₹599/month forever.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Trial Ending Banner ── */}
            {user && status === 'trial' && !isPending && (
                <div className="max-w-3xl mx-auto px-4 mt-6">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-600" />
                            <span className="text-sm text-indigo-800 font-medium">
                                Start your subscription to continue after your trial ends
                            </span>
                        </div>
                        <button
                            onClick={() => {
                                const tier = TIERS[1]
                                handleCTAClick(tier)
                            }}
                            className="text-xs font-semibold text-white bg-indigo-600 px-3 py-1.5 rounded-xl hover:bg-indigo-700 whitespace-nowrap"
                        >
                            Upgrade
                        </button>
                    </div>
                </div>
            )}

            {/* ── FAQs ── */}
            <div className="max-w-2xl mx-auto px-4 mt-14">
                <h2 className="text-2xl font-black text-slate-900 text-center mb-8">Frequently asked questions</h2>
                <div className="space-y-3">
                    {FAQS.map((faq, i) => (
                        <div
                            key={i}
                            className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                        >
                            <button
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                className="w-full text-left px-6 py-4 font-bold text-slate-900 flex items-center justify-between gap-4"
                            >
                                <span>{faq.q}</span>
                                <span className={`text-slate-400 transition-transform ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                            </button>
                            <AnimatePresence>
                                {openFaq === i && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <p className="px-6 pb-5 text-slate-500 font-medium text-sm leading-relaxed">{faq.a}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Footer CTA ── */}
            <div className="max-w-xl mx-auto px-4 mt-14 text-center">
                <p className="text-slate-500 font-medium text-sm mb-4">
                    Questions? Chat with us directly on WhatsApp.
                </p>
                <a
                    href="https://wa.me/917620422387?text=Hi%2C+I+have+a+question+about+NirogOS+pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-sm transition shadow-lg shadow-green-200"
                >
                    <MessageCircle size={16} />
                    Chat on WhatsApp
                </a>
            </div>

            {/* ── WhatsApp Confirmation Popup (non-logged-in users) ── */}
            <AnimatePresence>
                {whatsappConfirmTier && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setWhatsappConfirmTier(null)}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="bg-gradient-to-br from-green-600 to-emerald-700 px-6 py-5">
                                <button
                                    onClick={() => setWhatsappConfirmTier(null)}
                                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                                >
                                    <X size={14} className="text-white" />
                                </button>
                                <p className="text-green-200 text-xs font-semibold mb-1">Confirm Your Plan</p>
                                <h3 className="text-white text-xl font-black">
                                    {whatsappConfirmTier.name} — {isYearly ? 'Yearly' : 'Monthly'}
                                </h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-600">Plan</span>
                                        <span className="text-sm font-black text-slate-900">{whatsappConfirmTier.name}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-600">Billing</span>
                                        <span className="text-sm font-black text-slate-900">{isYearly ? 'Yearly' : 'Monthly'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-600">Per Month</span>
                                        <span className="text-sm font-bold text-slate-700">
                                            ₹{(isYearly ? whatsappConfirmTier.yearlyPrice : whatsappConfirmTier.monthlyPrice).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                    {isYearly && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold text-emerald-600">You save</span>
                                            <span className="text-sm font-black text-emerald-600">
                                                ₹{((whatsappConfirmTier.monthlyPrice - whatsappConfirmTier.yearlyPrice) * 12).toLocaleString('en-IN')}/year
                                            </span>
                                        </div>
                                    )}
                                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                                        <span className="text-sm font-bold text-slate-900">
                                            {isYearly ? 'Total billed today' : 'Amount due'}
                                        </span>
                                        <span className="text-2xl font-black text-slate-900">
                                            ₹{(isYearly
                                                ? whatsappConfirmTier.yearlyPrice * 12
                                                : whatsappConfirmTier.monthlyPrice
                                            ).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '917620422387'
                                        const price = isYearly ? whatsappConfirmTier.yearlyPrice : whatsappConfirmTier.monthlyPrice
                                        const total = isYearly ? price * 12 : price
                                        const waText = encodeURIComponent(
                                            `Hi, I want to start NirogOS ${whatsappConfirmTier.name} plan (₹${price.toLocaleString('en-IN')}/month, ` +
                                            `${isYearly ? `₹${total.toLocaleString('en-IN')}/year` : 'monthly billing'}).\n` +
                                            `Please help me get started and send the UPI QR code.`
                                        )
                                        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`, '_blank')
                                        setWhatsappConfirmTier(null)
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-4 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold rounded-2xl transition shadow-lg shadow-green-200 text-sm"
                                >
                                    <MessageCircle size={18} />
                                    Confirm & Open WhatsApp →
                                </button>
                                <p className="text-center text-xs text-slate-400">
                                    You'll be redirected to WhatsApp to complete your sign-up
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Upgrade Modal (logged-in users) ── */}
            <AnimatePresence>
                {showUpgradeModal && selectedTier && clinicId && (
                    <UpgradeModal
                        tier={selectedTier}
                        isYearly={isYearly}
                        clinicId={clinicId}
                        clinicName={clinicName}
                        doctorName={doctorName}
                        onClose={() => {
                            setShowUpgradeModal(false)
                            setSelectedTier(null)
                        }}
                        onSuccess={handleUpgradeSuccess}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
