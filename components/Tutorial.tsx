// src/components/Tutorial.tsx
// Hardened 4-step walkthrough — handles missing elements, scroll-into-view, mobile.

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight } from 'lucide-react'

export const TUTORIAL_DONE_KEY = 'clinicos_tutorial_done_v2'

interface TutorialStep {
    target: string
    title: string
    body: string
    emoji: string
    position: 'bottom' | 'top' | 'left' | 'right'
    fallbackY?: number
}

const STEPS: TutorialStep[] = [
    {
        target: '[data-tour="queue-buttons"]',
        title: 'Start Your Session',
        emoji: '🟢',
        body: 'Click "Accepting" to open your clinic for patients. Hit "Emergency" to instantly pause all new walk-ins — the QR page and Front Desk will block automatically.',
        position: 'bottom',
        fallbackY: 200,
    },
    {
        target: '[data-tour="patient-queue"]',
        title: 'Your Patient Queue',
        emoji: '👥',
        body: 'Patients appear here as they check in. Click any patient card to open their consultation. The timer shows how long they\'ve been waiting.',
        position: 'right',
        fallbackY: 320,
    },
    {
        target: '[data-tour="medicine-search"]',
        title: 'Add Medicines Instantly',
        emoji: '💊',
        body: 'Type any medicine name and press Enter to add it. See the 🟢🔴🟡 dots? Green = after food, Red = before food, Yellow = with food. Add as many as you need — search bar stays pinned at top.',
        position: 'top',
        fallbackY: 480,
    },
    {
        target: '[data-tour="send-prescription"]',
        title: 'Send to Patient in 1 Click',
        emoji: '📲',
        body: 'This button sends the prescription link directly to the patient\'s WhatsApp. They get a beautiful digital prescription instantly — no PDF, no storage, no printing needed.',
        position: 'top',
        fallbackY: 600,
    },
]

interface TutorialProps {
    onComplete: () => void
}

interface TooltipPos {
    top: number
    left: number
    arrowSide: 'top' | 'bottom' | 'left' | 'right'
}

function getTooltipPosition(el: Element | null, step: TutorialStep, tooltipW = 300, tooltipH = 160): TooltipPos {
    const GAP = 14
    const vw = window.innerWidth
    const vh = window.innerHeight

    if (!el) {
        return { top: step.fallbackY ?? 300, left: Math.max(16, (vw - tooltipW) / 2), arrowSide: 'top' }
    }

    const rect = el.getBoundingClientRect()
    let top = 0
    let left = 0
    let arrowSide: TooltipPos['arrowSide'] = 'top'

    switch (step.position) {
        case 'bottom':
            top = rect.bottom + GAP
            left = rect.left + rect.width / 2 - tooltipW / 2
            arrowSide = 'top'
            break
        case 'top':
            top = rect.top - tooltipH - GAP
            left = rect.left + rect.width / 2 - tooltipW / 2
            arrowSide = 'bottom'
            break
        case 'right':
            top = rect.top + rect.height / 2 - tooltipH / 2
            left = rect.right + GAP
            arrowSide = 'left'
            break
        case 'left':
            top = rect.top + rect.height / 2 - tooltipH / 2
            left = rect.left - tooltipW - GAP
            arrowSide = 'right'
            break
    }

    // Clamp to viewport
    left = Math.max(12, Math.min(left, vw - tooltipW - 12))
    top = Math.max(12, Math.min(top, vh - tooltipH - 12))

    return { top, left, arrowSide }
}

export default function Tutorial({ onComplete }: TutorialProps) {
    const [step, setStep] = useState(0)
    const [spotRect, setSpotRect] = useState<DOMRect | null>(null)
    const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ top: 200, left: 200, arrowSide: 'top' })
    const [ready, setReady] = useState(false)

    const positionForStep = useCallback((stepIndex: number) => {
        const current = STEPS[stepIndex]
        const el = document.querySelector(current.target)

        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
            setTimeout(() => {
                const rect = el.getBoundingClientRect()
                setSpotRect(rect)
                setTooltipPos(getTooltipPosition(el, current))
                setReady(true)
            }, 350)
        } else {
            console.warn(`[Tutorial] data-tour target not found: ${current.target}`)
            setSpotRect(null)
            setTooltipPos(getTooltipPosition(null, current))
            setReady(true)
        }
    }, [])

    useEffect(() => {
        setReady(false)
        positionForStep(step)
    }, [step, positionForStep])

    useEffect(() => {
        function onResize() { positionForStep(step) }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [step, positionForStep])

    function handleNext() {
        if (step < STEPS.length - 1) {
            setReady(false)
            setStep(s => s + 1)
        } else {
            handleComplete()
        }
    }

    function handleComplete() {
        localStorage.setItem(TUTORIAL_DONE_KEY, 'true')
        onComplete()
    }

    const current = STEPS[step]

    return (
        <>
            {/* Dark overlay */}
            <div
                className="fixed inset-0 z-[9998] transition-opacity duration-300"
                style={{ background: 'rgba(0,0,0,0.55)' }}
                onClick={handleComplete}
            />

            {/* Spotlight cutout */}
            {spotRect && (
                <div
                    className="fixed z-[9998] pointer-events-none transition-all duration-300 rounded-xl"
                    style={{
                        top: spotRect.top - 8,
                        left: spotRect.left - 8,
                        width: spotRect.width + 16,
                        height: spotRect.height + 16,
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                    }}
                />
            )}

            {/* Tooltip bubble */}
            <AnimatePresence mode="wait">
                {ready && (
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, scale: 0.92, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -8 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
                        style={{ width: 300, top: tooltipPos.top, left: tooltipPos.left }}
                    >
                        {/* Progress bar */}
                        <div className="h-1 bg-slate-100">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                            />
                        </div>

                        <div className="p-5">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-2xl">{current.emoji}</span>
                                    <div>
                                        <p className="font-black text-slate-900 text-sm leading-tight">{current.title}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Step {step + 1} of {STEPS.length}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleComplete}
                                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0 ml-2"
                                >
                                    <X size={12} className="text-slate-500" />
                                </button>
                            </div>

                            {/* Body */}
                            <p className="text-slate-600 text-xs leading-relaxed mb-4">{current.body}</p>

                            {/* Footer */}
                            <div className="flex items-center justify-between">
                                <div className="flex gap-1.5">
                                    {STEPS.map((_, i) => (
                                        <div
                                            key={i}
                                            className={`h-1.5 rounded-full transition-all duration-300 ${i === step
                                                    ? 'w-5 bg-indigo-600'
                                                    : i < step
                                                        ? 'w-1.5 bg-emerald-400'
                                                        : 'w-1.5 bg-slate-200'
                                                }`}
                                        />
                                    ))}
                                </div>

                                <button
                                    onClick={handleNext}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition"
                                >
                                    {step < STEPS.length - 1 ? (
                                        <>Next <ArrowRight size={12} /></>
                                    ) : (
                                        <>✓ Let's go!</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
