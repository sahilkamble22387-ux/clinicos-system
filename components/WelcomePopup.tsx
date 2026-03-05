// src/components/WelcomePopup.tsx
// Shown ONCE after onboarding completes for the first time.
// Celebrates trial unlock and bridges into tutorial.

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Sparkles, ArrowRight } from 'lucide-react'

const FEATURES = [
    { icon: '💊', text: 'Smart prescription builder' },
    { icon: '📲', text: '1-click WhatsApp delivery' },
    { icon: '🔍', text: 'QR patient check-in' },
    { icon: '📊', text: 'Analytics & revenue reports' },
    { icon: '📝', text: 'Digital medical records' },
]

interface WelcomePopupProps {
    doctorName: string
    daysLeft: number
    onStartTour: () => void
    onSkip: () => void
}

export default function WelcomePopup({
    doctorName,
    daysLeft,
    onStartTour,
    onSkip,
}: WelcomePopupProps) {
    const firstName = doctorName.replace(/^Dr\.?\s*/i, '').split(' ')[0]

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
                {/* Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 24 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 16 }}
                    transition={{ type: 'spring', duration: 0.5, bounce: 0.35 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                >
                    {/* Purple gradient header */}
                    <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 px-8 pt-8 pb-10 text-center overflow-hidden">
                        {/* Confetti circles */}
                        {['top-3 left-6', 'top-8 right-10', 'top-2 right-4', 'top-12 left-16'].map((pos, i) => (
                            <motion.div
                                key={i}
                                className={`absolute ${pos} w-3 h-3 rounded-full opacity-40`}
                                style={{ background: ['#FDE68A', '#A5F3FC', '#FCA5A5', '#86EFAC'][i] }}
                                animate={{ y: [-4, 4, -4], rotate: [0, 180, 360] }}
                                transition={{ duration: 2 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        ))}

                        <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            className="text-5xl mb-4 inline-block"
                        >
                            🎉
                        </motion.div>

                        <h1 className="text-2xl font-black text-white mb-2 leading-tight">
                            Welcome to ClinicOS,<br />Dr. {firstName}!
                        </h1>
                        <p className="text-indigo-200 text-sm">
                            Your clinic is set up and ready to go.
                        </p>

                        {/* Trial badge */}
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.4, type: 'spring', bounce: 0.6 }}
                            className="inline-flex items-center gap-2 mt-4 bg-white/20 border border-white/30 rounded-2xl px-5 py-2.5"
                        >
                            <Sparkles size={16} className="text-yellow-300" />
                            <span className="text-white font-black text-sm">
                                {daysLeft} days free · ALL features unlocked
                            </span>
                            <Sparkles size={16} className="text-yellow-300" />
                        </motion.div>
                    </div>

                    {/* Feature list */}
                    <div className="px-8 py-5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                            Everything is unlocked for you right now:
                        </p>
                        <div className="space-y-3">
                            {FEATURES.map((f, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -16 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.15 + i * 0.07 }}
                                    className="flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-base flex-shrink-0">
                                        {f.icon}
                                    </div>
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className="text-sm font-semibold text-slate-700">{f.text}</span>
                                        <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* CTA buttons */}
                    <div className="px-8 pb-8 space-y-3">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onStartTour}
                            className="w-full flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 text-sm"
                        >
                            <span>🗺️</span>
                            Show me around — Start Tour
                            <ArrowRight size={16} />
                        </motion.button>

                        <button
                            onClick={onSkip}
                            className="w-full py-3 text-slate-400 hover:text-slate-600 text-sm font-semibold transition"
                        >
                            I'll explore on my own →
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
