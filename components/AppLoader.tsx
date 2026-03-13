import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface AppLoaderProps {
    message?: string
    /**
     * Delay in ms before the loader even appears.
     * If loading finishes before this delay, the loader never shows at all.
     * This eliminates the "flash of loader" on fast operations.
     * Default: 400ms
     */
    delay?: number
}

export function AppLoader({ message = 'Loading NirogOS...', delay = 400 }: AppLoaderProps) {
    const [visible, setVisible] = useState(false)

    // Only show loader if loading takes longer than `delay` ms.
    // This is the fix for "loader appears too many times" —
    // fast operations (< 400ms) will never show the loader at all.
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), delay)
        return () => clearTimeout(t)
    }, [delay])

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="nirogos-loader"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
                    style={{ background: '#080d1a' }}
                >
                    {/* Ambient glow blobs */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div style={{
                            position: 'absolute', top: '20%', left: '30%',
                            width: 480, height: 480,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 70%)',
                            filter: 'blur(40px)',
                        }} />
                        <div style={{
                            position: 'absolute', bottom: '20%', right: '25%',
                            width: 360, height: 360,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
                            filter: 'blur(40px)',
                        }} />
                    </div>

                    {/* ECG / heartbeat line */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none opacity-[0.07]">
                        <svg viewBox="0 0 800 80" width="800" height="80" fill="none">
                            <motion.polyline
                                points="0,40 160,40 180,40 200,10 215,70 230,40 260,40 280,40 300,10 315,70 330,40 640,40 800,40"
                                stroke="#4f46e5"
                                strokeWidth="2"
                                fill="none"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop', repeatDelay: 0.5 }}
                            />
                        </svg>
                    </div>

                    {/* Main content */}
                    <div className="relative flex flex-col items-center">

                        {/* Logo icon */}
                        <motion.div
                            initial={{ scale: 0.6, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.05 }}
                            className="mb-6 relative"
                        >
                            {/* Outer pulse ring */}
                            <motion.div
                                className="absolute inset-0 rounded-2xl"
                                style={{ background: 'rgba(79,70,229,0.3)' }}
                                animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                            />
                            <div style={{
                                width: 72, height: 72,
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                borderRadius: 20,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 40px rgba(79,70,229,0.5), 0 8px 32px rgba(0,0,0,0.4)',
                                position: 'relative',
                            }}>
                                {/* M letter mark */}
                                <svg width="36" height="30" viewBox="0 0 36 30" fill="none">
                                    <path
                                        d="M2 28V4L18 20L34 4V28"
                                        stroke="white"
                                        strokeWidth="3.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        fill="none"
                                    />
                                    {/* Small cross / plus mark */}
                                    <circle cx="18" cy="20" r="2.5" fill="rgba(255,255,255,0.6)" />
                                </svg>
                            </div>
                        </motion.div>

                        {/* Wordmark */}
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.18, duration: 0.4 }}
                            className="text-center mb-8"
                        >
                            <h1 style={{
                                fontSize: 28,
                                fontWeight: 800,
                                letterSpacing: '-0.03em',
                                color: '#ffffff',
                                fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                                lineHeight: 1,
                            }}>
                                Medi<span style={{ color: '#818cf8' }}>Flow</span>
                            </h1>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.35 }}
                                style={{
                                    fontSize: 12,
                                    color: 'rgba(148,163,184,0.8)',
                                    marginTop: 6,
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    fontFamily: 'system-ui, sans-serif',
                                }}
                            >
                                {message}
                            </motion.p>
                        </motion.div>

                        {/* Progress bar */}
                        <motion.div
                            initial={{ opacity: 0, scaleX: 0.8 }}
                            animate={{ opacity: 1, scaleX: 1 }}
                            transition={{ delay: 0.3 }}
                            style={{
                                width: 160,
                                height: 2,
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: 99,
                                overflow: 'hidden',
                            }}
                        >
                            <motion.div
                                style={{
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #4f46e5, #818cf8, #10b981)',
                                    borderRadius: 99,
                                }}
                                initial={{ width: '0%' }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1], delay: 0.35 }}
                            />
                        </motion.div>

                        {/* Three dots */}
                        <div className="flex items-center gap-1.5 mt-5">
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    style={{
                                        width: 4, height: 4,
                                        borderRadius: '50%',
                                        background: '#4f46e5',
                                    }}
                                    animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                                    transition={{
                                        duration: 1.2,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                        ease: 'easeInOut',
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Bottom tag */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        style={{
                            position: 'absolute', bottom: 28,
                            fontSize: 10,
                            color: 'rgba(100,116,139,0.6)',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            fontFamily: 'system-ui, sans-serif',
                        }}
                    >
                        Clinic Management · Powered by NirogOS
                    </motion.p>
                </motion.div>
            )}
        </AnimatePresence>
    )
}