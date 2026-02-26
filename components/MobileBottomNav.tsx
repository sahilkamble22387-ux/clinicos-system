import React from 'react'
import { motion } from 'framer-motion'
import { Home, Users, UserRound, BarChart3, Sparkles } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { ViewMode } from '../types'
import { FeatureGate } from './FeatureGate'
import { Clinic } from '../types'

interface MobileBottomNavProps {
    view: ViewMode
    onNavigate: (view: ViewMode) => void
    waitingCount: number
    clinic: Clinic | null
    authResolved: boolean
}

export function MobileBottomNav({ view, onNavigate, waitingCount, clinic, authResolved }: MobileBottomNavProps) {
    const location = useLocation()
    const isPricingActive = location.pathname === '/pricing'

    const tabs = [
        { key: 'HOME' as ViewMode, icon: Home, label: 'Home' },
        { key: 'FRONT_DESK' as ViewMode, icon: Users, label: 'Desk' },
        { key: 'DOCTOR' as ViewMode, icon: UserRound, label: 'Doctor', badge: waitingCount },
        { key: 'ANALYTICS' as ViewMode, icon: BarChart3, label: 'Analytics' },
    ]

    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40"
            style={{
                paddingBottom: 'calc(var(--sab) + 8px)',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
            }}
        >
            <div className="flex justify-between items-center px-1 pt-2 pb-1">
                {tabs.map(tab => {
                    const active = view === tab.key && !isPricingActive

                    const tabBtn = (
                        <button
                            onClick={() => onNavigate(tab.key)}
                            className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all duration-200 relative"
                            style={{ WebkitTapHighlightColor: 'transparent', minWidth: '48px' }}
                        >
                            {/* Badge for Doctor Portal */}
                            {tab.badge !== undefined && tab.badge > 0 && (
                                <span className="absolute top-0 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center z-10">
                                    {tab.badge > 9 ? '9+' : tab.badge}
                                </span>
                            )}

                            {/* Icon container */}
                            <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${active ? 'bg-indigo-50 scale-110' : 'bg-transparent'
                                    }`}
                            >
                                <tab.icon
                                    size={18}
                                    className={active ? 'text-indigo-600' : 'text-slate-400'}
                                    strokeWidth={active ? 2.5 : 1.8}
                                />
                            </div>

                            {/* Label */}
                            <span className={`text-[9px] font-bold tracking-tight ${active ? 'text-indigo-600' : 'text-slate-400'
                                }`}>
                                {tab.label}
                            </span>

                            {/* Active dot indicator */}
                            {active && (
                                <motion.div
                                    layoutId="nav-dot"
                                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-indigo-600"
                                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                />
                            )}
                        </button>
                    )

                    if (tab.key === 'ANALYTICS') {
                        return (
                            <FeatureGate
                                key={tab.key}
                                feature="analytics"
                                clinicId={clinic?.id}
                                clinicName={clinic?.name}
                                authResolved={authResolved}
                            >
                                {tabBtn}
                            </FeatureGate>
                        )
                    }

                    return <React.Fragment key={tab.key}>{tabBtn}</React.Fragment>
                })}

                {/* Pricing / Plans tab */}
                <Link
                    to="/pricing"
                    className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all duration-200 relative"
                    style={{ WebkitTapHighlightColor: 'transparent', minWidth: '48px', textDecoration: 'none' }}
                >
                    <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${isPricingActive ? 'bg-indigo-50 scale-110' : 'bg-transparent'
                            }`}
                    >
                        <Sparkles
                            size={18}
                            className={isPricingActive ? 'text-indigo-600' : 'text-slate-400'}
                            strokeWidth={isPricingActive ? 2.5 : 1.8}
                        />
                    </div>
                    <span className={`text-[9px] font-bold tracking-tight ${isPricingActive ? 'text-indigo-600' : 'text-slate-400'
                        }`}>
                        Plans
                    </span>
                    {isPricingActive && (
                        <motion.div
                            layoutId="nav-dot"
                            className="absolute -bottom-1 w-1 h-1 rounded-full bg-indigo-600"
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                    )}
                </Link>
            </div>
        </nav>
    )
}
