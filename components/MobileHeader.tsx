import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pill, X, LogOut, Settings, User as UserIcon, ChevronRight, Sparkles } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'
import { Clinic } from '../types'
import { ViewMode } from '../types'

interface MobileHeaderProps {
    session: any
    clinic: Clinic | null
    onSignOut: () => void
    authResolved: boolean
    onNavigate?: (view: ViewMode) => void
}

export function MobileHeader({ session, clinic, onSignOut, authResolved, onNavigate }: MobileHeaderProps) {
    const { status, daysLeft } = useSubscription(clinic?.id, authResolved)
    const [sheetOpen, setSheetOpen] = useState(false)

    const profile = session?.user?.user_metadata
    const fullName = profile?.full_name || profile?.first_name || session?.user?.email?.split('@')[0] || 'Doctor'

    const initials = fullName
        .split(' ')
        .filter(Boolean)
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    async function handleSignOut() {
        setSheetOpen(false)
        await onSignOut()
    }

    return (
        <>
            {/* ── Top bar ── */}
            <header
                className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 flex-shrink-0 relative z-[45]"
                style={{ paddingTop: 'calc(var(--sat) + 12px)' }}
            >
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-sm shadow-indigo-500/30">
                        <Pill className="text-white w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-sm text-slate-900 leading-none">ClinicOS</span>
                        {fullName && (
                            <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5 truncate max-w-[120px]">
                                {fullName}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right side — subscription badge + avatar */}
                <div className="flex items-center gap-2">
                    {/* Trial badge */}
                    {status === 'trial' && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            {daysLeft}d trial
                        </span>
                    )}
                    {status === 'active' && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                            ✓ Pro
                        </span>
                    )}

                    {/* Avatar button — opens bottom sheet */}
                    <button
                        onClick={() => setSheetOpen(true)}
                        className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shadow-md shadow-indigo-500/25 active:scale-95 transition-transform"
                    >
                        {initials}
                    </button>
                </div>
            </header>

            {/* ── Bottom Sheet ── */}
            <AnimatePresence>
                {sheetOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="fixed inset-0 z-50 md:hidden"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSheetOpen(false)}
                        />

                        {/* Sheet */}
                        <motion.div
                            className="fixed bottom-0 left-0 right-0 z-[60] md:hidden bg-white rounded-t-3xl"
                            style={{
                                paddingBottom: 'calc(var(--sab) + 16px)',
                                boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
                            }}
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                        >
                            {/* Handle bar */}
                            <div className="flex justify-center pt-3 pb-4">
                                <div className="w-10 h-1 rounded-full bg-slate-200" />
                            </div>

                            {/* Close button */}
                            <button
                                onClick={() => setSheetOpen(false)}
                                className="absolute top-3 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
                            >
                                <X size={14} className="text-slate-500" />
                            </button>

                            {/* User info */}
                            <div className="px-5 pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-500/25">
                                        {initials}
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900 text-base leading-tight">
                                            {fullName}
                                        </p>
                                        <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[200px]">
                                            {clinic?.name || session?.user?.email}
                                        </p>
                                    </div>
                                </div>

                                {/* Subscription status */}
                                <div className={`mt-3 px-3 py-2 rounded-xl flex items-center justify-between ${status === 'active' ? 'bg-emerald-50 border border-emerald-200' :
                                    status === 'trial' ? 'bg-amber-50 border border-amber-200' :
                                        'bg-red-50 border border-red-200'
                                    }`}>
                                    <span className={`text-xs font-semibold ${status === 'active' ? 'text-emerald-700' :
                                        status === 'trial' ? 'text-amber-700' : 'text-red-700'
                                        }`}>
                                        {status === 'active' && `✓ Active Subscription`}
                                        {status === 'trial' && `Free Trial — ${daysLeft} days left`}
                                        {(status === 'expired' || status === 'error' || status === 'locked') && `Subscription Inactive`}
                                    </span>
                                    {status !== 'active' && (
                                        <a href="/pricing" className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
                                            Upgrade
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Menu items */}
                            <div className="px-4 py-3 space-y-1">
                                {[
                                    {
                                        icon: UserIcon,
                                        label: 'Profile & Settings',
                                        action: () => {
                                            setSheetOpen(false)
                                            window.location.href = '/settings'
                                        },
                                        iconBg: 'bg-indigo-50',
                                        iconColor: 'text-indigo-600',
                                    },
                                    {
                                        icon: Settings,
                                        label: 'Clinic Settings',
                                        action: () => {
                                            setSheetOpen(false)
                                            window.location.href = '/settings'
                                        },
                                        iconBg: 'bg-slate-100',
                                        iconColor: 'text-slate-600',
                                    },
                                    {
                                        icon: Sparkles,
                                        label: 'Upgrade / Plans',
                                        action: () => {
                                            setSheetOpen(false)
                                            window.location.href = '/pricing'
                                        },
                                        iconBg: 'bg-violet-50',
                                        iconColor: 'text-violet-600',
                                    },
                                ].map((item, idx) => (
                                    <button
                                        key={idx}
                                        onClick={item.action}
                                        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 ${item.iconBg} rounded-xl flex items-center justify-center`}>
                                                <item.icon size={15} className={item.iconColor} />
                                            </div>
                                            <span className="text-slate-700 font-semibold text-sm">{item.label}</span>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-300" />
                                    </button>
                                ))}

                                {/* Sign Out — prominent red button */}
                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-red-50 border border-red-100 active:bg-red-100 transition mt-2"
                                >
                                    <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                                        <LogOut size={15} className="text-red-600" />
                                    </div>
                                    <span className="text-red-600 font-bold text-sm">Sign Out</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}
