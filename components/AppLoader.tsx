import { motion } from 'framer-motion'
import { Pill } from 'lucide-react'

interface AppLoaderProps {
    message?: string
}

export function AppLoader({ message = 'Loading ClinicOS...' }: AppLoaderProps) {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)' }}>

            {/* Logo mark */}
            <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className="mb-5"
            >
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/30">
                    <Pill className="text-white w-8 h-8" />
                </div>
            </motion.div>

            {/* Logo text */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-center mb-6"
            >
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">ClinicOS</h1>
                <p className="text-slate-400 text-sm mt-0.5">{message}</p>
            </motion.div>

            {/* Single animated progress bar — not a spinner */}
            <motion.div
                className="w-40 h-1 bg-slate-200 rounded-full overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <motion.div
                    className="h-full bg-indigo-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                />
            </motion.div>
        </div>
    )
}
